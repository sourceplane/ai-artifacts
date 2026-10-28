# Epics

Orun-style work programs. Each epic is a folder carrying `epic.yaml` (the
declaration the platform reads: slug, key prefix, milestones with exit
criteria and task keys) beside its doc set. The pull request that adds the
folder is the adoption; the merge creates the epic in the workspace.

| Epic | Cluster | Status | What it is |
|------|---------|--------|------------|
| [`ai-artifacts/`](./ai-artifacts/) | **AA** | AA0–AA3 shipped; AA4 in progress | E2B's Fragments — an AI app generator whose code runs in E2B sandboxes — equivalent in code and function on ONE Cloudflare Worker, the code written by Workers AI with no key, the rate limits and share links in Workers KV — and an Orun baseline that instantiates it in one landing |

As-built ≠ intent: what shipped lives in each epic's `IMPLEMENTATION-STATUS.md`.
