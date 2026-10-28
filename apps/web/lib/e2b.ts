// E2B's API key, an optional Worker secret (E2B_API_KEY). The fragment is
// written without it — the model needs no E2B — and running it in a sandbox
// is what needs it, so the sandbox route answers what to connect instead of
// failing inside the SDK.
export const E2B_NOT_CONNECTED =
  'E2B is not connected: store your E2B API key as the E2B_API_KEY secret and redeploy to run fragments (README → Connecting E2B). The code above is ready to copy.'

export function e2bApiKey(): string | undefined {
  const key = process.env.E2B_API_KEY
  return key && key.length > 0 ? key : undefined
}

export function isE2BConnected(): boolean {
  return e2bApiKey() !== undefined
}
