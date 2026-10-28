#!/usr/bin/env bash
# TIER 2 — the product a bootstrap produces builds, deploys (dry) and serves.
#
# placement.test.sh proves the tree a bootstrap ends with is the right tree.
# This proves it WORKS, by doing to it what its own pipelines will:
#
#   1. at the 01-product landing (the commit its one pull request merges),
#      install with the lockfile the product ships, render the wrangler
#      fixture and check the committed config IS that render, typecheck,
#      lint, test, build. The landing's own PR runs `plan` alone (an
#      `orun/BASE-*` branch), so THIS is where a product those steps refuse
#      is caught: before the tag, not after a build has merged it;
#   2. the stage lane's own steps, rendered by `orun plan` in the product for
#      a pull request (the verify profile: the deploy profile has no dry run)
#      — `verify-app-structure` (which checks the wrangler config exists
#      BEFORE anything is built), `build-app` (the component's buildCommand:
#      the live wiring render, then the build), `verify-build-output` and
#      `deploy-dry-run` (`wrangler deploy --dry-run --name <reponame>-web-stage`).
#      They run IN THE TREE THE RUNNER STAGES for the job
#      (testing/lib/stage-job.py), with the dependency layout the pinned
#      composition produces, and with the stage wiring document in the job's
#      environment as the platform resolves it (the component's secretEnv) —
#      so the namespace id in the built config is asserted to be the
#      document's, not the fixture's;
#      The build runs with an E2B key in its environment, as a deploy lane
#      with the secret stored would: it must never reach the bundle (the
#      build strips it), and the Worker-secrets step must say it goes to
#      `<reponame>-web-stage` from the deploy lane — a verify lane holds no
#      Cloudflare credential and pushes nothing. The dry run's size must fit
#      Workers Free (3 MiB gzipped);
#   3. serve the built Worker with `wrangler dev`, its `AI` binding pointed at
#      a deterministic stand-in for Workers AI (testing/lib/fake-ai: Workers AI
#      has no local mode), and run the component's OWN `smokeCommand` against
#      it, verbatim — the check the real deploy ends with — and then every
#      route the product promises: the title and heading carry the product's
#      name and its bundle its repository link; /api/health reads the
#      namespace and finds the binding; a fragment streams from the default
#      Workers AI model through /api/chat with the fragment's JSON schema, the
#      route only the Worker answers; a vendor model with no key is refused
#      naming its secret; the sandbox says E2B is not connected; the rate
#      limit spends its window in the KV binding and answers 429; a share link
#      nobody published goes home; the assets are served, an unknown path is a
#      404.
#
# What it cannot do is the platform's half: create the repository, mint the
# brokered Cloudflare token, apply the namespace, push the secrets, deploy for
# real and probe workers.dev — nor a real model or a real E2B sandbox. The KV
# root is verified to `terraform validate` and its plan is part of every pull
# request's lanes; the apply needs an account.
#
# Needs: orun, node, pnpm, python3 (+PyYAML), git, curl, and the network for
# `pnpm install` and the build's Google Font (or a warm store). A few minutes:
# two installs and builds.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
# shellcheck source=lib/bootstrap.sh
source "$here/lib/bootstrap.sh"

for bin in orun node pnpm python3 git curl; do
  command -v "$bin" >/dev/null || { echo "e2e.test.sh needs $bin on PATH" >&2; exit 1; }
done

scratch="$(mktemp -d)"
dev_pid=""
# wrangler dev runs under pnpm, node and two workerd processes; a TERM to the
# first does not reach the rest, and waiting on it then never returns. So it is
# started as its own process group (setsid) and the whole group is stopped.
cleanup() {
  if [ -n "$dev_pid" ]; then
    kill -TERM -- "-$dev_pid" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 -- "-$dev_pid" 2>/dev/null || break; sleep 0.5; done
    kill -KILL -- "-$dev_pid" 2>/dev/null || true
  fi
  rm -rf "$scratch"
}
trap cleanup EXIT
values="$here/fixtures/acme.json"
repo="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['reponame'])" "$values")"
export CI=1 WRANGLER_SEND_METRICS=false NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1

