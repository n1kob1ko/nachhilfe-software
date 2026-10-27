/**
 * Der **Abschluss** einer beendeten Einheit (niko, 25.10.2026): vier Felder, alle aus echten Ergebnissen, und ein
 * Knopf „Dokumentation bestätigen“. Die Felder kommen aus `unitBrief` (lib/summary.ts: Aufgaben, Fehlerarten,
 * Empfehlung, Hausübung und Termine) und aus dem, was der Lehrer im geführten Unterricht getippt hat
 * (lib/cockpit.ts: erledigt, wiederholt, nicht verstanden, nicht erreicht). Nichts wird erfunden: ohne Beleg bleibt
 * „Gut verstanden“ leer, und die Seite sagt das.
 *
 * Textarbeiten (PR 4, niko 25.10.2026): eine übernommene Note steht unter „Heute gemacht“ (Textsorte und Note), ihre
 * schwachen Kriterien unter „Noch schwierig“. Ohne Übernahme steht dort nur „Bewertung offen“ mit dem einen Link dorthin;
 * ein Vorschlag der KI erscheint nie als Ergebnis.
 *
 * Automatischer Abschluss (PR 5, niko 25.10.2026: „Dokumentation ohne Tippen, nachvollziehbar, nichts erfunden“): mit
 * `belege` (`belegeDerEinheit`) kommen dazu die Antworten am Gerät (erster Versuch, Fehler, „vermutet“, solange die
 * Lehrkraft die Fehlerart nicht bestätigt hat), deine Beobachtungen Richtig/Teilweise/Falsch, die Anpassung im
 * Unterricht, der Minitest, die Vorgabe für heute und die nächste Prüfung. Jede Zeile sagt, woher sie kommt (`QUELLE`).
 * „Gut verstanden“ folgt festen Regeln (`gutVerstanden`). Text der KI steht in keinem der vier Felder.
 * „Dokumentation bestätigen“ schreibt die Felder in die Dokumentation, nur wo die Lehrkraft nichts selbst geschrieben
 * hat (`bestaetigeAbschluss`); „Nächstes Mal“ liest dann die nächste Vorbereitung (lib/vorbereitung-auto.ts).
 */
import { KRITERIUM_KEYS, KRITERIUM_KURZ } from "./bewertung-kriterien";
import { ablaufDerEinheit, antwortenDerEinheit, reaktionenDerEinheit, skillsErledigterSchritte, type AblaufDerEinheit, type Beobachtung } from "./cockpit";
import { db, json } from "./db";
import { autoFelderVon } from "./einschaetzung";
import { errorTypeLabel } from "./error-types";
import { daysUntil } from "./exams";
import { readReport, type TaskLine } from "./learning";
import { tagAddieren, wienerDatum } from "./planung/zeit";
import * as repo from "./repo";
import { schulstufe } from "./school";
import type { Art } from "./steuerung-regeln";
import { shortDate, unitBrief, type BriefLine, type UnitBrief } from "./summary";
import { textLaeufe } from "./textarbeit-ablauf";
import { bewertungFuerBericht, SCHWACHE_STUFE, skillFuerText, type BerichtBewertung } from "./text-note";
import { getUnit } from "./units";
import { vorgabeDerEinheit } from "./vorgabe";

/**
 * Woher eine Zeile kommt; die Karte zeigt es leise hinter der Zeile (`QUELLE`). „daten“: aus der Dokumentation ohne
 * genauere Quelle (Aufrufe ohne `belege`), „eigen“: von der Lehrkraft direkt in der Karte korrigiert.
 */
export type Quelle = "daten" | "lehrer" | "eigen" | "ablauf" | "antworten" | "beobachtung" | "anpassung" | "vorgabe" | "pruefung" | "hausuebung" | "lernstand" | "text";
export const QUELLE: Record<Quelle, string> = {
  daten: "aus den Daten",
  lehrer: "deine Notiz",
  eigen: "von dir",
  ablauf: "Ablauf",
  antworten: "aus Antworten",
  beobachtung: "deine Beobachtung",
  anpassung: "Anpassung",
  vorgabe: "Vorgabe",
  pruefung: "Prüfung",
  hausuebung: "Hausübung",
  lernstand: "Lernstand",
  text: "Text",
};

/**
 * `link`: ein Tippen zum nächsten Schritt (etwa „Bewertung übernehmen“), nur für die Lehrkraft der Einheit. `auch`: eine
 * zweite Quelle („aus Antworten · deine Beobachtung“).
 */
export type KartenZeile = { text: string; von: Quelle; auch?: Quelle; link?: { href: string; label: string } };
export const quelleText = (z: Pick<KartenZeile, "von" | "auch">) => (z.auch ? `${QUELLE[z.von]} · ${QUELLE[z.auch]}` : QUELLE[z.von]);

