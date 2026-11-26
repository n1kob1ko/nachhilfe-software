/**
 * Der **geführte Ablauf** einer laufenden Einheit (niko, 26.11.2026: „Der Ablauf soll klar und einfach sein, die Lehrer kennen
 * sich mit der Technik nicht aus“). Auf dem Schirm steht immer nur eine Stufe mit einem großen Knopf:
 *
 *   Start ─┬─ weiter (gleiches Thema wie letztes Mal) → Kurztest → Üben → Hausübung
 *          └─ neu (der Schüler zeigt neuen Stoff)     → Stoff → Erklären → Üben → Hausübung
 *
 * Diese Datei hält nur fest, auf welchem Weg und in welcher Stufe die Einheit ist, und liest die Ergebnisse, die die Stufen
 * brauchen (Kurztest, Übungen dieser Einheit). Alles andere kommt aus den vorhandenen Teilen: Minitest (lib/minitest.ts),
 * Vorgabe mit Fotos (lib/vorgabe.ts), Plan und Präsentation (lib/cockpit.ts, lib/praesentation-unterricht.ts), Übungen aus
 * dem Generator (lib/cockpit.ts `sendeAusGenerator`), Hausübung im Abschluss (lib/hausuebung.ts). Das ganze frühere Cockpit
 * bleibt unter „Mehr Werkzeuge“.
 */
import { db, json } from "./db";
import { hatBegonnen, leseStand } from "./cockpit";
import { minitestDerEinheit } from "./minitest";
import * as repo from "./repo";
import { getUnit } from "./units";

export type Weg = "weiter" | "neu";
export type Stufe = "start" | "kurztest" | "stoff" | "erklaeren" | "ueben" | "schluss";

export const STUFE_LABEL: Record<Stufe, string> = { start: "Start", kurztest: "Kurztest", stoff: "Stoff", erklaeren: "Erklären", ueben: "Üben", schluss: "Hausübung" };

/** Die Stufen eines Wegs in ihrer Reihenfolge; ohne Wahl die des neuen Themas (der längere Weg). */
export function stufenFuer(weg: Weg | null): Stufe[] {
  return weg === "weiter" ? ["start", "kurztest", "ueben", "schluss"] : ["start", "stoff", "erklaeren", "ueben", "schluss"];
}

export const isWeg = (x: unknown): x is Weg => x === "weiter" || x === "neu";
export const isStufe = (x: unknown): x is Stufe => typeof x === "string" && x in STUFE_LABEL;

export type Ablauf = {
  unitId: number;
  weg: Weg | null;
  stufe: Stufe;
  /** die Themen von heute (Fähigkeiten), in der Reihenfolge, in der sie drankommen */
  skillIds: string[];
  /** das Thema, das gerade erklärt oder geübt wird; null = das erste */
  aktuell: string | null;
  /** der Lehrer hat „Kurztest ist fertig“ getippt (auch wenn nicht alles beantwortet ist) */
  kurztestFertig: boolean;
  /** „Mehr Werkzeuge“: das ganze frühere Cockpit statt der einen Stufe */
  alles: boolean;
  /** schon einmal gespeichert (sonst der Anfang) */
  gespeichert: boolean;
};

type Zeile = { unit_id: number; weg: string | null; stufe: string; skill_ids: string; aktuell: string | null; kurztest_fertig: number; ansicht: string };

export function leseAblauf(unitId: number): Ablauf {
  const r = db().prepare("SELECT * FROM einheit_ablauf WHERE unit_id = ?").get(unitId) as Zeile | undefined;
  const weg = isWeg(r?.weg) ? r.weg : null;
  const stufe = isStufe(r?.stufe) && stufenFuer(weg).includes(r.stufe) ? r.stufe : "start";
  const skillIds = json<unknown>(r?.skill_ids, []);
  return {
    unitId,
    weg,
    stufe,
    skillIds: Array.isArray(skillIds) ? skillIds.filter((x): x is string => typeof x === "string") : [],
    aktuell: r?.aktuell ?? null,
    kurztestFertig: Boolean(r?.kurztest_fertig),
    alles: r?.ansicht === "alles",
    gespeichert: Boolean(r),
  };
}

