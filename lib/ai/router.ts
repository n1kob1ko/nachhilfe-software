/**
 * The one door to the KI. Every KI function of the app asks here; the router decides whether a request
 * is needed at all (same question recently answered, budget used up, API down), picks provider and model
 * of the function's area, enforces its token limit and timeout, and logs what the request cost.
 * Which vendor answers is the business of the adapters in ./providers; nothing here is vendor-specific.
 * When anything fails the caller gets { ok: false } and carries on without KI.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { z } from "zod";
import { FUNCTIONS, PROVIDER_IDS, aiSwitchedOff, costOf, routeFor, type AIFunction, type Usage } from "./config";
import { budgetState, logCall, type CallStatus } from "./log";
import { providerReady, providerTransport, unsupported, type Prompt, type Transport } from "./providers";

export type { AIRequest, AIResult, Part, Prompt, Transport } from "./providers";

export type AIMeta = { teacherId?: number | null; unitId?: number | null; trigger?: string };

// ---------- replaceable parts (tests and the 60-minute simulation) ----------
let transport: Transport = providerTransport;
let custom = false;
let testRun = false;
let now = () => Date.now();

/** Replaces the providers (null = the real ones). A replaced transport counts as "KI on" without a key. */
export function setTransport(t: Transport | null) {
  transport = t ?? providerTransport;
  custom = t !== null;
}
/** Rows logged from now on are marked as test and do not count for the budget. */
export function setTestRun(on: boolean) {
  testRun = on;
}
export function setClock(fn: (() => number) | null) {
  now = fn ?? (() => Date.now());
}
export function clockNow() {
  return now();
}

/** KI is on when it is not switched off and the provider of at least one area (or of `fn`) has a key and a model. */
export function aiEnabled(fn?: AIFunction) {
  if (aiSwitchedOff()) return false;
  if (custom) return true;
  return (fn ? [fn] : (Object.keys(FUNCTIONS) as AIFunction[])).some((f) => {
    const r = routeFor(f);
    return Boolean(r.model) && providerReady(r.provider);
  });
}

/** For the cost page: whether any provider has a key at all. */
export function anyProviderKey() {
  return PROVIDER_IDS.some(providerReady);
}

// ---------- KI-Qualitätstest: other settings for the requests of one test run ----------
/**
 * Only the KI-Qualitätstest (Mehr › KI-Kosten) sets this, to compare speed and quality with another
 * model, without thinking or with less effort. The app's own requests never run with one. `tag` keeps
 * the requests of one run apart from everything else (no answer is reused across runs).
 */
export type AIOverride = { tag: string; model?: string; thinking?: "aus" | "adaptiv"; effort?: "low" | "medium" | "high"; onUsage?: (callId: number, usage: Usage) => void };
const overrideStore = ((globalThis as unknown as { __aiOverride?: AsyncLocalStorage<AIOverride> }).__aiOverride ??= new AsyncLocalStorage<AIOverride>());
export function withAIOverride<T>(o: AIOverride, run: () => Promise<T>): Promise<T> {
  return overrideStore.run(o, run);
}

// ---------- circuit breaker: after 3 failures in a row, 5 minutes without requests ----------
const BREAK_AFTER = 3;
const BREAK_MS = 5 * 60_000;
// shared by every copy of this module (Next.js may load it once per route)
const shared = globalThis as unknown as { __aiRouter?: { breaker: { failures: number; until: number }; done: Map<string, { at: number; data: unknown }>; inflight: Map<string, Promise<Outcome<unknown>>> } };
const state = (shared.__aiRouter ??= { breaker: { failures: 0, until: 0 }, done: new Map(), inflight: new Map() });
const breaker = state.breaker;
export function breakerState() {
  return { paused: breaker.until > now(), until: breaker.until, failures: breaker.failures };
}

// ---------- reuse of identical requests ----------
const { done, inflight } = state;
const MAX_REMEMBERED = 300;

export function resetRouter() {
  done.clear();
  inflight.clear();
  breaker.failures = 0;
  breaker.until = 0;
}

function fingerprint(fn: AIFunction, provider: string, model: string, system: string, prompt: Prompt, extra?: unknown) {
  return createHash("sha256").update(JSON.stringify(extra === undefined ? [fn, provider, model, system, prompt] : [fn, provider, model, system, prompt, extra])).digest("hex");
}

export type Outcome<T> =
  | { ok: true; data: T; reused: boolean; callId: number | null }
  | { ok: false; status: "aus" | "budget" | "pausiert" | "timeout" | "fehler" | "abgelehnt"; message: string; callId: number | null };

const MESSAGES = {
  aus: "Die KI ist ausgeschaltet oder es ist kein Schlüssel hinterlegt.",
  budget: "Das KI-Budget für diesen Monat ist aufgebraucht.",
  pausiert: "Die KI war zuletzt nicht erreichbar und pausiert ein paar Minuten.",
  timeout: "Die KI hat nicht rechtzeitig geantwortet.",
  abgelehnt: "Die KI hat keine verwertbare Antwort geliefert.",
};

/**
 * One structured request. `maxTokens` may lower the function's limit, never raise it.
 * Never throws: failures come back as { ok: false } with a German message.
 */
