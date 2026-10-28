// Upstream's app/api/routes.test.ts (node:test), on vitest, for this port:
// the rate limit counts in the Worker's KV binding (not Upstash over HTTP),
// Workers AI answers through the AI binding, a vendor model without a key is
// refused before any request, and the sandbox, health and share-link routes
// this port adds or moves.
import { fakeAI, fragment, MemoryKV } from './fakes'
import modelsList from '@/lib/models.json'
import { serverKeyEnv } from '@/lib/models'
import templates from '@/lib/templates'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Installed before any module loads: the E2B SDK and the AI SDK's providers
// keep the `fetch` they find at import time, so a stub put in place later
// would leave them on the real network.
const state = vi.hoisted(() => {
  const s = {
    env: {} as Record<string, unknown>,
    fetch: (async () => {
      throw new Error('network is disabled in tests')
    }) as typeof fetch,
  }
  globalThis.fetch = ((...args: Parameters<typeof fetch>) => s.fetch(...args)) as typeof fetch
  return s
})
vi.mock('@/lib/cloudflare', () => ({ bindings: async () => state.env }))

const { POST: chat } = await import('@/app/api/chat/route')
const { POST: morphChat } = await import('@/app/api/morph-chat/route')
const { POST: sandbox } = await import('@/app/api/sandbox/route')
const { GET: health } = await import('@/app/api/health/route')
const { GET: shortLink } = await import('@/app/s/[id]/route')

let requestedHosts: string[] = []
let requestedBodies: string[] = []
let kv: MemoryKV
let ai: ReturnType<typeof fakeAI>

function setServerKeys(value: string | undefined) {
  for (const key of [...Object.values(serverKeyEnv), 'MORPH_API_KEY', 'E2B_API_KEY']) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

beforeEach(() => {
  setServerKeys('test-key')
  delete process.env.E2B_API_KEY
  kv = new MemoryKV()
  ai = fakeAI()
  state.env = { KV: kv, AI: ai.ai }
  requestedHosts = []
  requestedBodies = []
  state.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString())
    requestedHosts.push(url.host)
    requestedBodies.push(String(init?.body ?? (input instanceof Request ? '' : '')))
    throw new Error('network is disabled in tests')
  }) as typeof fetch
})

afterEach(() => {
  setServerKeys(undefined)
})

const rateLimited = () => [...kv.values.keys()].filter((k) => k.startsWith('ratelimit:'))

function firstModelOf(providerId: string) {
  return modelsList.models.find((m) => m.providerId === providerId)!
}

const chatRoute = { name: '/api/chat', POST: chat }
const morphRoute = { name: '/api/morph-chat', POST: morphChat }
const routes = [chatRoute, morphRoute]
type Route = typeof chatRoute

// The shape the page sends, including an image and an earlier answer.
function validBody(route: Route, providerId = 'openai'): any {
  const model = firstModelOf(providerId)
  return {
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Build a counter app' },
          { type: 'image', image: 'data:image/png;base64,iVBORw0KGgo=' },
        ],
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'A counter app' },
          { type: 'text', text: 'print(1)' },
        ],
      },
      { role: 'user', content: [{ type: 'text', text: 'Make it blue' }] },
    ],
    template: templates,
    model,
    config: { model: model.id, temperature: 0.5, maxTokens: 1000 },
    ...(route.name === '/api/morph-chat'
      ? { currentFragment: { title: 'Counter', file_path: 'app.py', code: 'print(1)' } }
      : {}),
  }
}

