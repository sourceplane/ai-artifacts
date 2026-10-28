import modelsList from './models.json'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createFireworks } from '@ai-sdk/fireworks'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import { createWorkersAI } from 'workers-ai-provider'

// WHERE THE MODELS COME FROM. Upstream needs a vendor key for every model.
// Here the first models in models.json are Workers AI's, called through the
// Worker's own `AI` binding (wrangler.jsonc): the binding is the credential, so
// a fresh deployment writes fragments with nothing configured, and the page
// starts on DEFAULT_MODEL_ID. The vendor models upstream lists stay, each sent
// with the visitor's own key (the settings dialog, as upstream allows) or the
// server's (a Worker secret: OPENAI_API_KEY, ANTHROPIC_API_KEY, …). Vertex AI
// and Ollama are left out: a Google service-account file and a local Ollama
// server do not fit a Worker.

export type LLMModel = {
  id: string
  name: string
  provider: string
  providerId: string
  multiModal?: boolean
}

export type LLMModelConfig = {
  model?: string
  apiKey?: string
  temperature?: number
  topP?: number
  topK?: number
  frequencyPenalty?: number
  presencePenalty?: number
  maxTokens?: number
}

// The Workers AI model a fresh page selects: a text model Cloudflare lists
// for JSON mode, which the fragment's schema needs (workers-ai-provider sends
// it as `response_format: json_schema`).
export const DEFAULT_MODEL_ID = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

export const WORKERS_AI = 'workers-ai'

// Finds the model in models.json.
export function resolveModel(id: unknown): LLMModel | undefined {
  return modelsList.models.find((model) => model.id === id)
}

export function defaultModel(): LLMModel {
  return resolveModel(DEFAULT_MODEL_ID)!
}

// The server's own key for each vendor provider: an optional Worker secret.
// Workers AI has none — the binding is the credential.
export const serverKeyEnv: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  groq: 'GROQ_API_KEY',
  togetherai: 'TOGETHER_API_KEY',
  fireworks: 'FIREWORKS_API_KEY',
  xai: 'XAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
}

// Providers that call the API with the caller's key when one is provided.
const clientKeyProviders = new Set(Object.keys(serverKeyEnv))

// Returns the caller's API key when the request will be sent with it.
// Without one, the request uses the server's keys.
export function getClientApiKey(
  model: LLMModel,
  config: LLMModelConfig,
): string | undefined {
  const { apiKey } = config
  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    return undefined
  }
  return clientKeyProviders.has(model.providerId) ? apiKey : undefined
}

export function getServerApiKey(model: LLMModel): string | undefined {
  const name = serverKeyEnv[model.providerId]
  const value = name ? process.env[name] : undefined
  return value && value.length > 0 ? value : undefined
}

// Whether a request for this model can be sent at all: Workers AI always,
// a vendor model with the caller's key or the server's. Without either the
// chat route answers what to add instead of a provider's 401.
export function hasCredential(model: LLMModel, config: LLMModelConfig) {
  return (
    model.providerId === WORKERS_AI ||
    !!getClientApiKey(model, config) ||
    !!getServerApiKey(model)
  )
}

export function getModelParams(config: LLMModelConfig) {
  const {
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    maxTokens,
  } = config
  return {
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    // AI SDK 7's name for upstream's maxTokens.
    maxOutputTokens: maxTokens,
  }
}

export function getModelClient(
  model: LLMModel,
  config: LLMModelConfig,
  ai?: Ai,
): LanguageModel {
  const { id: modelNameString, providerId } = model
  const apiKey = getClientApiKey(model, config) ?? getServerApiKey(model)

  const providerConfigs: Record<string, () => LanguageModel> = {
    // The binding lives on the request's Cloudflare context; the route reads
    // it per call and passes it in.
    'workers-ai': () => {
      if (!ai) {
        throw new Error(
          'The AI binding is missing: wrangler.jsonc must declare `"ai": { "binding": "AI" }`',
        )
      }
      return createWorkersAI({ binding: ai })(modelNameString)
    },
    anthropic: () => createAnthropic({ apiKey })(modelNameString),
    openai: () => createOpenAI({ apiKey })(modelNameString),
    google: () => createGoogleGenerativeAI({ apiKey })(modelNameString),
    mistral: () => createMistral({ apiKey })(modelNameString),
    groq: () =>
      createOpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' }).chat(
        modelNameString,
      ),
    togetherai: () =>
      createOpenAI({ apiKey, baseURL: 'https://api.together.xyz/v1' }).chat(
        modelNameString,
      ),
    fireworks: () =>
      createFireworks({
        apiKey,
        baseURL: 'https://api.fireworks.ai/inference/v1',
      })(modelNameString),
    xai: () =>
      createOpenAI({ apiKey, baseURL: 'https://api.x.ai/v1' }).chat(
        modelNameString,
      ),
    deepseek: () =>
      createOpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' }).chat(
        modelNameString,
      ),
  }

  const createClient = providerConfigs[providerId]
  if (!createClient) {
    throw new Error(`Unsupported provider: ${providerId}`)
  }
  return createClient()
}