/**
 * Eine Textarbeit der Einheit, wie der Abschluss sie zeigt: `bewertung` wie in der Dokumentation (lib/text-note.ts
 * `bewertungFuerBericht`, nur in der letzten Einheit des Texts), `vorschlag`: ein Vorschlag der KI wartet auf Übernahme.
 */
export type AbschlussText = { id: number; titel: string; textsorte: string; bewertung?: BerichtBewertung; vorschlag?: boolean };
export type AbschlussKarte = { gemacht: KartenZeile[]; gut: KartenZeile[]; schwierig: KartenZeile[]; naechstes: KartenZeile[] };
export type AbschlussFeld = keyof AbschlussKarte;

export const ABSCHLUSS_FELDER: [AbschlussFeld, string][] = [
  ["gemacht", "Heute gemacht"],
  ["gut", "Gut verstanden"],
  ["schwierig", "Noch schwierig"],
  ["naechstes", "Nächstes Mal"],
];
export const isAbschlussFeld = (x: unknown): x is AbschlussFeld => ABSCHLUSS_FELDER.some(([f]) => f === x);

/** Das Feld der Dokumentation (lessons, wie im Formular „Ändern“), in das ein Feld des Abschlusses geschrieben wird. */
export const DOKU_FELD = { gemacht: "activities", gut: "positives", schwierig: "difficulties", naechstes: "next_steps" } as const satisfies Record<AbschlussFeld, keyof repo.Lesson>;

/** Eine Aufgabe am Gerät in dieser Einheit, wie der Bericht sie festhält (lib/learning.ts TaskLine). */
export type AufgabeBeleg = Pick<TaskLine, "assignmentId" | "skillId" | "skill" | "correct" | "finished" | "firstTry" | "tries" | "help">;

/**
 * Was der Abschluss außer der Dokumentation liest, alles gespeichert und nachprüfbar (`belegeDerEinheit`):
 * - `aufgaben`: die Aufgaben am Gerät; `fehler`: die Fehler der falschen Antworten, „(2×, vermutet)“, solange die
 *   Fehlerart nur ein Vorschlag ist
 * - `beobachtungen`: Richtig / Teilweise / Falsch der Lehrkraft bei Fragen und Kontrollen, mit den Fähigkeiten des Schritts
 * - `reaktionen`: Aufgaben, die die Anpassung im Unterricht geschickt hat (leichter, Voraussetzung, zum Fehler, schwerer)
 * - `minitest`: der Minitest am Anfang, wenn einer lief
 * - `vorgabe`: die bestätigten Fähigkeiten der Vorgabe für heute; `geuebt`: was heute nachweislich dran war (Antworten,
 *   erledigte Schritte, deine Beobachtungen, Textarbeit)
 * - `pruefung`: die nächste eingetragene Prüfung (bis 30 Tage) und ihr Stoff ohne Antwort in den 30 Tagen davor
 * - `eigene`: Felder, die die Lehrkraft direkt in der Karte korrigiert hat, mit ihrem Text
 */
export type AbschlussBelege = {
  aufgaben: AufgabeBeleg[];
  fehler: string[];
  beobachtungen: { titel: string; art: string; antwort: Beobachtung; skillIds: string[] }[];
  reaktionen: { art: Art; skillId: string | null; skill: string; assignmentId: number | null }[];
  minitest: { von: number; erledigt: number; richtig: number; falsch: string[] } | null;
  vorgabe: { id: string; name: string }[];
  geuebt: string[];
  pruefung: { art: string; fach: string; datum: string; offen: string[] } | null;
  eigene: Partial<Record<AbschlussFeld, string>>;
};

/** „Gut verstanden“, Regel 1: so viele Aufgaben einer Fähigkeit im ersten Versuch ohne Hilfe richtig, keine falsche Antwort. */
export const GUT_ERSTER_VERSUCH = 3;
/** Regel 2: so viele richtige Aufgaben einer Fähigkeit ohne falsche Antwort, dazu dein „Richtig“ bei einer Frage dazu. */
export const GUT_MIT_BEOBACHTUNG = 2;
/** Regel 3: eine schwerere Aufgabe der Anpassung mit so vielen erledigten Aufgaben, alle im ersten Versuch richtig. */
export const SCHWERER_AB = 2;
/** Die nächste Prüfung zählt bis so viele Tage voraus; ihr Stoff gilt als geübt, wenn es in so vielen Tagen davor eine Antwort gab. */
export const PRUEFUNG_TAGE = 30;
/** Höchstens so viele Punkte des Prüfungsstoffs unter „Nächstes Mal“. */
export const PRUEFUNG_PUNKTE = 3;
/** Höchstlänge eines Felds, das die Lehrkraft in der Karte korrigiert. */
export const FELD_MAX = 2000;

