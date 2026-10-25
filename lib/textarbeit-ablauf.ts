/**
 * **Textarbeit im geführten Unterricht** (niko, 25.10.2026: „PR 4: Textarbeiten vollständig in die Bewertung“): Eine
 * Schreibaufgabe ist ein normaler Schritt der Einheit, und ihr Ergebnis geht wie bei anderen Übungen in Bewertung und
 * Dokumentation, ohne Mehrarbeit für die Lehrkraft.
 *
 * - **Schreibauftrag starten** (`schreibStart`): Ist die Fähigkeit des Schritts eine Textsorte, ist das der Hauptknopf des
 *   Schritts. Textsorte, Aufgabenstellung und Wortzahl kommen aus dem, was die App schon weiß: der passende Punkt der
 *   Vorgabe für heute, sonst der des Prüfungsstoffs, sonst die Fähigkeit selbst. Nichts wird erfunden; die Lehrkraft kann
 *   alles ändern, bevor der Text startet. Oberstufe (Textsorten der SRDP, auch die Textinterpretation an der HTL) geht über
 *   den Schreibauftrag mit Textbeilage, die Bildgeschichte der Volksschule über ihre Bilder.
 * - **Eine Zeile je Textarbeit** (`textZeile`): schreibt, abgegeben, wird korrigiert, Bewertung offen, bewertet mit Note,
 *   und genau ein nächster Schritt. Eine Note steht dort nur, wenn die Lehrkraft sie übernommen hat; ein Vorschlag der KI
 *   heißt nur „Bewertung offen“.
 *
 * Keine KI, keine Kosten: es wird nur gelesen, was gespeichert ist.
 */
import { parseBewertung, type Stufe } from "./bewertung-kriterien";
import { db } from "./db";
import { daysUntil } from "./exams";
import { stoffDerPruefung } from "./pruefungsstoff";
import * as repo from "./repo";
import { sorteOfSkill, SORTEN, type SorteKey } from "./schreibauftrag";
import { PRUEFUNG_TAGE } from "./vorbereitung-auto";
import { vorgabeDerEinheit } from "./vorgabe";
import { wienerDatum } from "./planung/zeit";
import { PICTURE_STORY_KIND } from "./picture-story";

// ---------- welche Fähigkeit ist eine Schreibaufgabe ----------

/**
 * Fähigkeit → Textsorte einer normalen Textarbeit. Die Textsorte führt über lib/text-note.ts (`skillFuerText`) wieder zu
 * genau dieser Fähigkeit, damit die übernommene Note dort zählt (ein Test prüft das). Fähigkeiten, die nur Teile eines
 * Texts üben (Groß- und Kleinschreibung, Linking Words), sind keine Schreibaufgabe.
 */
export const SCHREIB_TEXTSORTE: Record<string, string> = {
  "deutsch.vs.schreiben.brief": "Brief",
  "deutsch.schreiben.erzaehlung": "Erlebniserzählung",
  "deutsch.schreiben.nacherzaehlung": "Nacherzählung",
  "deutsch.schreiben.inhaltsangabe": "Inhaltsangabe",
  "deutsch.schreiben.brief": "Brief",
  "deutsch.schreiben.lebenslauf": "Lebenslauf",
  "deutsch.schreiben.bewerbung": "Bewerbungsschreiben",
  "deutsch.os.bewerbung.schreiben": "Bewerbungsschreiben",
  "deutsch.os.bewerbung.lebenslauf": "Lebenslauf",
  "deutsch.beschreiben.bericht": "Bericht",
  "deutsch.beschreiben.person": "Personenbeschreibung",
  "deutsch.beschreiben.gegenstand": "Gegenstandsbeschreibung",
  "deutsch.beschreiben.weg": "Wegbeschreibung",
  "deutsch.beschreiben.vorgang": "Vorgangsbeschreibung",
  "deutsch.argumentieren.stellungnahme": "Stellungnahme",
  "englisch.writing.email": "E-Mail",
  "englisch.writing.story": "Story",
  "englisch.writing.opinion": "Opinion",
  "englisch.writing.blog": "Blog",
  "englisch.writing.article": "Article",
};
const BILDGESCHICHTE_SKILL = "deutsch.vs.schreiben.bildgeschichte";

export type SchreibArt = { art: "schreibauftrag"; sorte: SorteKey; textsorte: string } | { art: "bildgeschichte"; textsorte: string } | { art: "text"; textsorte: string };

