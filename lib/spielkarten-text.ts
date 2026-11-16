/**
 * Spielkarten als Text (lib/spielkarten.ts): so schreibt die Lehrkraft eigenen Stoff für die Lernspiele, in jedem Fach
 * (niko 2026-11-16: Bio-Test „Evolution, Plattentektonik“ – „wie könnte ich das in blockpuzzle implementieren“). Wie bei
 * den Vokabellisten eine Karte pro Zeile; die App prüft jede Antwort ohne KI. Ohne Datenbank, damit die Vorschau im
 * Browser dieselben Regeln hat wie der Server.
 *
 * - Auswahl: `Frage = richtige Antwort | falsche | falsche` (2 bis 6 Antworten, die erste stimmt). Steht in der Frage
 *   eine Lücke `___`, kommt die Antwort dort hinein, sonst ans Ende. Zwei Antworten werden gewischt, drei bis sechs
 *   sind Kacheln.
 * - Reihenfolge: `Auftrag: erstes > zweites > drittes` (3 bis 8 Teile, in der richtigen Reihenfolge geschrieben).
 * - `Merke: …` in der Zeile darunter erscheint nach einem Fehler bei dieser Karte.
 * - Leere Zeilen und Zeilen mit `#` am Anfang zählen nicht.
 */
import { festerZufall, REIHE_TRENNER, zahlAus, type SpielKarte } from "./lernspiele-typen";

export type EigeneKarte =
  | { art: "wahl"; frage: string; richtig: string; falsch: string[]; merke: string; zeile?: number }
  | { art: "reihe"; frage: string; teile: string[]; merke: string; zeile?: number };

export type Meldung = { zeile: number; text: string };
export type GeleseneKarten = { karten: EigeneKarte[]; fehler: Meldung[]; hinweise: Meldung[] };

/** So viele Karten braucht ein Satz, damit er ins Spiel kommt, und so viele hat er höchstens. */
export const KARTEN_MIN = 4;
export const KARTEN_MAX = 200;
export const ANTWORTEN_MAX = 6;
export const TEILE_MIN = 3;
export const TEILE_MAX = 8;
/** Längen: eine Frage passt auf die Karte, eine Antwort auf eine Kachel. */
export const FRAGE_MAX = 220;
export const ANTWORT_MAX = 48;
const STANDARD_AUFTRAG = "Bring in die richtige Reihenfolge.";

const LUECKE = /_{2,}/;
const sauber = (s: string) => s.replace(/\s+/g, " ").trim();
const gleich = (a: string, b: string) => a.toLocaleLowerCase("de") === b.toLocaleLowerCase("de");

export const BEISPIEL = `Zufällige Veränderung der DNA, ein Kopierfehler = Mutation | Rekombination | Selektion
Wer sagte: „Arten sind unveränderlich“? = Cuvier | Lamarck | Darwin
Merke: Cuvier glaubte an Katastrophen, nicht an Evolution.
Magma ist geschmolzenes Gestein ___ der Erde. = im Inneren | an der Oberfläche
Ordne das Zeitseil, das Älteste zuerst: Erdurzeit > Erdaltertum > Erdmittelalter > Erdneuzeit`;

/** Liest den Text Zeile für Zeile. Fehler halten das Speichern auf, Hinweise nicht. */
export function leseKarten(text: string): GeleseneKarten {
  const karten: EigeneKarte[] = [];
  const fehler: Meldung[] = [];
  const hinweise: Meldung[] = [];
  const gesehen = new Map<string, number>();
  const zeilen = text.replace(/\r\n?/g, "\n").split("\n");
  zeilen.forEach((roh, i) => {
    const zeile = i + 1;
    const z = sauber(roh);
    if (!z || z.startsWith("#")) return;
    const merke = z.match(/^(merke|tipp|regel)\s*:\s*(.*)$/i);
    if (merke) {
      const letzte = karten[karten.length - 1];
      if (!letzte || letzte.zeile !== vorigeKarte(zeilen, i)) fehler.push({ zeile, text: `Zeile ${zeile}: „${merke[1]}:“ gehört direkt unter eine Karte.` });
      else letzte.merke = merke[2].slice(0, 300);
      return;
    }
    const karte = leseZeile(z, zeile, fehler);
    if (!karte) return;
    const schluessel = karte.frage.toLocaleLowerCase("de");
    const doppelt = gesehen.get(schluessel);
    if (doppelt) {
      hinweise.push({ zeile, text: `Zeile ${zeile}: Dieselbe Frage steht schon in Zeile ${doppelt}. Die App nimmt nur die erste.` });
      return;
    }
    gesehen.set(schluessel, zeile);
    karten.push(karte);
  });
  if (karten.length > KARTEN_MAX) fehler.push({ zeile: 0, text: `Höchstens ${KARTEN_MAX} Karten in einem Satz. Teil den Stoff auf zwei auf.` });
  else if (karten.length > 0 && karten.length < KARTEN_MIN) hinweise.push({ zeile: 0, text: `Ins Spiel kommt der Satz ab ${KARTEN_MIN} Karten.` });
  return { karten, fehler, hinweise };
}

/** Die Nummer der letzten Zeile vor `i`, die eine Karte ist (nicht leer, kein Kommentar, kein Merke). */
function vorigeKarte(zeilen: string[], i: number): number | undefined {
  for (let j = i - 1; j >= 0; j--) {
    const z = sauber(zeilen[j]);
    if (!z || z.startsWith("#")) continue;
    if (/^(merke|tipp|regel)\s*:/i.test(z)) return undefined;
    return j + 1;
  }
  return undefined;
}

