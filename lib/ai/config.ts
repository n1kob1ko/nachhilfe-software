/**
 * Everything about the KI that is a setting: which model each tier uses, what each function may spend,
 * prices and the monthly budget. Models and budget come from environment variables (Railway Variables);
 * the defaults below are the only place a model id is written down.
 */

export type Tier = "fast" | "standard" | "deep";

/** Defaults when no environment variable is set. Change the variable, not this list, to switch models. */
const DEFAULT_MODELS: Record<Tier, string> = {
  fast: "claude-haiku-4-5",
  standard: "claude-sonnet-5-5",
  deep: "claude-opus-5-5",
};
const MODEL_ENV: Record<Tier, string> = { fast: "AI_MODEL_FAST", standard: "AI_MODEL_STANDARD", deep: "AI_MODEL_DEEP" };

export function modelFor(tier: Tier): string {
  return process.env[MODEL_ENV[tier]]?.trim() || DEFAULT_MODELS[tier];
}

export const TIER_LABEL: Record<Tier, string> = { fast: "schnell", standard: "standard", deep: "tief" };

export type AIFunction =
  | "echtzeit"
  | "freitext"
  | "aufgaben"
  | "neue_aufgabe"
  | "block"
  | "einheit"
  | "analyse"
  | "tiefenanalyse"
  | "notiz"
  | "material";

export type FunctionSpec = {
  label: string;
  tier: Tier;
  /** upper limit of output tokens (a caller may ask for less, never for more) */
  maxTokens: number;
  timeoutMs: number;
  /** "aus": answer directly, no thinking; "adaptiv": the model decides how much to think */
  thinking: "aus" | "adaptiv";
  effort: "low" | "medium" | "high";
  /** runs during a unit; switched off first when the budget is used up */
  realtime: boolean;
  /** how long an identical request is answered from memory; 0 = never (each call must give something new) */
  reuseMs: number;
  /**
   * Prompt caching of the system prompt and output schema. Pays off only when the same function runs
   * again before the cache expires: a cache write costs 1.25× (5 min) or 2× (1 h) the input price, a read 0.1×.
   */
  cache: "aus" | "5m" | "1h";
};

const MIN = 60_000;
export const FUNCTIONS: Record<AIFunction, FunctionSpec> = {
  echtzeit: { label: "Echtzeit-Analyse", tier: "fast", maxTokens: 700, timeoutMs: 8_000, thinking: "aus", effort: "low", realtime: true, reuseMs: 30 * MIN, cache: "aus" },
  freitext: { label: "Freitext bewerten", tier: "standard", maxTokens: 900, timeoutMs: 12_000, thinking: "aus", effort: "low", realtime: true, reuseMs: 24 * 60 * MIN, cache: "aus" },
  block: { label: "Blockauswertung", tier: "standard", maxTokens: 1_200, timeoutMs: 30_000, thinking: "aus", effort: "low", realtime: true, reuseMs: 60 * MIN, cache: "1h" },
  neue_aufgabe: { label: "Neue Aufgabe in der Einheit", tier: "standard", maxTokens: 12_000, timeoutMs: 60_000, thinking: "adaptiv", effort: "low", realtime: false, reuseMs: 0, cache: "1h" },
  einheit: { label: "Zusammenfassung der Einheit", tier: "standard", maxTokens: 1_500, timeoutMs: 30_000, thinking: "aus", effort: "low", realtime: false, reuseMs: 24 * 60 * MIN, cache: "aus" },
  aufgaben: { label: "Aufgaben erstellen", tier: "standard", maxTokens: 64_000, timeoutMs: 180_000, thinking: "adaptiv", effort: "medium", realtime: false, reuseMs: 0, cache: "5m" },
  analyse: { label: "Schüler-Einschätzung", tier: "standard", maxTokens: 3_000, timeoutMs: 45_000, thinking: "aus", effort: "low", realtime: false, reuseMs: 10 * MIN, cache: "aus" },
  tiefenanalyse: { label: "Tiefenanalyse", tier: "deep", maxTokens: 8_000, timeoutMs: 120_000, thinking: "adaptiv", effort: "medium", realtime: false, reuseMs: 10 * MIN, cache: "aus" },
  notiz: { label: "Notiz für Eltern/Schüler", tier: "standard", maxTokens: 1_000, timeoutMs: 30_000, thinking: "aus", effort: "low", realtime: false, reuseMs: 0, cache: "aus" },
  material: { label: "Material erkennen", tier: "standard", maxTokens: 8_000, timeoutMs: 90_000, thinking: "aus", effort: "low", realtime: false, reuseMs: 24 * 60 * MIN, cache: "aus" },
};

