/**
 * Lernwörter als Text (lib/lernwoerter.ts; niko 2026-11-27, VS-Deutsch-Schularbeit 17.12.: „Lernwörter, das Wort wird
 * vorgelesen und das Kind schreibt es“). Die Lehrkraft schreibt die Liste der Klasse ab, ein Wort pro Zeile; nach einem
 * Doppelpunkt darf ein Satz mit dem Wort stehen, dann kommt das Wort im Spiel als Lücke in diesem Satz.
 *
 *     Fahrrad: Ich fahre mit dem Fahrrad zur Schule.
 *     vielleicht
 *
 * Leere Zeilen und Zeilen mit `#` am Anfang zählen nicht. Geprüft wird streng: jeder Buchstabe, auch groß und klein
 * (das ist bei Lernwörtern der Stoff). Ohne Datenbank, damit die Vorschau im Browser und das Spielfeld dieselben Regeln
 * haben wie der Server.
 */
import type { SpielKarte } from "./lernspiele-typen";

export type LernwortEintrag = { wort: string; satz: string; zeile: number };
export type Meldung = { zeile: number; text: string };
export type GeleseneLernwoerter = { eintraege: LernwortEintrag[]; fehler: Meldung[]; hinweise: Meldung[] };

export const LERNWORT_MAX = 30;
export const LERNWOERTER_MAX = 200;
export const LERNSATZ_MAX = 160;

export const LERNWORT_BEISPIEL = `Fahrrad: Ich fahre mit dem Fahrrad zur Schule.
vielleicht: Es regnet vielleicht morgen.
wieder
Straße`;

/** Für den Vergleich: dieselben Zeichen (NFC), ein Leerzeichen, ohne Satzzeichen am Ende; groß und klein zählen. */
export function lernwortGlatt(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[‘’`´ʼ]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?,;:]+$/, "")
    .trim();
}

/** Stimmt das Geschriebene? Nur, wenn jeder Buchstabe stimmt (auch groß und klein). */
export const lernwortStimmt = (eingabe: string, wort: string) => !!lernwortGlatt(eingabe) && lernwortGlatt(eingabe) === lernwortGlatt(wort);

/** Wo das Wort als ganzes Wort im Satz steht (nicht „Hund“ in „Hunde“); -1, wenn nicht. */
export function stelleImSatz(satz: string, wort: string): number {
  const esc = wort.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(^|[^\\p{L}\\p{N}])(${esc})(?![\\p{L}\\p{N}])`, "u").exec(satz);
  return m ? m.index + m[1].length : -1;
}

/** Liest die Liste; Zeilen mit Fehlern halten das Speichern auf, Hinweise nicht. */
export function leseLernwoerter(text: string): GeleseneLernwoerter {
  const eintraege: LernwortEintrag[] = [];
  const fehler: Meldung[] = [];
  const hinweise: Meldung[] = [];
  const gesehen = new Set<string>();
  text.split(/\r?\n/).forEach((roh, i) => {
    const zeile = i + 1;
    const l = roh.trim();
    if (!l || l.startsWith("#")) return;
    const doppel = l.indexOf(":");
    const wort = lernwortGlatt(doppel >= 0 ? l.slice(0, doppel) : l);
    let satz = doppel >= 0 ? l.slice(doppel + 1).replace(/\s+/g, " ").trim() : "";
    if (!wort) return void fehler.push({ zeile, text: `Zeile ${zeile}: vor dem Doppelpunkt fehlt das Wort.` });
    if ([...wort].length > LERNWORT_MAX) return void fehler.push({ zeile, text: `Zeile ${zeile}: „${wort.slice(0, 20)}…“ ist zu lang für ein Lernwort (höchstens ${LERNWORT_MAX} Zeichen).` });
    if (/\d/.test(wort)) return void fehler.push({ zeile, text: `Zeile ${zeile}: „${wort}“ hat eine Ziffer. Lernwörter sind Wörter.` });
    if (gesehen.has(wort)) return void hinweise.push({ zeile, text: `Zeile ${zeile}: „${wort}“ steht schon weiter oben und kommt nur einmal.` });
    if (satz.length > LERNSATZ_MAX) return void fehler.push({ zeile, text: `Zeile ${zeile}: der Satz ist zu lang (höchstens ${LERNSATZ_MAX} Zeichen).` });
    if (satz && stelleImSatz(satz, wort) < 0) {
      hinweise.push({ zeile, text: `Zeile ${zeile}: „${wort}“ steht nicht genau so im Satz. Das Wort kommt ohne den Satz.` });
      satz = "";
    }
    if (eintraege.length >= LERNWOERTER_MAX) return void fehler.push({ zeile, text: `Höchstens ${LERNWOERTER_MAX} Lernwörter in einer Liste.` });
    gesehen.add(wort);
    eintraege.push({ wort, satz, zeile });
  });
  return { eintraege, fehler, hinweise };
}

