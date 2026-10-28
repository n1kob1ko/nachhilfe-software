/**
 * **KI-Budget je Einheit** (niko, 28.10.2026: „Du legst einen Betrag je Einheit fest. Darunter erstellt die KI fehlende Aufgaben
 * ohne Extra-Klick. Kosten je Einheit sichtbar.“ „Es dürfen keine unkontrollierten Kosten entstehen.“).
 *
 * - Der Betrag gilt für jede Einheit (Erweitert › KI-Kosten, nur die Administration, `app_settings` „ki_budget_einheit“). Standard
 *   0 € = automatisch aus: alles bleibt auf Tippen mit Kosten, wie bisher. Je Einheit kann er geändert werden (`units.ki_budget_eur`):
 *   die Lehrkraft senkt ihn (höchstens bis zum Standard), die Administration darf ihn auch erhöhen (bis `BUDGET_MAX_EUR`).
 * - Gezählt wird `ai_calls.cost_usd` aller Aufrufe mit dieser `unit_id`, ohne Testläufe. Eine Anfrage bekommt die Einheit von ihrem
 *   Aufrufer (`meta.unitId`, nur fürs Protokoll `meta.kostenEinheitId`), sonst die laufende Einheit ihres Schülers (`laufendeEinheitVon`,
 *   im Router). Das Briefing, das vor dem Start im Hintergrund lief, kommt beim Start dazu (`ordneBriefingZu`).
 * - Nur unter dem Betrag erstellt die App selbst fehlende Aufgaben (lib/ki-nachschub.ts), immer erst mit Vorschau. Ist ein Betrag
 *   gesetzt und erreicht, stoppt auch die Live-Analyse der Einheit (lib/ai/realtime.ts); bei 0 € läuft sie wie bisher.
 * - Die Grenze je Schüler (lib/ai/schueler-kosten.ts) und das Monatsbudget gelten weiter und gehen vor.
 * Nur für Lehrkräfte; Schülerseiten zeigen davon nichts.
 */
import { db } from "../db";
import { wienerMinuten } from "../planung/zeit";
import { budget, FUNCTIONS, type AIFunction } from "./config";

export const BUDGET_SCHLUESSEL = "ki_budget_einheit";
/** Standard: 0 € = automatisch aus (niko setzt den Betrag). */
export const BUDGET_STANDARD_EUR = 0;
/** Mehr als das lässt sich je Einheit nicht einstellen. */
export const BUDGET_MAX_EUR = 5;

const usdPerEur = () => budget().usdPerEur;
const cent = (x: number) => Math.round(x * 100) / 100;