function leseZeile(z: string, zeile: number, fehler: Meldung[]): EigeneKarte | null {
  const f = (text: string) => {
    fehler.push({ zeile, text: `Zeile ${zeile}: ${text}` });
    return null;
  };
  const gl = z.lastIndexOf(" = ");
  if (gl >= 0 || z.endsWith(" =")) {
    const frage = sauber(z.slice(0, gl >= 0 ? gl : z.length - 2));
    const antworten = (gl >= 0 ? z.slice(gl + 3) : "").split("|").map(sauber).filter(Boolean);
    if (!frage) return f("Vor „=“ fehlt die Frage.");
    if (frage.length > FRAGE_MAX) return f(`Die Frage ist zu lang (höchstens ${FRAGE_MAX} Zeichen).`);
    if (antworten.length < 2) return f("Nach „=“ braucht es die richtige Antwort und mindestens eine falsche, getrennt mit „|“.");
    if (antworten.length > ANTWORTEN_MAX) return f(`Höchstens ${ANTWORTEN_MAX} Antworten.`);
    const lang = antworten.find((a) => a.length > ANTWORT_MAX);
    if (lang) return f(`„${lang.slice(0, 30)}…“ ist als Antwort zu lang (höchstens ${ANTWORT_MAX} Zeichen).`);
    const doppelt = antworten.find((a, n) => antworten.findIndex((b) => gleich(a, b)) !== n);
    if (doppelt) return f(`„${doppelt}“ steht zweimal bei den Antworten.`);
    if ((frage.match(/_{2,}/g) ?? []).length > 1) return f("Nur eine Lücke ___ pro Frage.");
    return { art: "wahl", frage, richtig: antworten[0], falsch: antworten.slice(1), merke: "", zeile };
  }
  if (/\s>\s/.test(z)) {
    const erstes = z.search(/\s>\s/);
    const doppelpunkt = z.lastIndexOf(":", erstes);
    const frage = doppelpunkt >= 0 ? sauber(z.slice(0, doppelpunkt)) : "";
    const teile = z
      .slice(doppelpunkt + 1)
      .split(/\s>\s/)
      .map(sauber)
      .filter(Boolean);
    if (teile.length < TEILE_MIN) return f(`Eine Reihenfolge braucht mindestens ${TEILE_MIN} Teile, getrennt mit „>“.`);
    if (teile.length > TEILE_MAX) return f(`Höchstens ${TEILE_MAX} Teile in einer Reihenfolge.`);
    if (frage.length > FRAGE_MAX) return f(`Der Auftrag ist zu lang (höchstens ${FRAGE_MAX} Zeichen).`);
    const lang = teile.find((a) => a.length > ANTWORT_MAX);
    if (lang) return f(`„${lang.slice(0, 30)}…“ ist als Teil zu lang (höchstens ${ANTWORT_MAX} Zeichen).`);
    const doppelt = teile.find((a, n) => teile.findIndex((b) => gleich(a, b)) !== n);
    if (doppelt) return f(`„${doppelt}“ steht zweimal in der Reihenfolge.`);
    return { art: "reihe", frage: frage || STANDARD_AUFTRAG, teile, merke: "", zeile };
  }
  return f("Es fehlt „=“ mit den Antworten (Frage = richtig | falsch) oder „>“ für eine Reihenfolge.");
}

/** Schreibt Karten als Text (für die Vorschläge der KI, damit die Lehrkraft sie im selben Feld ändert). */
export function kartenAlsText(karten: EigeneKarte[]): string {
  return karten
    .map((k) => {
      const zeile = k.art === "wahl" ? `${k.frage} = ${[k.richtig, ...k.falsch].join(" | ")}` : `${k.frage}: ${k.teile.join(" > ")}`;
      return k.merke ? `${zeile}\nMerke: ${k.merke}` : zeile;
    })
    .join("\n");
}

function mischen<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Der Schlüssel einer Karte: hängt nur an der Frage, damit eine falsche Karte nach dem Ändern der Antworten wiederkommt. */
export const kartenKey = (k: Pick<EigeneKarte, "frage">) => `stoff:${zahlAus(k.frage.toLocaleLowerCase("de"))}`;

/** Eine Karte des Lernspiels (lib/lernspiele-typen.ts): Auswahl als Wischen oder Kacheln, Reihenfolge wie beim Satzbau. */
export function alsSpielKarte(k: EigeneKarte, skill: string): SpielKarte {
  const key = kartenKey(k);
  const rng = festerZufall(zahlAus(key) + 17);
  if (k.art === "reihe") {
    let gemischt = mischen(k.teile, rng);
    for (let i = 0; i < 6 && gemischt.every((t, j) => t === k.teile[j]); i++) gemischt = mischen(k.teile, rng);
    if (gemischt.every((t, j) => t === k.teile[j])) gemischt = [...k.teile.slice(1), k.teile[0]];
    return { key, skill, form: "reihe", auftrag: k.frage, vor: "", nach: "", faecher: gemischt, richtig: k.teile.join(REIHE_TRENNER), loesung: k.teile.join(" → "), regel: k.merke, kurz: k.teile[0] };
  }
  const antworten = [k.richtig, ...k.falsch];
  const luecke = k.frage.match(LUECKE);
  const vor = luecke ? k.frage.slice(0, luecke.index).trimEnd() : k.frage;
  const nach = luecke ? k.frage.slice(luecke.index! + luecke[0].length).trimStart() : "";
  const loesung = luecke ? sauber(`${vor} ${k.richtig}${/^[,.;:!?]/.test(nach) ? "" : " "}${nach}`) : `${k.frage} → ${k.richtig}`;
  return {
    key,
    skill,
    form: antworten.length === 2 ? "wischen" : "kacheln",
    vor,
    nach,
    faecher: mischen(antworten, rng),
    richtig: k.richtig,
    loesung,
    regel: k.merke,
    kurz: k.richtig,
  };
}
