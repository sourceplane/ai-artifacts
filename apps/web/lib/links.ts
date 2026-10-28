import { customAlphabet } from 'nanoid'

// The short links a published preview gets — upstream's `fragment:<id>` keys
// in Vercel KV, the same keys in the Worker's KV namespace, expiring with the
// preview. `/s/<id>` (app/s/[id]/route.ts) redirects to the sandbox URL.
export type LinkStore = {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

const nanoid = customAlphabet('1234567890abcdef', 7)

export const LINK_ID = /^[0-9a-f]{7}$/

export async function saveLink(
  kv: LinkStore,
  url: string,
  expirationMs: number,
): Promise<string> {
  const id = nanoid()
  await kv.put(`fragment:${id}`, url, {
    // KV's floor for expirationTtl is 60 seconds.
    expirationTtl: Math.max(60, Math.ceil(expirationMs / 1000)),
  })
  return id
}

export async function readLink(
  kv: LinkStore,
  id: string,
): Promise<string | null> {
  if (!LINK_ID.test(id)) return null
  return kv.get(`fragment:${id}`)
}

// Only a sandbox on E2B's own domain is ever published or redirected to.
export function isSandboxUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.e2b.app')
  } catch {
    return false
  }
}