/** Eine falsche Antwort bei dieser Aufgabe: falsch abgegeben, erst nach einem Fehlversuch richtig oder die Lösung angesehen. */
export const hatFehler = (t: Pick<AufgabeBeleg, "correct" | "tries" | "help">) => t.help === "loesung" || t.tries > 1 || (t.tries > 0 && !t.correct);

const FRAGE = (art: string) => (art === "kontrolle" ? "Kontrolle" : "Frage");
const BEOBACHTET: Record<Beobachtung, string> = { richtig: "richtig beantwortet", teilweise: "teilweise richtig", falsch: "falsch beantwortet" };
const beobachtungsZeile = (b: AbschlussBelege["beobachtungen"][number]): KartenZeile => ({ text: `${FRAGE(b.art)} „${b.titel}“: ${BEOBACHTET[b.antwort]}`, von: "beobachtung" });

/**
 * „Gut verstanden“ nach festen Regeln, nur aus dieser Einheit (niko: „die KI darf keinen Fortschritt erfinden“):
 * 1. mind. `GUT_ERSTER_VERSUCH` Aufgaben einer Fähigkeit im ersten Versuch ohne Hilfe richtig, keine falsche Antwort dazu;
 * 2. mind. `GUT_MIT_BEOBACHTUNG` richtige Aufgaben ohne falsche Antwort und dein „Richtig“ bei einer Frage dieser Fähigkeit;
 * 3. eine schwerere Aufgabe der Anpassung mit mind. `SCHWERER_AB` Aufgaben, alle im ersten Versuch richtig.
 * Dein „Teilweise“ oder „Falsch“ zu einer Fähigkeit schließt sie aus. Ein „Richtig“ allein steht als deine Beobachtung da
 * und ist kein sicheres Ergebnis (`hatSichereErgebnisse`).
 */
export function gutVerstanden(b: Pick<AbschlussBelege, "aufgaben" | "beobachtungen" | "reaktionen">): KartenZeile[] {
  const zeilen: KartenZeile[] = [];
  const skills = new Set<string>();
  const benutzt = new Set<number>();
  const zweifel = (id: string) => b.beobachtungen.some((o) => o.antwort !== "richtig" && o.skillIds.includes(id));
  const ohneFehler = (ts: AufgabeBeleg[]) => ts.every((t) => !hatFehler(t));

  // 3. a harder task, solved
  for (const r of b.reaktionen) {
    if (r.art !== "schwerer" || r.assignmentId === null || !r.skillId || skills.has(r.skillId) || zweifel(r.skillId)) continue;
    const ts = b.aufgaben.filter((t) => t.assignmentId === r.assignmentId && (t.finished || t.tries > 0));
    if (ts.length < SCHWERER_AB || !ts.every((t) => t.finished && t.firstTry) || !ohneFehler(ts)) continue;
    zeilen.push({ text: `Schwerere Aufgabe geschafft: ${r.skill} (${ts.length} von ${ts.length} richtig)`, von: "anpassung", auch: "antworten" });
    skills.add(r.skillId);
  }

  // 1. and 2. per skill, in the order the skills came up
  const ids = [...new Set(b.aufgaben.map((t) => t.skillId).filter((x): x is string => Boolean(x)))];
  for (const id of ids) {
    if (skills.has(id) || zweifel(id)) continue;
    const ts = b.aufgaben.filter((t) => t.skillId === id);
    if (!ohneFehler(ts)) continue;
    const fertig = ts.filter((t) => t.finished);
    const name = ts[0].skill;
    const erster = fertig.filter((t) => t.firstTry).length;
    const richtig = fertig.filter((t) => t.correct).length;
    const beob = b.beobachtungen.findIndex((o, i) => !benutzt.has(i) && o.antwort === "richtig" && o.skillIds.includes(id));
    if (erster >= GUT_ERSTER_VERSUCH) {
      zeilen.push({ text: `${name}: ${erster} von ${fertig.length} im ersten Versuch richtig`, von: "antworten" });
      skills.add(id);
    } else if (richtig >= GUT_MIT_BEOBACHTUNG && beob >= 0) {
      const o = b.beobachtungen[beob];
      benutzt.add(beob);
      zeilen.push({ text: `${name}: ${richtig} von ${fertig.length} richtig, ${FRAGE(o.art)} „${o.titel}“ richtig beantwortet`, von: "antworten", auch: "beobachtung" });
      skills.add(id);
    }
  }

  // a „Richtig“ of the teacher on its own: shown as her observation, never as a result
  b.beobachtungen.forEach((o, i) => {
    if (o.antwort === "richtig" && !benutzt.has(i)) zeilen.push(beobachtungsZeile(o));
  });
  return zeilen;
}

