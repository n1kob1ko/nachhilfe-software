/**
 * Everything about the KI that is a setting: which provider and model each area uses, what each
 * function may spend, prices and the monthly budget. Providers, models and budget come from environment
 * variables (Railway Variables); the defaults below are the only place a model id is written down.
 */

import { kiModus } from "./modus";

export type Tier = "fast" | "standard" | "deep";

/** The providers the router can talk to (adapters in ./providers). `manual` talks to a person, not an API. */
export const PROVIDER_IDS = ["anthropic", "openrouter", "deepseek", "compatible", "manual"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/** The manual provider: the prompt is shown, the answer pasted in; it needs no key and no model id. */
export const MANUAL_MODEL = "manuell";
/**
 * How long a manual request may wait for the teacher. The API timeouts (8–180 s) are for a server that
 * answers; copying a prompt into a chat window and pasting the answer back takes minutes. `runAI` uses
 * this instead of the function's timeoutMs while the manual provider is selected.
 */
export const MANUAL_TIMEOUT_MS = 30 * 60_000;

/**
 * Areas group the functions for configuration: AI_<AREA>_PROVIDER and AI_<AREA>_MODEL switch the
 * provider and model of every function in that area.
 */
export type Area = "REALTIME" | "EXERCISE" | "ANALYSIS" | "DEEP" | "MATERIAL" | "TEXT";
export const AREA_LABEL: Record<Area, string> = { REALTIME: "Echtzeit", EXERCISE: "Aufgaben", ANALYSIS: "Auswertung", DEEP: "Tiefenanalyse", MATERIAL: "Material", TEXT: "Textkorrektur" };

/**
 * Defaults on Anthropic when no environment variable is set: Sonnet 5.5 for every tier (niko,
 * 2026-10-18; the monthly Anthropic credits pay for it). Change the variable, not this list, to switch models.
 */
const DEFAULT_MODELS: Record<Tier, string> = {
  fast: "claude-sonnet-5-5",
  standard: "claude-sonnet-5-5",
  deep: "claude-sonnet-5-5",
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

/**
 * A model id as the provider names it, or null when it belongs to another provider. The same variable
 * (AI_TEXT_MODEL=anthropic/claude-sonnet-5.5, set for OpenRouter) must not break the other provider:
 * on Anthropic an OpenRouter id of a Claude model becomes the API id (claude-sonnet-5-5), an id of
 * another vendor does not fit; on OpenRouter an id without a vendor prefix does not fit.
 */
export function fitModel(provider: ProviderId, id: string): string | null {
  if (!id) return null;
  if (provider === "anthropic") {
    if (!id.includes("/")) return id;
    const m = /^anthropic\/(claude-[a-z]+)-(\d+)(?:\.(\d+))?$/.exec(id);
    return m ? `${m[1]}-${m[2]}${m[3] ? `-${m[3]}` : ""}` : null;
  }
  if (provider === "openrouter") return id.includes("/") ? id : null;
  return id;
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
  | "stundenplan"
  | "stoffzettel"
  | "druckblatt"
  | "textkorrektur"
  | "textanalyse"
  | "textpruefung"
  | "lesen"
  | "briefing"
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
  // Stundenplan-Fotos (lib/planung/stundenplan-foto.ts): only on the admin's click, after the tick that first names
  // may go to the KI; the answer holds first names, so it is never kept for reuse
  stundenplan: { label: "Stundenplan-Foto lesen", area: "MATERIAL", tier: "standard", maxTokens: 8_000, timeoutMs: 90_000, thinking: "aus", effort: "low", realtime: false, reuseMs: 0, cache: "aus" },
  // Stoffzettel einer Schularbeit (lib/stoffzettel.ts): only on the teacher's click, after the tick „kein Name darauf“;
  // the answer is Art, Fach, Datum and Stoff, so the same sheet on the same day is not paid for twice
  stoffzettel: { label: "Stoffzettel lesen", area: "MATERIAL", tier: "standard", maxTokens: 3_000, timeoutMs: 90_000, thinking: "aus", effort: "low", realtime: false, reuseMs: 24 * 60 * MIN, cache: "aus" },
  // Blätter erstellen (Phase 5, Schritt 6): Wortlisten und Spalten für die drei Druckblätter.
  // Kleine, klar umrissene Listen — der schnelle Tarif reicht, der Standardtarif wäre Verschwendung.
  // Nur auf Klick der Lehrkraft, nichts wird von selbst übernommen; reuseMs 0, weil jede Anfrage
  // zu einem anderen Blatt gehören soll.
  druckblatt: { label: "Vorschläge für Blätter", area: "EXERCISE", tier: "fast", maxTokens: 4_000, timeoutMs: 60_000, thinking: "aus", effort: "low", realtime: false, reuseMs: 0, cache: "aus" },
  // only on the teacher's click, after consent; the same version of a text is never paid for twice
  textkorrektur: { label: "Textkorrektur", area: "TEXT", tier: "standard", maxTokens: 16_000, timeoutMs: 180_000, thinking: "adaptiv", effort: "low", realtime: false, reuseMs: 24 * 60 * MIN, cache: "aus" },
  // Textkorrektur „gründlich“ (lib/ai/textkorrektur-gruendlich.ts): sentence-by-sentence analysis, then an independent check of every suggestion
  textanalyse: { label: "Textkorrektur gründlich: Analyse", area: "TEXT", tier: "standard", maxTokens: 20_000, timeoutMs: 180_000, thinking: "adaptiv", effort: "medium", realtime: false, reuseMs: 24 * 60 * MIN, cache: "aus", schemaInPrompt: true },
  textpruefung: { label: "Textkorrektur gründlich: Prüfung", area: "TEXT", tier: "standard", maxTokens: 16_000, timeoutMs: 180_000, thinking: "adaptiv", effort: "medium", realtime: false, reuseMs: 24 * 60 * MIN, cache: "aus", schemaInPrompt: true },
  // Leseverständnis: one request for the reading text, one for the questions; only on the teacher's click
  lesen: { label: "Leseverständnis erstellen", area: "EXERCISE", tier: "standard", maxTokens: 24_000, timeoutMs: 180_000, thinking: "adaptiv", effort: "low", realtime: false, reuseMs: 0, cache: "aus" },
  // Tagesbriefing (lib/briefing.ts): only on the teacher's click, saved per student and day, so nothing is reused here
  briefing: { label: "Tagesbriefing", area: "ANALYSIS", tier: "standard", maxTokens: 8_000, timeoutMs: 120_000, thinking: "adaptiv", effort: "low", realtime: false, reuseMs: 0, cache: "aus" },
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
 * Provider: AI_<AREA>_PROVIDER, else AI_PROVIDER, else the choice on Mehr › KI-Kosten (app_settings
 * `ki_modus`: Anthropic, OpenRouter or manual; Anthropic when nothing is chosen). A provider without key
 * means: KI off. Nothing switches to another provider by itself.
 * Model: AI_<AREA>_MODEL, else AI_MODEL_<TIER>, each only where it fits the provider (fitModel), else the
 * default of the tier for anthropic and openrouter (other providers need a model set explicitly, no id is guessed).
 */
/** The provider for every area without its own AI_<AREA>_PROVIDER: AI_PROVIDER, else the choice on Mehr › KI-Kosten. */
export function mainProvider(): ProviderId {
  return providerFrom(process.env.AI_PROVIDER) ?? kiModus();
}

export function routeFor(fn: AIFunction): Route {
  const spec = FUNCTIONS[fn];
  const provider = providerFrom(process.env[`AI_${spec.area}_PROVIDER`]) ?? providerFrom(process.env.AI_PROVIDER) ?? kiModus();
  const fallback = provider === "anthropic" ? DEFAULT_MODELS[spec.tier] : provider === "openrouter" ? OPENROUTER_MODELS[spec.tier] : provider === "manual" ? MANUAL_MODEL : "";
  const fromEnv = [process.env[`AI_${spec.area}_MODEL`], process.env[MODEL_ENV[spec.tier]]].map((v) => fitModel(provider, v?.trim() ?? "")).find(Boolean);
  return { provider, model: fromEnv || fallback, area: spec.area };
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
  // prompts up to 100k tokens (all of this app's); above that Anthropic charges $0.50 / $2.50
  ["claude-haiku-5-5", { in: 0.1, out: 0.5, cacheWrite: 0.125, cacheRead: 0.01 }],
  ["anthropic/claude-haiku-5.5", { in: 0.1, out: 0.5, cacheWrite: 0.125, cacheRead: 0.01 }],
  ["anthropic/claude-sonnet-5.5", { in: 2, out: 10, cacheWrite: 2.5, cacheRead: 0.2 }],
  // Lokale Modelle (Ollama, Phase 6 des Merges, Schritt 2): sie kosten nichts. Der Eintrag hält
  // `ollama/*` aus dem Tarif-Rückfall (tierPrice) heraus, der sonst den Claude-Preis ansetzen würde;
  // für einen Aufruf über OLLAMA_BASE_URL rechnet der Router ohnehin mit 0 (isLocalModel).
  ["ollama/", { in: 0, out: 0, cacheWrite: 0, cacheRead: 0 }],
];
/** For a model without a known price: the price of the default model of its tier. */
const tierPrice = (tier: Tier): Price => PRICES.find(([prefix]) => DEFAULT_MODELS[tier].startsWith(prefix))![1];

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
  return hit ? { price: hit[1], known: true } : { price: tierPrice(tier), known: false };
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
 * Which monthly budget a provider's requests count against. Anthropic has its own, because niko's
 * monthly Anthropic credits pay for it (they do not carry over to the next month); every other paid
 * provider (OpenRouter, DeepSeek, compatible) shares the general one.
 */
export type BudgetPool = "anthropic" | "allgemein";
export const BUDGET_POOLS: BudgetPool[] = ["anthropic", "allgemein"];
export function poolOf(provider: ProviderId): BudgetPool {
  return provider === "anthropic" ? "anthropic" : "allgemein";
}

/** Anthropic: 90 $ of the 100 $ monthly credits, so some is left over (niko, 2026-10-18). */
const ANTHROPIC_BUDGET_USD = 90;

/**
 * Monthly budget of a pool and the share at which the page warns. The general budget is set in euros
 * (AI_MONTHLY_BUDGET_EUR, default 10 €; the older AI_MONTHLY_BUDGET_USD still wins when set), the
 * Anthropic budget in US dollars like the credits (ANTHROPIC_MONTHLY_BUDGET_USD, default 90 $). Costs are
 * logged in US dollars, as billed. Each budget starts again on the 1st of the month. When it is used up,
 * every paid request of its providers stops; the app carries on without KI.
 */
export function budget(pool: BudgetPool = "allgemein") {
  const usdPerEur = num("AI_USD_PER_EUR", USD_PER_EUR) || USD_PER_EUR;
  const warnAt = Math.min(1, num("AI_BUDGET_WARN", 0.8));
  if (pool === "anthropic") {
    const monthlyUsd = num("ANTHROPIC_MONTHLY_BUDGET_USD", ANTHROPIC_BUDGET_USD);
    return { pool, currency: "usd" as const, monthlyUsd, monthlyEur: monthlyUsd / usdPerEur, usdPerEur, warnAt };
  }
  const usd = process.env.AI_MONTHLY_BUDGET_USD?.trim() ? num("AI_MONTHLY_BUDGET_USD", 10 * usdPerEur) : null;
  const monthlyUsd = usd ?? num("AI_MONTHLY_BUDGET_EUR", 10) * usdPerEur;
  return { pool, currency: usd == null ? ("eur" as const) : ("usd" as const), monthlyUsd, monthlyEur: monthlyUsd / usdPerEur, usdPerEur, warnAt };
}

/** Max. realtime analyses per unit and hour, a safety net against loops. */
export function realtimeCapPerHour() {
  return num("AI_REALTIME_MAX_PER_HOUR", 40);
}

export function aiSwitchedOff() {
  return ["1", "true", "ja"].includes((process.env.AI_DISABLED ?? "").trim().toLowerCase());
}

/**
 * Ein Modellserver auf dem eigenen Rechner (Ollama, Phase 6 des Merges, Schritt 2) spricht dieselbe
 * Schnittstelle wie ein OpenAI-kompatibler Anbieter, braucht aber keinen Schlüssel und kostet nichts.
 * Als lokal zählt **nur** `OLLAMA_BASE_URL`: eine andere `AI_COMPATIBLE_BASE_URL` — auch eine auf
 * 127.0.0.1 — kann ein bezahlter Dienst hinter einem eigenen Gateway sein, dort gilt weiter die
 * Preistabelle.
 */
export function isLocalModel(provider: ProviderId): boolean {
  return provider === "compatible" && Boolean(process.env.OLLAMA_BASE_URL?.trim());
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
      // a local model server (Ollama) needs no key; anything else needs key and address
      return isLocalModel("compatible") || Boolean(e.AI_COMPATIBLE_API_KEY && e.AI_COMPATIBLE_BASE_URL);
    case "manual":
      // no key is needed and none can exist; `providerReady` counts manual as ready
      return false;
  }
}
