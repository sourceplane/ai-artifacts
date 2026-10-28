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
[Orun](https://github.com/sourceplane/orun).

Both of Fragments' halves are HTTP — the AI SDK's `streamObject` and the E2B
SDK's REST and streaming calls — so the whole app is one Worker (a spike
proved the E2B SDK bundles for workerd and reaches E2B's API from it). A
fresh deployment writes fragments with nothing configured; running them
needs an E2B API key, and every vendor model needs its own key, each an
optional secret. See [`specs/epics/ai-artifacts`](specs/epics/ai-artifacts/README.md)
for the design, the milestones and the as-built status.

## What is here

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
| "Deploy with Vercel" (clone the template) | An Orun baseline — once it is one |

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

`ci.yml` is the Orun pipeline: `orun plan --changed`, then one job per lane.
A pull request runs the verify lanes (the tests, the KV root planned, the
Worker built and dry-deployed per environment); a merge applies the
namespace, then deploys stage → prod. It plans nothing while `intent.yaml`
names the placeholder workspace `ws_CHANGE_ME`, as this repository does. A
manual run (Orunbase's Deploy button, or Run workflow on `main`) plans the
environment and components it names under the push-to-main trigger.

Fragments is © FoundryLabs, Inc. (E2B), under the Apache License 2.0
(`apps/web/LICENSE`).
