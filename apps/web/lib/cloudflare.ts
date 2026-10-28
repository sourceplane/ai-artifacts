import { getCloudflareContext } from '@opennextjs/cloudflare'

// The Worker's bindings for this request (wrangler.jsonc): `KV`, the rate
// limits and share links; `AI`, Workers AI. Read per call — the bindings live
// on the request's Cloudflare context, not at module scope.
export async function bindings(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true })
  return env as CloudflareEnv
}