export const lernwortKey = (wort: string) => `lw:${lernwortGlatt(wort)}`;

/** Woran man bei diesem Wort denken muss, kurz und nur, was man am Wort sicher sieht. */
export function lernwortRegel(wort: string): string {
  const teile: string[] = [];
  if (/^[A-ZÄÖÜ]/.test(wort) && !/\s/.test(wort)) teile.push("groß am Anfang");
  if (/ie/.test(wort)) teile.push("ie");
  if (/ß/.test(wort)) teile.push("ß");
  if (/ck/.test(wort)) teile.push("ck");
  if (/tz/.test(wort)) teile.push("tz");
  const doppelt = /([bdfglmnprst])\1/i.exec(wort);
  if (doppelt) teile.push(`${doppelt[0].toLowerCase()}`);
  // Dehnungs-h: ein Selbstlaut, dann h vor l, m, n, r oder am Ende (fahren, Uhr, ihm, Kuh; nicht „ch“ in Buch)
  if (/[aeiouäöü]h(?=[lmnr]|$)/i.test(wort)) teile.push("h");
  if (/äu/.test(wort)) teile.push("äu");
  else if (/ä/i.test(wort)) teile.push("ä");
  if (/v/i.test(wort)) teile.push("v");
  const eindeutig = [...new Set(teile)].slice(0, 3);
  return eindeutig.length ? `Achte auf: ${eindeutig.join(", ")}.` : "Schau dir jeden Buchstaben genau an.";
}

/**
 * Die Karte im Spiel „Lernwörter“: mit Satz ist das Wort die Lücke darin, ohne Satz steht nur die Lücke. `zeigen`: das
 * Wort steht zuerst zum Anschauen da (neu oder zuletzt falsch); sonst wird es nur vorgelesen (wie beim Diktat).
 */
export function lernwortKarte(e: Pick<LernwortEintrag, "wort" | "satz">, o: { skill: string; zeigen: boolean }): SpielKarte {
  const i = e.satz ? stelleImSatz(e.satz, e.wort) : -1;
  return {
    key: lernwortKey(e.wort),
    form: "lernwort",
    skill: o.skill,
    vor: i >= 0 ? e.satz.slice(0, i) : "",
    nach: i >= 0 ? e.satz.slice(i + e.wort.length) : "",
    faecher: [],
    richtig: e.wort,
    loesung: i >= 0 ? e.satz : e.wort,
    regel: lernwortRegel(e.wort),
    lernwort: { zeigen: o.zeigen },
  };
}

/**
 * Das richtige Wort, Buchstabe für Buchstabe, mit den Stellen, an denen das Geschriebene anders war (rot im Spiel):
 * ein falscher oder fehlender Buchstabe ist markiert; ein Buchstabe zu viel markiert den Buchstaben dahinter.
 */
export function lernwortVergleich(wort: string, eingabe: string): { z: string; falsch: boolean }[] {
  const a = [...lernwortGlatt(wort)];
  const b = [...lernwortGlatt(eingabe)];
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  const falsch = new Array<boolean>(a.length).fill(false);
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      if (a[i - 1] !== b[j - 1]) falsch[i - 1] = true;
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      falsch[i - 1] = true;
      i--;
    } else {
      // ein Buchstabe zu viel: markiert ist der Buchstabe, vor dem er stand (am Ende der letzte)
      if (a.length) falsch[Math.min(i, a.length - 1)] = true;
      j--;
    }
  }
  return a.map((z, k) => ({ z, falsch: falsch[k] }));
}
