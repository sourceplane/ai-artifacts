# Risks and open questions — ai-artifacts

| # | Risk / question | Status |
|---|---|---|
| AA-A | Does the E2B SDK run on Workers? | **Settled by a spike before AA0**: `@e2b/code-interpreter` 2.9.0 and `e2b` 2.56.0 bundle for workerd with `nodejs_compat`, and under `wrangler dev` `Sandbox.create` reached E2B's API (a fake key answered `401 Invalid API key`). A real sandbox run is proven only live, with a key |
| AA-B | A Workers AI model must follow the fragment's JSON schema | `workers-ai-provider` sends the schema as `response_format: json_schema`; the default is a model Cloudflare lists for JSON mode. Proven offline against a stand-in only |
| AA-C | Worker size on Workers Free (3 MiB gzipped) | Accepted: 1875 KiB gzipped at AA1 (9073 KiB raw); the e2e's dry run prints it |
| AA-D | KV is eventually consistent, so the rate limit is approximate across locations | Accepted: upstream's limit is a cost guard, not a quota |
| AA-E | Vertex and Ollama are left out | Decided: neither fits a Worker |
| AA-F | No live bootstrap yet: the repository link, a real `terraform apply`, the lease-published document, a real `wrangler deploy`, the secrets push and the probes | OPEN — closed by one bootstrap from a tag against a workspace |
