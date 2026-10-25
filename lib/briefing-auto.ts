/**
 * **Briefings automatisch mit KI vorbereiten** (niko, 25.10.2026: „KI nur im genehmigten Budget, und sie darf den
 * Unterricht nie blockieren“). Öffnet eine Lehrkraft Heute, fragt die App für die heutigen Schüler, die noch nicht
 * begonnen haben, im Hintergrund die KI-Fassung des Briefings (lib/briefing.ts `erstelleBriefing`), wenn es zum
 * jetzigen Datenstand noch keine gibt. Heute wartet nie darauf: bis sie da ist, steht die Fassung aus den Daten.
 *
 * Nur wenn alles erlaubt:
 * - der Schalter unter Erweitert › KI-Kosten ist an (`app_settings` „briefing_auto“, Standard an);
 * - die KI ist an und nicht im manuellen Modus (dort müsste jemand den Prompt kopieren);
 * - das Monatsbudget des Anbieters ist unter der Warnschwelle (AI_BUDGET_WARN, 80 %): der Rest bleibt für das, was die
 *   Lehrkraft selbst anstößt;
 * - der Schüler ist unter der Warnstufe seiner KI-Grenze (1 € im Monat, lib/ai/schueler-kosten.ts); ab dort fragt nur
 *   noch ein Klick, bis 3 € der Router für ihn stoppt.
 *
 * Eine Anfrage nach der anderen, je Schüler höchstens eine zugleich. Schlägt eine fehl, fragt die App für denselben
 * Datenstand erst nach sechs Stunden wieder von selbst. Ins Protokoll kommt nur die Schüler-ID, kein Text.
 */
import { budget, costOf, isLocalModel, poolOf, routeFor } from "./ai/config";
import { budgetState } from "./ai/log";
import { aiEnabled, clockNow } from "./ai/router";
import { schuelerStand } from "./ai/schueler-kosten";
import { briefingLaeuft, erstelleBriefing, gespeichertesBriefing, type Fokus } from "./briefing";
import { db } from "./db";

export const AUTO_SCHLUESSEL = "briefing_auto";
/** Standard: an (geschätzt rund 3 Cent je Briefing mit Sonnet 5.5, siehe `autoKosten`). */
export const AUTO_STANDARD = true;

/** Ist „Briefings automatisch mit KI vorbereiten“ an? */
export function autoBriefingAn(): boolean {
  const v = (db().prepare("SELECT value FROM app_settings WHERE key = ?").get(AUTO_SCHLUESSEL) as { value: string } | undefined)?.value;
  return v === undefined ? AUTO_STANDARD : v === "1";
}

export function setzeAutoBriefing(an: boolean): void {
  db().prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(AUTO_SCHLUESSEL, an ? "1" : "0");
}

/** Warum die App gerade nicht von selbst fragt. */
export type AutoSperre = "aus" | "ki_aus" | "manuell" | "budget" | "schuelergrenze";
export const AUTO_SPERRE_TEXT: Record<AutoSperre, string> = {
  aus: "ausgeschaltet",
  ki_aus: "KI ist aus",
  manuell: "manueller KI-Modus: nur auf Klick",
  budget: "Monatsbudget über der Warnschwelle",
  schuelergrenze: "KI-Grenze des Schülers erreicht",
};

/** Null, wenn die App für diesen Schüler jetzt von selbst ein KI-Briefing fragen darf; sonst warum nicht. */
export function autoSperre(studentId: number): AutoSperre | null {
  if (!autoBriefingAn()) return "aus";
  if (!aiEnabled("briefing")) return "ki_aus";
  const { provider } = routeFor("briefing");
  if (provider === "manual") return "manuell";
  // a local model costs nothing: no budget, no limit per student
  if (isLocalModel(provider)) return null;
  if (budgetState(clockNow(), poolOf(provider)).level !== "ok") return "budget";
  if (schuelerStand(studentId, clockNow()).stufe !== "ok") return "schuelergrenze";
  return null;
}

// ---------- what it costs ----------

/**
 * Typische Größe einer Anfrage, gemessen an Beispiel-Schülern mit Verlauf (Systemprompt, Lernstand, drei
 * Dokumentationen, 15 Übungen, KI-Hinweise): rund 11 000 Zeichen, gerechnet mit 3,2 Zeichen je Token wie die
 * Schätzung auf der Briefing-Seite. Die Antwort mit Denken: 2 500 Tokens wie dort.
 */
export const TYPISCH_TOKENS_EIN = 3_500;
export const TYPISCH_TOKENS_AUS = 2_500;
/** Für die Monatsrechnung: 20 Briefings an jedem der rund 21 Schultage. */
export const BRIEFINGS_IM_MONAT = 20 * 21;

