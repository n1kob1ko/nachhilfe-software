/**
 * Everything about the KI that is a setting: which provider and model each area uses, what each
 * function may spend, prices and the monthly budget. Providers, models and budget come from environment
 * variables (Railway Variables); the defaults below are the only place a model id is written down.
 */

export type Tier = "fast" | "standard" | "deep";

/** The providers the router can talk to (adapters in ./providers). */
export const PROVIDER_IDS = ["anthropic", "openrouter", "deepseek", "compatible"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/**
 * Areas group the functions for configuration: AI_<AREA>_PROVIDER and AI_<AREA>_MODEL switch the
 * provider and model of every function in that area.
 */
export type Area = "REALTIME" | "EXERCISE" | "ANALYSIS" | "DEEP" | "MATERIAL" | "TEXT";
export const AREA_LABEL: Record<Area, string> = { REALTIME: "Echtzeit", EXERCISE: "Aufgaben", ANALYSIS: "Auswertung", DEEP: "Tiefenanalyse", MATERIAL: "Material", TEXT: "Textkorrektur" };

/** Defaults when no environment variable is set. Change the variable, not this list, to switch models. */
const DEFAULT_MODELS: Record<Tier, string> = {
  fast: "claude-haiku-4-5",
  standard: "claude-sonnet-5-5",
  deep: "claude-opus-5-5",
};
const MODEL_ENV: Record<Tier, string> = { fast: "AI_MODEL_FAST", standard: "AI_MODEL_STANDARD", deep: "AI_MODEL_DEEP" };

/**
 * Defaults on OpenRouter (prices checked 2026-10-09 on openrouter.ai): the small Claude model for
 * everyday work, the mid-size one for the rare deep analysis. Both read photos and PDFs and answer in
 * the app's JSON schema. Switch with AI_<AREA>_MODEL or AI_MODEL_<TIER>, no code change.
 */
const OPENROUTER_MODELS: Record<Tier, string> = {
  fast: "anthropic/claude-haiku-5.5",
  standard: "anthropic/claude-haiku-5.5",
  deep: "anthropic/claude-sonnet-5.5",
};

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
  | "material"
  | "textkorrektur"
  | "textanalyse"
  | "textpruefung"
  | "lesen"
  | "verbindungstest";

export type FunctionSpec = {
  label: string;
  /** which AI_<AREA>_PROVIDER / AI_<AREA>_MODEL apply */
  area: Area;
  /** default model (AI_MODEL_FAST/STANDARD/DEEP) and price fallback when no area model is set */
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
  /**
   * The answer's shape goes into the instructions instead of as json_schema. Sonnet 5.5 behind
   * OpenRouter does not think at all with json_schema (0 reasoning tokens in every Textkorrektur call,
   * 2026-10-09), but does with the shape in the instructions; Haiku thinks either way.
   */
  schemaInPrompt?: boolean;
};

const MIN = 60_000;
export const FUNCTIONS: Record<AIFunction, FunctionSpec> = {
  echtzeit: { label: "Echtzeit-Analyse", area: "REALTIME", tier: "fast", maxTokens: 700, timeoutMs: 8_000, thinking: "aus", effort: "low", realtime: true, reuseMs: 30 * MIN, cache: "aus" },
  freitext: { label: "Freitext bewerten", area: "ANALYSIS", tier: "standard", maxTokens: 900, timeoutMs: 12_000, thinking: "aus", effort: "low", realtime: true, reuseMs: 24 * 60 * MIN, cache: "aus" },
  block: { label: "Blockauswertung", area: "ANALYSIS", tier: "standard", maxTokens: 1_200, timeoutMs: 30_000, thinking: "aus", effort: "low", realtime: true, reuseMs: 60 * MIN, cache: "1h" },
  neue_aufgabe: { label: "Neue Aufgabe in der Einheit", area: "EXERCISE", tier: "standard", maxTokens: 12_000, timeoutMs: 60_000, thinking: "adaptiv", effort: "low", realtime: false, reuseMs: 0, cache: "1h" },
  einheit: { label: "Zusammenfassung der Einheit", area: "ANALYSIS", tier: "standard", maxTokens: 1_500, timeoutMs: 30_000, thinking: "aus", effort: "low", realtime: false, reuseMs: 24 * 60 * MIN, cache: "aus" },
  aufgaben: { label: "Aufgaben erstellen", area: "EXERCISE", tier: "standard", maxTokens: 64_000, timeoutMs: 180_000, thinking: "adaptiv", effort: "medium", realtime: false, reuseMs: 0, cache: "5m" },
  analyse: { label: "Schüler-Einschätzung", area: "ANALYSIS", tier: "standard", maxTokens: 3_000, timeoutMs: 45_000, thinking: "aus", effort: "low", realtime: false, reuseMs: 10 * MIN, cache: "aus" },
  tiefenanalyse: { label: "Tiefenanalyse", area: "DEEP", tier: "deep", maxTokens: 8_000, timeoutMs: 120_000, thinking: "adaptiv", effort: "medium", realtime: false, reuseMs: 10 * MIN, cache: "aus" },
  notiz: { label: "Notiz für Eltern/Schüler", area: "ANALYSIS", tier: "standard", maxTokens: 1_000, timeoutMs: 30_000, thinking: "aus", effort: "low", realtime: false, reuseMs: 0, cache: "aus" },
  material: { label: "Material erkennen", area: "MATERIAL", tier: "standard", maxTokens: 8_000, timeoutMs: 90_000, thinking: "aus", effort: "low", realtime: false, reuseMs: 24 * 60 * MIN, cache: "aus" },
  // only on the teacher's click, after consent; the same version of a text is never paid for twice
  textkorrektur: { label: "Textkorrektur", area: "TEXT", tier: "standard", maxTokens: 16_000, timeoutMs: 180_000, thinking: "adaptiv", effort: "low", realtime: false, reuseMs: 24 * 60 * MIN, cache: "aus" },
  // Textkorrektur „gründlich“ (lib/ai/textkorrektur-gruendlich.ts): sentence-by-sentence analysis, then an independent check of every suggestion
  textanalyse: { label: "Textkorrektur gründlich: Analyse", area: "TEXT", tier: "standard", maxTokens: 20_000, timeoutMs: 180_000, thinking: "adaptiv", effort: "medium", realtime: false, reuseMs: 24 * 60 * MIN, cache: "aus", schemaInPrompt: true },
  textpruefung: { label: "Textkorrektur gründlich: Prüfung", area: "TEXT", tier: "standard", maxTokens: 16_000, timeoutMs: 180_000, thinking: "adaptiv", effort: "medium", realtime: false, reuseMs: 24 * 60 * MIN, cache: "aus", schemaInPrompt: true },
  // Leseverständnis: one request for the reading text, one for the questions; only on the teacher's click
  lesen: { label: "Leseverständnis erstellen", area: "EXERCISE", tier: "standard", maxTokens: 24_000, timeoutMs: 180_000, thinking: "adaptiv", effort: "low", realtime: false, reuseMs: 0, cache: "aus" },
  // KI-Selbsttest on Mehr › KI-Kosten: one tiny request before the real test requests
  verbindungstest: { label: "Verbindungstest", area: "ANALYSIS", tier: "fast", maxTokens: 50, timeoutMs: 20_000, thinking: "aus", effort: "low", realtime: false, reuseMs: 0, cache: "aus" },
};

/** Which provider and model a function uses. model is "" when the provider has no default and none is set. */
export type Route = { provider: ProviderId; model: string; area: Area };

function providerFrom(v: string | undefined): ProviderId | null {
  const id = v?.trim().toLowerCase();
  return id && (PROVIDER_IDS as readonly string[]).includes(id) ? (id as ProviderId) : null;
}

/**
 * Provider: AI_<AREA>_PROVIDER, else AI_PROVIDER, else the provider whose key is set (Anthropic first,
 * then OpenRouter), else anthropic.
 * Model: AI_<AREA>_MODEL, else AI_MODEL_<TIER>, else the default of the tier for anthropic and openrouter
 * (other providers need a model set explicitly, no id is guessed).
 */
export function routeFor(fn: AIFunction): Route {
  const spec = FUNCTIONS[fn];
  const provider = providerFrom(process.env[`AI_${spec.area}_PROVIDER`]) ?? providerFrom(process.env.AI_PROVIDER) ?? (!hasKey("anthropic") && hasKey("openrouter") ? "openrouter" : "anthropic");
  const fallback = provider === "anthropic" ? DEFAULT_MODELS[spec.tier] : provider === "openrouter" ? OPENROUTER_MODELS[spec.tier] : "";
  const model = process.env[`AI_${spec.area}_MODEL`]?.trim() || process.env[MODEL_ENV[spec.tier]]?.trim() || fallback;
  return { provider, model, area: spec.area };
}

// ---------- prices ----------

/** US dollars per million tokens. cacheWrite = 5-minute cache. */
export type Price = { in: number; out: number; cacheWrite: number; cacheRead: number };

/**
 * List prices of the Anthropic price page (checked 2026-10-07) and of OpenRouter (checked 2026-10-09).
 * On OpenRouter the cost logged is the price OpenRouter reports for each request; this table only shows
 * the price on Mehr › KI-Kosten and stands in when a request reports none. Override with AI_PRICES_JSON.
 */
const PRICES: [prefix: string, price: Price][] = [
  ["claude-haiku-4-5", { in: 1, out: 5, cacheWrite: 1.25, cacheRead: 0.1 }],
  ["claude-sonnet-5-5", { in: 2, out: 10, cacheWrite: 2.5, cacheRead: 0.2 }],
  ["claude-opus-5-5", { in: 4, out: 20, cacheWrite: 5, cacheRead: 0.2 }],
  ["anthropic/claude-haiku-5.5", { in: 0.1, out: 0.5, cacheWrite: 0.125, cacheRead: 0.01 }],
  ["anthropic/claude-sonnet-5.5", { in: 2, out: 10, cacheWrite: 2.5, cacheRead: 0.2 }],
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
/** reasoning: the part of output spent on thinking, where the provider reports it (OpenRouter); only for information, output already counts it. */
export type Usage = { input: number; output: number; cacheWrite: number; cacheWrite1h?: number; cacheRead: number; reasoning?: number };

export function costOf(model: string, tier: Tier, u: Usage): number {
  const { price } = priceFor(model, tier);
  return (u.input * price.in + u.output * price.out + u.cacheWrite * price.cacheWrite + (u.cacheWrite1h ?? 0) * price.in * 2 + u.cacheRead * price.cacheRead) / 1_000_000;
}

// ---------- budget ----------

function num(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 && process.env[name]?.trim() ? v : fallback;
}

/** Euro rate of 2026-10-08 (1 € = 1.12 $). Providers bill in US dollars; AI_USD_PER_EUR updates it. */
const USD_PER_EUR = 1.12;

/**
 * Monthly budget and the share at which the page warns. Set in euros (AI_MONTHLY_BUDGET_EUR, default 10 €);
 * the older AI_MONTHLY_BUDGET_USD still wins when set. Costs are logged in US dollars, as billed.
 * When the budget is used up, every paid request stops; the app carries on without KI.
 */
export function budget() {
  const usdPerEur = num("AI_USD_PER_EUR", USD_PER_EUR) || USD_PER_EUR;
  const usd = process.env.AI_MONTHLY_BUDGET_USD?.trim() ? num("AI_MONTHLY_BUDGET_USD", 10 * usdPerEur) : null;
  const monthlyUsd = usd ?? num("AI_MONTHLY_BUDGET_EUR", 10) * usdPerEur;
  return {
    monthlyUsd,
    monthlyEur: monthlyUsd / usdPerEur,
    usdPerEur,
    warnAt: Math.min(1, num("AI_BUDGET_WARN", 0.8)),
  };
}

/** Max. realtime analyses per unit and hour, a safety net against loops. */
export function realtimeCapPerHour() {
  return num("AI_REALTIME_MAX_PER_HOUR", 40);
}

export function aiSwitchedOff() {
  return ["1", "true", "ja"].includes((process.env.AI_DISABLED ?? "").trim().toLowerCase());
}

/** Whether an API key for the provider is set (the key itself never leaves the provider adapter). */
export function hasKey(provider: ProviderId = "anthropic") {
  const e = process.env;
  switch (provider) {
    case "anthropic":
      return Boolean(e.ANTHROPIC_API_KEY || e.ANTHROPIC_AUTH_TOKEN);
    case "openrouter":
      return Boolean(e.OPENROUTER_API_KEY);
    case "deepseek":
      return Boolean(e.DEEPSEEK_API_KEY);
    case "compatible":
      return Boolean(e.AI_COMPATIBLE_API_KEY && e.AI_COMPATIBLE_BASE_URL);
  }
}
