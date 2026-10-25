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
 */
import { KRITERIUM_KEYS, KRITERIUM_KURZ } from "./bewertung-kriterien";
import type { AblaufDerEinheit } from "./cockpit";
import { db } from "./db";
import type { BriefLine, UnitBrief } from "./summary";
import { SCHWACHE_STUFE, type BerichtBewertung } from "./text-note";

/** `link`: ein Tippen zum nächsten Schritt (etwa „Bewertung übernehmen“), nur für die Lehrkraft der Einheit. */
export type KartenZeile = { text: string; von: "daten" | "lehrer" | "ablauf"; link?: { href: string; label: string } };

/**
 * Eine Textarbeit der Einheit, wie der Abschluss sie zeigt: `bewertung` wie in der Dokumentation (lib/text-note.ts
 * `bewertungFuerBericht`, nur in der letzten Einheit des Texts), `vorschlag`: ein Vorschlag der KI wartet auf Übernahme.
 */
export type AbschlussText = { id: number; titel: string; textsorte: string; bewertung?: BerichtBewertung; vorschlag?: boolean };
export type AbschlussKarte = { gemacht: KartenZeile[]; gut: KartenZeile[]; schwierig: KartenZeile[]; naechstes: KartenZeile[] };

export const ABSCHLUSS_FELDER: [keyof AbschlussKarte, string][] = [
  ["gemacht", "Heute gemacht"],
  ["gut", "Gut verstanden"],
  ["schwierig", "Noch schwierig"],
  ["naechstes", "Nächstes Mal"],
];

const namen = (xs: { titel: string }[]) => xs.map((x) => x.titel).join(", ");
const mitMal = (xs: { titel: string; mal: number }[]) => xs.map((x) => (x.mal > 1 ? `${x.titel} (${x.mal}×)` : x.titel)).join(", ");

const textName = (t: Pick<AbschlussText, "titel" | "textsorte">) => (t.textsorte.trim() && t.textsorte.trim() !== t.titel ? `${t.textsorte.trim()} „${t.titel}“` : `Textarbeit „${t.titel}“`);

/** „Heute gemacht“ für eine Textarbeit mit übernommener oder offener Bewertung. */
function textGemacht(t: AbschlussText & { bewertung: BerichtBewertung }): KartenZeile {
  const b = t.bewertung;
  if (b.stand === "offen")
    return { text: `${textName(t)}: Bewertung offen`, von: "daten", link: t.vorschlag ? { href: `/texte/${t.id}/korrektur?teil=aufgabe`, label: "Bewertung übernehmen" } : { href: `/texte/${t.id}/korrektur`, label: "Korrigieren" } };
  const auftraege = b.von ? ` (${b.erfuellt} von ${b.von} ${b.von === 1 ? "Arbeitsauftrag" : "Arbeitsaufträgen"} erfüllt)` : "";
  const stufen = KRITERIUM_KEYS.map((k) => `${KRITERIUM_KURZ[k]} ${b.stufen[k]}`).join(", ");
  return { text: b.note ? `${textName(t)}: Note ${b.note}${auftraege}` : `${textName(t)}: bewertet (${stufen})`, von: "daten" };
}

/**
 * Die vier Felder. `brief` null: es gibt keine Dokumentation (dann bleibt nur, was getippt wurde). `texte`: die
 * Textarbeiten der Einheit; mit Bewertung (übernommen oder offen) ersetzt ihre Zeile die der Dokumentation.
 */
export function abschlussKarte(brief: Pick<UnitBrief, "done" | "good" | "difficulties" | "errors" | "next" | "dates"> | null, ablauf: AblaufDerEinheit | null, texte: AbschlussText[] = []): AbschlussKarte {
  const zeile = (l: BriefLine): KartenZeile => ({ text: l.text, von: l.from });
  const a = (text: string): KartenZeile => ({ text, von: "ablauf" });
  const e = ablauf?.ergebnis;
  const wo = ablauf ? (ablauf.art === "plan" ? "Plan für heute" : `Lernpaket „${ablauf.titel}“`) : "";
  const gesamt = e ? e.erledigt.length + e.uebersprungen.length + e.nichtErreicht.length : 0;

  // a text with a grade (confirmed or open) gets its own line instead of the documentation's
  const mitBewertung = texte.filter((t): t is AbschlussText & { bewertung: BerichtBewertung } => Boolean(t.bewertung));
  // also the bare topic line („E-Mail“) the documentation writes when the unit had no tasks
  const ersetzt = (l: BriefLine) => l.from === "daten" && mitBewertung.some((t) => l.text.startsWith(`Textarbeit „${t.titel}“`) || (t.textsorte !== "" && l.text === t.textsorte));
  const gemacht = (brief?.done ?? []).filter((l) => !ersetzt(l)).map(zeile);
  gemacht.push(...mitBewertung.map(textGemacht));
  if (e?.erledigt.length) gemacht.push(a(`${wo}: ${e.erledigt.length} von ${gesamt} Schritten (${namen(e.erledigt)})`));

  // only what the data shows as secure, or what the teacher wrote; a step marked „Weiter“ proves nothing
  const gut = (brief?.good ?? []).map(zeile);

  const schwierig = [...(brief?.difficulties ?? []).map(zeile), ...(brief?.errors ?? []).map((l) => ({ ...zeile(l), text: l.from === "daten" ? `Fehler: ${l.text}` : l.text }))];
  if (e?.nichtVerstanden.length) schwierig.push(a(`Nicht verstanden: ${mitMal(e.nichtVerstanden)}`));
  // weak criteria of a confirmed grade only; an open grade proves nothing yet
  for (const t of mitBewertung) {
    const b = t.bewertung;
    if (b.stand !== "bestaetigt") continue;
    const schwach = KRITERIUM_KEYS.filter((k) => b.stufen[k] >= SCHWACHE_STUFE);
    if (schwach.length) schwierig.push({ text: `${textName(t)}: ${schwach.map((k) => `${KRITERIUM_KURZ[k]} ${b.stufen[k]}`).join(", ")}`, von: "daten" });
  }

  const naechstes = (brief?.next ?? []).map(zeile);
  if (e?.nichtErreicht.length && (e.erledigt.length || e.uebersprungen.length || e.wiederholt.length || e.nichtVerstanden.length)) naechstes.push(a(`Weiter mit: ${namen(e.nichtErreicht)}`));
  if (e?.wiederholt.length) naechstes.push(a(`Wiederholen: ${mitMal(e.wiederholt)}`));
  if (e?.uebersprungen.length) naechstes.push(a(`Übersprungen: ${namen(e.uebersprungen)}`));
  naechstes.push(...(brief?.dates ?? []).map(zeile));

  const einmal = (xs: KartenZeile[]) => xs.filter((x, i) => x.text.trim() && xs.findIndex((y) => y.text === x.text) === i);
  return { gemacht: einmal(gemacht), gut: einmal(gut), schwierig: einmal(schwierig), naechstes: einmal(naechstes) };
}

/**
 * „Dokumentation bestätigen“: die automatische Dokumentation gilt als vom Lehrer gesehen. Kein Feld ändert sich, nur
 * `reviewed_at`. Schon bestätigt: bleibt, wie es ist. Gibt zurück, ob sich etwas geändert hat.
 */
export function bestaetigeDoku(lessonId: number, at: Date = new Date()): boolean {
  return db().prepare("UPDATE lessons SET reviewed_at = ? WHERE id = ? AND reviewed_at IS NULL").run(at.toISOString(), lessonId).changes > 0;
}
