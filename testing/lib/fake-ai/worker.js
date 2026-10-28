// A DETERMINISTIC STAND-IN FOR WORKERS AI, for testing/e2e.test.sh only.
//
// The product writes fragments through the Worker's `AI` binding
// (apps/web/lib/models.ts, via workers-ai-provider): `env.AI.run(model,
// inputs, options)`, with the fragment's JSON schema as
// `inputs.response_format` and — for the page's streamed object —
// `inputs.stream: true`, answered with a server-sent-event stream of
// `data: {"response": "<delta>"}` events ending in `data: [DONE]`. Workers AI
// has no local mode and cannot be called offline, so under `wrangler dev` the
// e2e points the `AI` binding at this Worker instead (a service binding to its
// `FakeAI` entrypoint, an RPC method with the binding's own shape). It answers
// with a canned fragment — a Python cell — that names the model it was asked
// for, split into small deltas as a model streams them. What that proves is
// the app's half — the route, the provider, the schema, the stream — not that
// a real model follows the schema: that is only verified live.
import { WorkerEntrypoint } from "cloudflare:workers";

const calls = [];

export function cannedFragment(model) {
  return {
    commentary: `A one-cell analysis, written by ${model} (the stand-in for Workers AI).`,
    template: "code-interpreter-v1",
    title: "Sum check",
    description: "Prints the sum of one and one.",
    additional_dependencies: [],
    has_additional_dependencies: false,
    install_dependencies_command: "",
    port: null,
    file_path: "script.py",
    code: "print(1 + 1)",
  };
}

function sse(text) {
  const enc = new TextEncoder();
  const deltas = text.match(/.{1,12}/gs) ?? [];
  return new ReadableStream({
    start(controller) {
      for (const d of deltas) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ response: d })}\n\n`));
      }
      controller.enqueue(
        enc.encode(`data: ${JSON.stringify({ response: "", usage: { prompt_tokens: 7, completion_tokens: deltas.length, total_tokens: 7 + deltas.length } })}\n\n`),
      );
      controller.enqueue(enc.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

export class FakeAI extends WorkerEntrypoint {
  async run(model, inputs) {
    const schema = inputs?.response_format?.json_schema;
    calls.push({ model, stream: Boolean(inputs?.stream), schema: Boolean(schema) });
    const body = JSON.stringify(cannedFragment(model));
    if (inputs?.stream) return sse(body);
    return { response: body, usage: { prompt_tokens: 7, completion_tokens: 40, total_tokens: 47 } };
  }
}

export default {
  // What the stand-in was asked: the model, whether it streamed, and whether
  // the request carried a JSON schema.
  fetch() {
    return Response.json(calls);
  },
};
