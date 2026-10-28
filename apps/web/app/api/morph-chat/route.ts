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
import { applyPatch } from '@/lib/morph'
import ratelimit from '@/lib/ratelimit'
import { morphChatRequestSchema, parseRequest } from '@/lib/request-schema'
import { morphEditSchema } from '@/lib/schema'
import { generateObject } from 'ai'

// System prompt is constructed dynamically below using the current file context

export async function POST(req: Request) {
  const request = await parseRequest(req, morphChatRequestSchema)
  if ('error' in request) {
    return request.error
  }
  const { messages, model, config, currentFragment } = request.data

  const llm = resolveModel(model.id)
  if (!llm || llm.providerId !== model.providerId) {
    return new Response('Unsupported model', { status: 400 })
  }
  if (!hasCredential(llm, config)) {
    return missingKeyResponse(llm)
  }

  const env = await bindings()

  // Always rate limited: Morph Apply uses the server's Morph key even when
  // the model call uses the caller's key.
  const { maxRequests, window } = rateLimitConfig()
  const limit = await ratelimit(env.KV, clientIp(req), maxRequests, window)

  if (limit) {
    return createRateLimitResponse(limit)
  }

  try {
    const modelClient = getModelClient(llm, config, env.AI)
    const contextualSystemPrompt = `You are a code editor. Generate a JSON response with exactly these fields:

{
  "commentary": "Explain what changes you are making",
  "instruction": "One line description of the change", 
  "edit": "The code changes with // ... existing code ... for unchanged parts",
  "file_path": "${currentFragment.file_path}"
}

Current file: ${currentFragment.file_path}
Current code:
\`\`\`
${currentFragment.code}
\`\`\`

`

    const result = await generateObject({
      model: modelClient,
      system: contextualSystemPrompt,
      messages,
      schema: morphEditSchema,
      maxRetries: 0,
      ...getModelParams(config),
    })

    const editInstructions = result.object

    // Apply edits using Morph
    const morphResult = await applyPatch({
      targetFile: currentFragment.file_path,
      instructions: editInstructions.instruction,
      initialCode: currentFragment.code,
      codeEdit: editInstructions.edit,
    })

    // Return updated fragment in standard format
    const updatedFragment = {
      ...currentFragment,
      code: morphResult.code,
      commentary: editInstructions.commentary,
    }

    // Create a streaming response that matches the AI SDK format
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const json = JSON.stringify(updatedFragment)
        controller.enqueue(encoder.encode(json))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch (error: any) {
    return handleAPIError(error, {
      hasOwnApiKey: !!getClientApiKey(llm, config),
    })
  }
}
