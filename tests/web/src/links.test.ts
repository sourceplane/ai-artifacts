import { MemoryKV } from './fakes'
import { isSandboxUrl, LINK_ID, readLink, saveLink } from '@/lib/links'
import { describe, expect, it } from 'vitest'

describe('share links in KV', () => {
  it('stores the sandbox URL under fragment:<id>, expiring with the preview', async () => {
    const kv = new MemoryKV()
    const id = await saveLink(kv, 'https://3000-abc.e2b.app', 30 * 60 * 1000)
    expect(id).toMatch(LINK_ID)
    expect(kv.values.get(`fragment:${id}`)).toEqual({ value: 'https://3000-abc.e2b.app', ttl: 1800 })
    expect(await readLink(kv, id)).toBe('https://3000-abc.e2b.app')
  })

  it('never asks KV for an expiry under its 60-second floor', async () => {
    const kv = new MemoryKV()
    const id = await saveLink(kv, 'https://3000-abc.e2b.app', 1000)
    expect(kv.values.get(`fragment:${id}`)?.ttl).toBe(60)
  })

  it('reads nothing for an id that is not one it issues', async () => {
    const kv = new MemoryKV()
    kv.values.set('fragment:../x', { value: 'https://3000-abc.e2b.app' })
    expect(await readLink(kv, '../x')).toBeNull()
    expect(await readLink(kv, 'abcdef1')).toBeNull()
  })

  it('accepts only https sandboxes on E2B’s domain', () => {
    expect(isSandboxUrl('https://3000-abc.e2b.app')).toBe(true)
    for (const url of ['http://3000-abc.e2b.app', 'https://e2b.app.evil.test', 'https://evil.test/?x=.e2b.app', 'not a url']) {
      expect(isSandboxUrl(url)).toBe(false)
    }
  })
})