/** Ob „Gut verstanden“ ein sicheres Ergebnis hat (aus den Daten oder von dir geschrieben); sonst „Keine sicheren Ergebnisse“. */
export const hatSichereErgebnisse = (gut: KartenZeile[]) => gut.some((z) => z.von !== "beobachtung");

/** Die Zeile zur nächsten Prüfung: das eingetragene Datum, der Stoff ohne Antwort (oder heutige Textarbeit) in den letzten 30 Tagen, höchstens drei Punkte. */
export function pruefungsZeile(p: NonNullable<AbschlussBelege["pruefung"]>): string {
  const mehr = p.offen.length - PRUEFUNG_PUNKTE;
  const offen = p.offen.length ? `: zuletzt nicht geübt: ${p.offen.slice(0, PRUEFUNG_PUNKTE).join(", ")}${mehr > 0 ? ` und ${mehr} ${mehr === 1 ? "weiterer Punkt" : "weitere Punkte"}` : ""}` : "";
  return `${p.art}${p.fach ? ` ${p.fach}` : ""} am ${p.datum}${offen}`;
}

const namen = (xs: { titel: string }[]) => xs.map((x) => x.titel).join(", ");
const mitMal = (xs: { titel: string; mal: number }[]) => xs.map((x) => (x.mal > 1 ? `${x.titel} (${x.mal}×)` : x.titel)).join(", ");
const zeilenAus = (text: string) =>
  text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((z) => z.trim())
    .filter(Boolean);

const textName = (t: Pick<AbschlussText, "titel" | "textsorte">) => {
  const sorte = t.textsorte.trim();
  if (!sorte || sorte === t.titel) return `Textarbeit „${t.titel}“`;
  // „Textinterpretation zu „Der letzte Bus““ nennt die Textsorte schon: nicht noch einmal davor
  return t.titel.toLowerCase().startsWith(sorte.toLowerCase()) ? t.titel : `${sorte} „${t.titel}“`;
};

/** „Heute gemacht“ für eine Textarbeit mit übernommener oder offener Bewertung. */
function textGemacht(t: AbschlussText & { bewertung: BerichtBewertung }): KartenZeile {
  const b = t.bewertung;
  if (b.stand === "offen")
    return { text: `${textName(t)}: Bewertung offen`, von: "text", link: t.vorschlag ? { href: `/texte/${t.id}/korrektur?teil=aufgabe`, label: "Bewertung übernehmen" } : { href: `/texte/${t.id}/korrektur`, label: "Korrigieren" } };
  const auftraege = b.von ? ` (${b.erfuellt} von ${b.von} ${b.von === 1 ? "Arbeitsauftrag" : "Arbeitsaufträgen"} erfüllt)` : "";
  const stufen = KRITERIUM_KEYS.map((k) => `${KRITERIUM_KURZ[k]} ${b.stufen[k]}`).join(", ");
  return { text: b.note ? `${textName(t)}: Note ${b.note}${auftraege}` : `${textName(t)}: bewertet (${stufen})`, von: "text" };
}

/**
 * Die vier Felder. `brief` null: es gibt keine Dokumentation (dann bleibt nur, was getippt wurde). `texte`: die
 * Textarbeiten der Einheit; mit Bewertung (übernommen oder offen) ersetzt ihre Zeile die der Dokumentation. `belege`
 * (PR 5): alle weiteren Quellen, „Gut verstanden“ nach den Regeln; ohne sie bleibt die Karte, wie sie war.
 */