# The landing's own checks, step for step — the ones the product's retired
# Checks workflow ran, run here at once on the whole tree. A product's pull
# requests verify through ci.yml's lanes (the page built — Next's build
# type-checks it — and dry-deployed per environment, the KV root planned),
# which neither lint nor run the tests, so before a tag THIS is where those
# are held.
LANDING_CHECKS=(
  "pnpm install --frozen-lockfile"
  "pnpm run wire:fixture"
  "git diff --exit-code"
  "pnpm typecheck"
  "pnpm lint"
  "pnpm test"
  "pnpm build"
)
checks() { # DIR LOG
  local dir="$1" log="$2" cmd
  for cmd in "${LANDING_CHECKS[@]}"; do
    echo "   \$ $cmd" | tee -a "$log"
    if ! (cd "$dir" && bash -c "$cmd") >> "$log" 2>&1; then
      echo "FAIL: \`$cmd\` failed in $dir" >&2; tail -40 "$log" >&2; return 1
    fi
  done
}

echo "── the offline bootstrap (testing/lib/bootstrap.sh)"
tree="$scratch/$repo"
bootstrap_offline "$root" "$tree" "$values" "$scratch/logs" > "$scratch/bootstrap.log" 2>&1 || {
  echo "FAIL: the offline bootstrap stopped" >&2; tail -40 "$scratch/bootstrap.log" >&2; exit 1; }
echo "   2 phases placed and landed"
s01="$(git -C "$tree" rev-parse HEAD~1)"

# ── 1. the product's one pull request ──────────────────────────────────────
echo "── 01-product's landing: install, the fixture render, typecheck, lint, test, build"
git -C "$tree" worktree add -q "$scratch/at-01" "$s01"
checks "$scratch/at-01" "$scratch/checks-01.log"
# The landing's build is done; its tree is not needed again, and the disk is shared.
git -C "$tree" worktree remove --force "$scratch/at-01"

# ── 2. the stage lane's steps, in the job's own tree ──────────────────────
echo "── the stage lane: verify-app-structure, build-app, verify-build-output, deploy-dry-run"
# A pull request that changes the page: the lane `orun plan` gives it.
git -C "$tree" checkout -q -b e2e-pr
echo "<!-- a change to the page's component -->" >> "$tree/apps/web/README.md"
git -C "$tree" -c user.email=e2e@example.invalid -c user.name=e2e commit -qam "a pull request"
(cd "$tree" && orun plan --intent intent.yaml --trigger github-pull-request --changed \
   --base main --head HEAD --env stage --output "$scratch/plan.json") > "$scratch/plan.log" 2>&1 \
  || { echo "FAIL: orun plan" >&2; tail -15 "$scratch/plan.log" >&2; exit 1; }
python3 - "$scratch/plan.json" "$scratch/steps" <<'PY'
import json, pathlib, sys
plan = json.load(open(sys.argv[1]))
out = pathlib.Path(sys.argv[2]); out.mkdir()
job = next(j for j in plan["jobs"] if j["component"] == "web" and j["environment"] == "stage")
for s in job["steps"]:
    if s["id"] in ("verify-app-structure", "build-app", "verify-build-output", "deploy-dry-run"):
        (out / f"{s['id']}.sh").write_text(s.get("run") or "")
    if s["id"] == "install-workspace-dependencies":
        (out / "install.sh").write_text(s.get("run") or "")
        (out / "install.wd").write_text(s.get("working-directory") or ".")
        (out / "install.scope").write_text(s.get("scope") or "job")
(out / "path").write_text(job.get("path") or "apps/web")
for k, v in (job.get("env") or {}).items():
    (out / "env").open("a").write(f"export {k}={json.dumps(v)}\n")
(out / "secrets").write_text("\n".join(r["asEnv"] for r in job.get("secretRefs") or []))
PY
# The job's private tree, staged as orun stages it. The source checkout
# carries no build output (nothing was built in it), and its dependencies are
# what the pinned composition says: a lane-scoped install ran once in the
# source tree and is linked in, or the job installs its own.
work="$tree/.orun/runs/e2e/web.stage.verify-deploy/work"
[ -f "$scratch/steps/install.sh" ] || { echo "FAIL: the stage lane has no install step" >&2; exit 1; }
if [ "$(cat "$scratch/steps/install.scope")" = lane ]; then
  (cd "$tree" && bash -e "$scratch/steps/install.sh") > "$scratch/install.log" 2>&1 \
    || { echo "FAIL: the lane's install step" >&2; tail -30 "$scratch/install.log" >&2; exit 1; }
  python3 "$here/lib/stage-job.py" "$tree" "$work" --shared-deps
  [ -L "$work/node_modules" ] || { echo "FAIL: the staged tree's node_modules is not the lane's symlink" >&2; exit 1; }
  echo "   staged: $(realpath --relative-to="$tree" "$work"); install scope: lane — node_modules → the source tree's"
