/**
 * Selbst schreiben statt auswählen (niko 2026-11-24: „das mit antwort auswählen ist am anfang vielleicht besser aber mit
 * der zeit kommt es mir so vor als würde man einfach raten oder man kann's halt auswendig … was wenn es einen schwer
 * modus gibt wo man dann selbst die antwort eintippen muss“; dann: „ja übernimm das für alle spiele“).
 *
 * - **Kommt zum Schreiben wieder**: eine Karte, die beim letzten Mal richtig war, kommt beim nächsten Mal zum selbst
 *   Schreiben (`form: "schreiben"`), Zahlen im Mathe-Quiz am Ziffernblock (`form: "tippen"`). War das Geschriebene
 *   falsch, kommt sie danach wieder mit Auswahl. lib/lernspiele.ts sucht dafür den letzten Stand jeder Karte heraus
 *   (`schreibStand`) und holt bis zu zwei, die mit Auswahl richtig waren, in die nächste Runde (`zumSchreiben`).
 * - **Schwer**: am Anfang des Spiels ein Schalter; dann wird jede Karte geschrieben, die sich schreiben lässt.
 *
 * Geschrieben wird nur, wo die Antwort eindeutig ist (`schreibbar`): eine Verbform zur Grundform („(take)“ → takes), das
 * eigene Fehlerwort, der Name des Stilmittels, das treffende Wort (mit Anfangsbuchstaben), im Quiz die Antwort auf eine
 * Frage zu einem Wort („Mehrzahl von „der Baum““). Nicht: der, die, das; die Endungen; zwei Antworten zum Wischen;
 * „Welcher Satz ist richtig?“. Dort würde Schreiben nur dasselbe Wählen sein, oder es gäbe mehrere richtige Antworten.
 *
 * Geprüft wird mit `pruefeSchreiben`:
 * - Groß/klein, Leerzeichen, Apostrophe und ein Punkt am Ende zählen nie. Im Englischen zählt „doesn't“ wie „does not“.
 * - **Tippfehler** („fast“, zählt als richtig, die Schreibung wird gezeigt): ein Buchstabe daneben ab 5 Buchstaben,
 *   zwei ab 12; dazu Umlaute als ae/oe/ue und ß als ss, Artikel vorne egal. Nie, wenn das Geschriebene eine der
 *   falschen Antworten der Karte ist oder ihr näher.
 * - **Streng** bei den Formen, bei denen genau der Buchstabe der Fehler ist (Irregular Verbs, Präteritum, English
 *   Tenses und Grammar, die eigenen Fehler): „telled“ ist nie ein Tippfehler von „told“, „ging“ nie von „gingen“.
 *
 * Rein (keine Datenbank): auch der Browser lädt es (components/lernen/SchreibFeld.tsx).
 */
import { langform } from "./englisch-kurzformen";
import { tippZiel } from "./lernspiele-antwort";
import { REIHE_TRENNER, type SpielArt, type SpielForm, type SpielKarte } from "./lernspiele-typen";

export type SchreibErgebnis = "richtig" | "fast" | "falsch";

/** Die Spiele, in denen Karten geschrieben werden können, und wie streng geprüft wird. */
const SPIELE: Partial<Record<SpielArt, { streng: boolean; englisch?: boolean }>> = {
  irregular: { streng: true, englisch: true },
  praeteritum: { streng: true },
  zeiten: { streng: true, englisch: true },
  grammatik: { streng: true, englisch: true },
  fehler: { streng: true },
  stilmittel: { streng: false },
  wortschatz: { streng: false },
  quizdeutsch: { streng: false },
  quizenglisch: { streng: false, englisch: true },
  quizmathe: { streng: true },
  stoff: { streng: false },
};

