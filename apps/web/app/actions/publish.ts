'use server'

import { bindings } from '@/lib/cloudflare'
import { Duration, ms } from '@/lib/duration'
import { e2bApiKey } from '@/lib/e2b'
import { isSandboxUrl, saveLink } from '@/lib/links'
import { Sandbox } from '@e2b/code-interpreter'
import { headers } from 'next/headers'

export async function publish(url: string, sbxId: string, duration: Duration) {
  if (!isSandboxUrl(url)) {
    throw new Error('URL must be on *.e2b.app domain')
  }

  const expiration = ms(duration)
  if (expiration > ms('24h')) {
    throw new Error('Expiration must be 24 hours or less')
  }

  // Keep the sandbox alive as long as the link lives.
  await Sandbox.setTimeout(sbxId, expiration, { apiKey: e2bApiKey() })

  const { KV } = await bindings()
  const id = await saveLink(KV, url, expiration)

  // Upstream built the link on NEXT_PUBLIC_SITE_URL; here it is the origin
  // the visitor is on, so stage, prod and a custom domain each link to
  // themselves.
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return { url: host ? `${proto}://${host}/s/${id}` : `/s/${id}` }
}