export function abschlussKarte(brief: Pick<UnitBrief, "done" | "good" | "difficulties" | "errors" | "next" | "dates"> | null, ablauf: AblaufDerEinheit | null, texte: AbschlussText[] = [], belege?: AbschlussBelege): AbschlussKarte {
  // with belege each line of the documentation gets its real source; the teacher's own lines stay „deine Notiz“
  const amGeraet = Boolean(belege?.aufgaben.some((t) => t.finished));
  const zeile = (l: BriefLine, genauer?: Quelle | ((text: string) => Quelle)): KartenZeile => ({
    text: l.text,
    von: l.from === "lehrer" ? "lehrer" : !belege || !genauer ? "daten" : typeof genauer === "function" ? genauer(l.text) : genauer,
  });
  const a = (text: string): KartenZeile => ({ text, von: "ablauf" });
  const e = ablauf?.ergebnis;
  const wo = ablauf ? (ablauf.art === "plan" ? "Plan für heute" : `Lernpaket „${ablauf.titel}“`) : "";
  const gesamt = e ? e.erledigt.length + e.uebersprungen.length + e.nichtErreicht.length : 0;

  // a text with a grade (confirmed or open) gets its own line instead of the documentation's
  const mitBewertung = texte.filter((t): t is AbschlussText & { bewertung: BerichtBewertung } => Boolean(t.bewertung));
  // also the bare topic line („E-Mail“) the documentation writes when the unit had no tasks
  const ersetzt = (l: BriefLine) => l.from === "daten" && mitBewertung.some((t) => l.text.startsWith(`Textarbeit „${t.titel}“`) || (t.textsorte !== "" && l.text === t.textsorte));
  const gemacht = (brief?.done ?? []).filter((l) => !ersetzt(l)).map((l) => zeile(l, (t) => (t.startsWith("Textarbeit „") ? "text" : amGeraet ? "antworten" : "daten")));
  const mt = belege?.minitest;
  if (mt?.erledigt) gemacht.push({ text: `Minitest am Anfang: ${mt.richtig} von ${mt.von} richtig${mt.erledigt < mt.von ? ` (${mt.erledigt} abgegeben)` : ""}`, von: "antworten" });
  gemacht.push(...mitBewertung.map(textGemacht));
  // the plan for the whole unit: the topics worked on today, then the steps
  if (ablauf?.themen?.length) gemacht.push(a(`${ablauf.themen.length === 1 ? "Thema" : "Themen"}: ${ablauf.themen.join(", ")}`));
  if (e?.erledigt.length) gemacht.push(a(`${wo}: ${e.erledigt.length} von ${gesamt} Schritten (${namen(e.erledigt)})`));
  // today's Vorgabe: what was practised, and (under „Nächstes Mal“) what was not
  const vorgabeGeuebt = (belege?.vorgabe ?? []).filter((v) => belege!.geuebt.includes(v.id));
  const vorgabeOffen = (belege?.vorgabe ?? []).filter((v) => !belege!.geuebt.includes(v.id));
  if (vorgabeGeuebt.length) gemacht.push({ text: `Aus deiner Vorgabe geübt: ${vorgabeGeuebt.map((v) => v.name).join(", ")}`, von: "vorgabe" });

  // only what the rules show as secure (`gutVerstanden`), or what the teacher wrote; a step marked „Weiter“ proves nothing
  const regeln = belege ? gutVerstanden(belege) : null;
  const gut = regeln ? [...regeln, ...(brief?.good ?? []).filter((l) => l.from === "lehrer").map((l) => zeile(l))] : (brief?.good ?? []).map((l) => zeile(l));

  // a skill with a secure result is not „noch schwierig“ only because the documentation's score was lower
  const sicherNamen = (regeln ?? []).filter((z) => z.von === "antworten").map((z) => z.text.slice(0, z.text.indexOf(":")));
  const sicher = (l: BriefLine) => l.from === "daten" && sicherNamen.some((n) => l.text.startsWith(`${n}:`));
  const fehler = belege
    ? [...belege.fehler.map((f): KartenZeile => ({ text: `Fehler: ${f}`, von: "antworten" })), ...(brief?.errors ?? []).filter((l) => l.from === "lehrer").map((l) => zeile(l))]
    : (brief?.errors ?? []).map((l) => ({ ...zeile(l), text: l.from === "daten" ? `Fehler: ${l.text}` : l.text }));
  const schwierig = [...(brief?.difficulties ?? []).filter((l) => !sicher(l)).map((l) => zeile(l, "antworten")), ...fehler];
  if (mt?.falsch.length) schwierig.push({ text: `Minitest: Fehler bei ${mt.falsch.join(", ")}`, von: "antworten" });
  for (const o of belege?.beobachtungen ?? []) if (o.antwort !== "richtig") schwierig.push(beobachtungsZeile(o));
  // the Anpassung im Unterricht had to go easier: once per skill, with what came of it
  const leichter = new Map<string, { art: Art; skill: string; ts: AufgabeBeleg[] }>();
  for (const r of belege?.reaktionen ?? []) {
    if (r.art !== "leichter" && r.art !== "voraussetzung" && r.art !== "fehler") continue;
    const key = `${r.art}:${r.skillId ?? r.skill}`;
    const x = leichter.get(key) ?? { art: r.art, skill: r.skill, ts: [] };
    x.ts.push(...belege!.aufgaben.filter((t) => r.assignmentId !== null && t.assignmentId === r.assignmentId && t.finished));
    leichter.set(key, x);
  }
  for (const x of leichter.values()) {
    const kopf = x.art === "voraussetzung" ? `Erst die Grundlage geübt: ${x.skill}` : x.art === "fehler" ? `Aufgabe zum Fehler nötig bei ${x.skill}` : `Leichtere Aufgabe nötig bei ${x.skill}`;
    const danach = x.ts.length ? ` (danach ${x.ts.filter((t) => t.correct).length} von ${x.ts.length} richtig)` : "";
    schwierig.push({ text: `${kopf}${danach}`, von: "anpassung" });
  }
  if (e?.nichtVerstanden.length) schwierig.push(a(`Nicht verstanden: ${mitMal(e.nichtVerstanden)}`));
  // weak criteria of a confirmed grade only; an open grade proves nothing yet
  for (const t of mitBewertung) {
    const b = t.bewertung;
    if (b.stand !== "bestaetigt") continue;
    const schwach = KRITERIUM_KEYS.filter((k) => b.stufen[k] >= SCHWACHE_STUFE);
    if (schwach.length) schwierig.push({ text: `${textName(t)}: ${schwach.map((k) => `${KRITERIUM_KURZ[k]} ${b.stufen[k]}`).join(", ")}`, von: "text" });
  }

  // most urgent first: the next exam with what was not practised lately, then what today's Vorgabe left open
  const p = belege?.pruefung;
  const naechstes: KartenZeile[] = [];
  if (p) naechstes.push({ text: pruefungsZeile(p), von: "pruefung" });
  if (vorgabeOffen.length) naechstes.push({ text: `Aus deiner Vorgabe noch offen: ${vorgabeOffen.map((v) => v.name).join(", ")}`, von: "vorgabe" });
  // a recommendation for exam material the exam line already names is not said twice
  const schonGenannt = (l: BriefLine) => Boolean(p) && l.from === "daten" && p!.offen.some((n) => l.text.startsWith(`${n} (`));
  naechstes.push(...(brief?.next ?? []).filter((l) => !schonGenannt(l)).map((l) => zeile(l, "lernstand")));
  if (e?.nichtErreicht.length && (e.erledigt.length || e.uebersprungen.length || e.wiederholt.length || e.nichtVerstanden.length)) naechstes.push(a(`Weiter mit: ${namen(e.nichtErreicht)}`));
  if (e?.wiederholt.length) naechstes.push(a(`Wiederholen: ${mitMal(e.wiederholt)}`));
  if (e?.uebersprungen.length) naechstes.push(a(`Übersprungen: ${namen(e.uebersprungen)}`));
  // the documentation's line for the same exam goes: the one above says more
  const gleichePruefung = (l: BriefLine) => Boolean(p) && l.from === "daten" && l.text.startsWith(`${p!.art} ${p!.fach}`) && l.text.includes(`(${p!.datum})`);
  naechstes.push(...(brief?.dates ?? []).filter((l) => !gleichePruefung(l)).map((l) => zeile(l, (t) => (t.startsWith("Hausübung") ? "hausuebung" : "pruefung"))));

  const einmal = (xs: KartenZeile[]) => xs.filter((x, i) => x.text.trim() && xs.findIndex((y) => y.text === x.text) === i);
  const karte: AbschlussKarte = { gemacht: einmal(gemacht), gut: einmal(gut), schwierig: einmal(schwierig), naechstes: einmal(naechstes) };
  // a field the teacher corrected in the card: exactly her text
  for (const [feld] of ABSCHLUSS_FELDER) {
    const eigen = belege?.eigene[feld];
    if (eigen?.trim()) karte[feld] = zeilenAus(eigen).map((text) => ({ text, von: "eigen" }));
  }
  return karte;
}

