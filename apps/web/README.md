# apps/web — Fragments on Cloudflare Workers

E2B's [Fragments](https://github.com/e2b-dev/fragments) (Apache-2.0, © FoundryLabs, Inc.;
`LICENSE`) on one Cloudflare Worker built by `@opennextjs/cloudflare`. The
repository README says how to run, test, preview and deploy it.

| What | Where |
|---|---|
| The page, the chat, the preview | `app/page.tsx`, `components/` |
| The model call (a fragment streamed as a structured object) | `app/api/chat/route.ts`, `app/api/morph-chat/route.ts` |
| Running it in E2B | `app/api/sandbox/route.ts`, `lib/e2b.ts` |
| The models: Workers AI first, vendor models behind their keys | `lib/models.ts`, `lib/models.json` |
| The rate limit and the share links, in the `KV` binding | `lib/ratelimit.ts`, `lib/links.ts`, `app/actions/publish.ts`, `app/s/[id]/route.ts` |
| The product's name and source link | `lib/site.ts` |
| What the deploy's smoke reads | `app/api/health/route.ts` |
| Bindings | `wrangler.template.jsonc` + `wiring.fixture.json` → `wrangler.jsonc` (`pnpm run wire:fixture`) |
