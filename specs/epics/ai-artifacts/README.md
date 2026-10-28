# Epic: ai-artifacts (AA)

**Fragments is a Next.js app that asks a model for a *fragment* — code, the stack it runs on and its dependencies, as one structured object streamed into the page — and asks E2B to run it in a cloud sandbox. Both halves are HTTP: the AI SDK's `streamObject` and the E2B SDK's REST and streaming calls, so the whole app runs on ONE Cloudflare Worker built by `@opennextjs/cloudflare` (a spike proved the E2B SDK bundles for workerd and reaches E2B's API from it). The models default to Workers AI through the Worker's own `AI` binding, the way `ai-chatbot` does, so a fresh deployment writes code with no key; E2B's key and every vendor model key are optional Orun secrets.**

The port keeps the chat, the five stacks (Python data analyst, Next.js, Vue, Streamlit, Gradio), the model picker and its settings, the streamed fragment and its code view, the sandbox preview, the interpreter's output and charts, Morph's apply-edit mode, and publishing a preview behind a short link. It swaps Upstash rate limiting and Vercel KV for a Workers KV namespace, and leaves out Supabase sign-in, PostHog and Vercel Analytics, which upstream already treats as optional.

## Status

| Field | Value |
|-------|-------|
| Status | AA0 in progress |
| Cluster | **AA** (AA0–AA4) |
| Owner(s) | `apps/web` (the page, the chat, sandbox and publish routes, `lib/`) · `tests/web` · `infra/terraform/cloudflare-kv` |
| Builds on | `ai-chatbot` (Workers AI through the `AI` binding with `workers-ai-provider`, vendor models behind their keys, the AI stand-in in the e2e), `kv-redis-starter` (the `cloudflare-kv` root and the wiring render), `ai-emoji-generator` (optional Orun secrets pushed as Worker secrets) |
| Upstream | [e2b-dev/fragments](https://github.com/e2b-dev/fragments) (Apache-2.0), at `3b11c7f` (2026-10-13) |
| Changes | Next.js 14 → 16 and AI SDK 3 → 7 (the reference stack); Workers AI the default provider; Upstash and Vercel KV → Workers KV; Supabase auth, PostHog and Vercel Analytics left out; Vertex and Ollama left out (a service-account file and a local server do not fit a Worker) |
| Gate | AA1 is the first user-visible rung. AA2 applies only with a linked workspace; verified by `terraform validate` |

## Read order

1. `design.md` — what maps to what, the request flow, what is out of scope
2. `implementation-plan.md` — the milestones and what "done" means for each
3. `risks-and-open-questions.md` — what could go wrong and what was decided
4. `IMPLEMENTATION-STATUS.md` — what actually shipped (kept distinct from intent)

## Milestones at a glance

| Milestone | What it lands | Done when |
|---|---|---|
| AA0 — the spec | intent, CI, tooling, the spec index, this doc set and the task contracts | merged on `main` |
| AA1 — the app on Workers | `apps/web`, the rendered wrangler config, `tests/web` | `wrangler dev` streams a fragment from the default model and shows it; checks green |
| AA2 — the KV namespace | `infra/terraform/cloudflare-kv` | the root validates; the wiring keys match the template |
| AA3 — ready to instantiate | README, as-built status | a reader can run, test, preview, connect and deploy it |
| AA4 — a baseline | card, build document (`01-product` + `02-docs`), rename, bootstrap tooling, tests | a new app generator goes from nothing to live in one landing; Baseline CI green |
