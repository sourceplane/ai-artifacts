# ai-artifacts — open risks

What is not yet proven or not yet decided. The full write-up of every risk,
including the accepted and resolved ones, is
`specs/epics/ai-artifacts/risks-and-open-questions.md`; this page lists
only what is still live, so it should be short.

| ID | Risk | State | What closes it |
|---|---|---|---|
| AA-B | A real Workers AI model must follow the fragment's JSON schema; offline only a stand-in answers | OPEN | One fragment written by the default model on a live deployment |
| AA-F | No live bootstrap yet: the repository created and linked, the token minted, a real `terraform apply`, the lease-published document, a real `wrangler deploy`, the secrets push and the probes are all unproven | OPEN | One bootstrap from a tag against a workspace |

Accepted, and worth knowing before you change them: AA-A (the E2B SDK on
workerd is proven by a spike; a real sandbox run only with a key), AA-C (the
Worker is 1.9 MiB gzipped, under Workers Free's 3 MiB), AA-D (the KV rate
limit is approximate across locations), AA-E (Vertex and Ollama are out).
