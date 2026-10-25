/**
 * Die bestätigte Note einer Textarbeit außerhalb der Korrekturseite (2026-10-23, niko: „dann jenachdem wie es lief soll
 * es am Ende der Einheit auch in der Dokumentation stehen … wie bei anderen Übungen“, und „Auch Lernstand“):
 *
 * - **Dokumentation**: welche Einheit die Note zeigt (bewertungFuerBericht). Nur die letzte Einheit, in der am Text
 *   geschrieben wurde; dort „Bewertung offen“, solange eine abgegebene Textarbeit mit Aufgabenstellung keine bestätigte
 *   Note hat. Ein Vorschlag der KI steht nie als Zahl in der Dokumentation.
 * - **Lernstand**: welche Fähigkeit die Note zählt (skillFuerText) und die Noten je Schüler (textNotenFuerLernstand) für
 *   lib/analysis.ts. Je Text höchstens eine Note (eine Zeile in text_bewertungen): neu bestätigen ersetzt sie, zurücknehmen
 *   nimmt sie heraus. Gespeichert wird hier nichts, die Werte kommen beim Lesen aus text_bewertungen.
 *
 * Ohne KI und ohne schwere Abhängigkeiten, damit lib/service.ts und lib/learning.ts es lesen können.
 */
import { arbeitsauftraege, KRITERIUM_KEYS, lernstandNote, parseBewertung, type KriteriumKey, type Stufe } from "./bewertung-kriterien";
import { db } from "./db";

// ---------- welche Fähigkeit ----------

/**
 * Textsorte → Fähigkeiten aus dem Lehrplan, in dieser Reihenfolge. Es zählt die erste, die es gibt und deren
 * Schulstufen zur Schulstufe des Schülers passen; sonst keine (die Seite sagt das). Bewusst eine kurze, feste Liste:
 * lieber keine Fähigkeit als eine falsche.
 */
const TEXTSORTE_SKILLS: { fach: "Deutsch" | "Englisch"; muster: RegExp; skills: string[] }[] = [
  { fach: "Deutsch", muster: /bewerbung/i, skills: ["deutsch.schreiben.bewerbung", "deutsch.os.bewerbung.schreiben"] },
  { fach: "Deutsch", muster: /lebenslauf/i, skills: ["deutsch.schreiben.lebenslauf", "deutsch.os.bewerbung.lebenslauf"] },
  { fach: "Deutsch", muster: /bildgeschichte/i, skills: ["deutsch.vs.schreiben.bildgeschichte", "deutsch.schreiben.erzaehlung"] },
  { fach: "Deutsch", muster: /nacherz/i, skills: ["deutsch.schreiben.nacherzaehlung"] },
  { fach: "Deutsch", muster: /erlebnis|fantasie|erzählung|geschichte/i, skills: ["deutsch.schreiben.erzaehlung"] },
  { fach: "Deutsch", muster: /inhaltsangabe/i, skills: ["deutsch.schreiben.inhaltsangabe"] },
  { fach: "Deutsch", muster: /zusammenfassung/i, skills: ["deutsch.os.matura.zusammenfassung", "deutsch.schreiben.inhaltsangabe"] },
  { fach: "Deutsch", muster: /bericht/i, skills: ["deutsch.beschreiben.bericht"] },
  { fach: "Deutsch", muster: /personenbeschreibung/i, skills: ["deutsch.beschreiben.person"] },
  { fach: "Deutsch", muster: /gegenstandsbeschreibung/i, skills: ["deutsch.beschreiben.gegenstand"] },
  { fach: "Deutsch", muster: /wegbeschreibung/i, skills: ["deutsch.beschreiben.weg"] },
  { fach: "Deutsch", muster: /vorgangsbeschreibung|anleitung|rezept/i, skills: ["deutsch.beschreiben.vorgang"] },
  { fach: "Deutsch", muster: /leserbrief/i, skills: ["deutsch.os.matura.leserbrief"] },
  { fach: "Deutsch", muster: /offener brief/i, skills: ["deutsch.os.matura.offenerbrief"] },
  { fach: "Deutsch", muster: /brief|e-?mail/i, skills: ["deutsch.vs.schreiben.brief", "deutsch.schreiben.brief"] },
  { fach: "Deutsch", muster: /stellungnahme/i, skills: ["deutsch.argumentieren.stellungnahme"] },
  { fach: "Deutsch", muster: /erörterung/i, skills: ["deutsch.os.matura.eroerterung"] },
  { fach: "Deutsch", muster: /kommentar/i, skills: ["deutsch.os.matura.kommentar"] },
  { fach: "Deutsch", muster: /interpretation/i, skills: ["deutsch.os.matura.textinterpretation"] },
  { fach: "Englisch", muster: /letter|e-?mail/i, skills: ["englisch.writing.email"] },
  { fach: "Englisch", muster: /story/i, skills: ["englisch.writing.story"] },
  { fach: "Englisch", muster: /essay|opinion/i, skills: ["englisch.writing.opinion"] },
  { fach: "Englisch", muster: /blog|posting/i, skills: ["englisch.writing.blog"] },
  { fach: "Englisch", muster: /article/i, skills: ["englisch.writing.article"] },
];