function schreibe(a: Ablauf) {
  db()
    .prepare(
      `INSERT INTO einheit_ablauf (unit_id, weg, stufe, skill_ids, aktuell, kurztest_fertig, ansicht, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(unit_id) DO UPDATE SET weg = excluded.weg, stufe = excluded.stufe, skill_ids = excluded.skill_ids, aktuell = excluded.aktuell,
         kurztest_fertig = excluded.kurztest_fertig, ansicht = excluded.ansicht, updated_at = excluded.updated_at`,
    )
    .run(a.unitId, a.weg, a.stufe, JSON.stringify(a.skillIds), a.aktuell, a.kurztestFertig ? 1 : 0, a.alles ? "alles" : "gefuehrt");
}

type Ergebnis = { ok: true } | { fehler: string };

const laeuft = (unitId: number) => getUnit(unitId)?.status === "gestartet";

/** Die Antwort auf „Was machen wir heute?“: weiter mit dem Stoff vom letzten Mal (dann der Kurztest) oder neuer Stoff. */
export function waehleWeg(unitId: number, weg: Weg, skillIds: string[] = []): Ergebnis {
  if (!laeuft(unitId)) return { fehler: "Diese Einheit läuft nicht mehr." };
  const ids = [...new Set(skillIds.filter((id) => repo.getSkill(id)))];
  schreibe({ ...leseAblauf(unitId), weg, stufe: weg === "weiter" ? "kurztest" : "stoff", skillIds: ids, aktuell: ids[0] ?? null, kurztestFertig: false });
  return { ok: true };
}

/** Zu einer Stufe des gewählten Wegs springen (die Stufen oben antippen, „Weiter“). Zurück zum Start setzt den Weg zurück. */
export function setzeStufe(unitId: number, stufe: Stufe): Ergebnis {
  if (!laeuft(unitId)) return { fehler: "Diese Einheit läuft nicht mehr." };
  const a = leseAblauf(unitId);
  if (stufe === "start") {
    schreibe({ ...a, weg: null, stufe: "start" });
    return { ok: true };
  }
  if (!a.weg) return { fehler: "Zuerst wählen: weiter wie letztes Mal oder neues Thema." };
  if (!stufenFuer(a.weg).includes(stufe)) return { fehler: "Diese Stufe gibt es auf diesem Weg nicht." };
  schreibe({ ...a, stufe });
  return { ok: true };
}

/** Die Themen von heute setzen (nach den Fotos vom Stoff); das erste wird das aktuelle. */
export function setzeThemen(unitId: number, skillIds: string[]): Ergebnis {
  if (!laeuft(unitId)) return { fehler: "Diese Einheit läuft nicht mehr." };
  const ids = [...new Set(skillIds.filter((id) => repo.getSkill(id)))];
  const a = leseAblauf(unitId);
  schreibe({ ...a, skillIds: ids, aktuell: a.aktuell && ids.includes(a.aktuell) ? a.aktuell : (ids[0] ?? null) });
  return { ok: true };
}

/** Das Thema, das jetzt erklärt oder geübt wird. */
export function setzeAktuell(unitId: number, skillId: string, stufe?: Stufe): Ergebnis {
  if (!laeuft(unitId)) return { fehler: "Diese Einheit läuft nicht mehr." };
  const a = leseAblauf(unitId);
  if (!repo.getSkill(skillId)) return { fehler: "Dieses Thema gibt es nicht." };
  const skillIds = a.skillIds.includes(skillId) ? a.skillIds : [...a.skillIds, skillId];
  schreibe({ ...a, skillIds, aktuell: skillId, stufe: stufe && a.weg && stufenFuer(a.weg).includes(stufe) ? stufe : a.stufe });
  return { ok: true };
}

export function kurztestFertig(unitId: number): Ergebnis {
  if (!laeuft(unitId)) return { fehler: "Diese Einheit läuft nicht mehr." };
  schreibe({ ...leseAblauf(unitId), kurztestFertig: true });
  return { ok: true };
}