else
  python3 "$here/lib/stage-job.py" "$tree" "$work"
  echo "   staged: $(realpath --relative-to="$tree" "$work"); install scope: job — installing inside it"
  echo "   ▸ install-workspace-dependencies"
  (cd "$work/$(cat "$scratch/steps/path")/$(cat "$scratch/steps/install.wd")" && bash -e "$scratch/steps/install.sh") \
    > "$scratch/install.log" 2>&1 || { echo "FAIL: the lane's install step" >&2; tail -30 "$scratch/install.log" >&2; exit 1; }
  [ -d "$work/node_modules" ] && [ ! -L "$work/node_modules" ] \
    || { echo "FAIL: the job's install did not land inside its own tree" >&2; exit 1; }
fi
[ ! -e "$work/apps/web/.open-next" ] || { echo "FAIL: the staged tree carries build output" >&2; exit 1; }
# What the platform resolves into the job before its first step: the wiring
# documents the KV root lease-published (the component's secretEnv). Ids no
# fixture carries, so the built config proves which one it was rendered from.
for env in stage prod; do
  key="WIRING_CLOUDFLARE_KV_$(echo "$env" | tr a-z A-Z)"
  grep -qx "$key" "$scratch/steps/secrets" || { echo "FAIL: the stage lane does not resolve $key" >&2; exit 1; }
done
export WIRING_CLOUDFLARE_KV_STAGE='{"app_kv_id":"5ca1ab1e5ca1ab1e5ca1ab1e0000a001","app_kv_title":"stg-'"$repo"'-app-kv-stage"}'
export WIRING_CLOUDFLARE_KV_PROD='{"app_kv_id":"5ca1ab1e5ca1ab1e5ca1ab1e0000a003","app_kv_title":"prod-'"$repo"'-app-kv-prod"}'
# An E2B key in the job's environment, as a deploy lane with the secret stored
# resolves it (optionalSecretEnv): a marker no source carries, so a bundle
# that held it would say so.
e2b_marker="e2b_e2e_$(python3 -c 'import secrets;print(secrets.token_hex(12))')"
export E2B_API_KEY="$e2b_marker"
for step in verify-app-structure build-app verify-build-output deploy-dry-run; do
  [ -f "$scratch/steps/$step.sh" ] || { echo "FAIL: the stage verify lane has no $step step" >&2; exit 1; }
  echo "   ▸ $step"
  # The runner's per-job environment: the job's env (intent environment
  # `env:`), its resolved secrets, and ORUN_ENVIRONMENT; the step runs in the
  # component's directory.
  if ! (cd "$work/$(cat "$scratch/steps/path")" && \
        { [ -f "$scratch/steps/env" ] && source "$scratch/steps/env"; true; } && \
        export ORUN_ENVIRONMENT=stage && bash -e "$scratch/steps/$step.sh") > "$scratch/$step.log" 2>&1; then
    echo "FAIL: the deploy lane's $step step" >&2; tail -40 "$scratch/$step.log" >&2; exit 1
  fi
done
grep -q '"5ca1ab1e5ca1ab1e5ca1ab1e0000a001"' "$work/apps/web/wrangler.jsonc" \
  || { echo "FAIL: the lane's build did not render the stage namespace id from its wiring document" >&2; exit 1; }
grep -Eq 'env\.KV \(5ca1ab1e5ca1ab1e5ca1ab1e0000a001\)' "$scratch/deploy-dry-run.log" \
  || { echo "FAIL: the dry run does not bind KV to the stage namespace" >&2; tail -20 "$scratch/deploy-dry-run.log" >&2; exit 1; }
grep -Eq 'env\.AI +AI' "$scratch/deploy-dry-run.log" \
  || { echo "FAIL: the dry run does not bind Workers AI as AI" >&2; tail -20 "$scratch/deploy-dry-run.log" >&2; exit 1; }
unset E2B_API_KEY
if grep -rlF "$e2b_marker" "$work/apps/web/.open-next" "$work/apps/web/.next" 2>/dev/null | head -1 | grep -q .; then
  echo "FAIL: the E2B key reached the build output" >&2; grep -rlF "$e2b_marker" "$work/apps/web/.open-next" "$work/apps/web/.next" | head -5 >&2; exit 1
fi
grep -q "E2B_API_KEY reach $repo-web-stage from the deploy lane" "$scratch/build-app.log" \
  || { echo "FAIL: the build did not hand the E2B key on to the deploy lane's secrets step" >&2; grep "worker-secrets" "$scratch/build-app.log" >&2; exit 1; }
gz="$(sed -n 's/.*Total Upload: .* gzip: \([0-9.]*\) KiB.*/\1/p' "$scratch/deploy-dry-run.log" | head -1)"
python3 -c "import sys; sys.exit(0 if float(sys.argv[1]) < 3072 else 1)" "${gz:-99999}" \
  || { echo "FAIL: the Worker is ${gz:-?} KiB gzipped — over Workers Free's 3 MiB" >&2; exit 1; }
