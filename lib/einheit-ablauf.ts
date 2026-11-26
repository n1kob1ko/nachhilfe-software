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
import { hatBegonnen, leseStand, mitZeile, planNeu } from "./cockpit";
import { autoFelderVon } from "./einschaetzung";
import { getLernpaket, type LernpaketMitSchritten, type LernpaketSchritt, type SchrittArt } from "./lernpakete";
import { minitestDerEinheit } from "./minitest";
import * as repo from "./repo";
import { getStoffpaket, uebernimmStoffpaket, type Stoffpaket } from "./stoffpaket";
import { aiState, latestCorrection, listItems } from "./text-correction";
import { categoryLabel } from "./text-correction-rules";
import { textsForUnit } from "./texts";
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
  /** mit Lernpaket aus „Stoff vorbereiten“: der Schritt, der in „Erklären“ auf dem Schirm ist; null = der erste */
  schrittId: number | null;
  /** schon einmal gespeichert (sonst der Anfang) */
  gespeichert: boolean;
};

type Zeile = { unit_id: number; weg: string | null; stufe: string; skill_ids: string; aktuell: string | null; kurztest_fertig: number; ansicht: string; schritt_id: number | null };

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
    schrittId: r?.schritt_id ?? null,
    gespeichert: Boolean(r),
  };
}

