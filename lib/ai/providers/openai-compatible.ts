/**
 * Adapter for APIs that speak the OpenAI chat-completions format: OpenRouter, DeepSeek and any other
 * compatible endpoint (AI_COMPATIBLE_BASE_URL). Plain fetch, no extra SDK. Another provider of this
 * kind is one more entry in FLAVORS.
 */
import { z } from "zod";
import type { ProviderId, Usage } from "../config";
import type { AIRequest, Capabilities, Part, Transport } from "./types";

type Flavor = Capabilities & {
  label: string;
  baseUrl: () => string;
  key: () => string;
  /** json_schema response format; otherwise json_object with the schema in the instructions */
  jsonSchema: () => boolean;
  /** extra request fields for this provider */
  extra?: (req: AIRequest) => Record<string, unknown>;
};

const env = (name: string) => process.env[name]?.trim() ?? "";

export const FLAVORS: Record<Exclude<ProviderId, "anthropic">, Flavor> = {
  openrouter: {
    label: "OpenRouter",
    baseUrl: () => env("OPENROUTER_BASE_URL") || "https://openrouter.ai/api/v1",
    key: () => env("OPENROUTER_API_KEY"),
    jsonSchema: () => true,
    images: true,
    pdf: true,
    // usage.include: OpenRouter reports the price it charged; reasoning only where the function may think
    extra: (req) => ({ usage: { include: true }, ...(req.thinking === "adaptiv" ? { reasoning: { effort: req.effort } } : {}) }),
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: () => env("DEEPSEEK_BASE_URL") || "https://api.deepseek.com",
    key: () => env("DEEPSEEK_API_KEY"),
    jsonSchema: () => false,
    images: false,
    pdf: false,
  },
  compatible: {
    label: "OpenAI-kompatibel",
    baseUrl: () => env("AI_COMPATIBLE_BASE_URL"),
    key: () => env("AI_COMPATIBLE_API_KEY"),
    jsonSchema: () => env("AI_COMPATIBLE_JSON_SCHEMA") !== "0",
    images: true,
    pdf: false,
  },
};

const schemaJson = new WeakMap<z.ZodType, Record<string, unknown>>();
function jsonSchemaOf(schema: z.ZodType) {
  let s = schemaJson.get(schema);
  if (!s) {
    const { $schema: _drop, ...rest } = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
    schemaJson.set(schema, (s = rest));
  }
  return s;
}

function part(p: Part, provider: string, model: string) {
  if (p.type === "text") return { type: "text", text: p.text };
  if (p.type === "image") return { type: "image_url", image_url: { url: `data:${p.mime};base64,${p.base64}` } };
  if (provider === "openrouter") return { type: "file", file: { filename: "material.pdf", file_data: `data:application/pdf;base64,${p.base64}` } };
  throw new Error(`PDF wird von ${model} nicht unterstützt.`);
}

/** The JSON object in a reply, also when the model wraps it in a code fence or adds a sentence. */
export function jsonIn(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const allowsNull = (s: Record<string, unknown>) =>
  s.type === "null" || (Array.isArray(s.type) && s.type.includes("null")) || (Array.isArray(s.anyOf) && s.anyOf.some((x) => (x as Record<string, unknown>)?.type === "null"));

/**
 * Fields the schema allows to be null but the answer left out, set to null (all the way down). Without
 * the schema as response format a model often skips empty fields; the content is still complete.
 */
export function fillNulls(value: unknown, schema: unknown): unknown {
  if (!schema || typeof schema !== "object" || value == null) return value;
  const s = schema as Record<string, unknown>;
  const branches = [s, ...((Array.isArray(s.anyOf) ? s.anyOf : []) as unknown[])].filter((b): b is Record<string, unknown> => Boolean(b) && typeof b === "object");
  if (Array.isArray(value)) {
    const items = branches.find((b) => b.items)?.items;
    return items ? value.map((v) => fillNulls(v, items)) : value;
  }
  if (typeof value !== "object") return value;
  const props = branches.find((b) => b.properties)?.properties as Record<string, Record<string, unknown>> | undefined;
  if (!props) return value;
  const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const [k, ps] of Object.entries(props)) {
    if (out[k] === undefined) {
      if (allowsNull(ps)) out[k] = null;
    } else out[k] = fillNulls(out[k], ps);
  }
  return out;
}

type ChatResponse = {
  model?: string;
  choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
    prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
    prompt_cache_hit_tokens?: number;
  };
};

/** Usage in the router's terms: input at full price, cache writes and reads apart. */
export function usageOf(u: ChatResponse["usage"]): Usage {
  const prompt = u?.prompt_tokens ?? 0;
  const cacheRead = u?.prompt_tokens_details?.cached_tokens ?? u?.prompt_cache_hit_tokens ?? 0;
  const cacheWrite = u?.prompt_tokens_details?.cache_write_tokens ?? 0;
  return { input: Math.max(0, prompt - cacheRead - cacheWrite), output: u?.completion_tokens ?? 0, cacheWrite, cacheRead };
}

