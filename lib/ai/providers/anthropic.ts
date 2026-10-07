/** Adapter for the Anthropic API (Claude), with structured output, thinking settings and prompt caching. */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam, BetaThinkingConfigParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { AIRequest, Part, Transport } from "./types";

type Shape = { thinking?: BetaThinkingConfigParam; output_config: { effort?: "low" | "medium" | "high" } };

/** How a request is shaped for a model: no thinking where the answer is short, effort where supported. */
export function requestShape(model: string, o: Pick<AIRequest, "thinking" | "effort">): Shape {
  // the small model answers directly and does not take an effort setting
  if (/haiku/.test(model)) return { output_config: {} };
  if (o.thinking === "aus") {
    // models with adaptive thinking that cannot switch it off: thinking only between tools = none here
    return /sonnet-5-5/.test(model) ? { thinking: { type: "between_tools" }, output_config: { effort: o.effort } } : { output_config: { effort: o.effort } };
  }
  return { thinking: { type: "adaptive" }, output_config: { effort: o.effort } };
}

function block(p: Part): BetaContentBlockParam {
  if (p.type === "text") return { type: "text", text: p.text };
  if (p.type === "pdf") return { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.base64 } };
  return { type: "image", source: { type: "base64", media_type: p.mime, data: p.base64 } };
}

let client: Anthropic | null = null;
export const anthropicTransport: Transport = async (req) => {
  client ??= new Anthropic();
  const shape = requestShape(req.model, req);
  // streamed: a non-streamed request with a large max_tokens is refused by the SDK (10-minute rule)
  const res = await client.beta.messages
    .stream(
      {
        model: req.model,
        max_tokens: req.maxTokens,
        // system prompt (and output schema) are the same for every request of a function: cached where it pays off
        system: [req.cache === "aus" ? { type: "text", text: req.system } : { type: "text", text: req.system, cache_control: { type: "ephemeral", ttl: req.cache } }],
        messages: [{ role: "user", content: typeof req.content === "string" ? req.content : req.content.map(block) }],
        ...(shape.thinking ? { thinking: shape.thinking } : {}),
        output_config: { ...shape.output_config, format: betaZodOutputFormat(req.schema) },
      },
      { signal: req.signal, timeout: req.timeoutMs, maxRetries: 1 },
    )
    .finalMessage();
  const u = res.usage;
  return {
    parsed: res.parsed_output ?? null,
    refusal: res.stop_reason === "refusal",
    model: res.model,
    usage: {
      input: u.input_tokens,
      output: u.output_tokens,
      cacheWrite: u.cache_creation ? u.cache_creation.ephemeral_5m_input_tokens : (u.cache_creation_input_tokens ?? 0),
      cacheWrite1h: u.cache_creation?.ephemeral_1h_input_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
    },
  };
};
