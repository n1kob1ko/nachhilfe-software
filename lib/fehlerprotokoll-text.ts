/**
 * Das Fehlerprotokoll als Text (lib/fehlerprotokoll.ts): die Fehler aus den eigenen Texten eines Schülers, so wie die
 * Lehrkraft sie auf Papier führt („Falsch | Richtig“). Eine Zeile ein Fehler, die falsche Stelle links, die richtige
 * rechts. Im Spiel „Meine Fehler“ steht der Satz da, die Stelle mit dem Fehler ist eine Lücke, und der Schüler wischt
 * zur richtigen Form. Ohne Datenbank, damit die Vorschau im Browser dieselben Regeln hat wie der Server.
 *
 * - `falsch → richtig` (auch `->` oder `=>`): Schulen müssen Schülern unterstützen → Schulen müssen Schüler unterstützen
 * - `Merke: …` in der Zeile darunter erscheint nach einem Fehler bei dieser Karte (ohne Merke steht dort die richtige
 *   Form).
 * - Leere Zeilen und Zeilen mit `#` am Anfang zählen nicht.
 *
 * Die Lücke rechnet die App selbst aus: alles, was links und rechts gleich ist, bleibt stehen, der Rest ist die Stelle
 * mit dem Fehler (bei „seine eigene Wünsche ist“ → „seine eigenen Wünsche sind“ also „eigene Wünsche ist“).
 */
import { festerZufall, zahlAus, type SpielKarte } from "./lernspiele-typen";

export type FehlerEintrag = {
  falsch: string;
  richtig: string;
  merke: string;
  zeile: number;
  /** was vor und nach der Stelle mit dem Fehler steht */
  vor: string;
  nach: string;
  /** die Stelle selbst, falsch und richtig */
  stelleFalsch: string;
  stelleRichtig: string;
};

export type Meldung = { zeile: number; text: string };
export type GeleseneFehler = { eintraege: FehlerEintrag[]; fehler: Meldung[]; hinweise: Meldung[] };

/** So oft hintereinander richtig, dann ist ein Fehler geschafft und kommt nicht mehr (niko: „zweimal hintereinander“). */
export const RAUS_NACH = 2;
export const FEHLER_MAX = 200;
/** Ein Satz passt auf die Karte, die Stelle auf eine Seite der Karte zum Wischen. */
export const SATZ_MAX = 200;
export const STELLE_MAX = 48;

export const BEISPIEL = `Schulen müssen Schülern unterstützen → Schulen müssen Schüler unterstützen
Merke: unterstützen + Akkusativ (wen?)
Das wirkt sich positiv für die Gesundheit aus → Das wirkt sich positiv auf die Gesundheit aus
im Vergleich zu seinem Frau → im Vergleich zu seiner Frau`;