// ---------- prices ----------

/** US dollars per million tokens. cacheWrite = 5-minute cache. */
export type Price = { in: number; out: number; cacheWrite: number; cacheRead: number };

/** List prices of the Anthropic price page (checked 2026-10-07). Override with AI_PRICES_JSON. */
const PRICES: [prefix: string, price: Price][] = [
  ["claude-haiku-4-5", { in: 1, out: 5, cacheWrite: 1.25, cacheRead: 0.1 }],
  ["claude-sonnet-5-5", { in: 2, out: 10, cacheWrite: 2.5, cacheRead: 0.2 }],
  ["claude-opus-5-5", { in: 4, out: 20, cacheWrite: 5, cacheRead: 0.2 }],
];
/** For a model without a known price: the price of the default model of its tier. */
const TIER_PRICE: Record<Tier, Price> = { fast: PRICES[0][1], standard: PRICES[1][1], deep: PRICES[2][1] };

function priceOverrides(): [string, Price][] {
  const raw = process.env.AI_PRICES_JSON;
  if (!raw) return [];
  try {
    const obj = JSON.parse(raw) as Record<string, Partial<Price>>;
    return Object.entries(obj).flatMap(([k, p]) =>
      typeof p?.in === "number" && typeof p?.out === "number"
        ? [[k, { in: p.in, out: p.out, cacheWrite: p.cacheWrite ?? p.in * 1.25, cacheRead: p.cacheRead ?? p.in * 0.1 }] as [string, Price]]
        : [],
    );
  } catch {
    return [];
  }
}

export function priceFor(model: string, tier: Tier): { price: Price; known: boolean } {
  const hit = [...priceOverrides(), ...PRICES].find(([prefix]) => model.startsWith(prefix));
  return hit ? { price: hit[1], known: true } : { price: TIER_PRICE[tier], known: false };
}

/** cacheWrite: 5-minute cache, cacheWrite1h: 1-hour cache (twice the input price). */
export type Usage = { input: number; output: number; cacheWrite: number; cacheWrite1h?: number; cacheRead: number };

export function costOf(model: string, tier: Tier, u: Usage): number {
  const { price } = priceFor(model, tier);
  return (u.input * price.in + u.output * price.out + u.cacheWrite * price.cacheWrite + (u.cacheWrite1h ?? 0) * price.in * 2 + u.cacheRead * price.cacheRead) / 1_000_000;
}

// ---------- budget ----------

function num(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 && process.env[name]?.trim() ? v : fallback;
}

/** Monthly budget in USD and the share at which the page warns. */
export function budget() {
  return {
    monthlyUsd: num("AI_MONTHLY_BUDGET_USD", 10),
    warnAt: Math.min(1, num("AI_BUDGET_WARN", 0.8)),
    /** above the budget only realtime stops; at this share everything stops */
    hardAt: 1.2,
  };
}

/** Max. realtime analyses per unit and hour, a safety net against loops. */
export function realtimeCapPerHour() {
  return num("AI_REALTIME_MAX_PER_HOUR", 40);
}

export function aiSwitchedOff() {
  return ["1", "true", "ja"].includes((process.env.AI_DISABLED ?? "").trim().toLowerCase());
}

export function hasKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
