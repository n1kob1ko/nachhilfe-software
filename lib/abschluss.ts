/**
 * Der **Abschluss** einer beendeten Einheit (niko, 25.10.2026): vier Felder, alle aus echten Ergebnissen, und ein
 * Knopf „Dokumentation bestätigen“. Die Felder kommen aus `unitBrief` (lib/summary.ts: Aufgaben, Fehlerarten,
 * Empfehlung, Hausübung und Termine) und aus dem, was der Lehrer im geführten Unterricht getippt hat
 * (lib/cockpit.ts: erledigt, wiederholt, nicht verstanden, nicht erreicht). Nichts wird erfunden: ohne Beleg bleibt
 * „Gut verstanden“ leer, und die Seite sagt das.
 */
import type { AblaufDerEinheit } from "./cockpit";
import { db } from "./db";
import type { BriefLine, UnitBrief } from "./summary";

export type KartenZeile = { text: string; von: "daten" | "lehrer" | "ablauf" };
export type AbschlussKarte = { gemacht: KartenZeile[]; gut: KartenZeile[]; schwierig: KartenZeile[]; naechstes: KartenZeile[] };

export const ABSCHLUSS_FELDER: [keyof AbschlussKarte, string][] = [
  ["gemacht", "Heute gemacht"],
  ["gut", "Gut verstanden"],
  ["schwierig", "Noch schwierig"],
  ["naechstes", "Nächstes Mal"],
];

const namen = (xs: { titel: string }[]) => xs.map((x) => x.titel).join(", ");
const mitMal = (xs: { titel: string; mal: number }[]) => xs.map((x) => (x.mal > 1 ? `${x.titel} (${x.mal}×)` : x.titel)).join(", ");

/** Die vier Felder. `brief` null: es gibt keine Dokumentation (dann bleibt nur, was getippt wurde). */
export function abschlussKarte(brief: Pick<UnitBrief, "done" | "good" | "difficulties" | "errors" | "next" | "dates"> | null, ablauf: AblaufDerEinheit | null): AbschlussKarte {
  const zeile = (l: BriefLine): KartenZeile => ({ text: l.text, von: l.from });
  const a = (text: string): KartenZeile => ({ text, von: "ablauf" });
  const e = ablauf?.ergebnis;
  const wo = ablauf ? (ablauf.art === "plan" ? "Plan für heute" : `Lernpaket „${ablauf.titel}“`) : "";
  const gesamt = e ? e.erledigt.length + e.uebersprungen.length + e.nichtErreicht.length : 0;

  const gemacht = (brief?.done ?? []).map(zeile);
  if (e?.erledigt.length) gemacht.push(a(`${wo}: ${e.erledigt.length} von ${gesamt} Schritten (${namen(e.erledigt)})`));

  // only what the data shows as secure, or what the teacher wrote; a step marked „Weiter“ proves nothing
  const gut = (brief?.good ?? []).map(zeile);

  const schwierig = [...(brief?.difficulties ?? []).map(zeile), ...(brief?.errors ?? []).map((l) => ({ ...zeile(l), text: l.from === "daten" ? `Fehler: ${l.text}` : l.text }))];
  if (e?.nichtVerstanden.length) schwierig.push(a(`Nicht verstanden: ${mitMal(e.nichtVerstanden)}`));

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