// ---------- the evidence of a unit (database) ----------

/** Alle Belege einer beendeten Einheit (`AbschlussBelege`); liest nur Gespeichertes, keine KI. */
export function belegeDerEinheit(unitId: number, lesson: repo.Lesson): AbschlussBelege {
  const unit = getUnit(unitId);
  const report = readReport(lesson);
  const aufgaben: AufgabeBeleg[] = (report?.tasks ?? []).map((t) => ({ assignmentId: t.assignmentId, skillId: t.skillId, skill: t.skill, correct: t.correct, finished: t.finished, firstTry: t.firstTry, tries: t.tries, help: t.help }));

  // wrong answers by error: the Fehlerart only „vermutet“ until the teacher confirmed it; else the checker's concrete error
  const zaehler = new Map<string, { n: number; vermutet: boolean }>();
  for (const x of repo.listAttemptsForUnit(unitId)) {
    if (x.correct || x.solution_viewed) continue;
    const typ = x.error_type && x.error_type !== "unbekannt" ? errorTypeLabel(x.error_type) : null;
    const key = typ ?? x.error_label;
    if (!key) continue;
    const z = zaehler.get(key) ?? { n: 0, vermutet: false };
    zaehler.set(key, { n: z.n + 1, vermutet: z.vermutet || (typ !== null && x.error_type_source !== "lehrer") });
  }
  const fehler = [...zaehler]
    .sort((x, y) => y[1].n - x[1].n)
    .slice(0, 5)
    .map(([k, z]) => `${k} (${z.n}×${z.vermutet ? ", vermutet" : ""})`);

  // the skills of the step: of the package step, or in the plan for the whole unit of its topic
  const beobachtungen = antwortenDerEinheit(unitId).map((b) => ({ titel: b.titel, art: b.art, antwort: b.antwort, skillIds: b.skillIds }));
  const skillName = (id: string | null) => (id ? (repo.getSkill(id)?.name ?? id) : "");
  const reaktionen = reaktionenDerEinheit(unitId).map((r) => ({ art: r.art, skillId: r.skillId, skill: skillName(r.skillId), assignmentId: r.assignmentId }));

  const v = vorgabeDerEinheit(unitId);
  const vorgabe = (v?.skillIds ?? []).flatMap((id) => {
    const s = repo.getSkill(id);
    return s ? [{ id, name: s.name }] : [];
  });
  // practised today: answers, steps the teacher marked done, her observations, a Textarbeit with words
  const student = repo.getStudent(lesson.student_id);
  const fach = unit?.subject || lesson.subject;
  const textSkills = student
    ? textLaeufe(unitId)
        .filter((t) => t.woerter > 0)
        .flatMap((t) => skillFuerText({ fach, textsorte: t.textsorte, schulstufe: schulstufe(student.school_type, student.klasse ?? 1) }, repo.listSkills())?.id ?? [])
    : [];
  const geuebt = [...new Set([...aufgaben.filter((t) => t.finished && t.skillId).map((t) => t.skillId!), ...skillsErledigterSchritte(unitId), ...beobachtungen.flatMap((b) => b.skillIds), ...textSkills])];

  // the next exam: only a date the teacher (or the student) entered, never a guess
  const tag = wienerDatum(new Date(unit?.started_at ?? Date.now()));
  const bis = unit?.ended_at ? wienerDatum(new Date(unit.ended_at)) : tag;
  const test = repo.upcomingTests(tag, lesson.student_id).find((t) => (!fach || !t.subject || t.subject === fach) && daysUntil(t.date, tag) <= PRUEFUNG_TAGE);
  const geuebtSeit = db().prepare(`SELECT 1 FROM attempts WHERE student_id = ? AND skill_id = ? AND substr(created_at, 1, 10) BETWEEN ? AND ? AND ${repo.COUNTED} LIMIT 1`);
  const pruefung = test
    ? {
        art: test.kind || "Prüfung",
        fach: test.subject,
        datum: shortDate(test.date),
        // geübt: eine gezählte Antwort in den 30 Tagen davor, oder heute eine Textarbeit dieser Art (sie hat keine Antworten)
        offen: test.skill_ids.filter((id) => repo.getSkill(id) && !textSkills.includes(id) && !geuebtSeit.get(lesson.student_id, id, tagAddieren(tag, -PRUEFUNG_TAGE), bis)).map((id) => skillName(id)),
      }
    : null;

  const eigen = new Set(json<string[]>(lesson.abschluss_eigen ?? "[]", []).filter(isAbschlussFeld));
  const eigene: AbschlussBelege["eigene"] = {};
  for (const feld of eigen) if ((lesson[DOKU_FELD[feld]] ?? "").trim()) eigene[feld] = lesson[DOKU_FELD[feld]];

  return { aufgaben, fehler, beobachtungen, reaktionen, minitest: report?.minitest ?? null, vorgabe, geuebt, pruefung, eigene };
}

