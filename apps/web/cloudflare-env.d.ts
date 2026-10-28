// The bindings wrangler.jsonc declares, as the Worker (and `next dev` through
// the platform proxy) sees them, and the optional Worker secrets the deploy
// lane sets (tooling/wire/worker-secrets.mjs). Regenerate the bindings with
// `wrangler types` after changing them.
interface CloudflareEnv {
  // The rate-limit windows and the share links (lib/kv.ts).
  KV: KVNamespace
  // Workers AI: the default model provider, no key (lib/models.ts).
  AI: Ai
  ASSETS: Fetcher
}
