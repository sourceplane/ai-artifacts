# ai-artifacts

An AI app generator — describe an app or an analysis, a model writes it as a
*fragment* (its code, the stack it runs on and its dependencies) streamed into
the page, and [E2B](https://e2b.dev) runs it in a cloud sandbox: a Python
cell's output and charts, or a live Next.js, Vue, Streamlit or Gradio preview.
E2B's [Fragments](https://github.com/e2b-dev/fragments) on **Cloudflare
Workers + Static Assets** through
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare), its default
model **Workers AI** (no key), its rate limits and share links in a **Workers
KV** namespace that Terraform provisions per environment.

Building on it with an agent? Start it at [AGENTS.md](AGENTS.md): what to
read first, how a change lands, and what not to touch.

## Live deployment

<!-- 02-docs:begin -->
Not recorded yet. The bootstrap's last phase writes the live URLs, the
workspace and the secrets the site uses into
[ai/context/deployment.md](ai/context/deployment.md); how the site deploys
and how to operate it is in
[ai/context/operations.md](ai/context/operations.md).
<!-- 02-docs:end -->

## What is here

| Surface | Where |
|---|---|
| The page, the chat, the picker, the settings, the preview | `apps/web/app/page.tsx`, `apps/web/components` |
| The model call — a fragment streamed as a structured object | `apps/web/app/api/chat/route.ts`, `apps/web/app/api/morph-chat/route.ts` |
| The stacks and the fragment's schema | `apps/web/lib/templates.ts`, `apps/web/lib/schema.ts` |
| The models: Workers AI first, vendor models behind their keys | `apps/web/lib/models.ts`, `apps/web/lib/models.json` |
| Running a fragment in E2B | `apps/web/app/api/sandbox/route.ts`, `apps/web/lib/e2b.ts` |
| The rate limit and the share links, in KV | `apps/web/lib/ratelimit.ts`, `apps/web/lib/links.ts`, `apps/web/app/s/[id]/route.ts` |
| The site's name and source link | `apps/web/lib/site.ts` |
| What the deploy's smoke reads | `apps/web/app/api/health/route.ts` |
| Workers build, bindings and deploy contract | `apps/web/next.config.mjs`, `open-next.config.ts`, `wrangler.template.jsonc` + `wiring.fixture.json` (→ `wrangler.jsonc`), `component.yaml` |
| The KV namespace (stage, prod) | `infra/terraform/cloudflare-kv` |
| Tests | `tests/web` (vitest, against in-memory bindings) |

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
pnpm exec wrangler login                           # Workers AI has no local mode
pnpm --filter @app/web dev        # http://localhost:3000 — the bindings through wrangler's platform proxy
pnpm --filter @app/web preview    # wrangler dev over the built Worker
```

Make it yours in `apps/web/app/page.tsx` and `apps/web/components`, its name
and the repository it links to in `apps/web/lib/site.ts`, and its stacks in
`apps/web/lib/templates.ts`.

## Connecting E2B

Fragments are written without E2B; running one needs an
[E2B API key](https://e2b.dev/dashboard?tab=keys). Store it as the Orun
secret `E2B_API_KEY` for an environment (`orun secrets set E2B_API_KEY
--env prod`) and redeploy that environment (Deploy by hand, below): the
build hands it to the Worker as a Worker secret, the value over stdin, never
in a bundle. Until then the page says "E2B is not connected" beside the code,
and the code is ready to copy. Locally, put the key in `apps/web/.dev.vars`.
Removing the Orun secret does not remove the Worker's copy: delete it with
`wrangler secret delete E2B_API_KEY --name ai-artifacts-web-<env>` too.

## Connecting a model provider

The picker lists Workers AI's models first; they answer with the Worker's own
account and need nothing. A vendor model is sent with the key the visitor
types in the settings or, without one, with the server's — an optional Orun
secret, pushed to the Worker the same way:

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

A vendor model with neither key is refused with the secret to add. Requests
sent with the server's keys, and every Workers AI request, are limited per
client IP: 10 a day unless `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW`
are set as `vars` in `apps/web/wrangler.template.jsonc`.

## How the namespace is wired

The Worker binds the namespace as `KV`. Its id is never hand-written:
`apps/web/wrangler.template.jsonc` names it as a wiring token, and
`wrangler.jsonc` is that template rendered — from `wiring.fixture.json`
(placeholder ids) for local work and verification, and on every deploy from
the document the `cloudflare-kv` Terraform root publishes after its apply
(`WIRING_CLOUDFLARE_KV`, per environment). Edit the template, then
`pnpm run wire:fixture` and commit the render with the template.

KV is eventually consistent: two locations can each let a few requests
through at the edge of a rate-limit window. The limit is a cost guard, not an
exact quota.

## How it deploys

Merges to `main` converge through [Orun](https://github.com/sourceplane/orun):
`.github/workflows/ci.yml` plans the changed components and runs each lane
against the workspace in `intent.yaml`. The KV namespace applies first, then
the app builds with that environment's namespace id and deploys — to
`stage`, then to `prod` once stage has converged on the same commit; `dev`
only verifies. The Worker is `ai-artifacts-web-<env>` on your account's
workers.dev subdomain, and every deploy is smoke-tested over HTTP: the page
must render and `/api/health` must answer ok, its KV namespace read and its AI
binding found. A pull request runs the same pipeline's verify lanes, with
nothing applied or deployed: the KV namespace planned for stage and prod, and
the app built and dry-deployed for each environment. They do not run the
tests or the linter — run those before you push (Getting started, above).

The pipeline holds one credential, GitHub's own `GITHUB_TOKEN`. The
Cloudflare token and account id are brokered per run from the workspace's
Cloudflare connection, the namespace ids travel as Orun secrets, and the E2B
and model keys are Orun secrets you store; nothing provider-shaped is stored
in the repository or in GitHub.

**Deploy by hand.** Orunbase's **Deploy** button on a component, or **Run
workflow** on the CI workflow in GitHub's Actions tab (on `main`), runs
`ci.yml` for the environment and components you pick, and each one deploys
exactly as a merge would deploy it. Leave the component blank to redeploy
every component in that environment, with nothing changed: after storing or
rotating a key, say. A component with nothing to run in that environment (a
test suite in `prod`) is left out with a notice.

## Custom domain

The site answers on workers.dev from its first deploy. To serve it on your
own domain, add the domain to the Cloudflare account the site deploys into
and attach it to the Worker (dashboard → Workers & Pages →
`ai-artifacts-web-prod` → Settings → Domains & Routes → Add → Custom
domain). The page builds its share links from the request it is answering,
so nothing else has to change; the repository names the domain in one place,
`BASE_DOMAIN` in `intent.yaml`, which the site was born with as the reserved
placeholder `ai-artifacts.example.com`. Replace it with your domain in the
same change that records it.

## Credits

Fragments is © FoundryLabs, Inc. (E2B), under the Apache License 2.0
(`apps/web/LICENSE`).
