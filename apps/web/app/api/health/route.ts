import { bindings } from '@/lib/cloudflare'
import { isE2BConnected } from '@/lib/e2b'
import { DEFAULT_MODEL_ID, serverKeyEnv } from '@/lib/models'

// Not upstream's: the deploy's smoke check and the bootstrap's probes read
// this. It proves what the page alone never does: the KV binding answers a
// read against its namespace, and the AI binding is declared. READ-ONLY: a
// public route that wrote would let anyone spend the namespace's daily write
// allowance (1,000 on Workers Free), which the rate limit and the share links
// need. It says which providers are connected — names and yes/no, never a key.
// Never prerendered: the answer is the binding's, at request time.
export const dynamic = 'force-dynamic'

export async function GET() {
  const env = await bindings()
  let kv: 'bound' | 'unbound' = 'unbound'
  try {
    // Any key: a bound namespace answers (null for a key it does not hold);
    // a missing binding throws.
    await env.KV.get('health')
    kv = 'bound'
  } catch (error) {
    console.error('health: KV check failed', error)
  }
  const ai = env.AI ? 'bound' : 'unbound'
  const ok = kv === 'bound' && ai === 'bound'
  return Response.json(
    {
      ok,
      kv,
      ai,
      models: {
        default: DEFAULT_MODEL_ID,
        provider: 'workers-ai',
        keys: Object.fromEntries(
          Object.entries(serverKeyEnv).map(([provider, name]) => [
            provider,
            process.env[name] ? 'connected' : 'not connected',
          ]),
        ),
      },
      e2b: isE2BConnected() ? 'connected' : 'not connected',
    },
    { headers: { 'cache-control': 'no-store' }, status: ok ? 200 : 503 },
  )
}
