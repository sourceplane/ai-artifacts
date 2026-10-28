# ai-artifacts — decisions

The choices that shape this repository, one line each, with where the full
reasoning lives.

| # | Decision | Why | Source |
|---|---|---|---|
| 1 | One Worker for the whole app, E2B called from it | Both halves are HTTP (the AI SDK, the E2B SDK); a spike proved the E2B SDK bundles for workerd and reaches E2B's API | risks AA-A |
| 2 | Next.js 16 and AI SDK 7, `streamObject` + `experimental_useObject` kept | The reference stack; both calls survive the upgrade unchanged | IMPLEMENTATION-STATUS |
| 3 | Workers AI through the `AI` binding is the default model (a JSON-mode model) | A fresh product writes fragments with no key; the fragment is a structured object | `apps/web/lib/models.ts`, risks AA-B |
| 4 | Every other key is an optional Orun secret handed to the Worker as a Worker secret; none is a bundle value or a build variable | A product deploys before its owner has any account; a key never reaches the bundler's cache | `apps/web/component.yaml`, `tooling/wire/worker-secrets.mjs` |
| 5 | Upstash and Vercel KV become one Workers KV namespace (a fixed window, `fragment:<id>` links) | One binding, one Terraform root; the limit is a cost guard | design.md, risks AA-D |
| 6 | Vertex AI, Ollama, Supabase sign-in and the analytics are left out | None fits a Worker or is needed to write and run a fragment | IMPLEMENTATION-STATUS |
| 7 | `/api/health` is read-only | A public route that wrote would spend the namespace's daily write allowance | `apps/web/app/api/health/route.ts` |
| 8 | Only the dev server opens wrangler's platform proxy; the build copies the static-assets cache itself | The AI binding has no local mode, so the proxy needs a Cloudflare login; a build must need none | `apps/web/next.config.mjs`, `apps/web/scripts/populate-static-assets-cache.mjs` |
| 9 | The namespace id reaches the Worker through the wiring document, rendered per environment; `wrangler.jsonc` is committed as the fixture render | The deploy-time render every binding in this programme uses; the deploy lane checks the config exists before it builds | `apps/web/wrangler.template.jsonc` |
| 10 | One landing (`01-product`) then the record (`02-docs`); `web` → `cloudflare-kv` enforced on main, advisory on a pull request | The plan, not a landing boundary, orders the namespace before the Worker | `repo-blueprint.yaml` |
| 11 | Two brokered secrets: `workers-deploy` applies the namespace and deploys the Worker | That token covers KV Storage write | `blueprint.yaml` |
| 12 | The product's name and source link come from one seam (`apps/web/lib/site.ts`); upstream's name stays as its credit | The rename rewrites one literal | `tooling/rebrand/rebrand.mjs` |
| 13 | stack-tectonic 0.19.0, not 0.20.0 | 0.20.0's lane-scoped install is refused by Next 16's Turbopack | `intent.yaml` |
| 14 | The console asks for no domain and reads `subdomain` from the Cloudflare connection | The site goes live on workers.dev; the subdomain belongs to the account | `blueprint.yaml` |
| 15 | Upstream's code is kept as written; the lint rules eslint-config-next 16 added after it are off by name | A port, not a rewrite | `apps/web/eslint.config.mjs` |
