/**
 * The answer's shape as JSON schema, shared by the adapters: what goes to a provider as structured
 * output, what goes into the instructions when it cannot, and how the JSON is found in a reply.
 */
import { z } from "zod";

const schemaJson = new WeakMap<z.ZodType, Record<string, unknown>>();
/** The JSON schema of a zod schema (input side), computed once per schema. */
export function jsonSchemaOf(schema: z.ZodType) {
  let s = schemaJson.get(schema);
  if (!s) {
    const { $schema: _drop, ...rest } = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
    schemaJson.set(schema, (s = rest));
  }
  return s;
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

/** Properties that may hold more than one type (a nullable field is one), counted through the whole schema. */
export function unionCount(s: unknown): number {
  if (!s || typeof s !== "object") return 0;
  if (Array.isArray(s)) return s.reduce((n: number, x) => n + unionCount(x), 0);
  const o = s as Record<string, unknown>;
  const own = Array.isArray(o.anyOf) || Array.isArray(o.oneOf) || (Array.isArray(o.type) && o.type.length > 1) ? 1 : 0;
  return own + Object.values(o).reduce((n: number, v) => n + unionCount(v), 0);
}

/** Anthropic refuses an output schema with more nullable fields than this ("too many parameters with union types"). */
export const ANTHROPIC_MAX_UNIONS = 16;

/** The instructions with the answer's shape spelled out, for a request that does not send it as structured output. */
export function withSchemaInstruction(system: string, schema: z.ZodType) {
  return `${system}\n\nAntworte ausschließlich mit einem JSON-Objekt nach diesem JSON-Schema:\n${JSON.stringify(jsonSchemaOf(schema))}`;
}
