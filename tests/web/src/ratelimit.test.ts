import { MemoryKV } from './fakes'
import ratelimit from '@/lib/ratelimit'
import { describe, expect, it } from 'vitest'

const day = 24 * 60 * 60 * 1000

describe('ratelimit (a fixed window per client in KV)', () => {
  it('lets maxRequests through in a window, then answers the limit', async () => {
    const kv = new MemoryKV()
    const now = Date.UTC(2026, 9, 28, 12)
    for (let i = 0; i < 3; i++) {
      expect(await ratelimit(kv, '203.0.113.7', 3, '1d', now + i)).toBeUndefined()
    }
    const limit = await ratelimit(kv, '203.0.113.7', 3, '1d', now + 5)
    expect(limit).toEqual({ amount: 3, remaining: 0, reset: Date.UTC(2026, 9, 29) })
  })

  it('counts each client on its own', async () => {
    const kv = new MemoryKV()
    const now = Date.UTC(2026, 9, 28, 12)
    expect(await ratelimit(kv, 'a', 1, '1d', now)).toBeUndefined()
    expect(await ratelimit(kv, 'a', 1, '1d', now)).toBeDefined()
    expect(await ratelimit(kv, 'b', 1, '1d', now)).toBeUndefined()
  })

  it('starts again in the next window', async () => {
    const kv = new MemoryKV()
    const now = Date.UTC(2026, 9, 28, 23, 59)
    expect(await ratelimit(kv, 'a', 1, '1d', now)).toBeUndefined()
    expect(await ratelimit(kv, 'a', 1, '1d', now)).toBeDefined()
    expect(await ratelimit(kv, 'a', 1, '1d', now + day)).toBeUndefined()
  })

  it('never asks KV for an expiry under its 60-second floor', async () => {
    const kv = new MemoryKV()
    const windowEnd = Date.UTC(2026, 9, 29)
    // One second before the window closes: the counter still lives 60 s.
    expect(await ratelimit(kv, 'a', 5, '1d', windowEnd - 1000)).toBeUndefined()
    const [entry] = [...kv.values.values()]
    expect(entry?.ttl).toBe(60)
  })
})