/** „Mehr Werkzeuge“ (alles = true) und „Zurück zum Ablauf“ (false): gilt für diese Einheit, bis wieder umgeschaltet wird. */
export function setzeAnsicht(unitId: number, alles: boolean): Ergebnis {
  if (!laeuft(unitId)) return { fehler: "Diese Einheit läuft nicht mehr." };
  schreibe({ ...leseAblauf(unitId), alles });
  return { ok: true };
}

/**
 * Zeigt die Einheit den geführten Ablauf? Nicht nach „Mehr Werkzeuge“; sonst ja, sobald er einmal benutzt wurde, und bei jeder
 * neuen Einheit, in der noch nichts getan ist. Eine Einheit, die schon im früheren Unterricht läuft (etwa beim Update mitten
 * in der Stunde), bleibt dort, bis der Lehrer „Geführter Ablauf“ tippt.
 */
export function zeigtGefuehrt(unitId: number): boolean {
  const a = leseAblauf(unitId);
  if (a.gespeichert) return !a.alles;
  if (db().prepare("SELECT 1 FROM assignments WHERE unit_id = ? LIMIT 1").get(unitId)) return false;
  return !hatBegonnen(leseStand(unitId));
}

// ---------- Ergebnisse ----------

export type ThemaErgebnis = { skillId: string; name: string; aufgaben: number; fertig: number; richtig: number; falsch: number };
export type Auswertung = { aufgaben: number; fertig: number; richtig: number; falsch: number; themen: ThemaErgebnis[] };

type Versuch = Pick<repo.Attempt, "task_id" | "skill_id" | "correct" | "final" | "solution_viewed">;

/**
 * Wie es gelaufen ist, aus den Versuchen: je Aufgabe zählt der letzte Versuch. Fertig ist eine Aufgabe, wenn sie richtig ist
 * oder keine Versuche mehr hat; richtig nur ohne angesehene Lösung. `alle`: die Aufgaben, die es gibt (auch unbeantwortete).
 */
export function auswerten(versuche: Versuch[], alle: { id: number; skillId: string | null }[], name: (id: string) => string = (id) => repo.getSkill(id)?.name ?? id): Auswertung {
  const letzter = new Map<number, Versuch>();
  for (const v of versuche) letzter.set(v.task_id, v);
  const skillVon = new Map(alle.map((t) => [t.id, t.skillId]));
  for (const v of versuche) if (!skillVon.has(v.task_id)) skillVon.set(v.task_id, v.skill_id);
  const themen = new Map<string, ThemaErgebnis>();
  const out: Auswertung = { aufgaben: skillVon.size, fertig: 0, richtig: 0, falsch: 0, themen: [] };
  for (const [taskId, skillId] of skillVon) {
    const t = skillId ? (themen.get(skillId) ?? { skillId, name: name(skillId), aufgaben: 0, fertig: 0, richtig: 0, falsch: 0 }) : null;
    if (t) {
      t.aufgaben++;
      themen.set(t.skillId, t);
    }
    const v = letzter.get(taskId);
    if (!v || !(v.final || v.correct)) continue;
    const richtig = Boolean(v.correct) && !v.solution_viewed;
    out.fertig++;
    out[richtig ? "richtig" : "falsch"]++;
    if (t) {
      t.fertig++;
      t[richtig ? "richtig" : "falsch"]++;
    }
  }
  out.themen = [...themen.values()].sort((a, b) => b.falsch - a.falsch || b.aufgaben - a.aufgaben);
  return out;
}

/** Der Kurztest dieser Einheit: gesendet oder nur gedruckt, und wie er gelaufen ist. */
export function kurztestStand(unitId: number): { worksheetId: number; assignmentId: number | null; auswertung: Auswertung; fertig: boolean } | null {
  const m = minitestDerEinheit(unitId);
  if (!m) return null;
  const tasks = repo.listTasks(m.worksheet.id).map((t) => ({ id: t.id, skillId: t.skillId ?? null }));
  const versuche = m.assignment ? (db().prepare("SELECT task_id, skill_id, correct, final, solution_viewed FROM attempts WHERE assignment_id = ? ORDER BY created_at, id").all(m.assignment.id) as Versuch[]) : [];
  const auswertung = auswerten(versuche, tasks);
  const fertig = Boolean(m.assignment?.completed_at) || (auswertung.aufgaben > 0 && auswertung.fertig >= auswertung.aufgaben);
  return { worksheetId: m.worksheet.id, assignmentId: m.assignment?.id ?? null, auswertung, fertig };
}

