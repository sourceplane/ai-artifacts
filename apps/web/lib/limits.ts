import { Duration } from './duration'
import { LLMModel, serverKeyEnv } from './models'

// Upstream's variables, unchanged: requests sent with the server's keys (and
// every Workers AI request, which runs on the Worker's own account) are
// limited per client IP.
export function rateLimitConfig() {
  const max = Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '', 10)
  return {
    maxRequests: Number.isFinite(max) && max > 0 ? max : 10,
    window: (process.env.RATE_LIMIT_WINDOW as Duration) || ('1d' as Duration),
  }
}

// Cloudflare names the client in CF-Connecting-IP; X-Forwarded-For is what
// upstream read on Vercel.
export function clientIp(req: Request): string | null {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null
  )
}

// A vendor model with neither the visitor's key nor the server's: say which
// key to add, instead of passing the provider's 401 through.
export function missingKeyResponse(model: LLMModel): Response {
  const env = serverKeyEnv[model.providerId]
  return new Response(
    `${model.provider} needs an API key: add yours in the settings, or store ${env} as a secret and redeploy. The Workers AI models need none.`,
    { status: 401 },
  )
}