/** Ist die Fähigkeit (oder eine ihrer Teilfähigkeiten) eine Schreibaufgabe, und auf welchem Weg startet sie? null: nein. */
export function schreibArt(skillId: string | null | undefined): SchreibArt | null {
  if (!skillId) return null;
  const sorte = sorteOfSkill(skillId);
  if (sorte) return { art: "schreibauftrag", sorte, textsorte: SORTEN[sorte].name };
  const ist = (id: string) => skillId === id || skillId.startsWith(`${id}.`);
  if (ist(BILDGESCHICHTE_SKILL)) return { art: "bildgeschichte", textsorte: PICTURE_STORY_KIND };
  const id = Object.keys(SCHREIB_TEXTSORTE).find(ist);
  return id ? { art: "text", textsorte: SCHREIB_TEXTSORTE[id] } : null;
}

// ---------- „Schreibauftrag starten“, vorgefüllt ----------

/** Ein Punkt „Schreiben“ aus der Vorgabe für heute oder dem Prüfungsstoff (oder eine Fähigkeit der Prüfung ohne Stoffzettel). */
export type SchreibPunkt = { quelle: "vorgabe" | "pruefung"; original: string; inhalt: string; skillId: string | null; testId: number | null };

export type SchreibStart = {
  /** wohin „Schreibauftrag starten“ führt */
  href: string;
  /** woher die Angaben kommen: „Vorgefüllt aus …“ */
  quelle: string;
  textsorte: string;
} & (
  | { art: "schreibauftrag"; sorte: SorteKey; testId: number | null }
  | { art: "bildgeschichte" }
  | { art: "text"; titel: string; fach: string; aufgabe: string; woerter: number | null }
);

const WOERTER = /(\d{2,4})\s*(?:words?|wörter|wörtern|w\.)(?![\p{L}])/iu;
const woerterAus = (s: string) => {
  const m = WOERTER.exec(s);
  const n = m ? Number(m[1]) : NaN;
  return n >= 20 && n <= 2000 ? n : null;
};
const ohneEnde = (s: string) => s.replace(/\s+/g, " ").trim().replace(/[.!:;,]+$/, "");

/**
 * Die Angaben für „Schreibauftrag starten“ im Schritt mit der Fähigkeit `skill`; null, wenn sie keine Schreibaufgabe ist.
 * Der passende Punkt (gleiche Fähigkeit) aus der Vorgabe für heute zählt vor dem aus dem Prüfungsstoff. Die Wortzahl steht
 * in diesem Punkt oder in einem anderen Punkt „Schreiben“ derselben Quelle ohne eigene Fähigkeit („Writing task (120
 * words)“). Ohne Punkt sind Titel und Aufgabenstellung der Name der Fähigkeit.
 */
export function schreibStart(o: { unitId: number; skill: { id: string; name: string; subject: string }; punkte: SchreibPunkt[] }): SchreibStart | null {
  const a = schreibArt(o.skill.id);
  if (!a) return null;
  const passend = [...o.punkte.filter((p) => p.quelle === "vorgabe" && p.skillId === o.skill.id), ...o.punkte.filter((p) => p.quelle === "pruefung" && p.skillId === o.skill.id)];
  const p = passend.find((x) => x.original.trim() || x.inhalt.trim()) ?? passend[0] ?? null;
  const quelle = p ? (p.quelle === "vorgabe" ? "deiner Vorgabe für heute" : "dem Prüfungsstoff") : "dem Schritt";
  const testId = passend.find((x) => x.testId)?.testId ?? null;
  const basis = `/einheiten/${o.unitId}`;
  if (a.art === "schreibauftrag") return { art: "schreibauftrag", sorte: a.sorte, testId, textsorte: a.textsorte, quelle, href: `${basis}/schreibauftrag?sorte=${a.sorte}${testId ? `&pruefung=${testId}` : ""}` };
  if (a.art === "bildgeschichte") return { art: "bildgeschichte", textsorte: a.textsorte, quelle, href: `${basis}/bildgeschichte` };
  const andere = p ? o.punkte.filter((x) => x.quelle === p.quelle && !x.skillId) : o.punkte.filter((x) => !x.skillId);
  const woerter = [p, ...andere].reduce<number | null>((n, x) => n ?? (x ? (woerterAus(x.original) ?? woerterAus(x.inhalt)) : null), null);
  const wortlaut = ohneEnde(p?.original || p?.inhalt || o.skill.name);
  const englisch = /englisch/i.test(o.skill.subject);
  const umfang = woerter && !woerterAus(wortlaut) ? (englisch ? ` (about ${woerter} words)` : ` (etwa ${woerter} Wörter)`) : "";
  return {
    art: "text",
    textsorte: a.textsorte,
    // the word count belongs to the task, not to the title
    titel: ohneEnde((p?.inhalt || p?.original || o.skill.name).replace(/\s*\(\s*(?:ca\.|etwa|about)?\s*\d{2,4}\s*(?:words?|wörter|wörtern|w\.)\s*\)/giu, "")).slice(0, 140),
    fach: o.skill.subject,
    aufgabe: `${wortlaut}${umfang}.`,
    woerter,
    quelle,
    href: `${basis}/text?schreiben=${encodeURIComponent(o.skill.id)}`,
  };
}