export async function runAI<S extends z.ZodType>(
  fn: AIFunction,
  schema: S,
  system: string,
  prompt: Prompt,
  o: { maxTokens?: number; meta?: AIMeta } = {},
): Promise<Outcome<z.infer<S>>> {
  if (!aiEnabled(fn)) return { ok: false, status: "aus", message: MESSAGES.aus, callId: null };
  const spec = FUNCTIONS[fn];
  const route = routeFor(fn);
  const ov = overrideStore.getStore();
  const provider = route.provider;
  const model = ov?.model || route.model;
  const thinking = ov?.thinking ?? spec.thinking;
  const effort = ov?.effort ?? spec.effort;
  const meta = o.meta ?? {};
  const log = (status: CallStatus, extra: Partial<Parameters<typeof logCall>[0]> = {}) =>
    logCall({
      fn,
      tier: spec.tier,
      model,
      teacherId: meta.teacherId ?? null,
      unitId: meta.unitId ?? null,
      trigger: meta.trigger ?? "",
      input: 0,
      output: 0,
      cacheWrite: 0,
      cacheRead: 0,
      durationMs: 0,
      costUsd: 0,
      status,
      test: testRun,
      at: now(),
      ...extra,
    });

  const fp = fingerprint(fn, provider, model, system, prompt, ov ? [ov.tag, thinking, effort] : undefined);
  const kept = spec.reuseMs > 0 ? done.get(fp) : undefined;
  if (kept && kept.at > now() - spec.reuseMs) return { ok: true, data: kept.data as z.infer<S>, reused: true, callId: log("cache") };
  const running = inflight.get(fp);
  if (running) {
    const r = await running;
    return r.ok ? { ...r, data: r.data as z.infer<S>, reused: true, callId: log("cache") } : r;
  }
  if (breaker.until > now()) return { ok: false, status: "pausiert", message: MESSAGES.pausiert, callId: log("pausiert") };
  const b = budgetState(now());
  if (b.level === "aus") return { ok: false, status: "budget", message: MESSAGES.budget, callId: log("budget") };
  // a photo or PDF the configured provider cannot read: a setting to change, not an outage
  const cannot = custom ? null : unsupported(provider, prompt);
  if (cannot) return { ok: false, status: "fehler", message: cannot, callId: log("fehler", { error: cannot }) };

  const call = (async (): Promise<Outcome<z.infer<S>>> => {
    const maxTokens = Math.max(1, Math.min(o.maxTokens ?? spec.maxTokens, spec.maxTokens));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), spec.timeoutMs);
    const started = Date.now();
    try {
      const res = await transport({
        fn,
        provider,
        model,
        maxTokens,
        system,
        cache: spec.cache,
        content: prompt,
        thinking,
        effort,
        schema,
        ...(spec.schemaInPrompt ? { schemaInPrompt: true } : {}),
        signal: ctrl.signal,
        timeoutMs: spec.timeoutMs,
      });
      // the provider's own price when it reports one, else tokens × price table
      const cost = res.costUsd ?? costOf(res.model || model, spec.tier, res.usage);
      const usage = { input: res.usage.input, output: res.usage.output, cacheWrite: res.usage.cacheWrite + (res.usage.cacheWrite1h ?? 0), cacheRead: res.usage.cacheRead, costUsd: cost, model: res.model || model };
      const durationMs = res.simulatedMs ?? Date.now() - started;
      breaker.failures = 0;
      const error = res.problem ?? "";
      if (res.refusal || res.parsed == null) {
        const refused = log("abgelehnt", { ...usage, durationMs, error });
        ov?.onUsage?.(refused, res.usage);
        return { ok: false, status: "abgelehnt", message: MESSAGES.abgelehnt, callId: refused };
      }
      const callId = log("ok", { ...usage, durationMs, error });
      ov?.onUsage?.(callId, res.usage);
      if (spec.reuseMs > 0) {
        done.set(fp, { at: now(), data: res.parsed });
        if (done.size > MAX_REMEMBERED) done.delete(done.keys().next().value!);
      }
      return { ok: true, data: res.parsed as z.infer<S>, reused: false, callId };
    } catch (e) {
      const timedOut = ctrl.signal.aborted;
      breaker.failures += 1;
      if (breaker.failures >= BREAK_AFTER) {
        breaker.until = now() + BREAK_MS;
        breaker.failures = 0;
      }
      const message = timedOut ? MESSAGES.timeout : `Die KI war nicht erreichbar (${e instanceof Error ? e.message : String(e)}).`.slice(0, 300);
      return { ok: false, status: timedOut ? "timeout" : "fehler", message, callId: log(timedOut ? "timeout" : "fehler", { durationMs: Date.now() - started, error: message }) };
    } finally {
      clearTimeout(timer);
    }
  })();
  inflight.set(fp, call as Promise<Outcome<unknown>>);
  try {
    return await call;
  } finally {
    inflight.delete(fp);
  }
}

/** For callers that want the old behaviour: data, null on a refusal, an Error for everything else. */
export function unwrap<T>(r: Outcome<T>): T | null {
  if (r.ok) return r.data;
  if (r.status === "abgelehnt") return null;
  throw new Error(r.message);
}