export type SkillInfo = { id: string; name: string; grade_min: number; grade_max: number };

/**
 * Die Fähigkeit, für die eine bestätigte Note zählt. `sorteSkill`: beim Schreibauftrag die Fähigkeit seiner Textsorte (die
 * Verknüpfung des Texts); sonst die Textsorte (texts.topic) bei der Schulstufe des Schülers. null: keine passende.
 */
export function skillFuerText(o: { fach: string; textsorte: string; schulstufe: number; sorteSkill?: string | null; bildgeschichte?: boolean }, skills: SkillInfo[]): SkillInfo | null {
  const passt = (id: string) => skills.find((s) => s.id === id && s.grade_min <= o.schulstufe && o.schulstufe <= s.grade_max) ?? null;
  if (o.sorteSkill) return skills.find((s) => s.id === o.sorteSkill) ?? null;
  const fach = /englisch/i.test(o.fach) ? "Englisch" : !o.fach.trim() || /deutsch/i.test(o.fach) ? "Deutsch" : null;
  if (!fach) return null;
  const sorte = o.bildgeschichte && !o.textsorte.trim() ? "Bildgeschichte" : o.textsorte;
  for (const e of TEXTSORTE_SKILLS) {
    if (e.fach !== fach || !e.muster.test(sorte)) continue;
    for (const id of e.skills) {
      const s = passt(id);
      if (s) return s;
    }
  }
  return null;
}

// ---------- Lernstand ----------

/** Eine bestätigte Note, wie lib/analysis.ts sie zählt: die Note (1 bis 5, auch ein Schnitt wie 2,5) zum Zeitpunkt der Abgabe. */
export type TextNote = { textId: number; skillId: string; note: number; at: string };

/** Die bestätigten Noten eines Schülers mit Fähigkeit, je Text eine. Vorschläge der KI zählen nie. */
export function textNotenFuerLernstand(studentId: number): TextNote[] {
  const rows = db()
    .prepare(
      `SELECT b.text_id, b.kriterien, b.lernstand_skill, b.bestaetigt_at, x.completed_at FROM text_bewertungen b JOIN texts x ON x.id = b.text_id
       WHERE x.student_id = ? AND b.bestaetigt_at IS NOT NULL AND b.kriterien <> '' AND b.lernstand_skill <> ''`,
    )
    .all(studentId) as { text_id: number; kriterien: string; lernstand_skill: string; bestaetigt_at: string; completed_at: string | null }[];
  return rows.flatMap((r): TextNote[] => {
    const b = parseBewertung(r.kriterien);
    const note = b ? lernstandNote(b) : null;
    return note === null ? [] : [{ textId: r.text_id, skillId: r.lernstand_skill, note, at: r.completed_at ?? r.bestaetigt_at }];
  });
}

/** Ab dieser Stufe (Genügend, Nicht genügend) ist ein Kriterium schwach: im Abschluss unter „Noch schwierig“ und für die nächste Vorbereitung. */
export const SCHWACHE_STUFE = 4;

/** Eine bestätigte Bewertung mit Fähigkeit, für die nächste Vorbereitung (lib/vorbereitung-auto.ts `textSignale`). */
export type TextErgebnis = { textId: number; titel: string; textsorte: string; skillId: string; skillName: string; fach: string; note: Stufe | null; stufen: Record<KriteriumKey, Stufe>; at: string };

/**
 * Die bestätigten Bewertungen eines Schülers mit der Fähigkeit, für die sie zählen; neueste zuerst. Nur was die Lehrkraft
 * übernommen hat: ein Vorschlag der KI kommt hier nie vor.
 */
