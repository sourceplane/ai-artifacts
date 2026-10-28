# Implementation plan — ai-artifacts

| Milestone | Lands | Done when |
|---|---|---|
| AA0 — the spec | `intent.yaml`, `ci.yml` (turso-starter's, byte for byte), the shared tooling, the spec index, this doc set, AA-1…AA-5 | merged on `main` |
| AA1 — the app on Workers | `apps/web`: the page and components, the chat, sandbox, morph-chat and publish routes, `lib/` (models with the Workers AI default, KV rate limit and links, E2B secrets), the wrangler template, fixture and committed render; `tests/web` | typecheck, lint, test and build green; the Worker's dry-run size fits Workers Free; `wrangler dev` streams a fragment |
| AA2 — the KV namespace | `infra/terraform/cloudflare-kv` (kv-redis-starter's root), its component and the app's enforced edge on it | `terraform validate`; the product's merge plan applies the namespace before the Worker |
| AA3 — ready to instantiate | the README (run, test, preview, connect E2B and models, deploy), the as-built status | a reader can do each |
| AA4 — a baseline | `blueprint.yaml`, `repo-blueprint.yaml`, `.baseline/`, rebrand and bootstrap tooling, the context pack, phase cards, `testing/`, `baseline.yml`, `tag.yml` | Baseline CI green |

Each milestone is one pull request into `main`, squash-merged once its CI is green.
