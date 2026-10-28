# Implementation status — ai-artifacts

As built, kept apart from the plan.

| Milestone | Status | PR |
|---|---|---|
| AA0 — the spec | ✅ Shipped | [#1](https://github.com/sourceplane/ai-artifacts/pull/1) |
| AA1 — the app on Workers | ✅ Shipped | [#2](https://github.com/sourceplane/ai-artifacts/pull/2) |
| AA2 — the KV namespace | ✅ Shipped | [#3](https://github.com/sourceplane/ai-artifacts/pull/3) |
| AA3 — ready to instantiate | ✅ Shipped | [#4](https://github.com/sourceplane/ai-artifacts/pull/4) |
| AA4 — a baseline | not started | |

## Departures from upstream (e2b-dev/fragments at `3b11c7f`)

| Upstream | As built | Why |
|---|---|---|
| Next.js 14, React 18, AI SDK 3 | Next.js 16.3.8, React 19, AI SDK 7 + `@ai-sdk/react` 4 | The reference stack; `streamObject` and `experimental_useObject` carry over unchanged. `maxTokens` is passed as `maxOutputTokens` |
| Vercel hosting | One Worker + Static Assets through `@opennextjs/cloudflare`, the page pre-rendered and served from the static-assets incremental cache (`scripts/populate-static-assets-cache.mjs`, because `populateCache local` opens the platform proxy and the AI binding has no local mode) | Workers |
| A vendor key for every model; Claude the default | Workers AI the default (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`, a JSON-mode model, plus Llama 4 Scout), through the `AI` binding | A fresh deployment writes fragments with no key |
| Vertex AI, Ollama | Left out | A service-account file and a local server do not fit a Worker |
| Server keys read from the environment; a missing key failed at the provider | The same keys as optional Worker secrets; a model with no key is refused with the secret to add | Say what to connect before any request leaves |
| `createOpenAI` for Groq, Together, xAI, DeepSeek, Morph | `createOpenAI(...).chat(...)` | AI SDK 7's OpenAI provider defaults to the Responses API, which those endpoints do not serve |
| `E2B_API_KEY` required | Optional; without it the sandbox route answers "E2B is not connected" and the page shows that beside the code | Deploy before an E2B account exists |
| `@upstash/ratelimit` sliding window on Vercel KV | A fixed window per client IP in the `KV` binding; `CF-Connecting-IP` before `X-Forwarded-For` | Workers KV; eventually consistent, so approximate across locations (risk AA-D) |
| Vercel KV share links, `/s/:id` middleware, `NEXT_PUBLIC_SITE_URL` | `fragment:<id>` in the `KV` binding (60 s expiry floor), `/s/[id]` a route handler that redirects only to `*.e2b.app`, the link on the visitor's origin | Workers KV; each environment links to itself |
| Supabase sign-in, teams and their headers to E2B; ZeroBounce e-mail check | Left out | Upstream runs without them (a demo session); none is needed to write or run a fragment |
| PostHog, Vercel Analytics, Google Tag Manager | Left out | No analytics ship with the product |
| The account menu (avatar, e-mail, sign out) | A menu with upstream's links (About E2B, the product's source, E2B's Discord and X) | No account |
| "Fragments by E2B" heading | `{SITE_NAME} on E2B` (`lib/site.ts`) | The product names itself; E2B is credited |
| `fragment.code.forEach(async …)` | `Promise.all` | The writes are awaited before the code runs |
| `next lint` with `next/core-web-vitals` | ESLint 9 with eslint-config-next 16; the rules it added after the template are off by name | The template is kept as written |
| node:test with `tsx` | vitest in `tests/web`, with in-memory KV and AI bindings and no network | The reference test shape |

Not proven offline: a real Workers AI model following the schema (AA-B), a
real sandbox run (AA-A, beyond the spike), and the namespace's apply.
