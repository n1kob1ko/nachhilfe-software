/**
 * „Anpassen“ im **Cockpit** (Plan 2.2, niko 2026-10-23): auf Klick des Lehrers schlägt die KI für das Lernpaket
 * der laufenden Einheit Anpassungen an genau diesen Schüler vor: ein zusätzliches Beispiel zu seinen letzten
 * Fehlern, eine leichtere oder schwerere Fassung einer Frage mit erwarteter Antwort, einen Hinweis „Bei Fehler“.
 * Etwa 3 Cent je Klick.
 *
 * Was hinausgeht, sind die Schritte des Pakets und nachprüfbare Tatsachen aus der App (lib/ai/anpassen.ts, ohne
 * Namen). Jeder Vorschlag ist „Ungeprüft“, bis der Lehrer ihn übernimmt oder verwirft. Übernommenes gilt nur für
 * diese Einheit (Tabelle `einheit_anpassungen`, wie Reihenfolge und Notizen in `einheit_cockpit`); das Paket
 * ändert sich nie. Nichts davon kommt in Lernstand, Diagnose oder Einschätzung, und Schüler sehen es nicht.
 *
 * Ohne KI, mit aufgebrauchtem Budget oder erreichter Grenze je Schüler sagt der Knopf das, und das Cockpit
 * arbeitet unverändert weiter.
 */
import { ANPASSUNG_ARTEN, kiAnpassen, namenFuerAnpassen, type AnpassenDaten, type AnpassungArt, type Tatsache } from "./ai/anpassen";
import { aiEnabled, breakerState, budgetUsedUp, schuelerGestoppt } from "./ai/router";
import { grenzeErreichtText } from "./ai/schueler-kosten";
import { datumKurz } from "./briefing";
import { cockpit } from "./cockpit";
import { db, json } from "./db";
import { DIAGNOSIS_STATUS_LABEL, diagnosesOf, diagnosisResult } from "./diagnose";
import { errorTypeLabel } from "./error-types";
import { daysUntil } from "./exams";
import { SCHRITT_ARTEN } from "./lernpakete";
import { masteryStatus } from "./mastery";
import { wienerDatum } from "./planung/zeit";
import * as repo from "./repo";
import { klassenLabel } from "./school";
import { analyzeStudent } from "./service";
import { getUnit } from "./units";

export { ANPASSUNG_ARTEN, type AnpassungArt } from "./ai/anpassen";

export type AnpassungStatus = "vorschlag" | "uebernommen" | "verworfen";

export type Anpassung = {
  id: number;
  unit_id: number;
  paket_id: number | null;
  schritt_id: number;
  art: AnpassungArt;
  titel: string;
  text: string;
  antwort: string;
  /** die Tatsachen der App, auf die sich der Vorschlag stützt */
  bezug: string[];
  status: AnpassungStatus;
  created_at: string;
  decided_at: string | null;
};

type Row = Omit<Anpassung, "bezug"> & { bezug: string };

/** Die Anpassungen einer Einheit, älteste zuerst; ohne `status` alle außer den verworfenen. */
export function anpassungen(unitId: number, status?: AnpassungStatus): Anpassung[] {
  const rows = db()
    .prepare(`SELECT * FROM einheit_anpassungen WHERE unit_id = ? AND ${status ? "status = ?" : "status <> 'verworfen'"} ORDER BY id`)
    .all(...(status ? [unitId, status] : [unitId])) as Row[];
  return rows.map((r) => ({ ...r, bezug: json<string[]>(r.bezug, []) }));
}

// ---------- what goes to the KI ----------

const clip = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const prozent = (m: number) => `${Math.round(m * 100)} %`;

/**
 * Die Tatsachen über den Schüler, alle aus der App und nachprüfbar, die zum Paket zuerst: nächste Schularbeit mit
 * Stoff, Lernstand der Fähigkeiten des Pakets, die letzte Diagnose, häufige Fehlerarten, die letzten falschen
 * Antworten. Dazu die Texte, in denen Namen stehen könnten.
 */
