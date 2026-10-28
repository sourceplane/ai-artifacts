// OpenNext Cloudflare adapter config.
//
// The page is pre-rendered at build time (it is a client app: the chat, the
// models and the preview all run in the browser), and every API route is
// dynamic. Nothing revalidates, so the static-assets incremental cache serves
// the pre-rendered page straight from the Worker's static assets (read only,
// nothing to provision for it); scripts/populate-static-assets-cache.mjs puts
// it there at build time. An app that revalidates (ISR, `revalidateTag`)
// swaps this for the R2 incremental cache plus a tag cache.
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
