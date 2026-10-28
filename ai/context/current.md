# ai-artifacts — where this repository stands

The entry page for anyone (or any agent) picking this repository up. It is
this repository's own state and does not ship to a product built from it;
the two pages that do are [operations.md](operations.md) and
[deployment.md](deployment.md).

## What it is

E2B's Fragments — describe an app or an analysis, a model writes it as a
fragment, and E2B runs it in a cloud sandbox — on Cloudflare Workers + Static
Assets (through `@opennextjs/cloudflare`), its default model Workers AI
through the Worker's own binding (no key), its rate limits and share links
in Workers KV, the namespace from Terraform. It is packaged as an Orun
baseline: `orun new --blueprint repo-blueprint.yaml` builds a new product in
its own repository and takes it to live on stage and prod in one landing
(`01-product`: the KV namespace, then the Worker that binds it), then records
what went live (`02-docs`).

## Release

| | |
|---|---|
| Latest tag | `baseline-v1` (AA4, [#5](https://github.com/sourceplane/ai-artifacts/pull/5)) |
| Proven live | No. Everything short of the platform is proven offline in Baseline CI: the product built in orun's staged job tree, dry-deployed with the stage document's namespace id, served by `wrangler dev` with a Workers AI stand-in, a fragment streamed through the chat route and the deploy's own smoke passed. No bootstrap from a tag has run against a workspace (risk AA-F), and a real model following the schema (AA-B) and a real sandbox run (AA-A, beyond the spike) are unproven |

## Where to read

| Question | Page |
|---|---|
| What shipped, and every departure from upstream | `specs/epics/ai-artifacts/IMPLEMENTATION-STATUS.md` |
| Why it is built this way | [decisions.md](decisions.md), then `specs/epics/ai-artifacts/design.md` |
| What could still go wrong | [open-risks.md](open-risks.md), then `specs/epics/ai-artifacts/risks-and-open-questions.md` |
| How to instantiate it | `BOOTSTRAP.md`, `docs/phases/` |
| What each component is | `apps/web/docs/`, `infra/terraform/cloudflare-kv/docs/`, `tests/web/docs/` (generated; `python3 tooling/catalog/gen-component-docs.py`) |

## Next

1. Bootstrap one product from the tag against a workspace, store an E2B key,
   run a fragment, and record the timings (closes AA-F).