/** Die Karte einer beendeten Einheit mit allen Belegen, wie der Abschluss sie zeigt und „Bestätigen“ sie schreibt. */
export function karteDerEinheit(unitId: number, lesson: repo.Lesson, brief: UnitBrief | null = unitBrief(lesson.id)): AbschlussKarte {
  // Textarbeiten: die übernommene Note, sonst „Bewertung offen“ (lib/text-note.ts), nie ein Vorschlag als Ergebnis
  const texte = textLaeufe(unitId).map((t) => ({ id: t.id, titel: t.titel, textsorte: t.textsorte, bewertung: bewertungFuerBericht(t.id, unitId), vorschlag: t.vorschlag }));
  return abschlussKarte(brief, ablaufDerEinheit(unitId), texte, belegeDerEinheit(unitId, lesson));
}

// ---------- confirming and correcting ----------

/**
 * Der Text eines Felds für die Dokumentation: ohne deine Notizen (die stehen schon in ihren Feldern), eine Beobachtung
 * als solche markiert, damit sie später nicht als Ergebnis gelesen wird.
 */
export function dokuText(zeilen: KartenZeile[]): string {
  return zeilen
    .filter((z) => z.von !== "lehrer" && z.von !== "eigen")
    .map((z) => (z.von === "beobachtung" ? `${z.text} (Beobachtung)` : z.text))
    .join("\n");
}

