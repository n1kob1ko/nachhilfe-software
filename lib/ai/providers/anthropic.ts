/**
 * Adapter for the Anthropic API (Claude), with structured output, thinking settings and prompt caching.
 * It handles answers the way the OpenRouter adapter does: a schema too large for structured output goes
 * into the instructions, small slips are repaired (parseLenient), a schema the API refuses is retried
 * once with the schema in the instructions, and a failed answer still reports its tokens.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam, BetaThinkingConfigParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { z } from "zod";
import { parseLenient } from "./repair";
import { ANTHROPIC_MAX_UNIONS, jsonIn, jsonSchemaOf, unionCount, withSchemaInstruction } from "./schema";
import type { AIRequest, AnswerFailure, Part, Transport } from "./types";

type Shape = { thinking?: BetaThinkingConfigParam; output_config: { effort?: "low" | "medium" | "high" } };

/** How a request is shaped for a model: no thinking where the answer is short, effort where supported. */
export function requestShape(model: string, o: Pick<AIRequest, "thinking" | "effort">): Shape {
  // the small model answers directly and does not take an effort setting
  if (/haiku-4/.test(model)) return { output_config: {} };
  if (o.thinking === "aus") {
    // models with adaptive thinking that cannot switch it off: thinking only between tools = none here
    if (/sonnet-5-5/.test(model)) return { thinking: { type: "between_tools" }, output_config: { effort: o.effort } };
    // Haiku 5.5 takes "disabled" at effort high or below
    if (/haiku-5-5/.test(model)) return { thinking: { type: "disabled" }, output_config: { effort: o.effort } };
    return { output_config: { effort: o.effort } };
  }
  return { thinking: { type: "adaptive" }, output_config: { effort: o.effort } };
}

function block(p: Part): BetaContentBlockParam {
  if (p.type === "text") return { type: "text", text: p.text };
  if (p.type === "pdf") return { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.base64 } };
  return { type: "image", source: { type: "base64", media_type: p.mime, data: p.base64 } };
}

/**
 * The structured-output format of a schema, as the SDK prepares it for the API, but without its parse
 * function: the SDK would throw on an answer that does not fit, and the tokens of that answer would be
 * lost for the cost log. The adapter checks the answer itself.
 */
const formats = new WeakMap<z.ZodType, { type: "json_schema"; schema: Record<string, unknown> }>();
function formatOf(schema: z.ZodType) {
  let f = formats.get(schema);
  if (!f) {
    const { type, schema: json } = betaZodOutputFormat(schema as Parameters<typeof betaZodOutputFormat>[0]);
    formats.set(schema, (f = { type, schema: json as Record<string, unknown> }));
  }
  return f;
}

/**
 * The request body (exported for tests: what leaves the app is visible there). The schema goes as
 * structured output where the API takes it, else into the instructions.
 */
export function anthropicBody(req: AIRequest, o: { schemaInPrompt?: boolean } = {}) {
  const shape = requestShape(req.model, req);
  const format = formatOf(req.schema);
  const tooBig = unionCount(format.schema) > ANTHROPIC_MAX_UNIONS;
  const structured = !tooBig && !o.schemaInPrompt && !req.schemaInPrompt;
  const system = structured ? req.system : withSchemaInstruction(req.system, req.schema);
  return {
    model: req.model,
    max_tokens: req.maxTokens,
    // system prompt (and output schema) are the same for every request of a function: cached where it pays off
    system: [req.cache === "aus" ? { type: "text" as const, text: system } : { type: "text" as const, text: system, cache_control: { type: "ephemeral" as const, ttl: req.cache } }],
    messages: [{ role: "user" as const, content: typeof req.content === "string" ? req.content : req.content.map(block) }],
    ...(shape.thinking ? { thinking: shape.thinking } : {}),
    output_config: { ...shape.output_config, ...(structured ? { format } : {}) },
  };
}

/** A 400 about the answer schema (too many union types, an unsupported keyword): worth one try with the schema in the instructions. */
function schemaRefused(e: unknown) {
  return (e as { status?: unknown } | null)?.status === 400 && /schema|union|output_config\.format/i.test(e instanceof Error ? e.message : String(e));
}

let client: Anthropic | null = null;
export const anthropicTransport: Transport = async (req) => {
  client ??= new Anthropic();
  const send = (body: ReturnType<typeof anthropicBody>) =>
    // streamed: a non-streamed request with a large max_tokens is refused by the SDK (10-minute rule)
    client!.beta.messages.stream(body, { signal: req.signal, timeout: req.timeoutMs, maxRetries: 1 }).finalMessage();
  const body = anthropicBody(req);
  let res: Awaited<ReturnType<typeof send>>;
  try {
    res = await send(body);
  } catch (e) {
    if (!("format" in body.output_config) || !schemaRefused(e)) throw e;
    res = await send(anthropicBody(req, { schemaInPrompt: true }));
  }
  const u = res.usage;
  const refusal = res.stop_reason === "refusal";
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const raw = refusal ? null : jsonIn(text);
  const checked = raw == null ? null : parseLenient(req.schema, raw, jsonSchemaOf(req.schema));
  // no usable answer: cut off at the token limit, empty, no JSON in it, or JSON that does not fit the schema
  const failure: AnswerFailure | undefined =
    checked?.data != null || refusal ? undefined : res.stop_reason === "max_tokens" ? "unvollstaendig" : !text.trim() ? "leer" : raw == null ? "json" : "schema";
  const problem =
    failure === "unvollstaendig" ? "Antwort abgeschnitten: Token-Grenze erreicht" : failure === "leer" ? "Antwort ist leer" : failure === "json" ? "Antwort enthält kein JSON" : checked?.problem;
  const thinking = u.output_tokens_details?.thinking_tokens;
  return {
    parsed: checked?.data ?? null,
    refusal,
    ...(problem ? { problem } : {}),
    ...(failure ? { failure } : {}),
    model: res.model,
    usage: {
      input: u.input_tokens,
      output: u.output_tokens,
      cacheWrite: u.cache_creation ? u.cache_creation.ephemeral_5m_input_tokens : (u.cache_creation_input_tokens ?? 0),
      cacheWrite1h: u.cache_creation?.ephemeral_1h_input_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
      ...(typeof thinking === "number" ? { reasoning: thinking } : {}),
    },
  };
};

/** Only for tests: a stand-in for the SDK client (null = the real one on the next request). */
export function setAnthropicClientForTests(c: unknown) {
  client = c as Anthropic | null;
}