function schreibe(a: Ablauf) {
  db()
    .prepare(
      `INSERT INTO einheit_ablauf (unit_id, weg, stufe, skill_ids, aktuell, kurztest_fertig, ansicht, schritt_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(unit_id) DO UPDATE SET weg = excluded.weg, stufe = excluded.stufe, skill_ids = excluded.skill_ids, aktuell = excluded.aktuell,
         kurztest_fertig = excluded.kurztest_fertig, ansicht = excluded.ansicht, schritt_id = excluded.schritt_id, updated_at = excluded.updated_at`,
    )
    .run(a.unitId, a.weg, a.stufe, JSON.stringify(a.skillIds), a.aktuell, a.kurztestFertig ? 1 : 0, a.alles ? "alles" : "gefuehrt", a.schrittId);
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

// ---------- Neues Thema mit „Stoff vorbereiten“ (Fotos → Präsentation, Sprechtext, Fragen, Übungsblatt) ----------

/**
 * Der Stoff dieser Einheit aus „Stoff vorbereiten“ (lib/stoffpaket.ts): der neueste Lauf, der in dieser Einheit gestartet wurde
 * und nicht verworfen ist. In der Stufe „Stoff“ des neuen Themas startet ihn der große Knopf; er liefert in einem KI-Lauf das
 * Lernpaket (Sprechtext, Fragen mit erwarteter Antwort), die Präsentation dazu und ein Übungsblatt mit 8 Aufgaben.
 */
export function stoffpaketDerEinheit(unitId: number): Stoffpaket | null {
  const id = db().prepare("SELECT id FROM stoffpakete WHERE unit_id = ? AND status <> 'verworfen' ORDER BY id DESC LIMIT 1").pluck().get(unitId) as number | undefined;
  return id ? getStoffpaket(id) : null;
}

/** Diese Schritte eines Lernpakets gehören zu „Erklären“; Übung, Zusatz, Kontrolle und Abschluss macht „Üben“ am Tablet. */
const ERKLAER_ARTEN: readonly SchrittArt[] = ["einstieg", "erklaerung", "beispiel", "frage", "gefuehrte_uebung"];

/** Die Schritte zum Erklären, in der Reihenfolge des Pakets (hat es keinen davon: alle). */
export function erklaerSchritte(p: LernpaketMitSchritten): LernpaketSchritt[] {
  const s = [...p.schritte].sort((a, b) => a.position - b.position);
  const e = s.filter((x) => ERKLAER_ARTEN.includes(x.art));
  return e.length ? e : s;
}

/** Das Lernpaket, mit dem „Erklären“ geht: das des Cockpits, wenn es aus dem Stoff dieser Einheit kommt. */
export function erklaerPaket(unitId: number): LernpaketMitSchritten | null {
  const p = stoffpaketDerEinheit(unitId);
  if (!p?.paket_id || p.status !== "uebernommen" || leseStand(unitId).paket_id !== p.paket_id) return null;
  const paket = getLernpaket(p.paket_id);
  return paket && paket.status !== "archiviert" && paket.schritte.length ? paket : null;
}

/**
 * „Übernehmen und erklären“: der fertige Stoff wird übernommen (lib/stoffpaket.ts: Lernpaket geprüft, Präsentation gespeichert,
 * Lernzettel in der Schüler-App), das Lernpaket ist der Ablauf dieser Einheit, seine Themen sind die von heute, und „Erklären“
 * beginnt beim ersten Schritt.
 */
export function stoffUebernehmen(unitId: number, teacherId: number): Ergebnis {
  if (!laeuft(unitId)) return { fehler: "Diese Einheit läuft nicht mehr." };
  const p = stoffpaketDerEinheit(unitId);
  if (!p) return { fehler: "Es ist noch kein Stoff vorbereitet." };
  const u = uebernimmStoffpaket(p.id, teacherId);
  if ("fehler" in u) return u;
  // uebernimmStoffpaket wählt das Paket nur, solange in der Einheit nichts getan ist; im geführten Ablauf gilt es immer
  if (p.paket_id && leseStand(unitId).paket_id !== p.paket_id) {
    const n = planNeu(unitId, p.paket_id);
    if ("fehler" in n) return n;
  }
  const a = leseAblauf(unitId);
  const ids = [...new Set(p.skill_ids.filter((id) => repo.getSkill(id)))];
  const paket = p.paket_id ? getLernpaket(p.paket_id) : null;
  schreibe({ ...a, stufe: a.weg ? "erklaeren" : a.stufe, skillIds: ids.length ? ids : a.skillIds, aktuell: ids[0] ?? a.aktuell, schrittId: paket ? (erklaerSchritte(paket)[0]?.id ?? null) : null });
  return { ok: true };
}

/** Ein anderer Schritt des Lernpakets in „Erklären“ („Weiter“, „Zurück“). */
export function setzeSchritt(unitId: number, schrittId: number): Ergebnis {
  if (!laeuft(unitId)) return { fehler: "Diese Einheit läuft nicht mehr." };
  const paket = erklaerPaket(unitId);
  if (!paket || !erklaerSchritte(paket).some((s) => s.id === schrittId)) return { fehler: "Diesen Schritt gibt es hier nicht." };
  schreibe({ ...leseAblauf(unitId), schrittId });
  return { ok: true };
}

/** Das Übungsblatt aus dem Stoff dieser Einheit, solange es in dieser Einheit noch nicht gesendet ist; sonst null. */
export function offenesStoffBlatt(unitId: number): number | null {
  const p = stoffpaketDerEinheit(unitId);
  if (!p || p.status !== "uebernommen" || !p.uebung_id || !repo.getWorksheet(p.uebung_id) || !repo.listTasks(p.uebung_id).length) return null;
  return db().prepare("SELECT 1 FROM assignments WHERE unit_id = ? AND worksheet_id = ?").get(unitId, p.uebung_id) ? null : p.uebung_id;
}

/** Anfang der Zeile, die der geführte Ablauf in die Dokumentation schreibt (zum Ersetzen beim zweiten Mal). */
const ERKLAERT = "Erklärt mit Präsentation: ";

/**
 * Beim Beenden: lief „Erklären“ mit einem Lernpaket aus dem Stoff dieser Einheit, steht in „Was wurde gemacht?“, welches Thema
 * mit wie vielen Schritten erklärt wurde und wie die Fragen beantwortet wurden (Richtig / Teilweise / Falsch, wie getippt). Nur
 * aus dem, was in der Einheit wirklich passiert ist; ein Feld, das der Lehrer selbst geschrieben hat, bleibt.
 */
export function dokumentiereGefuehrt(lessonId: number, unitId: number): string | null {
  const a = leseAblauf(unitId);
  const lesson = repo.getLesson(lessonId);
  if (!a.weg || !lesson) return null;
  const p = stoffpaketDerEinheit(unitId);
  const paket = p?.paket_id && p.status === "uebernommen" ? getLernpaket(p.paket_id) : null;
  if (!paket || leseStand(unitId).paket_id !== paket.id) return null;
  const schritte = erklaerSchritte(paket);
  const bis = schritte.findIndex((s) => s.id === a.schrittId);
  const antworten = leseStand(unitId).antworten;
  const zahl = (w: string) => schritte.filter((s) => antworten[s.id] === w).length;
  const fragen = [["richtig", zahl("richtig")], ["teilweise", zahl("teilweise")], ["falsch", zahl("falsch")]].filter(([, n]) => Number(n) > 0).map(([w, n]) => `${n} ${w}`);
  const zeile = `${ERKLAERT}„${p!.thema || paket.title}“, ${Math.max(1, bis + 1)} von ${schritte.length} Schritten${fragen.length ? `; Fragen: ${fragen.join(", ")}` : ""}.`;
  const auto = autoFelderVon(lesson);
  const bisher = lesson.activities ?? "";
  if (bisher.trim() && !auto.has("activities")) return zeile;
  const wert = mitZeile(bisher, ERKLAERT, zeile);
  const werte = json<Record<string, unknown>>(lesson.auto_felder, {});
  werte.activities = wert;
  repo.saveLesson({ ...lesson, activities: wert }, lesson.id);
  db().prepare("UPDATE lessons SET auto_felder = ? WHERE id = ?").run(JSON.stringify(werte), lesson.id);
  return zeile;
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

// ---------- Deutsch, Englisch: ein Text von heute und Aufgaben zu seinen Fehlern ----------

export type TextFehler = {
  textId: number;
  titel: string;
  /** noch nichts drin (auf Papier geschrieben, noch nicht fotografiert) */
  leer: boolean;
  /** keine: noch nicht korrigiert; laeuft: die KI korrigiert gerade; fertig: Korrektur da */
  korrektur: "keine" | "laeuft" | "fertig";
  /** die Fehler der Korrektur (ohne abgelehnte), je Bereich, die meisten zuerst */
  fehler: number;
  bereiche: { label: string; anzahl: number }[];
  /** die Fähigkeiten der Fehler, die meisten zuerst; `offen`: seit der Korrektur noch keine Übung dazu in dieser Einheit */
  skills: { skillId: string; name: string; anzahl: number; offen: boolean }[];
};

/**
 * Der Text dieser Einheit (der zuletzt geschriebene oder weitergeschriebene, nicht archiviert) und was seine Korrektur ergab
 * (niko, 26.11.2026: „Text mit der Hand schreiben, abfotografieren, korrigieren, dann zu den Fehlern die Übungen“). Es zählen
 * die Fehler der KI und des Lehrers, außer den abgelehnten: ein offener Vorschlag der KI reicht für die Wahl der Übung (der
 * Lernstand ändert sich erst durch die Antworten des Schülers). Eine Fähigkeit ist `offen`, solange seit der Korrektur keine
 * Übung zu ihr in dieser Einheit gesendet wurde. Keine KI, nur Lesen.
 */
export function textFehler(unitId: number): TextFehler | null {
  const t = textsForUnit(unitId)
    .filter((x) => !x.archived_at)
    .at(-1);
  if (!t) return null;
  const c = latestCorrection(t.id);
  const basis = { textId: t.id, titel: t.title || "Text", leer: !t.words, fehler: 0, bereiche: [], skills: [] };
  if (!c) return { ...basis, korrektur: "keine" };
  const state = aiState(c);
  if (state === "laeuft") return { ...basis, korrektur: "laeuft" };
  const alle = listItems(c.id);
  // die Korrektur ist nur geöffnet (oder die KI ging nicht) und nichts ist markiert: noch nicht korrigiert
  if (!alle.length && (state === "keine" || state === "fehler")) return { ...basis, korrektur: "keine" };
  const items = alle.filter((i) => i.kind === "fehler" && i.status !== "abgelehnt");
  const zaehle = (keys: string[]) => {
    const n = new Map<string, number>();
    for (const k of keys) n.set(k, (n.get(k) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1]);
  };
  const deutsch = (t.subject || "Deutsch") === "Deutsch";
  let skillZahl = zaehle(items.map((i) => i.skill_id ?? (deutsch ? skillAusStelle(i) : null)).filter((x): x is string => Boolean(x && repo.getSkill(x))));
  // ohne Fähigkeit an den Fehlern: die Empfehlung der Korrektur
  if (!skillZahl.length && items.length && c.recommendation_skill && repo.getSkill(c.recommendation_skill)) skillZahl = [[c.recommendation_skill, items.length]];
  const geuebt = (skillId: string) =>
    Boolean(
      db()
        .prepare("SELECT 1 FROM assignments a JOIN worksheets w ON w.id = a.worksheet_id WHERE a.unit_id = ? AND a.assigned_at >= datetime(?) AND w.skill_ids LIKE ? LIMIT 1")
        .get(unitId, c.created_at, `%"${skillId}"%`),
    );
  return {
    ...basis,
    korrektur: "fertig",
    fehler: items.length,
    bereiche: zaehle(items.map((i) => i.category)).map(([k, anzahl]) => ({ label: categoryLabel(k), anzahl })),
    skills: skillZahl.map(([skillId, anzahl]) => ({ skillId, name: repo.getSkill(skillId)!.name, anzahl, offen: !geuebt(skillId) })),
  };
}

/**
 * Eine Korrektur des Lehrers trägt keine Fähigkeit (die der KI schon). Für die häufigsten Fehler in Deutsch ist sie an der
 * Stelle selbst zu sehen: nur Groß/klein anders, das/dass, s/ss/ß, getrennt/zusammen, ein Beistrich. Sonst null.
 */
export function skillAusStelle(i: { category: string; quote: string; replacement: string }): string | null {
  const q = i.quote.trim();
  const r = i.replacement.trim();
  if (!q || !r || q === r) return i.category === "zeichensetzung" ? "deutsch.beistrich.nebensatz" : null;
  if (i.category === "zeichensetzung" || (q.replace(/,/g, "") === r.replace(/,/g, "") && q.split(",").length !== r.split(",").length)) return "deutsch.beistrich.nebensatz";
  if (i.category !== "rechtschreibung" && i.category !== "grammatik") return null;
  if (q.toLowerCase() === r.toLowerCase()) return "deutsch.recht.gross";
  if (/\bdass?\b/i.test(q) && /\bdass?\b/i.test(r)) return "deutsch.recht.dasdass";
  const ohneS = (x: string) => x.toLowerCase().replace(/ss|ß|s/g, "s");
  if (ohneS(q) === ohneS(r)) return "deutsch.recht.sss";
  if (q.replace(/[\s-]/g, "").toLowerCase() === r.replace(/[\s-]/g, "").toLowerCase()) return "deutsch.recht.getrennt-zusammen";
  return null;
}

