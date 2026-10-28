# ai-artifacts

E2B's [Fragments](https://github.com/e2b-dev/fragments) — an open-source
take on Claude's Artifacts, v0 and GPT Engineer: describe an app or an
analysis, a model writes it as a *fragment* (its code, the stack it runs on
and its dependencies) streamed into the page, and E2B runs it in a cloud
sandbox — a Python cell's output and charts, or a live Next.js, Vue,
Streamlit or Gradio preview — running on **one Cloudflare Worker + Static
Assets** built by [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare).
Its default model is **Workers AI**, called through the Worker's own binding
with no key; its rate limits and the published previews' short links are in
a **Workers KV** namespace provisioned by Terraform through
[Orun](https://github.com/sourceplane/orun), and packaged as an **Orun
baseline**: one command takes a new product from nothing to live on stage and
prod, in its own repository, under its own name — in ONE landing.

Both of Fragments' halves are HTTP — the AI SDK's `streamObject` and the E2B
SDK's REST and streaming calls — so the whole app is one Worker (a spike
proved the E2B SDK bundles for workerd and reaches E2B's API from it). A
fresh deployment writes fragments with nothing configured; running them
needs an E2B API key, and every vendor model needs its own key, each an
optional secret. What the baseline adds is everything needed to make a copy
of it somebody else's, built the way
[cirrus-baseline](https://github.com/sourceplane/cirrus-baseline) is since
its one-landing bootstrap. See
[`specs/epics/ai-artifacts`](specs/epics/ai-artifacts/README.md) for the
design, the milestones and the as-built status.

## Instantiating a product

```bash
git clone --depth 1 --branch <baseline-tag> https://github.com/sourceplane/ai-artifacts
cd ai-artifacts
orun new --blueprint repo-blueprint.yaml --out ~/sites/acme-builder --run-hooks --resume \
  --set reponame=acme-builder --set productname="Acme Builder" \
  --set githuborg=acme-inc --set subdomain=<workers-dev-subdomain>
```

Or, once the platform's registry lists it, from the Orun console (Baselines →
`ai-artifacts` → Build). Two phases: **`01-product`** creates the repository
and lands the whole product as ONE pull request — intent, CI, tooling, the KV
root, the app and its tests — and one convergence applies the KV namespace on
stage and prod and then deploys the app with its id; **`02-docs`** records
the live deployment from probed facts. **[BOOTSTRAP.md](BOOTSTRAP.md)** is the
operator guide; [docs/phases/](docs/phases/README.md) has a page per phase.
The product goes live writing fragments with Workers AI; its owner stores an
E2B key (and any vendor model key) afterwards.

The new repository receives the **product only** — the app, its KV root, its
tests, its CI, its tooling, a README and an `AGENTS.md` of its own and its
operating contract — renamed throughout to the product's name, repository,
Cloudflare Worker and namespace titles. None of this repository's machinery
ships.

| What makes it a baseline | Where |
|---|---|
| The console card (inputs, secrets, programme) | `blueprint.yaml` |
| The build document (modules, phases, hooks) | `repo-blueprint.yaml` |
| This tree's identity, and the bootstrap's task contracts | `.baseline/` |
| The rename engine | `tooling/rebrand/rebrand.mjs` |
| The bootstrap's helpers (deferrals, redeploy marker, work-tree strip) | `tooling/bootstrap/` |
| The component docs generator | `tooling/catalog/gen-component-docs.py` |
| The deployment-record renderer | `hooks/render-deployment-docs.sh` |
| The product's README, its `AGENTS.md` and its context pack | `.baseline/product/`, `ai/context/` |
| The baseline's tests: contract, wiring, leak, offline bootstrap, end to end (a Workers AI stand-in) | `testing/`, `.github/workflows/baseline.yml` |
| Cutting a `baseline-vN` tag | `.github/workflows/tag.yml` |

## What is here (the product)

| Surface | Where |
|---|---|
| The page, the chat, the picker, the settings, the preview | `apps/web/app/page.tsx`, `apps/web/components` |
| The model call — a fragment streamed as a structured object | `apps/web/app/api/chat/route.ts`, `app/api/morph-chat/route.ts` (Morph's apply-edit mode) |
| The stacks (personas) and the fragment's schema | `apps/web/lib/templates.ts`, `apps/web/lib/schema.ts` |
| The models: Workers AI first, vendor models behind their keys | `apps/web/lib/models.ts`, `apps/web/lib/models.json` |
| Running a fragment in E2B | `apps/web/app/api/sandbox/route.ts`, `apps/web/lib/e2b.ts` |
| The rate limit and the share links, in KV | `apps/web/lib/ratelimit.ts`, `lib/links.ts`, `app/actions/publish.ts`, `app/s/[id]/route.ts` |
| The product's name and source link | `apps/web/lib/site.ts` |
| What the deploy's smoke reads | `apps/web/app/api/health/route.ts` |
| Workers build, bindings and deploy contract | `apps/web/next.config.mjs`, `open-next.config.ts`, `wrangler.template.jsonc` + `wiring.fixture.json` (→ the committed `wrangler.jsonc`), `component.yaml` |
| The KV namespace (stage, prod) | `infra/terraform/cloudflare-kv` |
| The wrangler renderer, the Worker-secrets helper | `tooling/wire` |
| Tests | `tests/web` (the models, the routes, the rate limit, the links — against in-memory bindings, no network) |

## Getting started

```bash
pnpm install
pnpm run wire:fixture   # render apps/web/wrangler.jsonc from the offline fixture
pnpm typecheck
pnpm lint
pnpm test
pnpm build              # next build + opennextjs-cloudflare build → apps/web/.open-next
```

```bash
cp apps/web/.dev.vars.example apps/web/.dev.vars   # optional keys, all may stay empty
pnpm --filter @app/web dev       # http://localhost:3000 — the bindings through wrangler's platform proxy
pnpm --filter @app/web preview   # wrangler dev over the built Worker
```

Workers AI has no local mode: `next dev`, `preview` and `wrangler dev` reach
it on your account, so run `pnpm exec wrangler login` first (a build needs no
credential — only the dev server opens the platform proxy). The KV namespace
is local under both.

## Connecting E2B

Fragments are written without E2B; running one needs an
[E2B API key](https://e2b.dev/dashboard?tab=keys). Store it as the product's
Orun secret `E2B_API_KEY` for an environment and redeploy it: the build hands
it to the Worker as a Worker secret (`tooling/wire/worker-secrets.mjs`, the
value over stdin, never in a bundle). Until then the sandbox route answers
"E2B is not connected", the page shows that beside the code, and the code is
ready to copy. The five stacks are E2B's public sandbox templates
(`code-interpreter-v1`, `nextjs-developer`, `vue-developer`,
`streamlit-developer`, `gradio-developer`), hosted by E2B. Locally, put the
key in `apps/web/.dev.vars`.

Removing an Orun secret does not remove the Worker's copy: delete it with
`wrangler secret delete E2B_API_KEY --name <worker>` too.

## Connecting a model provider

The picker lists every model upstream lists, Workers AI's first. A Workers
AI model answers with the Worker's own account; a vendor model is sent with
the key the visitor types in the settings (as upstream allows) or, without
one, with the server's — an optional Orun secret per provider, pushed to the
Worker the same way:

| Provider | Secret |
|---|---|
| OpenAI | `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| Google AI | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Mistral | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Together AI | `TOGETHER_API_KEY` |
| Fireworks | `FIREWORKS_API_KEY` |
| xAI | `XAI_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| Morph (the apply-edit mode) | `MORPH_API_KEY` |

A vendor model with neither key is refused with the secret to add, before
any request leaves the Worker. Requests sent with the server's keys — and
every Workers AI request — are limited per client IP, 10 a day unless
`RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW` (upstream's variables, set
as `vars` in `wrangler.template.jsonc`) say otherwise.

## How it maps to Vercel

| Vercel-side | Here |
|---|---|
| Next.js 14 hosting, `maxDuration` routes | One Cloudflare Worker (`.open-next/worker.js`) + Static Assets, Next.js 16; the routes stream |
| AI SDK 3 (`streamObject`, `experimental_useObject`) | AI SDK 7 and `@ai-sdk/react` 4 — the same two calls |
| A vendor key for every model | **Workers AI** through the `AI` binding (`workers-ai-provider`, the schema sent as JSON mode), the default, no key; vendor models behind the visitor's key or an optional server key |
| `E2B_API_KEY` environment variable | An optional Orun secret → Worker secret; without it fragments are written, not run |
| `@upstash/ratelimit` on Vercel KV (`KV_REST_API_URL`) | A fixed window per client IP in the `KV` binding (`lib/ratelimit.ts`) |
| Vercel KV share links + `/s/:id` middleware | `fragment:<id>` keys in the `KV` binding, `/s/[id]` a route handler; the link is on the visitor's own origin, not `NEXT_PUBLIC_SITE_URL` |
| Supabase sign-in and teams, PostHog, Vercel Analytics, Google Tag Manager | Left out; the account menu keeps its links |
| Vertex AI, Ollama | Left out: a service-account file and a local server do not fit a Worker |
| Deploy on push | Orun applies the namespace and deploys `<repo>-web-{stage,prod}` on merge to `main`, smoke-tested on `/api/health` |
| "Deploy with Vercel" (clone the template) | `orun new --blueprint repo-blueprint.yaml` — a new repository, branded, deployed |

## How the namespace reaches the Worker

```
infra/terraform/cloudflare-kv ──apply──► orun secret WIRING_CLOUDFLARE_KV (stage, prod)
                                               ▼
apps/web  dependsOn cloudflare-kv (enforced on main) · secretEnv WIRING_CLOUDFLARE_KV_<ENV>
  build:  tooling/wire/live.mjs → wrangler.jsonc with the environment's namespace id
          (dev, verify-only, renders the fixture) → next build → opennextjs-cloudflare
          → each stored key to the Worker as a secret (worker-secrets.mjs)
  smoke:  / renders to </html>; /api/health reads the namespace and finds the AI binding
```

`wrangler.jsonc` is committed as the fixture render of
`wrangler.template.jsonc`, because the deploy lane's `verify-app-structure`
step checks the config exists before it builds.

## CI

| Workflow | What it runs | Ships to a product |
|---|---|---|
| `ci.yml` | the Orun pipeline, and the only workflow a product carries: `orun plan --changed`, then one job per lane. A pull request runs the verify lanes (the KV root planned for stage and prod, the app built and dry-deployed per environment), except the bootstrap's own landings (`orun/BASE-*`), where `plan` alone runs and nothing waits for it (the landing checked its commit in the box); a merge applies the KV namespace, then deploys stage → prod. It plans nothing while `intent.yaml` names the placeholder workspace `ws_CHANGE_ME`, as this repository does. A manual run (Orunbase's Deploy button, or Run workflow on `main`) plans the environment and components it names under the push-to-main trigger, so they deploy as a merge deploys them | yes |
| `baseline.yml` | the baseline's own tiers: contract tests, the wiring path, the blueprint read by the pinned orun, the leak gate, the offline bootstrap with the product's own plan, the product built in the job tree, dry-deployed and served — a fragment streamed through the chat route from a Workers AI stand-in, the deploy's own smoke passed | no |
| `tag.yml` | cuts a `baseline-vN` tag (manual) | no |

Fragments is © FoundryLabs, Inc. (E2B), under the Apache License 2.0
(`apps/web/LICENSE`).