export function tatsachen(studentId: number, skillIds: string[], fach: string, now = new Date()): { tatsachen: Tatsache[]; freieTexte: string[] } {
  const heute = wienerDatum(now);
  const paketSkills = new Set(skillIds);
  const out: string[] = [];
  const freieTexte: string[] = [];

  const test = repo.upcomingTests(heute, studentId).find((t) => !fach || t.subject === fach) ?? repo.upcomingTests(heute, studentId)[0];
  if (test) {
    const tage = daysUntil(test.date, heute);
    const stoff = test.topics?.length ? test.topics : test.topic ? [test.topic] : [];
    const name = test.title || `${test.kind} ${test.subject}`;
    out.push(`${name} ${tage === 0 ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen`}${stoff.length ? `, Stoff: ${stoff.join(", ")}` : ""}`);
    freieTexte.push(name, ...stoff);
  }

  const analyse = analyzeStudent(studentId, now.getTime());
  const zumPaket = (ids: string[]) => ids.some((id) => paketSkills.has(id));
  const stand = (analyse?.skills ?? []).filter((s) => paketSkills.has(s.skill.id) && s.mastery !== null).slice(0, 5);
  for (const s of stand) out.push(`Lernstand ${s.skill.area} › ${s.skill.name}: ${prozent(s.mastery!)} (${masteryStatus(s.mastery)})`);

  const diag = diagnosesOf(studentId)[0];
  const ergebnis = diag ? diagnosisResult(diag.id, { today: heute, now: now.getTime() }) : null;
  if (ergebnis && ergebnis.done > 0) {
    const schwach = ergebnis.skills.filter((s) => s.status === "unsicher" || s.status === "kritisch");
    const liste = (schwach.some((s) => paketSkills.has(s.skill.id)) ? schwach.filter((s) => paketSkills.has(s.skill.id)) : schwach).slice(0, 4);
    if (liste.length) out.push(`Diagnose vom ${datumKurz(diag.assigned_at)}: ${liste.map((s) => `${s.skill.name} ${DIAGNOSIS_STATUS_LABEL[s.status].toLowerCase()}`).join(", ")}`);
  }

  const arten = (analyse?.errorTypes ?? []).filter((e) => e.type !== "unbekannt");
  for (const e of (arten.some((x) => zumPaket(x.skillIds)) ? arten.filter((x) => zumPaket(x.skillIds)) : arten).slice(0, 3))
    out.push(`Fehlerart „${errorTypeLabel(e.type)}“: ${e.count}×${e.confirmed ? `, davon ${e.confirmed}× vom Lehrer bestätigt` : ""}`);

  // die letzten falschen Antworten (90 Tage), die zu Fähigkeiten des Pakets zuerst, jede Aufgabe einmal
  const falsch = db()
    .prepare(
      `SELECT a.answer, a.error_label, a.error_type, a.skill_id, a.created_at, t.prompt FROM attempts a JOIN tasks t ON t.id = a.task_id
       WHERE a.student_id = ? AND a.correct = 0 AND a.created_at >= datetime('now', '-90 days') ORDER BY a.id DESC LIMIT 40`,
    )
    .all(studentId) as { answer: string; error_label: string | null; error_type: string | null; skill_id: string | null; created_at: string; prompt: string }[];
  const gesehen = new Set<string>();
  const sortiert = [...falsch.filter((a) => a.skill_id && paketSkills.has(a.skill_id)), ...falsch.filter((a) => !a.skill_id || !paketSkills.has(a.skill_id))];
  for (const a of sortiert) {
    if (gesehen.has(a.prompt) || gesehen.size >= 5) continue;
    gesehen.add(a.prompt);
    const extra = [a.error_label && `Fehler: ${clip(a.error_label, 80)}`, a.error_type && `Fehlerart: ${errorTypeLabel(a.error_type)}`].filter(Boolean).join(", ");
    out.push(`Falsch am ${datumKurz(a.created_at)}: „${clip(a.prompt, 160)}“, Antwort „${clip(a.answer, 80)}“${extra ? ` (${extra})` : ""}`);
    freieTexte.push(a.prompt, a.answer, a.error_label ?? "");
  }

  return { tatsachen: out.map((text, i) => ({ id: `F${i + 1}`, text })), freieTexte: freieTexte.filter((t) => t.trim()) };
}

/** Alles, was die KI für diese Einheit bekommt (Namen werden erst beim Bauen der Anfrage ersetzt); null ohne Paket. */
export function anpassenDaten(unitId: number, now = new Date()): AnpassenDaten | null {
  const unit = getUnit(unitId);
  const student = unit ? repo.getStudent(unit.student_id) : null;
  const c = cockpit(unitId);
  if (!unit || !student || !c.paket || !c.schritte.length) return null;
  const skillIds = [...new Set([...c.paket.skill_ids, ...c.schritte.flatMap((s) => s.aufgaben.flatMap((a) => [a.skillId, ...(a.skillIds ?? [])]))].filter((x): x is string => Boolean(x)))];
  const t = tatsachen(student.id, skillIds, c.paket.fach, now);
  const schon = (db().prepare("SELECT titel, art FROM einheit_anpassungen WHERE unit_id = ? ORDER BY id").all(unitId) as { titel: string; art: AnpassungArt }[]).map(
    (r) => `${ANPASSUNG_ARTEN[r.art] ?? r.art}: ${r.titel}`,
  );
  return {
    name: student.name,
    stufe: [klassenLabel(student.school_type, student.klasse), student.grade ? `Schulstufe ${student.grade}` : ""].filter(Boolean).join(", "),
    paket: { title: c.paket.title, fach: c.paket.fach, thema: c.paket.thema, ziel: c.paket.ziel },
    schritte: c.schritte.map((s, i) => ({
      nr: `S${i + 1}`,
      id: s.id,
      art: SCHRITT_ARTEN[s.art],
      titel: s.titel,
      minuten: s.minuten,
      lehrer_sagt: s.lehrer_sagt,
      lehrer_fragt: s.lehrer_fragt,
      erwartete_antwort: s.erwartete_antwort,
      bei_fehler: s.bei_fehler,
    })),
    tatsachen: t.tatsachen,
    freieTexte: t.freieTexte,
    schon,
  };
}

/** Wer in der Anfrage verborgen wird: der Schüler, alle Lehrer und Schüler der App, Namen in seinen Daten. */
export function namenFuer(d: AnpassenDaten): string[] {
  const bekannt = (db().prepare("SELECT name FROM teachers UNION SELECT name FROM students").all() as { name: string }[]).map((r) => r.name);
  return namenFuerAnpassen(d, bekannt);
}

// ---------- the button ----------

/** Ob „Anpassen“ jetzt geht. `grund` steht am Knopf, wenn es nicht geht; das Cockpit bleibt dann, wie es ist. */
export function anpassenStatus(studentId: number): { moeglich: boolean; grund: string | null } {
  const grund = !aiEnabled("anpassen")
    ? "Die KI ist aus oder nicht eingerichtet. Das Cockpit funktioniert ohne sie wie gewohnt."
    : budgetUsedUp("anpassen")
      ? "Das KI-Budget für diesen Monat ist aufgebraucht. Das Cockpit funktioniert ohne KI wie gewohnt."
      : schuelerGestoppt("anpassen", studentId)
        ? grenzeErreichtText()
        : breakerState().paused
          ? "Die KI war zuletzt nicht erreichbar und pausiert ein paar Minuten."
          : null;
  return { moeglich: grund === null, grund };
}

export type AnpassenErgebnis = { ok: true; anzahl: number; verworfen: number } | { ok: false; error: string };

const laufend = new Map<number, Promise<AnpassenErgebnis>>();

/**
 * Eine Anfrage an die KI für diese Einheit. Die neuen Vorschläge ersetzen die noch offenen; übernommene und
 * verworfene bleiben (und werden nicht noch einmal vorgeschlagen). Läuft für diese Einheit schon eine Anfrage,
 * wird auf sie gewartet.
 */
export function erstelleAnpassungen(unitId: number, teacherId: number | null, now = new Date()): Promise<AnpassenErgebnis> {
  const running = laufend.get(unitId);
  if (running) return running;
  const job = (async (): Promise<AnpassenErgebnis> => {
    const unit = getUnit(unitId);
    if (!unit || unit.status !== "gestartet") return { ok: false, error: "Diese Einheit läuft nicht mehr." };
    const d = anpassenDaten(unitId, now);
    if (!d) return { ok: false, error: "Für „Anpassen“ braucht die Einheit ein Lernpaket mit Schritten." };
    const geht = anpassenStatus(unit.student_id);
    if (!geht.moeglich) return { ok: false, error: geht.grund! };
    const paketId = cockpit(unitId).paket?.id ?? null;
    const out = await kiAnpassen(d, namenFuer(d), { teacherId, unitId, studentId: unit.student_id, trigger: "anpassen" });
    if (!out.ok) return { ok: false, error: out.error };
    const conn = db();
    const neu = conn.prepare(
      "INSERT INTO einheit_anpassungen (unit_id, paket_id, schritt_id, art, titel, text, antwort, bezug, status, call_id, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'vorschlag', ?, ?)",
    );
    conn.transaction(() => {
      conn.prepare("DELETE FROM einheit_anpassungen WHERE unit_id = ? AND status = 'vorschlag'").run(unitId);
      for (const v of out.vorschlaege) neu.run(unitId, paketId, v.schritt_id, v.art, v.titel, v.text, v.antwort, JSON.stringify(v.bezug), out.callId, teacherId);
    })();
    return { ok: true, anzahl: out.vorschlaege.length, verworfen: out.verworfen };
  })().finally(() => laufend.delete(unitId));
  laufend.set(unitId, job);
  return job;
}

/** Übernehmen oder verwerfen; ein übernommener Vorschlag lässt sich wieder entfernen (verworfen). Nur in dieser Einheit. */
export function entscheide(unitId: number, id: number, status: "uebernommen" | "verworfen"): boolean {
  const r = db()
    .prepare(`UPDATE einheit_anpassungen SET status = ?, decided_at = datetime('now') WHERE id = ? AND unit_id = ? AND status IN (${status === "uebernommen" ? "'vorschlag'" : "'vorschlag', 'uebernommen'"})`)
    .run(status, id, unitId);
  return r.changes > 0;
}
