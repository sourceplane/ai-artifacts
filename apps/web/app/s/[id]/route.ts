import { bindings } from '@/lib/cloudflare'
import { isSandboxUrl, readLink } from '@/lib/links'

// A published preview's short link (upstream's middleware on `/s/:path*`,
// reading Vercel KV): the sandbox URL it names, or home when it expired.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { KV } = await bindings()
  const url = await readLink(KV, id)
  if (url && isSandboxUrl(url)) {
    return Response.redirect(url, 302)
  }
  return Response.redirect(new URL('/', req.url), 302)
}
