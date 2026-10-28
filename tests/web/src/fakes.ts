// Test doubles for the Worker's bindings: an in-memory KV namespace (with
// KV's own 60-second floor on expirationTtl), and a Workers AI binding that
// streams a canned fragment the way the real one streams JSON mode.
export class MemoryKV {
  values = new Map<string, { value: string; ttl?: number }>()
  async get(key: string) {
    return this.values.get(key)?.value ?? null
  }
  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    if (options?.expirationTtl !== undefined && options.expirationTtl < 60) {
      throw new Error('KV PUT failed: 400 Invalid expiration_ttl of less than 60')
    }
    this.values.set(key, { value, ttl: options?.expirationTtl })
  }
}

export const fragment = {
  commentary: 'A one-cell analysis.',
  template: 'code-interpreter-v1',
  title: 'Sum check',
  description: 'Prints the sum of one and one.',
  additional_dependencies: [],
  has_additional_dependencies: false,
  install_dependencies_command: '',
  port: null,
  file_path: 'script.py',
  code: 'print(1 + 1)',
}

export function fakeAI() {
  const calls: { model: string; inputs: any }[] = []
  const ai = {
    async run(model: string, inputs: any) {
      calls.push({ model, inputs })
      const text = JSON.stringify(fragment)
      if (!inputs?.stream) return { response: text }
      const enc = new TextEncoder()
      return new ReadableStream({
        start(c) {
          for (const d of text.match(/.{1,9}/gs) ?? []) {
            c.enqueue(enc.encode(`data: ${JSON.stringify({ response: d })}\n\n`))
          }
          c.enqueue(enc.encode('data: [DONE]\n\n'))
          c.close()
        },
      })
    },
  }
  return { ai: ai as unknown as Ai, calls }
}
