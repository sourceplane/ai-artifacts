import { Duration, ms } from './duration'

// Upstream's limit on requests sent with the SERVER's keys — @upstash/ratelimit
// on Vercel KV, a sliding window per client IP — as a fixed window per client
// IP in the Worker's KV namespace. Same variables (RATE_LIMIT_MAX_REQUESTS,
// RATE_LIMIT_WINDOW) and the same answer when it trips. Workers KV is
// eventually consistent, so two locations can each let a few requests through
// at the edge of a window: the limit is a cost guard, as upstream's is, not an
// exact quota.
// The part of a KV namespace this uses: text values with an expiry.
export type RateLimitStore = {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

// KV's floor for expirationTtl is 60 seconds.
const MIN_TTL_SECONDS = 60

export default async function ratelimit(
  kv: RateLimitStore,
  key: string | null,
  maxRequests: number,
  window: Duration,
  now: number = Date.now(),
): Promise<{ amount: number; reset: number; remaining: number } | undefined> {
  const windowMs = ms(window)
  const start = Math.floor(now / windowMs) * windowMs
  const reset = start + windowMs
  const id = `ratelimit:${key ?? 'anonymous'}:${start}`

  const used = Number((await kv.get(id)) ?? 0)
  if (used >= maxRequests) {
    return { amount: maxRequests, reset, remaining: 0 }
  }
  await kv.put(id, String(used + 1), {
    expirationTtl: Math.max(MIN_TTL_SECONDS, Math.ceil((reset - now) / 1000)),
  })
  return undefined
}
