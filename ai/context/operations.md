# ai-artifacts — operating contract (for humans and agents)

This is the standing guide to how this site is deployed and operated.
Instance facts (live URLs, workspace, the secrets it uses) live in
[deployment.md](deployment.md), rendered from probed reality by the
bootstrap's `02-docs` phase; this file is the contract that stays true
between deployments. It is written to give an agent with repository read
access enough context to reason about and operate the site without any
other source.

## What this system is

An AI app generator on Cloudflare — a model writes a fragment (code, stack,
dependencies) and E2B runs it in a cloud sandbox — expressed as an Orun
component-native desired-state repo.

- **`infra/terraform/cloudflare-kv`** — one Workers KV namespace per deployed
  environment (`stage`, `prod`), applied by Terraform. After each apply it
  publishes a wiring document — `{app_kv_id, app_kv_title}` — as the Orun
  secret `WIRING_CLOUDFLARE_KV` on that environment.
- **`apps/web`** — the app: Next.js built by `@opennextjs/cloudflare` into
  one Worker plus Static Assets. The page is pre-rendered and runs in the
  browser; `/api/chat` streams a fragment from a model (Workers AI through
  the `AI` binding by default, a vendor API with a key), `/api/sandbox` runs
  it on E2B, and the `KV` binding holds the rate-limit windows
  (`ratelimit:<ip>:<window>`) and the share links (`fragment:<id>`).
  `/api/health` is what the deploy's smoke reads.
- **`tests/web`** — the models, the routes, the rate limit and the links
  against in-memory bindings (vitest), verified on the `dev` rung.
- **`tooling/*`** — shared TypeScript and ESLint configuration, the wrangler
  renderer that turns `wrangler.template.jsonc` plus a wiring document into
  `wrangler.jsonc`, and the helper that hands the stored keys to the Worker
  as secrets.

Environments: **`stage`** and **`prod`** are deployed; **`dev` is
verify-only by design** — lanes build and test, nothing deploys, and no KV
namespace exists for it (its build renders the committed fixture).

## Identity and tenancy

Every remote operation runs against ONE Orun workspace, declared in
`intent.yaml` under `execution.state.workspace` — committed, enforced, and
what CI uses. Do not remove it; headless credentials depend on it. If it
reads `ws_SET_ME`, the bootstrap had no workspace to write: set the real one
before anything else.

## How deployment works

