import { SITE_NAME, SOURCE_URL } from '@/lib/site'
import { describe, expect, it } from 'vitest'

describe('the product name seam', () => {
  it('names the product and its own repository', () => {
    expect(SITE_NAME.length).toBeGreaterThan(0)
    expect(SOURCE_URL).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/)
  })
})
