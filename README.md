# ai-artifacts

[Fragments](https://github.com/e2b-dev/fragments) — E2B's open-source AI app
generator: describe an app or an analysis, a model writes it, and E2B runs it
in a cloud sandbox — on **one Cloudflare Worker** built by
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare), its default
model **Workers AI** with no key, its rate limits and share links in a
**Workers KV** namespace provisioned by Terraform through
[Orun](https://github.com/sourceplane/orun), and packaged, once it is built,
as an **Orun baseline**.

Being built in reviewed steps; the plan and its status are in
[`specs/epics/ai-artifacts`](specs/epics/ai-artifacts/README.md).

Fragments is © FoundryLabs, Inc. (E2B), under the Apache License 2.0.