const PFEIL = /\s*(?:→|->|=>)\s*/;
const sauber = (s: string) => s.replace(/\s+/g, " ").trim();
/** Anführungszeichen außen weg („…“, "…", »…«), sie gehören nicht zum Satz. */
const ohneZeichen = (s: string) => sauber(s.replace(/^[„“"»«‚‘']+|[“”"»«‘’']+$/g, ""));

/** Liest den Text Zeile für Zeile. Fehler halten das Speichern auf, Hinweise nicht. */
export function leseFehler(text: string): GeleseneFehler {
  const eintraege: FehlerEintrag[] = [];
  const fehler: Meldung[] = [];
  const hinweise: Meldung[] = [];
  const gesehen = new Map<string, number>();
  let letzteKarte = 0;
  text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .forEach((roh, i) => {
      const zeile = i + 1;
      const z = sauber(roh);
      if (!z || z.startsWith("#")) return;
      const merke = z.match(/^(merke|tipp|regel)\s*:\s*(.*)$/i);
      if (merke) {
        const letzter = eintraege[eintraege.length - 1];
        if (!letzter || letzter.zeile !== letzteKarte) fehler.push({ zeile, text: `Zeile ${zeile}: „${merke[1]}:“ gehört direkt unter einen Fehler.` });
        else letzter.merke = merke[2].slice(0, 300);
        letzteKarte = 0;
        return;
      }
      letzteKarte = 0;
      const e = leseZeile(z, zeile, fehler);
      if (!e) return;
      const schluessel = e.falsch.toLocaleLowerCase("de");
      const doppelt = gesehen.get(schluessel);
      if (doppelt) {
        hinweise.push({ zeile, text: `Zeile ${zeile}: Derselbe Fehler steht schon in Zeile ${doppelt}. Die App nimmt nur den ersten.` });
        return;
      }
      gesehen.set(schluessel, zeile);
      eintraege.push(e);
      letzteKarte = zeile;
    });
  if (eintraege.length > FEHLER_MAX) fehler.push({ zeile: 0, text: `Höchstens ${FEHLER_MAX} Fehler im Protokoll. Lösch die, die geschafft sind.` });
  return { eintraege, fehler, hinweise };
}

function leseZeile(z: string, zeile: number, fehler: Meldung[]): FehlerEintrag | null {
  const f = (text: string) => {
    fehler.push({ zeile, text: `Zeile ${zeile}: ${text}` });
    return null;
  };
  const teile = z.split(PFEIL);
  if (teile.length !== 2) return f(teile.length < 2 ? "Es fehlt „→“ zwischen falsch und richtig (auch „->“ geht)." : "Nur ein „→“ pro Zeile.");
  const falsch = ohneZeichen(teile[0]);
  const richtig = ohneZeichen(teile[1]);
  if (!falsch) return f("Vor „→“ fehlt die falsche Form.");
  if (!richtig) return f("Nach „→“ fehlt die richtige Form.");
  if (falsch === richtig) return f("Falsch und richtig sind gleich.");
  if (falsch.length > SATZ_MAX || richtig.length > SATZ_MAX) return f(`Der Satz ist zu lang (höchstens ${SATZ_MAX} Zeichen). Nimm nur den Teil mit dem Fehler.`);
  const s = stelle(falsch, richtig);
  if (s.stelleFalsch.length > STELLE_MAX || s.stelleRichtig.length > STELLE_MAX)
    return f(`Der Unterschied „${s.stelleRichtig.slice(0, 30)}…“ ist zu lang für die Karte (höchstens ${STELLE_MAX} Zeichen). Schreib zwei Zeilen, eine je Fehler.`);
  return { falsch, richtig, merke: "", zeile, ...s };
}

/**
 * Die Stelle mit dem Fehler: Wörter, die vorne und hinten gleich sind, bleiben stehen. Fehlt auf einer Seite ein Wort
 * („anstatt zu helfen“ → „anstatt helfen“), nimmt die Stelle ein Nachbarwort mit, damit beide Seiten etwas zeigen.
 */
export function stelle(falsch: string, richtig: string): Pick<FehlerEintrag, "vor" | "nach" | "stelleFalsch" | "stelleRichtig"> {
  const a = falsch.split(" ");
  const b = richtig.split(" ");
  let vorne = 0;
  while (vorne < a.length && vorne < b.length && a[vorne] === b[vorne]) vorne++;
  let hinten = 0;
  while (hinten < a.length - vorne && hinten < b.length - vorne && a[a.length - 1 - hinten] === b[b.length - 1 - hinten]) hinten++;
  // eine leere Seite: ein Wort davor (oder danach) gehört zur Stelle
  if (a.length - vorne - hinten === 0 || b.length - vorne - hinten === 0) {
    if (vorne > 0) vorne--;
    else if (hinten > 0) hinten--;
  }
  return {
    vor: a.slice(0, vorne).join(" "),
    nach: a.slice(a.length - hinten).join(" "),
    stelleFalsch: a.slice(vorne, a.length - hinten).join(" "),
    stelleRichtig: b.slice(vorne, b.length - hinten).join(" "),
  };
}

/** Der Schlüssel einer Karte: hängt an der falschen Form, damit ein geänderter Merksatz den Stand nicht verliert. */
export const fehlerKey = (e: Pick<FehlerEintrag, "falsch">) => `fehler:${zahlAus(e.falsch.toLocaleLowerCase("de"))}`;

/** Die Karte im Spiel „Meine Fehler“: der Satz mit Lücke, links und rechts die beiden Formen (fester Zufall je Fehler). */
export function alsFehlerKarte(e: FehlerEintrag, skill: string): SpielKarte {
  const key = fehlerKey(e);
  const links = festerZufall(zahlAus(key) + 5)() < 0.5;
  return {
    key,
    skill,
    form: "wischen",
    vor: e.vor,
    nach: e.nach,
    faecher: links ? [e.stelleRichtig, e.stelleFalsch] : [e.stelleFalsch, e.stelleRichtig],
    richtig: e.stelleRichtig,
    loesung: e.richtig,
    regel: e.merke || `Richtig: ${e.richtig}. Nicht: ${e.falsch}.`,
    kurz: e.stelleRichtig,
  };
}