export function bestaetigteTextErgebnisse(studentId: number): TextErgebnis[] {
  const rows = db()
    .prepare(
      `SELECT b.text_id, b.kriterien, b.lernstand_skill, b.bestaetigt_at, x.completed_at, x.title, x.topic, s.name AS skill_name, s.subject
       FROM text_bewertungen b JOIN texts x ON x.id = b.text_id JOIN skills s ON s.id = b.lernstand_skill
       WHERE x.student_id = ? AND x.archived_at IS NULL AND b.bestaetigt_at IS NOT NULL AND b.kriterien <> ''`,
    )
    .all(studentId) as { text_id: number; kriterien: string; lernstand_skill: string; bestaetigt_at: string; completed_at: string | null; title: string; topic: string; skill_name: string; subject: string }[];
  return rows
    .flatMap((r): TextErgebnis[] => {
      const b = parseBewertung(r.kriterien);
      if (!b) return [];
      const stufen = Object.fromEntries(b.kriterien.map((k) => [k.key, k.stufe])) as Record<KriteriumKey, Stufe>;
      return [{ textId: r.text_id, titel: r.title, textsorte: r.topic, skillId: r.lernstand_skill, skillName: r.skill_name, fach: r.subject, note: b.note, stufen, at: r.completed_at ?? r.bestaetigt_at }];
    })
    .sort((a, b) => b.at.localeCompare(a.at) || b.textId - a.textId);
}

/** Die bestätigten Bewertungen der Texte eines Schülers (für den Lernverlauf): Text → Note und Stufen. */
export function bestaetigteBewertungen(studentId: number): Map<number, { note: Stufe | null; stufen: Record<KriteriumKey, Stufe> }> {
  const rows = db()
    .prepare("SELECT b.text_id, b.kriterien FROM text_bewertungen b JOIN texts x ON x.id = b.text_id WHERE x.student_id = ? AND b.bestaetigt_at IS NOT NULL")
    .all(studentId) as { text_id: number; kriterien: string }[];
  const out = new Map<number, { note: Stufe | null; stufen: Record<KriteriumKey, Stufe> }>();
  for (const r of rows) {
    const b = parseBewertung(r.kriterien);
    if (b) out.set(r.text_id, { note: b.note, stufen: Object.fromEntries(b.kriterien.map((k) => [k.key, k.stufe])) as Record<KriteriumKey, Stufe> });
  }
  return out;
}

// ---------- Dokumentation ----------

/** Was die Dokumentation einer Einheit über die Note eines Texts sagt; fehlt, wenn sie nichts sagt. */
export type BerichtBewertung =
  | { stand: "offen" }
  | { stand: "bestaetigt"; note: Stufe | null; stufen: Record<KriteriumKey, Stufe>; erfuellt: number | null; von: number | null };

/** Die letzte Einheit, in der am Text geschrieben wurde; null: keine. */
export function letzteEinheitDesTexts(textId: number): number | null {
  return (db().prepare("SELECT unit_id FROM text_units WHERE text_id = ? ORDER BY last_at DESC, unit_id DESC LIMIT 1").get(textId) as { unit_id: number } | undefined)?.unit_id ?? null;
}

/**
 * Die Note eines Texts in der Dokumentation der Einheit `unitId`: nur in der letzten Einheit des Texts. Bestätigt: die
 * Zahlen der Lehrkraft. Sonst „offen“, wenn der Text abgegeben ist und eine Aufgabenstellung hat; sonst nichts.
 */
export function bewertungFuerBericht(textId: number, unitId: number): BerichtBewertung | undefined {
  if (letzteEinheitDesTexts(textId) !== unitId) return undefined;
  const r = db()
    .prepare("SELECT x.status, x.prompt, b.kriterien, b.bestaetigt_at FROM texts x LEFT JOIN text_bewertungen b ON b.text_id = x.id WHERE x.id = ?")
    .get(textId) as { status: string; prompt: string; kriterien: string | null; bestaetigt_at: string | null } | undefined;
  if (!r) return undefined;
  const b = r.bestaetigt_at ? parseBewertung(r.kriterien) : null;
  if (b) {
    const stufen = Object.fromEntries(KRITERIUM_KEYS.map((k) => [k, b.kriterien.find((x) => x.key === k)!.stufe])) as Record<KriteriumKey, Stufe>;
    const a = b.auftraege ?? [];
    return { stand: "bestaetigt", note: b.note, stufen, erfuellt: a.length ? a.filter((x) => x.status === "erfuellt").length : null, von: a.length ? a.length : null };
  }
  return r.status === "fertig" && arbeitsauftraege(r.prompt).punkte.length ? { stand: "offen" } : undefined;
}
