import { toRequestConfig } from '@/lib/request-schema'
import { describe, expect, it } from 'vitest'

describe('toRequestConfig', () => {
  it('drops settings the chat API does not accept', () => {
    const saved = {
      model: 'gpt-5',
      apiKey: 'user-key',
      baseURL: 'https://old-endpoint.example/v1',
      temperature: 0.5,
    }

    expect(toRequestConfig(saved)).toEqual({
      model: 'gpt-5',
      apiKey: 'user-key',
      temperature: 0.5,
    })
  })
})
