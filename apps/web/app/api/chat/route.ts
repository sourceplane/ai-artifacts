import { handleAPIError, createRateLimitResponse } from '@/lib/api-errors'
import { bindings } from '@/lib/cloudflare'
import { clientIp, missingKeyResponse, rateLimitConfig } from '@/lib/limits'
import {
  getClientApiKey,
  getModelClient,
  getModelParams,
  hasCredential,
  resolveModel,
} from '@/lib/models'
import { toPrompt } from '@/lib/prompt'
import ratelimit from '@/lib/ratelimit'
import { chatRequestSchema, parseRequest } from '@/lib/request-schema'
import { fragmentSchema as schema } from '@/lib/schema'
import { streamObject } from 'ai'

export async function POST(req: Request) {
  const request = await parseRequest(req, chatRequestSchema)
  if ('error' in request) {
    return request.error
  }
  const { messages, template, model, config } = request.data

  const llm = resolveModel(model.id)
  if (!llm || llm.providerId !== model.providerId) {
    return new Response('Unsupported model', { status: 400 })
  }
  if (!hasCredential(llm, config)) {
    return missingKeyResponse(llm)
  }

  const env = await bindings()

  // Requests sent with the server's keys — and Workers AI's, which run on the
  // Worker's own account — are rate limited.
  const hasOwnApiKey = !!getClientApiKey(llm, config)
  const { maxRequests, window } = rateLimitConfig()
  const limit = !hasOwnApiKey
    ? await ratelimit(env.KV, clientIp(req), maxRequests, window)
    : undefined

  if (limit) {
    return createRateLimitResponse(limit)
  }

  try {
    const modelClient = getModelClient(llm, config, env.AI)
    const stream = streamObject({
      model: modelClient,
      schema,
      system: toPrompt(template),
      messages,
      maxRetries: 0, // do not retry on errors
      ...getModelParams(config),
    })

    return stream.toTextStreamResponse()
  } catch (error: any) {
    return handleAPIError(error, { hasOwnApiKey })
  }
}