/**
 * Schreibt die vier Felder in die Dokumentation (`DOKU_FELD`), nur wo die Lehrkraft nichts selbst geschrieben hat: ein
 * leeres Feld oder eines, das noch den automatischen Wert trägt (lib/einschaetzung.ts `autoFelderVon`). Was so
 * geschrieben wird, gilt weiter als automatisch. Gibt die geschriebenen Felder zurück.
 */
export function schreibeAbschluss(lessonId: number, karte: AbschlussKarte): AbschlussFeld[] {
  const lesson = repo.getLesson(lessonId);
  if (!lesson) return [];
  const auto = autoFelderVon(lesson);
  const werte = json<Record<string, unknown>>(lesson.auto_felder, {});
  const neu: Partial<Record<(typeof DOKU_FELD)[AbschlussFeld], string>> = {};
  const geschrieben: AbschlussFeld[] = [];
  for (const [feld] of ABSCHLUSS_FELDER) {
    const spalte = DOKU_FELD[feld];
    if ((lesson[spalte] ?? "").trim() && !auto.has(spalte)) continue;
    const text = dokuText(karte[feld]);
    neu[spalte] = text;
    if (text) werte[spalte] = text;
    else delete werte[spalte];
    geschrieben.push(feld);
  }
  if (!geschrieben.length) return [];
  repo.saveLesson({ ...lesson, ...neu }, lesson.id);
  db().prepare("UPDATE lessons SET auto_felder = ? WHERE id = ?").run(JSON.stringify(werte), lesson.id);
  return geschrieben;
}

/**
 * Nur das Zeichen „gesehen“: `reviewed_at`, kein Feld ändert sich. Schon bestätigt: bleibt, wie es ist. Gibt zurück, ob
 * sich etwas geändert hat. „Dokumentation bestätigen“ im Abschluss ist `bestaetigeAbschluss`.
 */
export function bestaetigeDoku(lessonId: number, at: Date = new Date()): boolean {
  return db().prepare("UPDATE lessons SET reviewed_at = ? WHERE id = ? AND reviewed_at IS NULL").run(at.toISOString(), lessonId).changes > 0;
}

/**
 * „Dokumentation bestätigen“: die Karte, wie die Lehrkraft sie sieht, kommt in die Dokumentation (`schreibeAbschluss`,
 * nur in leere oder automatische Felder), dann `reviewed_at`. Schon bestätigt: nichts ändert sich.
 */
export function bestaetigeAbschluss(lessonId: number, at: Date = new Date()): boolean {
  const lesson = repo.getLesson(lessonId);
  if (!lesson || lesson.reviewed_at) return false;
  const unit = lesson.unit_id ? getUnit(lesson.unit_id) : null;
  if (unit?.status === "beendet") schreibeAbschluss(lesson.id, karteDerEinheit(unit.id, lesson));
  return bestaetigeDoku(lesson.id, at);
}

/**
 * Ein Feld direkt in der Karte korrigieren: der Text kommt in sein Feld der Dokumentation und gehört ab jetzt der
 * Lehrkraft (Bestätigen schreibt dort nichts mehr). Leer: das Feld kommt wieder aus den Daten. Bestätigt nicht.
 */
export function korrigiereFeld(lessonId: number, feld: AbschlussFeld, text: string): boolean {
  const lesson = repo.getLesson(lessonId);
  if (!lesson || !isAbschlussFeld(feld)) return false;
  const t = zeilenAus(text.slice(0, FELD_MAX)).join("\n");
  const spalte = DOKU_FELD[feld];
  const eigen = new Set(json<string[]>(lesson.abschluss_eigen ?? "[]", []).filter(isAbschlussFeld));
  if (t) eigen.add(feld);
  else eigen.delete(feld);
  const werte = json<Record<string, unknown>>(lesson.auto_felder, {});
  delete werte[spalte];
  repo.saveLesson({ ...lesson, [spalte]: t }, lesson.id);
  db().prepare("UPDATE lessons SET auto_felder = ?, abschluss_eigen = ? WHERE id = ?").run(JSON.stringify(werte), JSON.stringify([...eigen]), lesson.id);
  return true;
}

/**
 * Die Notiz für Eltern oder Schüler (lib/summary.ts `noteFromFacts`) aus denselben Feldern wie der Abschluss: deine
 * Beobachtungen bleiben draußen, deine eigenen Zeilen gelten als Notiz (gehen also nie an die KI, `briefForAI`).
 */
export function briefAusKarte(b: UnitBrief, k: AbschlussKarte): UnitBrief {
  const zu = (xs: KartenZeile[]): BriefLine[] => xs.filter((z) => z.von !== "beobachtung").map((z) => ({ text: z.text, from: z.von === "lehrer" || z.von === "eigen" ? "lehrer" : "daten" }));
  return { ...b, done: zu(k.gemacht), good: zu(k.gut), difficulties: zu(k.schwierig), errors: [], next: zu(k.naechstes), dates: [] };
}
