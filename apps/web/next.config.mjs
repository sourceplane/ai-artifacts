import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required by @opennextjs/cloudflare, which bundles `.next/standalone/**`
  // into the Worker; traced from the monorepo root.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // Upstream's one header: the app is never framed (a fragment's preview is
  // framed BY it, from E2B's own domain).
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
      },
    ]
  },
}

// `next dev` reaches the KV and AI bindings through wrangler's local platform
// proxy (render apps/web/wrangler.jsonc first: `pnpm run wire:fixture`). Only
// the dev server starts it: the AI binding has no local mode, so the proxy
// opens a remote session — and a build must need no Cloudflare credential (a
// local or verify build has none; a deploy lane's token is for the deploy).
export default function config(phase) {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    initOpenNextCloudflareForDev()
  }
  return nextConfig
}