export type AutoKosten = { cent: number; quelle: "gemessen" | "geschaetzt" | "kostenlos"; aufrufe: number; monatEuro: number; modell: string };

/**
 * Was ein Briefing kostet, in Euro-Cent: gemessen (Ø der letzten 60 Tage, ab drei Aufrufen), sonst aus der typischen
 * Größe und dem Preis des eingestellten Modells geschätzt. Fragt nie die KI.
 */
export function autoKosten(now = Date.now()): AutoKosten {
  const route = routeFor("briefing");
  const usdPerEur = budget().usdPerEur;
  if (route.provider === "manual" || isLocalModel(route.provider)) return { cent: 0, quelle: "kostenlos", aufrufe: 0, monatEuro: 0, modell: route.model };
  const seit = new Date(now - 60 * 86_400_000).toISOString();
  const m = db().prepare("SELECT COUNT(*) AS n, AVG(cost_usd) AS usd FROM ai_calls WHERE fn = 'briefing' AND status = 'ok' AND test = 0 AND cost_usd > 0 AND created_at >= ?").get(seit) as { n: number; usd: number | null };
  const gemessen = m.n >= 3 && m.usd !== null;
  const usd = gemessen ? m.usd! : costOf(route.model, "standard", { input: TYPISCH_TOKENS_EIN, output: TYPISCH_TOKENS_AUS, cacheWrite: 0, cacheRead: 0 });
  const cent = (usd / usdPerEur) * 100;
  return { cent, quelle: gemessen ? "gemessen" : "geschaetzt", aufrufe: m.n, monatEuro: (cent * BRIEFINGS_IM_MONAT) / 100, modell: route.model };
}

// ---------- in the background ----------

const PAUSE_NACH_FEHLER_MS = 6 * 3_600_000;
type Zustand = { kette: Promise<void>; wartend: Set<number>; fehlgeschlagen: Map<string, number> };
const zustand = ((globalThis as unknown as { __briefingAuto?: Zustand }).__briefingAuto ??= { kette: Promise.resolve(), wartend: new Set(), fehlgeschlagen: new Map() });

export type AutoAuftrag = { studentId: number; teacherId: number | null; platzId: number | null; fokus: Fokus | null; stand: string };
export type AutoErgebnis = "vorhanden" | "laeuft" | "gestartet" | "pausiert" | AutoSperre;

/**
 * Stellt das KI-Briefing für einen Schüler in die Warteschlange, wenn es zum Datenstand `stand` noch keines gibt und
 * alles erlaubt ist. Kehrt sofort zurück; gewartet wird nie. Was geschah, steht im Ergebnis (für Tests).
 */
export function bereiteBriefingVor(a: AutoAuftrag): AutoErgebnis {
  if (gespeichertesBriefing(a.studentId, { stand: a.stand })) return "vorhanden";
  if (zustand.wartend.has(a.studentId) || briefingLaeuft(a.studentId)) return "laeuft";
  const sperre = autoSperre(a.studentId);
  if (sperre) return sperre;
  const key = `${a.studentId}:${a.stand}`;
  const zuletzt = zustand.fehlgeschlagen.get(key);
  if (zuletzt !== undefined && Date.now() - zuletzt < PAUSE_NACH_FEHLER_MS) return "pausiert";
  zustand.wartend.add(a.studentId);
  // one after the other, after the page is answered: nothing of this runs while Heute renders
  zustand.kette = zustand.kette
    .then(() => new Promise<void>((r) => setImmediate(r)))
    .then(async () => {
      // the budget or the student's limit may have been reached while waiting
      if (autoSperre(a.studentId)) return;
      const res = await erstelleBriefing(a.studentId, a.teacherId, { platzId: a.platzId, fokus: a.fokus });
      if (res.ok) zustand.fehlgeschlagen.delete(key);
      else {
        zustand.fehlgeschlagen.set(key, Date.now());
        console.warn(`[Briefing automatisch] Schüler ${a.studentId}: nicht erstellt, es bleibt die Fassung aus den Daten`);
      }
    })
    .catch(() => {
      zustand.fehlgeschlagen.set(key, Date.now());
      console.warn(`[Briefing automatisch] Schüler ${a.studentId}: Fehler, es bleibt die Fassung aus den Daten`);
    })
    .finally(() => {
      zustand.wartend.delete(a.studentId);
    });
  return "gestartet";
}

/** Für Tests: warten, bis die Warteschlange leer ist, und die Pausen nach Fehlern vergessen. */
export async function warteteAufAuto(): Promise<void> {
  await zustand.kette;
}
export function vergissAutoFuerTests(): void {
  zustand.fehlgeschlagen.clear();
  zustand.wartend.clear();
  zustand.kette = Promise.resolve();
}
