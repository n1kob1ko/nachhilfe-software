/**
 * Answers that miss the expected shape in small ways, repaired before the app gives up on them.
 * When the shape is only described in the instructions (not enforced by the provider), a model often
 * leaves out empty fields, writes "" for an unused choice or a number as text. One bad entry in a list
 * (one task of six) costs that entry, not the whole answer. Works on the JSON schema of the zod schema,
 * so it fits every answer shape of the app.
 */
import type { z } from "zod";

type Json = Record<string, unknown>;
const isObj = (x: unknown): x is Json => Boolean(x) && typeof x === "object" && !Array.isArray(x);
const typesOf = (s: Json): string[] => (Array.isArray(s.type) ? (s.type as string[]) : typeof s.type === "string" ? [s.type] : []);
const branchesOf = (s: Json): Json[] => (Array.isArray(s.anyOf) ? (s.anyOf as unknown[]).filter(isObj) : [s]);
const nullable = (s: Json) => branchesOf(s).some((b) => typesOf(b).includes("null"));

/** The value as the schema wants it, where that is plain: case of a choice, a number in quotes, an empty field left out. */
export function repair(value: unknown, schema: unknown): unknown {
  if (!isObj(schema)) return value;
  const branches = branchesOf(schema).filter((b) => !typesOf(b).includes("null") || typesOf(b).length > 1);
  const s = branches[0] ?? schema;
  if (value === null && !nullable(schema)) {
    // null where the shape has no empty value: an empty list or "no"
    if (typesOf(s).includes("array")) return [];
    if (typesOf(s).includes("boolean")) return false;
  }
  if (value === null || value === undefined) return value;
  if (Array.isArray(s.enum)) {
    const options = s.enum as unknown[];
    if (options.includes(value)) return value;
    const hit = typeof value === "string" ? options.find((o) => typeof o === "string" && o.toLowerCase() === value.trim().toLowerCase()) : undefined;
    if (hit !== undefined) return hit;
    return nullable(schema) ? null : value;
  }
  const types = typesOf(s);
  if (types.includes("integer") || types.includes("number")) {
    const n = typeof value === "string" && value.trim() !== "" ? Number(value.trim().replace(",", ".")) : value;
    if (typeof n !== "number" || !Number.isFinite(n)) return nullable(schema) && value === "" ? null : value;
    return types.includes("integer") ? Math.round(n) : n;
  }
  if (types.includes("boolean")) return value === "true" ? true : value === "false" ? false : value;
  if (types.includes("string")) return typeof value === "number" || typeof value === "boolean" ? String(value) : value;
  if (types.includes("array") && Array.isArray(value)) return s.items ? value.map((v) => repair(v, s.items)) : value;
  if (isObj(value) && isObj(s.properties)) {
    const out: Json = { ...value };
    for (const [k, ps] of Object.entries(s.properties as Record<string, unknown>)) {
      if (!isObj(ps)) continue;
      if (out[k] === undefined) {
        if (nullable(ps)) out[k] = null;
        else if (typesOf(ps).includes("array")) out[k] = [];
        else if (typesOf(ps).includes("boolean")) out[k] = false;
      } else out[k] = repair(out[k], ps);
    }
    return out;
  }
  return value;
}

/** Where and what, without the content of the answer (it may hold learning data). */
function summary(issues: z.ZodError["issues"]) {
  return issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "Antwort"}: ${i.message}`)
    .join("; ")
    .slice(0, 300);
}

/**
 * Checks an answer against the schema: as it came, then repaired, then without the list entries that
 * still do not fit. `problem` says what was wrong (also when entries were dropped), never the content.
 */
export function parseLenient<S extends z.ZodType>(schema: S, raw: unknown, json: unknown): { data: z.infer<S> | null; dropped: number; problem?: string } {
  const first = schema.safeParse(raw);
  if (first.success) return { data: first.data, dropped: 0 };
  let value = repair(raw, json);
  let result = schema.safeParse(value);
  let dropped = 0;
  const firstProblem = summary(result.success ? first.error.issues : result.error.issues);
  // a list at the top (tasks, questions …): drop the entries that still do not fit, keep the others
  for (let round = 0; !result.success && round < 50 && isObj(value); round++) {
    const bad = new Map<string, Set<number>>();
    for (const issue of result.error.issues) {
      const [key, index] = issue.path;
      if (typeof key === "string" && typeof index === "number" && Array.isArray((value as Json)[key])) {
        if (!bad.has(key)) bad.set(key, new Set());
        bad.get(key)!.add(index);
      }
    }
    if (!bad.size) break;
    const next: Json = { ...(value as Json) };
    for (const [key, indexes] of bad) {
      next[key] = ((value as Json)[key] as unknown[]).filter((_, i) => !indexes.has(i));
      dropped += indexes.size;
    }
    value = next;
    result = schema.safeParse(value);
  }
  if (!result.success) return { data: null, dropped, problem: `Antwort passt nicht zur Form: ${summary(result.error.issues)}` };
  return { data: result.data, dropped, ...(dropped ? { problem: `${dropped} ${dropped === 1 ? "Eintrag" : "Einträge"} verworfen: ${firstProblem}` } : {}) };
}
