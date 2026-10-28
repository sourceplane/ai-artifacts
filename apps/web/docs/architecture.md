# web — architecture

Built by the turbo pipeline from `apps/web` and deployed with wrangler.

|                     |                                                 |
| ------------------- | ----------------------------------------------- |
| Worker config       | `apps/web/wrangler.template.jsonc`              |
| Entry               | `.open-next/worker.js`                          |
| Compatibility date  | `2026-10-01`                                    |
| Compatibility flags | `nodejs_compat`, `global_fetch_strictly_public` |

## Bindings

| Binding  | Kind                 | Source                                  |
| -------- | -------------------- | --------------------------------------- |
| `KV`     | Workers KV namespace | `app_kv_id` from `cloudflare-kv`        |
| `AI`     | Workers AI           | account-level; no resource to provision |
| `ASSETS` | Static assets        | `.open-next/assets`                     |

Identifiers marked _from_ a component are filled in at deploy time from
that component's published outputs for the environment being deployed.

## Wiring

Resolved at deploy time from secrets the infrastructure lanes publish (names only):

- `WIRING_CLOUDFLARE_KV_PROD`
- `WIRING_CLOUDFLARE_KV_STAGE`

## Secrets resolved by the lane (names only)

- `ANTHROPIC_API_KEY` (optional)
- `DEEPSEEK_API_KEY` (optional)
- `E2B_API_KEY` (optional)
- `FIREWORKS_API_KEY` (optional)
- `GOOGLE_GENERATIVE_AI_API_KEY` (optional)
- `GROQ_API_KEY` (optional)
- `MISTRAL_API_KEY` (optional)
- `MORPH_API_KEY` (optional)
- `OPENAI_API_KEY` (optional)
- `TOGETHER_API_KEY` (optional)
- `XAI_API_KEY` (optional)
