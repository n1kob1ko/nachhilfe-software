/**
 * KI-Grenze je Schüler und Monat (niko, 2026-10-23): ab 1 € KI-Kosten für einen Schüler in einem Monat sehen die
 * Lehrer einen Hinweis (Cockpit, Schülerprofil), ab 3 € lehnt jede KI-Funktion für diesen Schüler ab; die App
 * arbeitet ohne KI weiter. Das gilt zusätzlich zu den Monatsbudgets (lib/ai/config.ts `budget`).
 *
 * Gezählt wird `ai_calls.cost_usd` aller Aufrufe mit diesem `student_id` im Kalendermonat (wie das Monatsbudget,
 * ab dem 1. des Monats, UTC), ohne Testläufe. Die Anbieter rechnen in US-Dollar ab; umgerechnet wird mit
 * AI_USD_PER_EUR (Standard 1,12 $ je €). Die Grenzen: AI_STUDENT_WARN_EUR (Standard 1) und AI_STUDENT_LIMIT_EUR
 * (Standard 3); 0 schaltet die jeweilige Stufe ab. Schülerseiten zeigen davon nichts.
 */
import { db } from "../db";
import { budget } from "./config";

function eur(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  const v = Number(raw);
  return raw && Number.isFinite(v) && v >= 0 ? v : fallback;
}

export type SchuelerGrenze = { warnEur: number; stopEur: number; usdPerEur: number };

export function schuelerGrenze(): SchuelerGrenze {
  return { warnEur: eur("AI_STUDENT_WARN_EUR", 1), stopEur: eur("AI_STUDENT_LIMIT_EUR", 3), usdPerEur: budget().usdPerEur };
}

const monatsAnfang = (now: number) => `${new Date(now).toISOString().slice(0, 7)}-01T00:00:00.000Z`;

/** Was die KI für diesen Schüler in diesem Monat gekostet hat, in US-Dollar (Testläufe zählen nicht). */
export function schuelerKostenUsd(studentId: number, now = Date.now()): number {
  return (db().prepare("SELECT COALESCE(SUM(cost_usd), 0) AS usd FROM ai_calls WHERE student_id = ? AND test = 0 AND created_at >= ?").get(studentId, monatsAnfang(now)) as { usd: number }).usd;
}

/** ok, warnung (Hinweis für Lehrer) oder aus (KI für diesen Schüler gestoppt). */
export type SchuelerStufe = "ok" | "warnung" | "aus";
export type SchuelerStand = { studentId: number; usd: number; eur: number; stufe: SchuelerStufe; grenze: SchuelerGrenze };

/** Die Stufe zu einem Betrag in US-Dollar; eine Grenze von 0 gilt als abgeschaltet. */
export function stufeFuer(usd: number, g: SchuelerGrenze = schuelerGrenze()): SchuelerStufe {
  const e = usd / g.usdPerEur;
  if (g.stopEur > 0 && e >= g.stopEur) return "aus";
  if (g.warnEur > 0 && e >= g.warnEur) return "warnung";
  return "ok";
}

export function schuelerStand(studentId: number, now = Date.now()): SchuelerStand {
  const grenze = schuelerGrenze();
  const usd = schuelerKostenUsd(studentId, now);
  return { studentId, usd, eur: usd / grenze.usdPerEur, stufe: stufeFuer(usd, grenze), grenze };
}

const euro = (x: number) => `${x.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** Die Meldung, wenn die KI für diesen Schüler abgelehnt hat (Router und Knöpfe). */
export function grenzeErreichtText(g: SchuelerGrenze = schuelerGrenze()): string {
  return `Die KI-Grenze für diesen Schüler ist in diesem Monat erreicht (${euro(g.stopEur)}). Ohne KI geht alles weiter wie gewohnt.`;
}

/** Der Hinweis für Lehrer ab der Warnstufe; null darunter. */
export function grenzeHinweis(s: SchuelerStand, name: string): string | null {
  if (s.stufe === "ok") return null;
  if (s.stufe === "aus") return `KI für ${name} in diesem Monat gestoppt: ${euro(s.eur)} von ${euro(s.grenze.stopEur)} verbraucht. Die App arbeitet ohne KI weiter.`;
  return `KI-Kosten für ${name} in diesem Monat: ${euro(s.eur)}. Ab ${euro(s.grenze.stopEur)} stoppt die KI für ${name} bis zum Monatsende.`;
}
