# Design — ai-artifacts

## What maps to what

| Upstream (Vercel) | Here |
|---|---|
| Next.js 14 on Vercel, `maxDuration` routes | Next.js 16 on one Cloudflare Worker + Static Assets through `@opennextjs/cloudflare`; the routes stream, so a Worker's wall-clock budget is not the limit a serverless function's was |
| AI SDK 3 (`streamObject`, `experimental_useObject`) | AI SDK 7 — the same two calls, which v7 still carries — and `@ai-sdk/react` 4 |
| A vendor key required for any model | **Workers AI through the `AI` binding** (`workers-ai-provider`), the default: JSON-schema output on a Workers AI text model, no key. Vendor models (OpenAI, Anthropic, Google, Mistral, Groq, Together, Fireworks, xAI, DeepSeek) are listed only when their key is a Worker secret, or when the visitor types their own key in the settings, as upstream allows |
| `E2B_API_KEY` env var | An optional Orun secret, pushed to the Worker as a secret by the deploy lane. Without it the fragment is still written and shown; the preview says E2B is not connected |
| `@upstash/ratelimit` on Vercel KV (`KV_REST_API_URL`) | A fixed-window counter per client IP in the `KV` Workers KV binding (`lib/ratelimit.ts`); same limits and window variables |
| Vercel KV share links (`fragment:<id>`, `/s/<id>`) | The same keys in the `KV` binding, with KV's expiration; `/s/<id>` redirects from a route handler instead of middleware |
| Supabase sign-in, teams, PostHog, Vercel Analytics | Left out: upstream runs without them, and none is needed to build or run a fragment |
| Vertex AI, Ollama | Left out: a Google service-account file and a local Ollama server do not fit a Worker |
| Morph apply-edit mode (`MORPH_API_KEY`) | Kept, behind its optional key |

## Request flow

```
browser ──POST /api/chat──► Worker ── streamObject(schema) ──► AI binding (Workers AI) | vendor API
        ◄── the fragment, streamed as partial JSON (experimental_useObject) ──
browser ──POST /api/sandbox──► Worker ── E2B SDK (REST + streaming fetch) ──► E2B sandbox
        ◄── interpreter output / preview URL ──
```

## Data plane

One Workers KV namespace per environment (`infra/terraform/cloudflare-kv`, kv-redis-starter's root): it holds the rate-limit windows (`ratelimit:<ip>:<window>`) and the share links (`fragment:<id>`). The root lease-publishes `WIRING_CLOUDFLARE_KV`, and the Worker's build renders the namespace id into `wrangler.jsonc` from it; the Worker's deploy waits for the apply (enforced on main).

## Out of scope

Sign-in and teams, analytics, Vertex, Ollama, and E2B's own templates (the five sandbox templates are E2B's public ones, built and hosted by E2B).