1. Merge (or push) to `main`.
2. CI (`.github/workflows/ci.yml`) runs `orun plan --changed` — only
   components whose files changed are planned — then runs each planned lane
   with `orun run --remote-state`, authenticated by GitHub OIDC (the
   exchange resolves this repository's linked workspace server-side).
3. **The namespace before the Worker.** `cloudflare-kv` applies for the
   environment and publishes `WIRING_CLOUDFLARE_KV`. `apps/web` declares an
   enforced `dependsOn` on it for pushes to `main`, so its deploy starts only
   after that apply — and a job resolves its secrets when it starts, so the
   document is there.
4. `apps/web` renders `wrangler.jsonc` from that document (the real
   namespace id), builds once per environment, `wrangler deploy` ships
   `ai-artifacts-web-<env>` — first handing it every key the environment
   has as a Worker secret — and a smoke test fetches `/` and `/api/health`,
   which must answer `"ok":true`: the namespace read through its binding and
   the AI binding found.
5. `prod` deploys after `stage` has converged on the same commit
   (`environments.prod.promotion` in intent.yaml).
6. **The convergence run is the deployment.** A green run means every
   planned lane applied. Failed lanes are retried with
   `gh run rerun --failed`, which resumes the same execution.

On a pull request nothing applies or deploys: the KV root plans, the app
builds and dry-deploys, and the edges in step 3 are advisory.

Caveats that matter:

- A push that touches no component files plans zero lanes — that run is
  green and deployed nothing. Never treat "latest run green" as "site
  converged"; probe the URLs instead.
- A change to `intent.yaml`'s `environments` maps to no component and
  redeploys nothing on its own. Land it with a change under `apps/web`.
- `wrangler.jsonc` is generated. Edit `wrangler.template.jsonc`, run
  `pnpm run wire:fixture` and commit both; the deploy renders its own
  config from the template, so a stale committed render misleads local work.

## Secrets model

- **Brokered provider secrets**: `CLOUDFLARE_API_TOKEN` (the
  `workers-deploy` scope: Workers Scripts and KV Storage write) and
  `CLOUDFLARE_ACCOUNT_ID` — pointers minted per run from the workspace's
  Cloudflare connection. No long-lived values at rest; nothing to rotate by
  hand. The KV root and the Worker deploy use the same two.
- **Wiring**: `WIRING_CLOUDFLARE_KV` on `stage` and `prod`, written by the
  KV root's apply (lease-published), read by the Worker's build as
  `WIRING_CLOUDFLARE_KV_<ENV>`. It holds ids, not credentials.
- **The app's keys, all optional**: `E2B_API_KEY` (running a fragment),
  `MORPH_API_KEY` (the apply-edit mode) and one per vendor model provider
  (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`,
  `MISTRAL_API_KEY`, `GROQ_API_KEY`, `TOGETHER_API_KEY`, `FIREWORKS_API_KEY`,
  `XAI_API_KEY`, `DEEPSEEK_API_KEY`), stored by you per environment. The
  build resolves the ones that exist (a missing one is skipped, not an
  error), keeps them out of the bundle (`env -u`) and hands them to the
  Worker with `wrangler secret bulk` before the deploy. Without any of them
  the app writes fragments with Workers AI and says E2B is not connected.
- Inspect by NAME only: `orun secrets list --org <ws> --project` and
  `--env stage|prod`. No tooling in this repository prints a secret value,
  and no document in `ai/context/` may contain one.

## Verifying the system

```bash
# the health check on each environment (also recorded, probed, in
# deployment.md): the namespace, the AI binding, and which keys are connected
curl -s https://ai-artifacts-web-stage.your-workers-subdomain.workers.dev/api/health
curl -s -o /dev/null -w '%{http_code}\n' https://ai-artifacts-web-prod.your-workers-subdomain.workers.dev/

# the wiring the deploys read, and workspace readiness
orun secrets list --org <ws> --env stage && orun secrets list --org <ws> --env prod
orun integrations list --org <ws> --json && orun cloud check --org <ws>
```

## Common operations

| task | how |
|---|---|
| change the app | edit `apps/web/app/page.tsx` and `apps/web/components` (its name and source link: `apps/web/lib/site.ts`), merge |
| add or change a stack | `apps/web/lib/templates.ts` — each entry names an E2B sandbox template, its libraries, file and port |
| change the models | `apps/web/lib/models.json`; the default is `DEFAULT_MODEL_ID` in `apps/web/lib/models.ts`, which must stay a Workers AI model with JSON mode |
| connect E2B or a model provider | `orun secrets set E2B_API_KEY --org <ws> --env <env>` (or the provider's key, README), then deploy that environment by hand |
| remove a key | `orun secrets revoke <KEY> --org <ws> --env <env>` and `wrangler secret delete <KEY> --name ai-artifacts-web-<env>` — the Worker keeps its copy until then |
| deploy a change | merge to `main`; watch the run; failed lanes → `gh run rerun --failed` |
| deploy by hand | Orunbase's Deploy button, or `gh workflow run ci.yml --ref main -f environment=<env> [-f component=<a,b>]` — the named components (blank: every one) run in that environment as a merge runs them; started off `main` it is refused |
| redeploy without a change | edit the last line of `apps/web/component.yaml` (`# orun: redeploy <reason> <stamp>`) and merge — it is a deploy trigger, nothing reads it |
| add a binding (R2, D1, another KV) | a Terraform root under `infra/terraform/` that publishes `WIRING_<ROOT>`, a token in `wrangler.template.jsonc`, its fixture entry, the root in the build's `--components`, the `WIRING_<ROOT>_<ENV>` secretEnv and an enforced `dependsOn` on it in `apps/web/component.yaml` |
| lift a rate limit early | `wrangler kv key list --namespace-id <id> --prefix ratelimit: --remote`, then `wrangler kv key delete <key> --namespace-id <id> --remote` (the id is in the environment's `WIRING_CLOUDFLARE_KV`) |
| change the limit | `RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW` as `vars` in `apps/web/wrangler.template.jsonc` (render, commit, merge) |
| serve a custom domain | attach it to the Worker in Cloudflare (README, "Custom domain"), then replace the placeholder `ai-artifacts.example.com` in `intent.yaml`'s `BASE_DOMAIN` with it |
| add a runtime secret of your own | `orun secrets set <KEY> --org <ws> --env <env>`, its ref under `optionalSecretEnv` in `apps/web/component.yaml` and a `--secret <KEY>` (and `-u <KEY>`) in its `buildCommand` |
| headless credentials | `ORUN_TOKEN` (workspace-scoped) + `GITHUB_TOKEN` |

The deployment record is the bootstrap's `02-docs` phase. Re-running it (the
Orun console's Retry on that phase, or `orun new … --phase 02-docs`)
re-probes the URLs and re-renders [deployment.md](deployment.md); it is
idempotent.

## Evolution

An exact rate limit is the Workers Rate Limiting binding or a Durable
Object: KV is eventually consistent, so the window is approximate across
locations. Saved chats and sign-in (upstream's optional Supabase) would be a
new data component — D1 or Postgres — of their own. Structural changes follow
the same
contract that deployed the site: add a component under `apps/`, `infra/` or
`packages/` with a `component.yaml`, land it as a pull request, and the
convergence run applies it.