/**
 * Die Punkte „Schreiben“ für eine laufende Einheit: aus der Vorgabe für heute und aus dem Stoff der Prüfungen der nächsten
 * 30 Tage im Fach der Einheit (ohne Ausgeschlossenes), auch ein Punkt einer anderen Gruppe, dessen Fähigkeit eine
 * Schreibaufgabe ist (die Vorgabe ohne KI kennt keine Gruppen). Eine Prüfung ohne Stoffzettel gibt ihre Fähigkeiten als Punkte ohne
 * Wortlaut weiter, damit der Schreibauftrag die Prüfung kennt.
 */
export function schreibPunkte(unit: { id: number; student_id: number; subject: string; started_at: string }): SchreibPunkt[] {
  const out: SchreibPunkt[] = [];
  // „Schreiben“ is the group, or the skill is a writing task (the app's own reading without KI has no groups)
  const schreiben = (p: { gruppe: string; skill_id: string | null }) => p.gruppe === "writing" || Boolean(schreibArt(p.skill_id));
  for (const p of vorgabeDerEinheit(unit.id)?.punkte ?? []) {
    if (schreiben(p) && p.status !== "ausgeschlossen") out.push({ quelle: "vorgabe", original: p.original, inhalt: p.inhalt, skillId: p.skill_id, testId: null });
  }
  const datum = wienerDatum(new Date(unit.started_at));
  for (const t of repo.upcomingTests(datum, unit.student_id)) {
    if (daysUntil(t.date, datum) > PRUEFUNG_TAGE || (unit.subject && t.subject && t.subject !== unit.subject)) continue;
    for (const z of stoffDerPruefung(t.id)) {
      if (schreiben(z) && z.status === "pruefung") out.push({ quelle: "pruefung", original: z.original, inhalt: z.inhalt, skillId: z.skill_id, testId: t.id });
    }
    for (const id of t.skill_ids) out.push({ quelle: "pruefung", original: "", inhalt: "", skillId: id, testId: t.id });
  }
  return out;
}

/** „Schreibauftrag starten“ für die Fähigkeit eines Schritts in dieser Einheit; null, wenn sie keine Schreibaufgabe ist. */
export function schreibStartFuer(unit: { id: number; student_id: number; subject: string; started_at: string }, skillId: string | null | undefined): SchreibStart | null {
  if (!schreibArt(skillId)) return null;
  const skill = repo.getSkill(skillId!);
  return skill ? schreibStart({ unitId: unit.id, skill, punkte: schreibPunkte(unit) }) : null;
}

/** Der erste Punkt „Schreiben“ des Prüfungsstoffs mit einer Fähigkeit, die eine Schreibaufgabe ist (nächste Prüfung zuerst). */
export const ersterSchreibPunkt = (punkte: SchreibPunkt[]): SchreibPunkt | null =>
  punkte.find((p) => p.quelle === "pruefung" && (p.original.trim() || p.inhalt.trim()) && schreibArt(p.skillId)) ?? null;

/**
 * Im Schritt „Schularbeit vorbereiten“ (lib/briefing.ts), dessen Fähigkeit keine Schreibaufgabe ist: die erste
 * Schreibaufgabe des Prüfungsstoffs, als zweiter Knopf neben „Übung senden“. null: der Stoff hat keine.
 */
