# cloudflare-kv

Provisions the Cloudflare KV namespace the app's rate limits and share links live in (stage and prod)

Terraform-managed infrastructure, planned and applied per environment by its CI lane.

|              |                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Type         | `terraform`                                                                                          |
| Source       | `infra/terraform/cloudflare-kv`                                                                      |
| Environments | `stage`: `plan-only`, `apply` on a push to `main` · `prod`: `plan-only`, `apply` on a push to `main` |

## Depends on

- (none)

## Depended on by

- **web** — E2B's Fragments app generator (Next.js on Cloudflare Workers + Static Assets via @opennextjs/cloudflare, Workers AI its default model, per environment)