/** Gibt es in diesem Spiel Karten zum Schreiben? (Dann steht am Anfang der Schalter „Schwer“.) */
export const hatSchreiben = (art: SpielArt) => art in SPIELE;
/** Wird in diesem Spiel streng geprüft (kein Tippfehler zählt)? */
export const schreibStreng = (art: SpielArt) => SPIELE[art]?.streng ?? false;
/** Englische Antworten: Kurzformen zählen wie die Langform. */
export const schreibEnglisch = (art: SpielArt) => SPIELE[art]?.englisch ?? false;

/** So lang darf eine Antwort zum Schreiben sein. */
export const SCHREIB_MAX = 30;

const woerter = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
/** Fragen, auf die es mehrere richtige Antworten gäbe, wenn die Auswahl fehlt („Welcher Buchstabe ist ein Selbstlaut?“). */
const AUSWAHL_FRAGE = /^\s*(welche[rsmn]?|was davon|wer davon|wo |richtig oder|stimmt|finde|kreuze|markiere)\b/i;
/** Quiz: Fragen, bei denen auch ein anderes Wort passen könnte. */
const MEHRDEUTIG = /treffender|wörterbuch vor|überflüssig|ein beispiel|zum beispiel|z\. ?b\./i;
/** Antworten, die etwas beschreiben („ein Feindbild“, „nicht hinein“, „Attributsatz (Relativsatz)“): dafür gibt es viele Wörter. */
const BESCHREIBUNG = /[()/]|\b(oder|nicht|kein|keine)\b|^(ein|eine|einen|einem|einer)\s/i;
/** Ein Wort oder höchstens drei kurze in Anführungszeichen: das Wort, nach dem gefragt wird. */
const ZITAT = /[„"“]([^„"“”]+)[“”"]/;

/** Eine Zahl als Antwort im Mathe-Quiz, die man ohne Runden eintippen kann (höchstens eine Nachkommastelle). */
function quizZahl(karte: SpielKarte): boolean {
  if (/≈|runde|gerundet/i.test(karte.vor)) return false;
  const z = tippZiel(karte.richtig);
  if (!z || z.bruch || z.wert.replace(/\D/g, "").length > 6) return false;
  if (/,\d{2,}/.test(z.wert)) return false;
  // alle Antworten sind Zahlen (sonst ist die Frage eine Auswahl, „Welche Zahl ist ein Vielfaches von 5?“)
  return !AUSWAHL_FRAGE.test(karte.vor) && karte.faecher.every((f) => tippZiel(f) !== null);
}

/**
 * Lässt sich diese Karte selbst schreiben? `"schreiben"` (Textfeld), `"tippen"` (Ziffernblock, Mathe-Quiz) oder null.
 * Die Karte selbst bleibt dieselbe; nur die Art zu antworten wechselt.
 */
export function schreibForm(art: SpielArt, karte: SpielKarte): Extract<SpielForm, "schreiben" | "tippen"> | null {
  if (!hatSchreiben(art) || karte.wort || karte.form === "reihe" || karte.form === "paar" || karte.form === "strahl" || karte.form === "tippen") return null;
  if (karte.form === "schreiben") return "schreiben";
  const r = karte.richtig.trim();
  if (!r || r.includes(REIHE_TRENNER) || !karte.faecher.includes(karte.richtig)) return null;
  if (art === "quizmathe") return karte.mathe && karte.mitte === undefined && quizZahl(karte) ? "tippen" : null;
  if (karte.mathe || r.length > SCHREIB_MAX || woerter(r) > 3 || /[.?!…]$/.test(r) || /\d/.test(r)) return null;
  // ein markierter Teil im Satz: nur bei den Stilmitteln ist die Antwort ein Name, sonst wird nach dem Teil gefragt
  if (karte.mitte !== undefined && art !== "stilmittel") return null;
  switch (art) {
    case "fehler":
      // das eigene Fehlerwort: die richtige Stelle selbst schreiben
      return "schreiben";
    case "irregular":
    case "praeteritum":
      return karte.faecher.length >= 3 ? "schreiben" : null;
    case "zeiten":
    case "grammatik":
      // nur mit der Grundform dabei („(take)“): sonst ist es eine kleine feste Auswahl (is, am, are)
      return karte.hinweis && karte.faecher.length >= 3 ? "schreiben" : null;
    case "stilmittel":
    case "wortschatz":
      return karte.faecher.length >= 3 ? "schreiben" : null;
    case "quizdeutsch":
    case "quizenglisch": {
      // eine Frage zu einem Wort („Mehrzahl von „der Baum““, „„always“ heißt“): eine Antwort, die man wissen kann
      const zitat = ZITAT.exec(karte.vor)?.[1];
      if (!zitat || woerter(zitat) > 3 || MEHRDEUTIG.test(karte.vor) || AUSWAHL_FRAGE.test(karte.vor) || BESCHREIBUNG.test(r)) return null;
      return karte.faecher.length >= 3 ? "schreiben" : null;
    }
    case "stoff":
      // die Karten der Lehrkraft: eine kurze Antwort, keine Auswahlfrage
      return karte.faecher.length >= 3 && !AUSWAHL_FRAGE.test(karte.vor) && !MEHRDEUTIG.test(karte.vor) && !BESCHREIBUNG.test(r) ? "schreiben" : null;
    default:
      return null;
  }
}

/** Bei „Wortschatz“ steht der Anfangsbuchstabe da: das treffende Wort ist sonst nicht eindeutig. */
export function schreibAnfang(art: SpielArt, karte: SpielKarte): string | null {
  return art === "wortschatz" ? [...karte.richtig.trim()][0] ?? null : null;
}

/**
 * Die Karten einer Runde mit der Art zu antworten: `schwer` schreibt jede, die sich schreiben lässt; sonst die, deren
 * Key in `schreiben` steht (beim letzten Mal richtig). Die übrigen bleiben, wie sie sind.
 */
export function mitSchreiben(art: SpielArt, karten: SpielKarte[], o: { schwer?: boolean; schreiben?: Set<string> }): SpielKarte[] {
  if (!hatSchreiben(art)) return karten;
  return karten.map((k) => {
    if (!o.schwer && !o.schreiben?.has(k.key)) return k;
    const form = schreibForm(art, k);
    return form && form !== k.form ? { ...k, form } : k;
  });
}

// ---------- Prüfen ----------

/** Für den strengen Vergleich: klein, ein Leerzeichen, gleiche Apostrophe und Bindestriche, ohne Punkt am Ende. */
export function schreibGlatt(s: string, englisch = false): string {
  let t = s
    .normalize("NFC")
    .replace(/[‘’`´ʼ]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[„“”"«»]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?,;:]+$/, "")
    .trim();
  if (englisch) t = langform(t).replace(/\bcan not\b/gi, "cannot");
  return t.toLocaleLowerCase("de-AT");
}

/** Für die Toleranz: dazu Umlaute als ae/oe/ue, ß als ss, ohne Artikel vorne, nur Buchstaben und Ziffern. */
export function schreibLocker(s: string, englisch = false): string {
  let t = schreibGlatt(s, englisch).replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  for (let i = 0; i < 2; i++) t = t.replace(/^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|the|a|an|to)\s+/, "");
  return t.replace(/[^\p{L}\p{N}]/gu, "");
}

/** Wie viele Buchstaben man ändern muss (einfügen, löschen, ersetzen, zwei nebeneinander tauschen). */
export function abstand(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array<number>(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++)
    for (let j = 1; j <= y.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[x.length][y.length];
}

/**
 * Stimmt das Geschriebene? `richtig`: die Antwort (und `auch`: andere, die ebenso stimmen). `falsche`: die falschen
 * Antworten der Karte, die nie als Tippfehler durchgehen. `streng`: nur Groß/klein, Leerzeichen und Apostrophe sind egal.
 */
export function pruefeSchreiben(eingabe: string, richtig: string, o: { auch?: string[]; falsche?: string[]; streng?: boolean; englisch?: boolean } = {}): SchreibErgebnis {
  const en = !!o.englisch;
  const glatt = schreibGlatt(eingabe, en);
  if (!glatt) return "falsch";
  const gut = [richtig, ...(o.auch ?? [])];
  if (gut.some((g) => schreibGlatt(g, en) === glatt)) return "richtig";
  // Silbentrennung („Kin-der“): der Strich ist die Antwort
  if (o.streng || /\p{L}-\p{L}/u.test(richtig)) return "falsch";
  const e = schreibLocker(eingabe, en);
  if (!e) return "falsch";
  const falsche = (o.falsche ?? []).map((f) => schreibLocker(f, en)).filter((f) => f && !gut.some((g) => schreibLocker(g, en) === f));
  if (falsche.includes(e)) return "falsch";
  let best = Infinity;
  let ziel = "";
  for (const g of gut) {
    const l = schreibLocker(g, en);
    if (l === e) return "fast";
    const d = abstand(e, l);
    if (d < best) [best, ziel] = [d, l];
  }
  // Zahlen und kurze Wörter müssen genau stimmen
  if (!ziel || /\p{N}/u.test(ziel)) return "falsch";
  const darf = [...ziel].length >= 12 ? 2 : [...ziel].length >= 5 ? 1 : 0;
  if (best > darf) return "falsch";
  // näher an einer falschen Antwort (oder gleich nah): kein Tippfehler, sondern die falsche Antwort
  if (falsche.some((f) => abstand(e, f) <= best)) return "falsch";
  return "fast";
}

/** Prüft das Geschriebene für eine Karte dieses Spiels. */
export function pruefeKarte(art: SpielArt, karte: SpielKarte, eingabe: string): SchreibErgebnis {
  return pruefeSchreiben(eingabe, karte.einsatz && art !== "fehler" ? karte.einsatz : karte.richtig, {
    auch: [...(karte.einsatz ? [karte.richtig] : []), ...(karte.auch ?? [])],
    falsche: karte.faecher.filter((f) => f !== karte.richtig),
    streng: schreibStreng(art),
    englisch: schreibEnglisch(art),
  });
}

// ---------- was zum Schreiben kommt ----------

/** Eine Karte einer beendeten Runde: ihr Key, wie sie beantwortet wurde und ob richtig. */
export type SchreibSpur = { key: string; form?: SpielForm; richtig: boolean };

/**
 * Der Stand jeder Karte aus den beendeten Runden (älteste zuerst): `schreiben` die Keys, deren letzte Antwort richtig
 * war (sie kommen zum Schreiben), `offen` davon die, die noch nie geschrieben richtig waren (die ältesten zuerst; sie
 * dürfen vorgezogen werden).
 */
export function schreibStand(runden: SchreibSpur[][]): { schreiben: Set<string>; offen: string[] } {
  const letzte = new Map<string, boolean>();
  const geschrieben = new Set<string>();
  const zuerst = new Map<string, number>();
  let n = 0;
  for (const r of runden)
    for (const s of r) {
      letzte.set(s.key, s.richtig);
      if (s.richtig && (s.form === "schreiben" || s.form === "tippen")) geschrieben.add(s.key);
      if (s.richtig && !geschrieben.has(s.key)) zuerst.set(s.key, n++);
      if (!s.richtig) zuerst.delete(s.key);
    }
  const schreiben = new Set([...letzte].filter(([, ok]) => ok).map(([k]) => k));
  const offen = [...zuerst.entries()]
    .filter(([k]) => schreiben.has(k) && !geschrieben.has(k))
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => k);
  return { schreiben, offen };
}

/** So viele Karten, die mit Auswahl richtig waren, holt eine Runde zum Schreiben vor. */
export const ZUM_SCHREIBEN_JE_RUNDE = 2;