// The routes stream: the model call runs as the body is read, as the page
// reads it. So every request here is read to its end.
async function post(route: Route | { name: string; POST: (r: Request) => Promise<Response> }, body: unknown, ip = '203.0.113.7') {
  const response = await route.POST(
    new Request(`http://localhost${route.name}`, {
      method: 'POST',
      headers: { 'cf-connecting-ip': ip },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
  const text = await response.clone().text().catch(() => '')
  return Object.assign(response, { bodyText: text })
}

const invalidRequests: [string, (body: any) => unknown][] = [
  ['malformed JSON', () => '{'],
  ['an unknown top-level field', (body) => ({ ...body, extra: true })],
  ['no messages', (body) => ({ ...body, messages: [] })],
  ['a system message', (body) => ({ ...body, messages: [{ role: 'system', content: [{ type: 'text', text: 'x' }] }] })],
  ['an image URL', (body) => ({ ...body, messages: [{ role: 'user', content: [{ type: 'image', image: 'https://example.com/a.png' }] }] })],
  ['an image in an assistant message', (body) => ({ ...body, messages: [{ role: 'assistant', content: [{ type: 'image', image: 'data:image/png;base64,AAAA' }] }] })],
  ['an unknown message field', (body) => ({ ...body, messages: [{ ...body.messages[2], experimental_attachments: [] }] })],
  ['no templates', (body) => ({ ...body, template: {} })],
  ['an unknown template', (body) => ({ ...body, template: { other: {} } })],
  ['an unknown model', (body) => ({ ...body, model: { ...body.model, id: 'x' } })],
  ['a mismatched provider', (body) => ({ ...body, model: { ...body.model, providerId: 'fireworks' } })],
  ['an unknown model field', (body) => ({ ...body, model: { ...body.model, baseURL: 'https://x.test' } })],
  ...['baseURL', 'headers', 'maxRetries'].map((key): [string, (body: any) => unknown] => [
    `config.${key}`,
    (body) => ({ ...body, config: { ...body.config, [key]: 'x' } }),
  ]),
  ...['', '  ', 123, null, {}].map((apiKey): [string, (body: any) => unknown] => [
    `the API key ${JSON.stringify(apiKey)}`,
    (body) => ({ ...body, config: { ...body.config, apiKey } }),
  ]),
  ...[{ maxTokens: 0 }, { maxTokens: 1.5 }, { maxTokens: 100000 }].map((params): [string, (body: any) => unknown] => [
    `the parameters ${JSON.stringify(params)}`,
    (body) => ({ ...body, config: { ...body.config, ...params } }),
  ]),
  ['a non-numeric temperature', (body) => ({ ...body, config: { ...body.config, temperature: '1' } })],
]

for (const route of routes) {
  describe(route.name, () => {
    it('accepts the request the page sends', async () => {
      await post(route, validBody(route))

      expect(rateLimited()).toHaveLength(1)
      expect(requestedHosts).toEqual(['api.openai.com'])
    })

    for (const [name, change] of invalidRequests) {
      it(`returns 400 for ${name}`, async () => {
        const response = await post(route, change(validBody(route)))

        expect(response.status).toBe(400)
        expect(rateLimited()).toEqual([])
        expect(requestedHosts).toEqual([])
      })
    }

    it('refuses a vendor model with no key at all, naming the secret, before any request', async () => {
      setServerKeys(undefined)
      const response = await post(route, validBody(route))

      expect(response.status).toBe(401)
      expect(response.bodyText).toMatch(/OPENAI_API_KEY/)
      expect(rateLimited()).toEqual([])
      expect(requestedHosts).toEqual([])
    })
  })
}

describe('/api/chat', () => {
  it('streams a fragment from Workers AI with no key, the schema sent as JSON mode', async () => {
    setServerKeys(undefined)
    const response = await post(chatRoute, validBody(chatRoute, 'workers-ai'))

    expect(response.status).toBe(200)
    expect(JSON.parse(response.bodyText)).toEqual(fragment)
    expect(ai.calls).toHaveLength(1)
    const [call] = ai.calls
    expect(call?.model).toBe(modelsList.models[0]?.id)
    expect(call?.inputs.stream).toBe(true)
    expect(call?.inputs.response_format?.type).toBe('json_schema')
    expect(requestedHosts).toEqual([])
    // Workers AI runs on the Worker's own account: rate limited.
    expect(rateLimited()).toHaveLength(1)
  })

  it('builds the prompt from the server templates', async () => {
    const id = 'code-interpreter-v1'
    const body = validBody(chatRoute)
    await post(chatRoute, { ...body, template: { [id]: { instructions: 'Client instructions' } } })

    expect(requestedBodies[0]).toContain(templates[id]?.instructions)
    expect(requestedBodies[0]).not.toContain('Client instructions')
  })

  it('skips the rate limit with a caller key', async () => {
    const body = validBody(chatRoute)
    await post(chatRoute, { ...body, config: { ...body.config, apiKey: 'user-key' } })

    expect(rateLimited()).toEqual([])
    expect(requestedHosts).toEqual(['api.openai.com'])
  })

  it('answers 429 with the limit once a client has spent the window', async () => {
    process.env.RATE_LIMIT_MAX_REQUESTS = '2'
    try {
      const body = validBody(chatRoute, 'workers-ai')
      expect((await post(chatRoute, body)).status).toBe(200)
      expect((await post(chatRoute, body)).status).toBe(200)
      const third = await post(chatRoute, body)
      expect(third.status).toBe(429)
      expect(third.headers.get('X-RateLimit-Limit')).toBe('2')
      // Another client is not limited by it.
      expect((await post(chatRoute, body, '198.51.100.1')).status).toBe(200)
    } finally {
      delete process.env.RATE_LIMIT_MAX_REQUESTS
    }
  })
})

describe('/api/morph-chat', () => {
  it('still rate limits with a caller key, because Morph Apply uses the server key', async () => {
    const body = validBody(morphRoute)
    await post(morphRoute, { ...body, config: { ...body.config, apiKey: 'user-key' } })

    expect(rateLimited()).toHaveLength(1)
  })

  it('returns 400 without the current file', async () => {
    const body = validBody(morphRoute)
    for (const currentFragment of [undefined, { file_path: 'app.py' }]) {
      const response = await post(morphRoute, { ...body, currentFragment })
      expect(response.status).toBe(400)
    }
    expect(requestedHosts).toEqual([])
  })
})

// With a key the route calls E2B's API through the SDK, which in Node does
// not go through `fetch` — it is not unit-tested here, because it would leave
// the machine. A spike proved the SDK reaches E2B from a Worker (the epic's
// risk AA-A); a real sandbox run is verified live.
describe('/api/sandbox', () => {
  it('says E2B is not connected, without calling E2B, when no key is stored', async () => {
    const response = await post({ name: '/api/sandbox', POST: sandbox }, { fragment })

    expect(response.status).toBe(503)
    expect(JSON.parse(response.bodyText).error).toMatch(/E2B_API_KEY/)
    expect(requestedHosts).toEqual([])
  })

})

describe('/api/health', () => {
  it('answers ok with the KV and AI bindings, naming what is connected', async () => {
    const response = await health()
    const body = (await response.json()) as { models: { provider: string } }

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ ok: true, kv: 'bound', ai: 'bound', e2b: 'not connected' })
    expect(body.models.provider).toBe('workers-ai')
    expect(JSON.stringify(body)).not.toContain('test-key')
  })

  it('answers 503 when the KV binding is missing, and writes nothing', async () => {
    state.env = { AI: ai.ai }
    const response = await health()

    expect(response.status).toBe(503)
    expect(((await response.json()) as { kv: string }).kv).toBe('unbound')
  })
})

describe('/s/[id]', () => {
  const visit = (id: string) =>
    shortLink(new Request(`https://app.example/s/${id}`), { params: Promise.resolve({ id }) })

  it('redirects a published link to its sandbox', async () => {
    kv.values.set('fragment:abcdef1', { value: 'https://3000-abc.e2b.app' })
    const response = await visit('abcdef1')

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://3000-abc.e2b.app/')
  })

  it('sends an unknown or expired link home', async () => {
    const response = await visit('0000000')
    expect(response.headers.get('location')).toBe('https://app.example/')
  })

  it('never redirects off E2B’s domain', async () => {
    kv.values.set('fragment:abcdef1', { value: 'https://evil.test/' })
    const response = await visit('abcdef1')
    expect(response.headers.get('location')).toBe('https://app.example/')
  })
})