/** Ein Betrag aus einem Formular („0,30“, „0.3“, „1“) in Euro auf Cent gerundet; null, wenn er keiner ist oder außerhalb 0 … `max` liegt. */
export function betragAus(roh: unknown, max = BUDGET_MAX_EUR): number | null {
  const s = String(roh ?? "").trim().replace(/\s*€$/, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const v = cent(Number(s));
  return Number.isFinite(v) && v >= 0 && v <= max ? v : null;
}

/** Der Betrag je Einheit aus Erweitert › KI-Kosten, in Euro. */
export function standardBudgetEur(): number {
  const v = (db().prepare("SELECT value FROM app_settings WHERE key = ?").get(BUDGET_SCHLUESSEL) as { value: string } | undefined)?.value;
  return (v === undefined ? null : betragAus(v)) ?? BUDGET_STANDARD_EUR;
}

export function setzeStandardBudget(eur: number): void {
  db().prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(BUDGET_SCHLUESSEL, String(cent(eur)));
}

/** Der Betrag dieser Einheit: ihr eigener, sonst der Standard. `eigen`: für diese Einheit geändert. */
export function budgetDerEinheitEur(unitId: number): { eur: number; eigen: boolean } {
  const r = db().prepare("SELECT ki_budget_eur FROM units WHERE id = ?").get(unitId) as { ki_budget_eur: number | null } | undefined;
  return r?.ki_budget_eur != null ? { eur: r.ki_budget_eur, eigen: true } : { eur: standardBudgetEur(), eigen: false };
}

/**
 * Den Betrag einer Einheit ändern (null = wieder der Standard). Die Lehrkraft darf nur senken (bis zum Standard), die
 * Administration auch erhöhen, beide höchstens `BUDGET_MAX_EUR`.
 */
export function setzeBudgetDerEinheit(unitId: number, eur: number | null, o: { admin: boolean }): { ok: true } | { fehler: string } {
  if (eur !== null) {
    if (!(eur >= 0 && eur <= BUDGET_MAX_EUR)) return { fehler: `Bitte einen Betrag von 0 bis ${euro(BUDGET_MAX_EUR)}.` };
    const standard = standardBudgetEur();
    if (!o.admin && eur > standard) return { fehler: `Erhöhen über ${euro(standard)} kann nur die Administration.` };
  }
  db().prepare("UPDATE units SET ki_budget_eur = ? WHERE id = ?").run(eur === null ? null : cent(eur), unitId);
  return { ok: true };
}

/** Was die KI in dieser Einheit gekostet hat, in US-Dollar (Testläufe zählen nicht). */
export function kostenDerEinheitUsd(unitId: number): number {
  return (db().prepare("SELECT COALESCE(SUM(cost_usd), 0) AS usd FROM ai_calls WHERE unit_id = ? AND test = 0").get(unitId) as { usd: number }).usd;
}

export type KostenJeFunktion = { fn: AIFunction; label: string; aufrufe: number; ausSpeicher: number; usd: number; eur: number };

/** Die Kosten der Einheit je KI-Funktion, die teuerste zuerst; Funktionen ohne bezahlten Aufruf und ohne Kosten fehlen. */
export function kostenJeFunktion(unitId: number): KostenJeFunktion[] {
  const rows = db()
    .prepare(
      `SELECT fn, SUM(CASE WHEN status IN ('ok', 'abgelehnt') THEN 1 ELSE 0 END) AS aufrufe, SUM(CASE WHEN status = 'cache' THEN 1 ELSE 0 END) AS ausSpeicher,
         COALESCE(SUM(cost_usd), 0) AS usd FROM ai_calls WHERE unit_id = ? AND test = 0 GROUP BY fn ORDER BY usd DESC, fn`,
    )
    .all(unitId) as { fn: AIFunction; aufrufe: number; ausSpeicher: number; usd: number }[];
  return rows.filter((r) => r.aufrufe > 0 || r.usd > 0).map((r) => ({ ...r, label: FUNCTIONS[r.fn]?.label ?? r.fn, eur: r.usd / usdPerEur() }));
}

export type EinheitBudget = {
  /** der Betrag dieser Einheit in Euro; 0 = automatisch aus */
  budgetEur: number;
  /** für diese Einheit geändert */
  eigen: boolean;
  standardEur: number;
  /** was die KI in dieser Einheit bisher gekostet hat, in Euro */
  kostenEur: number;
  /** automatisch an (ein Betrag ist gesetzt) */
  automatisch: boolean;
  /** der Betrag ist gesetzt und erreicht */
  erreicht: boolean;
};

export function einheitBudget(unitId: number): EinheitBudget {
  const b = budgetDerEinheitEur(unitId);
  const kostenEur = kostenDerEinheitUsd(unitId) / usdPerEur();
  return { budgetEur: b.eur, eigen: b.eigen, standardEur: standardBudgetEur(), kostenEur, automatisch: b.eur > 0, erreicht: b.eur > 0 && kostenEur >= b.eur };
}

export const euro = (x: number) => `${x.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
/** Ein kleiner Betrag: unter einem halben Cent „unter 0,01 €“ statt „0,00 €“. */
export const euroKlein = (x: number) => (x > 0 && x < 0.005 ? "unter 0,01 €" : euro(x));

/** Der Grund, wenn die App nicht mehr von selbst fragt. */
export const budgetErreichtText = (eur: number) => `Budget dieser Einheit erreicht (${euro(eur)})`;

/**
 * Darf die App für diese Einheit jetzt von selbst eine Anfrage stellen, die etwa `schaetzungUsd` kostet? Nur, wenn ein Betrag gesetzt
 * ist und Kosten, schon laufende Anfragen (`reserviertUsd`) und die Schätzung zusammen darunter bleiben. Schalter, Monatsbudget und
 * Grenze des Schülers prüft der Aufrufer (lib/steuerung.ts `kiTor`).
 */
export function automatischFrei(unitId: number, schaetzungUsd: number, reserviertUsd = 0): { erlaubt: true } | { erlaubt: false; grund: string } {
  const b = einheitBudget(unitId);
  if (!b.automatisch) return { erlaubt: false, grund: "Automatisch ist aus (0 € je Einheit)." };
  if (b.kostenEur + (reserviertUsd + schaetzungUsd) / usdPerEur() > b.budgetEur + 1e-9) return { erlaubt: false, grund: budgetErreichtText(b.budgetEur) };
  return { erlaubt: true };
}

/** Hintergrund-KI dieser Einheit (Live-Analyse) stoppt, wenn ein Betrag gesetzt und erreicht ist. Bei 0 € läuft sie wie bisher. */
export const hintergrundGestoppt = (unitId: number) => einheitBudget(unitId).erreicht;

/**
 * Die Zeile im Unterricht: „KI heute: 0,07 € von 0,30 €“, erreicht (auch auf Tippen darüber) „KI heute: 0,34 € (Budget 0,30 € erreicht)“,
 * „KI heute: 0,07 € · automatisch aus“ oder „… · KI ist aus“.
 */
export function kostenZeile(b: Pick<EinheitBudget, "kostenEur" | "budgetEur" | "automatisch">, kiAn = true): string {
  const heute = `KI heute: ${euroKlein(b.kostenEur)}`;
  if (!kiAn) return `${heute} · KI ist aus`;
  if (!b.automatisch) return `${heute} · automatisch aus`;
  return b.kostenEur >= b.budgetEur ? `${heute} (Budget ${euro(b.budgetEur)} erreicht)` : `${heute} von ${euro(b.budgetEur)}`;
}

/** Die laufende Einheit eines Schülers (höchstens eine, lib/db.ts), oder null. */
export function laufendeEinheitVon(studentId: number): number | null {
  const r = db().prepare("SELECT id FROM units WHERE student_id = ? AND status = 'gestartet' ORDER BY id DESC LIMIT 1").get(studentId) as { id: number } | undefined;
  return r?.id ?? null;
}

/**
 * Beim Start einer Einheit: die Briefings, die heute (Wien) für diesen Schüler im Hintergrund oder auf Klick liefen, zählen zu ihr.
 * Nur Zeilen ohne Einheit, nie Testläufe. Gibt die Zahl der Zeilen zurück.
 */
export function ordneBriefingZu(unitId: number, studentId: number, at = Date.now()): number {
  // Mitternacht in Wien: die Minuten des Tages und die Sekunden der laufenden Minute zurück
  const heute = new Date(at - wienerMinuten(new Date(at)) * 60_000 - (at % 60_000)).toISOString();
  return db()
    .prepare("UPDATE ai_calls SET unit_id = ? WHERE unit_id IS NULL AND test = 0 AND fn = 'briefing' AND student_id = ? AND created_at >= ? AND created_at <= ?")
    .run(unitId, studentId, heute, new Date(at + 60_000).toISOString()).changes;
}