echo "   the built config binds KV to the stage document's namespace id and AI to Workers AI; the dry run accepts it"
echo "   the E2B key never reached the bundle, and goes to $repo-web-stage from the deploy lane; ${gz} KiB gzipped"

# ── 3. serve it, and smoke it as the deploy does ───────────────────────────
echo "── wrangler dev over the built Worker: KV local, AI on the Workers AI stand-in"
[ ! -e "$work/apps/web/.dev.vars" ] || { echo "FAIL: the staged tree carries a .dev.vars" >&2; exit 1; }
# The ONE change to the config the lane built with: the AI binding becomes a
# service binding to the Workers AI stand-in. Everything else is the stage
# render build-app wrote.
python3 - "$work/apps/web/wrangler.jsonc" "$work/apps/web/wrangler.e2e.jsonc" <<'PY'
import re, sys
text = open(sys.argv[1]).read()
swapped, n = re.subn(r'"ai":\s*\{\s*"binding":\s*"AI"\s*\}',
                     '"services": [{ "binding": "AI", "service": "fake-workers-ai", "entrypoint": "FakeAI" }]', text)
if n != 1:
    sys.exit("FAIL: the built config does not bind Workers AI as `\"ai\": { \"binding\": \"AI\" }`")
open(sys.argv[2], "w").write(swapped)
PY
cp -r "$here/lib/fake-ai" "$scratch/fake-ai"
port=$(python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()")
(cd "$work/apps/web" && exec setsid pnpm exec wrangler dev -c wrangler.e2e.jsonc -c "$scratch/fake-ai/wrangler.jsonc" \
   --ip 127.0.0.1 --port "$port" --persist-to "$scratch/wrangler-state" \
   --show-interactive-dev-session=false) > "$scratch/dev.log" 2>&1 < /dev/null &
dev_pid=$!
url="http://127.0.0.1:$port"
for _ in $(seq 1 120); do
  curl -s -o /dev/null "$url/favicon.ico" && break
  kill -0 "$dev_pid" 2>/dev/null || { echo "FAIL: wrangler dev exited" >&2; tail -30 "$scratch/dev.log" >&2; exit 1; }
  sleep 1
done
curl -s -o /dev/null "$url/favicon.ico" || { echo "FAIL: wrangler dev never answered" >&2; tail -30 "$scratch/dev.log" >&2; exit 1; }

echo "   ▸ the component's own smokeCommand, DEPLOYED_URL=$url"
smoke="$(python3 -c "import yaml,sys;print(yaml.safe_load(open(sys.argv[1]))['spec']['parameters']['smokeCommand'])" "$tree/apps/web/component.yaml")"
DEPLOYED_URL="$url" bash -c "$smoke" || { echo "FAIL: the deploy's smoke refused the product" >&2; tail -20 "$scratch/dev.log" >&2; exit 1; }

echo "   ▸ every route the product promises, and a fragment written by the default model"
python3 - "$url" "$values" "$work/apps/web" <<'PY' || { echo "FAIL: the routes; wrangler dev said:" >&2; tail -40 "$scratch/dev.log" >&2; exit 1; }
import html, json, pathlib, re, sys, urllib.error, urllib.request
base, values, app = sys.argv[1], json.load(open(sys.argv[2])), pathlib.Path(sys.argv[3])
name, repo, org = values["productname"], values["reponame"], values["githuborg"]
problems = []
def bad(m): problems.append(m)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None
opener = urllib.request.build_opener(NoRedirect)
def req(method, path, body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(base + path, data=data, method=method,
                               headers={"content-type": "application/json", **(headers or {})})
    try:
        with opener.open(r, timeout=60) as resp:
            return resp.status, resp.headers, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read()

# The page: pre-rendered, served from the static assets, branded.
status, h, body = req("GET", "/")
page = body.decode()
if status != 200 or "</html>" not in page:
    bad(f"/ answered {status}")
title = re.search(r"<title>(.*?)</title>", page, re.S)
if not title or html.unescape(title.group(1)) != name:
    bad(f"the page's <title> is {title and title.group(1)!r}, not {name!r}")
h1 = re.search(r"<h1[^>]*>(.*?)</h1>", page, re.S)
if not h1 or not html.unescape(re.sub(r"<[^>]+>|<!-- -->", "", h1.group(1))).strip().startswith(name):
    bad(f"the navbar heading is {h1 and h1.group(1)!r}, not {name!r}")
if "ai-artifacts" in page:
    bad("the page still carries the baseline's slug")
# The source link lives in the client bundle (the menu opens it): some chunk
# the page loads must carry the product's repository, none the baseline's.
chunks = re.findall(r'src="(/_next/static/[^"]+\.js)"', page)
texts = [req("GET", c)[2].decode("utf-8", "replace") for c in chunks]
if not any(f"https://github.com/{org}/{repo}" in t for t in texts):
    bad(f"none of the {len(chunks)} chunks the page loads links github.com/{org}/{repo}")
if any("github.com/sourceplane/ai-artifacts" in t for t in texts):
    bad("a chunk still links the baseline's repository")

# Health: what the deploy's smoke and the bootstrap's probes read.
s, _, b = req("GET", "/api/health")
health = json.loads(b or b"{}")
if s != 200 or health.get("ok") is not True or health.get("kv") != "bound" or health.get("ai") != "bound":
    bad(f"/api/health answered {s} {health}")
if health.get("e2b") != "not connected":
    bad(f"/api/health says E2B is {health.get('e2b')!r} with no key stored")
default_model = (health.get("models") or {}).get("default")

models = json.loads((app / "lib/models.json").read_text())["models"]
wai = next(m for m in models if m["id"] == default_model)
openai = next(m for m in models if m["providerId"] == "openai")
def chat_body(model):
    return {"messages": [{"role": "user", "content": [{"type": "text", "text": "Add one and one in Python"}]}],
            "template": {"code-interpreter-v1": {}}, "model": model, "config": {"model": model["id"]}}

# THE ROUTE ONLY THE WORKER ANSWERS: a fragment, streamed through the AI
# binding with the fragment's schema, written by the default model.
s, h, b = req("POST", "/api/chat", chat_body(wai), {"cf-connecting-ip": "203.0.113.10"})
try:
    frag = json.loads(b)
except ValueError:
    frag = None
if s != 200 or not frag:
    bad(f"/api/chat answered {s}: {b[:200]!r}")
else:
    if frag.get("template") != "code-interpreter-v1" or frag.get("code") != "print(1 + 1)":
        bad(f"the streamed fragment is {frag}")
    if default_model not in frag.get("commentary", ""):
        bad(f"the fragment was not written by the default model {default_model}: {frag.get('commentary')!r}")

# A vendor model with no key at all: refused, naming the secret, before any request.
s, _, b = req("POST", "/api/chat", chat_body(openai), {"cf-connecting-ip": "203.0.113.11"})
if s != 401 or b"OPENAI_API_KEY" not in b:
    bad(f"an OpenAI model with no key answered {s}: {b[:160]!r}")

# The sandbox, with no E2B key: what to connect, not a crash.
s, _, b = req("POST", "/api/sandbox", {"fragment": frag or {}})
if s != 503 or b"E2B_API_KEY" not in b:
    bad(f"/api/sandbox with no E2B key answered {s}: {b[:160]!r}")

# The rate limit: ten requests a day per client, counted in the KV binding.
codes = [req("POST", "/api/chat", chat_body(wai), {"cf-connecting-ip": "198.51.100.77"})[0] for _ in range(11)]
if codes[:10] != [200] * 10 or codes[10] != 429:
    bad(f"one client's eleven requests answered {codes}; want ten 200s, then 429")

# A share link nobody published goes home; so does an id it never issues.
for link in ("/s/0000000", "/s/not-an-id"):
    s, h, _ = req("GET", link)
    loc = h.get("location") or ""
    if s != 302 or "/s/" in loc or not loc.endswith("/"):
        bad(f"{link} answered {s} → {loc!r}; want a redirect home")

for path, want, ctype in (("/favicon.ico", 200, "image/"), ("/thirdparty/logos/workers-ai.svg", 200, "image/svg+xml"),
                          ("/thirdparty/templates/code-interpreter-v1.svg", 200, "image/svg+xml"),
                          ("/no-such-page", 404, "text/html")):
    s, h, _ = req("GET", path)
    if s != want or not (h.get("content-type") or "").startswith(ctype):
        bad(f"{path} answered {s} {h.get('content-type')}, want {want} {ctype}")

if problems:
    for p in problems:
        print(f"  ✕ {p}", file=sys.stderr)
    sys.exit(1)
print(f"   / (the product's name and repository link), /api/health ok (KV, AI, E2B not connected),")
print(f"   a fragment streamed by {default_model} through the AI binding, an unkeyed vendor model refused,")
print(f"   the sandbox's notice, ten requests then 429, the short links home, the assets and a 404")
PY

echo "e2e.test.sh: ok"
