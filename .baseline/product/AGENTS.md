# AGENTS.md — ai-artifacts

For a coding agent (or a person) about to change this repository.

## What this is

An AI app generator: describe an app or an analysis, a model writes it as a
fragment (code, stack, dependencies) streamed into the page, and E2B runs it
in a cloud sandbox. Next.js on Cloudflare Workers + Static Assets (built by
`@opennextjs/cloudflare`), its default model Workers AI through the Worker's
`AI` binding, its rate limits and share links in a Workers KV namespace that
Terraform provisions per environment. It is an
[Orun](https://github.com/sourceplane/orun) repository: `intent.yaml`
declares the environments, and each `component.yaml` is a component Orun
plans and deploys.

| Component | Path | What it is |
|---|---|---|
| `web` | `apps/web` | the app and its Worker, `ai-artifacts-web-<env>` |
| `cloudflare-kv` | `infra/terraform/cloudflare-kv` | the KV namespace on stage and prod |
| `web-tests` | `tests/web` | vitest, against in-memory KV and AI bindings |

## Read first

1. `README.md` — run, test, preview, connect E2B and the models, and how it
   deploys.
2. `ai/context/operations.md` — the operating contract: deploy order,
   secrets, caveats, common operations.
3. `ai/context/deployment.md` — what is live now: URLs, workspace, secrets
   by name.
4. `apps/web/app/page.tsx` — the page; then `apps/web/app/api/chat/route.ts`
   (the model call), `apps/web/app/api/sandbox/route.ts` (E2B) and
   `apps/web/lib/models.ts` (which model, which key).
5. `infra/terraform/cloudflare-kv` — the namespace, and the wiring document
   (`WIRING_CLOUDFLARE_KV`) the app's build reads its id from.

## Before you push

```bash
pnpm install
pnpm run wire:fixture        # apps/web/wrangler.jsonc from the offline fixture
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Run them yourself: the pull request's lanes build and dry-deploy the app
and plan the KV root, but do not run the tests or the linter.

## How changes land

- One change, one pull request into `main`. If the work is an Orun task,
  open the pull request for it: `orun pr open --task <KEY>`.
- On the pull request, `ci.yml` plans with `orun plan --changed` and
  verifies: the KV root plans, the app builds and dry-deploys. Nothing
  applies or deploys.
- The merge is the deploy. `ci.yml` plans the changed components and runs
  each lane: the KV namespace applies first, then the app builds with its
  id, hands the stored keys to the Worker as secrets, deploys and is
  smoke-tested — stage, then prod.
- A new component is a directory under `apps/`, `infra/`, `packages/` or
  `tests/` with a `component.yaml`; `ai/context/operations.md` says how to
  add a binding.

## What not to touch

- `intent.yaml` → `execution.state.workspace`: the workspace CI
  authenticates to. Also the stack-tectonic pin (`0.19.0`); its comment says
  why it is not `0.20.0`.
- `apps/web/wrangler.jsonc` is generated. Edit `wrangler.template.jsonc`,
  then `pnpm run wire:fixture`, and commit both; the deploy renders its own
  config from the template, so a stale committed render misleads local work.
- `apps/web/component.yaml`'s `dependsOn: cloudflare-kv`: it is what makes
  the namespace apply before the Worker deploys on `main`.
- The last line of each `component.yaml` (`# orun: redeploy …`) is a deploy
  trigger; change it only to redeploy.
- `ai/context/deployment.md` is regenerated from probed state; a hand edit is
  overwritten. `.rebrand/values.json` records the site's identity; leave it.
- Only `ci.yml` may run on a push to `main`.
- No secret value goes in the repository, and none reaches the build: the
  E2B and model keys are Orun secrets the build strips from its environment
  (`env -u …`) and hands to the Worker as Worker secrets. The Cloudflare
  token and account id are brokered from the workspace's Cloudflare
  connection; list secrets by name only (`orun secrets list`).
- `apps/web/lib/models.ts`'s `DEFAULT_MODEL_ID` must stay a Workers AI model
  with JSON mode: the fragment is a structured object, and a fresh product
  has no other key.