/** Die Übungen dieser Einheit ohne den Kurztest: alle zusammen, jede für sich (in der Reihenfolge des Sendens) und die zuletzt gesendete. */
export function uebenStand(unitId: number): { gesamt: Auswertung; einzeln: Auswertung[]; letzte: { assignmentId: number; titel: string; auswertung: Auswertung; fertig: boolean } | null } {
  const kurztest = minitestDerEinheit(unitId)?.worksheet.id ?? null;
  const zuweisungen = (db().prepare("SELECT * FROM assignments WHERE unit_id = ? ORDER BY id").all(unitId) as repo.Assignment[]).filter((a) => a.worksheet_id !== kurztest);
  const alle: { id: number; skillId: string | null }[] = [];
  const versuche: Versuch[] = [];
  const einzeln: Auswertung[] = [];
  let letzte: ReturnType<typeof uebenStand>["letzte"] = null;
  for (const z of zuweisungen) {
    const tasks = repo.listTasks(z.worksheet_id).map((t) => ({ id: t.id, skillId: t.skillId ?? null }));
    const vs = db().prepare("SELECT task_id, skill_id, correct, final, solution_viewed FROM attempts WHERE assignment_id = ? ORDER BY created_at, id").all(z.id) as Versuch[];
    alle.push(...tasks);
    versuche.push(...vs);
    const auswertung = auswerten(vs, tasks);
    einzeln.push(auswertung);
    letzte = { assignmentId: z.id, titel: repo.getWorksheet(z.worksheet_id)?.title ?? "Übung", auswertung, fertig: Boolean(z.completed_at) || (auswertung.aufgaben > 0 && auswertung.fertig >= auswertung.aufgaben) };
  }
  return { gesamt: auswerten(versuche, alle), einzeln, letzte };
}

/**
 * Was als Nächstes geübt wird, ohne KI (die Regel, nach der der große Knopf in „Üben“ fragt). Je Thema zählt das Neueste, was es
 * dazu gibt: die letzte Übung mit Antworten zum Thema, sonst der Kurztest.
 * 1. ein Thema, bei dem das Neueste Fehler hat: Aufgaben zu den Fehlern (das aktuelle Thema zuerst, dann das mit den meisten Fehlern);
 * 2. ein Thema von heute, das noch nicht geübt wurde;
 * 3. sonst das aktuelle Thema noch einmal (die Übung passt sich dem Lernstand an).
 */
export function naechsteUebung(a: Pick<Ablauf, "skillIds" | "aktuell">, kurztest: Auswertung | null, uebungen: Auswertung[]): { skillId: string; art: "fehler" | "neu" | "nochmal" } | null {
  const neuestes = new Map<string, ThemaErgebnis>();
  const geuebt = new Set<string>();
  for (const [i, e] of [kurztest, ...uebungen].entries()) {
    for (const t of e?.themen ?? []) {
      if (t.fertig === 0) continue;
      neuestes.set(t.skillId, t);
      if (i > 0) geuebt.add(t.skillId);
    }
  }
  const offen = [...neuestes.values()].filter((t) => t.falsch > 0 && repo.getSkill(t.skillId)).sort((x, y) => (x.skillId === a.aktuell ? -1 : y.skillId === a.aktuell ? 1 : y.falsch - x.falsch));
  if (offen[0]) return { skillId: offen[0].skillId, art: "fehler" };
  const reihe = a.skillIds.length ? a.skillIds : [...neuestes.keys()];
  const neu = reihe.find((id) => !geuebt.has(id) && repo.getSkill(id));
  if (neu) return { skillId: neu, art: "neu" };
  const nochmal = a.aktuell ?? reihe[0] ?? null;
  return nochmal && repo.getSkill(nochmal) ? { skillId: nochmal, art: "nochmal" } : null;
}