/** Properties that may hold more than one type (a nullable field is one), counted through the whole schema. */
export function unionCount(s: unknown): number {
  if (!s || typeof s !== "object") return 0;
  if (Array.isArray(s)) return s.reduce((n: number, x) => n + unionCount(x), 0);
  const o = s as Record<string, unknown>;
  const own = Array.isArray(o.anyOf) || Array.isArray(o.oneOf) || (Array.isArray(o.type) && o.type.length > 1) ? 1 : 0;
  return own + Object.values(o).reduce((n: number, v) => n + unionCount(v), 0);
}
/** Anthropic refuses an output schema with more nullable fields than this ("too many parameters with union types"). */
const ANTHROPIC_MAX_UNIONS = 16;

/**
 * The request body for a provider (exported for tests: what leaves the app is visible there).
 * The answer's shape goes as json_schema where the model takes it, else into the instructions; the
 * transport checks every answer against the schema either way.
 */
export function chatBody(req: AIRequest, o: { schemaInPrompt?: boolean } = {}) {
  const flavor = FLAVORS[req.provider as keyof typeof FLAVORS];
  const schema = jsonSchemaOf(req.schema);
  const tooBig = req.provider === "openrouter" && req.model.startsWith("anthropic/") && unionCount(schema) > ANTHROPIC_MAX_UNIONS;
  const structured = flavor.jsonSchema() && !tooBig && !o.schemaInPrompt;
  const system = structured ? req.system : `${req.system}\n\nAntworte ausschließlich mit einem JSON-Objekt nach diesem JSON-Schema:\n${JSON.stringify(schema)}`;
  // OpenRouter passes cache_control on to Anthropic models; DeepSeek and most others cache by themselves
  const cacheHere = req.cache !== "aus" && req.provider === "openrouter" && req.model.startsWith("anthropic/");
  return {
    model: req.model,
    max_tokens: req.maxTokens,
    messages: [
      { role: "system", content: cacheHere ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] : system },
      { role: "user", content: typeof req.content === "string" ? req.content : req.content.map((p) => part(p, req.provider, req.model)) },
    ],
    // OpenRouter: without a schema no response_format at all (not every model behind it knows json_object)
    ...(structured ? { response_format: { type: "json_schema", json_schema: { name: "antwort", strict: false, schema } } } : req.provider === "openrouter" ? {} : { response_format: { type: "json_object" } }),
    ...(flavor.extra?.(req) ?? {}),
  };
}

export const openAICompatibleTransport: Transport = async (req) => {
  const flavor = FLAVORS[req.provider as keyof typeof FLAVORS];
  const base = flavor.baseUrl().replace(/\/+$/, "");
  if (!base) throw new Error(`Für ${flavor.label} ist keine Adresse eingestellt.`);
  let body = JSON.stringify(chatBody(req));
  let res: Response | null = null;
  let error = "";
  let schemaRetried = false;
  // one retry on overload or a server error, like the Anthropic adapter
  for (let attempt = 0; attempt < 2; attempt++) {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${flavor.key()}` },
      body,
      signal: req.signal,
    });
    if (res.ok) break;
    error = await res.text();
    // a model that refuses the answer schema (too large, unsupported): once more with the schema in the instructions
    if (res.status === 400 && !schemaRetried && /schema/i.test(error) && body.includes('"json_schema"')) {
      schemaRetried = true;
      body = JSON.stringify(chatBody(req, { schemaInPrompt: true }));
      attempt -= 1;
      continue;
    }
    if (!(res.status === 429 || res.status >= 500) || attempt === 1) break;
    await new Promise((r) => setTimeout(r, 800));
  }
  if (!res!.ok) throw new Error(`${flavor.label} antwortet mit ${res!.status}: ${error.slice(0, 200)}`);
  const data = (await res!.json()) as ChatResponse;
  const choice = data.choices?.[0];
  const text = choice?.message?.content ?? "";
  const refusal = choice?.finish_reason === "content_filter" || Boolean(choice?.message?.refusal);
  const raw = refusal ? null : jsonIn(text);
  let checked = raw == null ? null : req.schema.safeParse(raw);
  if (raw != null && !checked!.success) checked = req.schema.safeParse(fillNulls(raw, jsonSchemaOf(req.schema)));
  return {
    parsed: checked?.success ? checked.data : null,
    refusal,
    model: data.model || req.model,
    usage: usageOf(data.usage),
    ...(typeof data.usage?.cost === "number" ? { costUsd: data.usage.cost } : {}),
  };
};
