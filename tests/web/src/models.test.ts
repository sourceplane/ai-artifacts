// Upstream's lib/models.test.ts (node:test), on vitest, for this port: Vertex
// and Ollama are gone, Workers AI is the keyless default, and a model without
// a credential is known before any request is sent.
import { fakeAI } from './fakes'
import {
  DEFAULT_MODEL_ID,
  defaultModel,
  getClientApiKey,
  getModelClient,
  getModelParams,
  hasCredential,
  LLMModelConfig,
  resolveModel,
  serverKeyEnv,
} from '@/lib/models'
import modelsList from '@/lib/models.json'
import { generateText, LanguageModel } from 'ai'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const customBaseURL = 'https://custom-endpoint.example/v1'

const providerHosts: Record<string, string> = {
  anthropic: 'api.anthropic.com',
  openai: 'api.openai.com',
  google: 'generativelanguage.googleapis.com',
  mistral: 'api.mistral.ai',
  groq: 'api.groq.com',
  togetherai: 'api.together.xyz',
  fireworks: 'api.fireworks.ai',
  xai: 'api.x.ai',
  deepseek: 'api.deepseek.com',
}

const originalFetch = globalThis.fetch
let requestedHosts: string[] = []
let requestedAuthorization: (string | null)[] = []

function setServerKeys(value: string | undefined) {
  for (const key of Object.values(serverKeyEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

beforeEach(() => {
  setServerKeys('test-key')
  requestedHosts = []
  requestedAuthorization = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString()
    requestedHosts.push(new URL(url).host)
    requestedAuthorization.push(new Headers(init?.headers).get('authorization'))
    throw new Error('network is disabled in tests')
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  setServerKeys(undefined)
})

function firstModelOf(providerId: string) {
  const model = modelsList.models.find((m) => m.providerId === providerId)
  expect(model, `models.json has no ${providerId} model`).toBeDefined()
  return model!
}

async function sendPrompt(model: LanguageModel) {
  await generateText({ model, prompt: 'Hello', maxRetries: 0 }).catch(() => {})
}

describe('models.json', () => {
  it('starts with Workers AI, and the default is its first model', () => {
    expect(modelsList.models[0]?.providerId).toBe('workers-ai')
    expect(defaultModel().id).toBe(DEFAULT_MODEL_ID)
    expect(defaultModel().providerId).toBe('workers-ai')
  })

  it('lists no Vertex or Ollama model, which do not fit a Worker', () => {
    const providers = new Set(modelsList.models.map((m) => m.providerId))
    expect(providers.has('vertex')).toBe(false)
    expect(providers.has('ollama')).toBe(false)
  })

  it('names only providers getModelClient knows, each with its logo', () => {
    for (const model of modelsList.models) {
      expect(() =>
        getModelClient(model, {}, fakeAI().ai),
      ).not.toThrow()
      const logo = resolve(__dirname, '../../../apps/web/public/thirdparty/logos', `${model.providerId}.svg`)
      expect(existsSync(logo), `${model.providerId}.svg`).toBe(true)
    }
  })
})

describe('getModelClient', () => {
  for (const [providerId, host] of Object.entries(providerHosts)) {
    it(`sends ${providerId} requests to ${host}, ignoring a client base URL`, async () => {
      const config = { baseURL: customBaseURL } as LLMModelConfig
      const client = getModelClient(firstModelOf(providerId), config)

      await sendPrompt(client)

      expect(requestedHosts).toEqual([host])
    })
  }

  it('sends Workers AI requests through the AI binding, and nowhere else', async () => {
    const { ai, calls } = fakeAI()
    const model = defaultModel()
    const client = getModelClient(model, {}, ai)

    await generateText({ model: client, prompt: 'Hello', maxRetries: 0 })

    expect(calls.map((c) => c.model)).toEqual([model.id])
    expect(requestedHosts).toEqual([])
  })

  it('refuses a Workers AI model without the binding, naming it', () => {
    expect(() => getModelClient(defaultModel(), {})).toThrow(/AI binding is missing/)
  })

  it('sends the caller key when one is provided', async () => {
    const client = getModelClient(firstModelOf('groq'), { apiKey: 'user-key' })

    await sendPrompt(client)

    expect(requestedAuthorization).toEqual(['Bearer user-key'])
  })

  it('sends the server key when the caller key is not a string', async () => {
    const config = { apiKey: { key: 'user-key' } } as unknown as LLMModelConfig
    const client = getModelClient(firstModelOf('groq'), config)

    await sendPrompt(client)

    expect(requestedAuthorization).toEqual(['Bearer test-key'])
  })
})

describe('getClientApiKey', () => {
  it('returns the caller key for providers that use it', () => {
    for (const providerId of Object.keys(providerHosts)) {
      expect(getClientApiKey(firstModelOf(providerId), { apiKey: 'user-key' })).toBe('user-key')
    }
  })

  it('returns nothing for Workers AI, whose binding is the credential', () => {
    expect(getClientApiKey(defaultModel(), { apiKey: 'user-key' })).toBeUndefined()
  })

  it('returns nothing for a missing, empty or non-string key', () => {
    const model = firstModelOf('openai')
    for (const apiKey of [undefined, '', 123, { key: 'user-key' }]) {
      const config = { apiKey } as unknown as LLMModelConfig
      expect(getClientApiKey(model, config)).toBeUndefined()
    }
  })
})

describe('hasCredential', () => {
  it('is always true for Workers AI', () => {
    setServerKeys(undefined)
    expect(hasCredential(defaultModel(), {})).toBe(true)
  })

  it('needs the caller key or the server key for a vendor model', () => {
    const model = firstModelOf('openai')
    setServerKeys(undefined)
    expect(hasCredential(model, {})).toBe(false)
    expect(hasCredential(model, { apiKey: 'user-key' })).toBe(true)
    process.env.OPENAI_API_KEY = 'server-key'
    expect(hasCredential(model, {})).toBe(true)
  })
})

describe('resolveModel', () => {
  it('returns the model from models.json', () => {
    const model = firstModelOf('openai')
    expect(resolveModel(model.id)).toEqual(model)
  })

  it('rejects IDs that are not in models.json', () => {
    for (const id of ['not-a-model', 'constructor', undefined, 42]) {
      expect(resolveModel(id)).toBeUndefined()
    }
  })
})

describe('getModelParams', () => {
  it('keeps only the sampling parameters, maxTokens as AI SDK 7 names it', () => {
    const config = {
      model: 'gpt-5',
      apiKey: 'user-key',
      baseURL: customBaseURL,
      headers: { 'X-Custom': '1' },
      maxRetries: 5,
      temperature: 0.5,
      maxTokens: 100,
    } as LLMModelConfig

    expect(getModelParams(config)).toEqual({
      temperature: 0.5,
      topP: undefined,
      topK: undefined,
      frequencyPenalty: undefined,
      presencePenalty: undefined,
      maxOutputTokens: 100,
    })
  })
})