export function schreibStartZurPruefung(unit: { id: number; student_id: number; subject: string; started_at: string }): SchreibStart | null {
  const p = ersterSchreibPunkt(schreibPunkte(unit));
  return p ? schreibStartFuer(unit, p.skillId) : null;
}

// ---------- die Textarbeiten der laufenden Einheit, je eine Zeile ----------

export type TextLauf = {
  id: number;
  titel: string;
  textsorte: string;
  status: "offen" | "fertig";
  woerter: number;
  /** von der Lehrkraft übernommen */
  bestaetigt: boolean;
  /** die übernommene Gesamtnote; nie die eines Vorschlags */
  note: Stufe | null;
  /** ein Vorschlag der KI wartet auf „Bewertung übernehmen“ */
  vorschlag: boolean;
  pruefung: "keine" | "laeuft" | "fertig" | "fehler";
};

export type TextStand = "schreibt" | "abgegeben" | "wird_korrigiert" | "bewertung_offen" | "bewertet";
export type TextZeile = { stand: TextStand; text: string; aktion: { label: string; href: string; haupt: boolean } };

const woerterLabel = (n: number) => `${n.toLocaleString("de-AT")} ${n === 1 ? "Wort" : "Wörter"}`;

/** Der Stand einer Textarbeit in einer Zeile und der eine nächste Schritt. `amGeraet`: der Text ist am Schülergerät offen. */
export function textZeile(t: TextLauf, o: { amGeraet: boolean }): TextZeile {
  const korrektur = `/texte/${t.id}/korrektur`;
  if (t.bestaetigt) return { stand: "bewertet", text: t.note ? `bewertet · Note ${t.note}` : "bewertet", aktion: { label: "Ansehen", href: `${korrektur}?teil=aufgabe`, haupt: false } };
  if (t.vorschlag) return { stand: "bewertung_offen", text: "Bewertung offen", aktion: { label: "Bewertung übernehmen", href: `${korrektur}?teil=aufgabe`, haupt: true } };
  if (t.status === "fertig" && t.pruefung === "laeuft") return { stand: "wird_korrigiert", text: "wird korrigiert …", aktion: { label: "Ansehen", href: korrektur, haupt: false } };
  if (t.status === "fertig") return { stand: "abgegeben", text: `abgegeben · ${woerterLabel(t.woerter)}`, aktion: { label: "Korrigieren", href: korrektur, haupt: true } };
  return { stand: "schreibt", text: `schreibt · ${woerterLabel(t.woerter)}`, aktion: { label: o.amGeraet ? "Mitlesen" : "Öffnen", href: `/texte/${t.id}`, haupt: false } };
}

/** Die Textarbeiten, an denen in dieser Einheit geschrieben wurde (ohne archivierte), mit dem Stand ihrer Bewertung. */
export function textLaeufe(unitId: number): TextLauf[] {
  const rows = db()
    .prepare(
      `SELECT x.id, x.title, x.topic, x.status, x.words, b.kriterien, b.bestaetigt_at, b.vorschlag, b.pruefung_status
       FROM text_units tu JOIN texts x ON x.id = tu.text_id LEFT JOIN text_bewertungen b ON b.text_id = x.id
       WHERE tu.unit_id = ? AND x.archived_at IS NULL ORDER BY tu.first_at, x.id`,
    )
    .all(unitId) as { id: number; title: string; topic: string; status: string; words: number; kriterien: string | null; bestaetigt_at: string | null; vorschlag: string | null; pruefung_status: string | null }[];
  return rows.map((r) => {
    const b = r.bestaetigt_at ? parseBewertung(r.kriterien) : null;
    const p = r.pruefung_status;
    return {
      id: r.id,
      titel: r.title,
      textsorte: r.topic,
      status: r.status === "fertig" ? "fertig" : "offen",
      woerter: r.words,
      bestaetigt: Boolean(b),
      note: b?.note ?? null,
      vorschlag: !b && Boolean(r.vorschlag),
      pruefung: p === "laeuft" || p === "fertig" || p === "fehler" ? p : "keine",
    };
  });
}

/** Die Textarbeit dieser Einheit, die zum Schritt gehört (gleiche Textsorte); null: noch keine gestartet. */
export function textZumSchritt(laeufe: TextLauf[], s: Pick<SchreibStart, "textsorte">): TextLauf | null {
  const sorte = s.textsorte.trim().toLowerCase();
  return laeufe.find((t) => t.textsorte.trim().toLowerCase() === sorte) ?? null;
}
