/**
 * „Vokabel-Paare“: die Karten des Englisch-Lernspiels aus Vokabellisten (eigene Listen des Schülers oder eine
 * Themenliste, lib/vokabeln-themen.ts). Hier steht nur Reines (Karte bauen, Runde und Bretter zusammenstellen),
 * damit es sich ohne Datenbank testen lässt; welche Liste dran ist, steht in lib/lernspiele.ts.
 *
 * Eine Runde hat bis zu zwölf Wortpaare. Auf einem Brett stehen links englische und rechts deutsche Wörter; je
 * zwei gehören zusammen. Darum dürfen sich die Wörter einer Runde nicht überschneiden: „big“ und „large“ (beide
 * „groß“) kommen nie in dieselbe Runde, sonst gäbe es zwei richtige Paare.
 */
import type { SpielKarte } from "./lernspiele-typen";
import type { Vokabel } from "./vokabeln";
import { schluesselEn, teileDe } from "./vokabeln-pruefen";

type Rng = () => number;

/** So viele Wortpaare hat eine Runde höchstens. */
export const PAARE_JE_RUNDE = 12;
/** Ab so vielen brauchbaren Wörtern spielt man die eigenen Listen (darunter eine Themenliste). */
export const PAARE_MIN = 4;
/** Längere Wörter und Wendungen passen nicht auf ein Kärtchen und bleiben für die Übungen. */
const MAX_ZEICHEN = 32;
/** Höchstens so viele Karten aus früheren Fehlern kommen in eine neue Runde. */
const WIEDERHOLUNGEN_MAX = 4;

export type VokabelKandidat = {
  karte: SpielKarte;
  stufe: 0 | 1 | 2;
  /** alle englischen und deutschen Formen als Schlüssel: zwei Wörter mit einer gemeinsamen Form vertragen sich nicht */
  en: string[];
  de: string[];
};

export const vokabelKey = (v: Pick<Vokabel, "en" | "de">) => `vokabeln:${v.en[0].toLowerCase()}=${v.de[0].toLowerCase()}`;

/** Der Beispielsatz ohne die Sternchen um das Wort. */
const satzOhneMarke = (s: string | undefined) => (s ?? "").replace(/\*/g, "").trim();

export function vokabelKarte(v: Vokabel, skill: string): SpielKarte {
  return {
    key: vokabelKey(v),
    form: "paar",
    skill,
    wort: v.en[0],
    vor: "",
    nach: "",
    faecher: [],
    richtig: v.de[0],
    loesung: `${v.en[0]} = ${v.de[0]}`,
    regel: satzOhneMarke(v.satz),
  };
}

/** Die spielbaren Wörter einer Liste, jedes Paar einmal; `skill` ist das Thema oder die eigenen Listen. */
export function vokabelKandidaten(woerter: Vokabel[], skill: string): VokabelKandidat[] {
  const gesehen = new Set<string>();
  const out: VokabelKandidat[] = [];
  for (const v of woerter) {
    const en = v.en[0]?.trim();
    const de = v.de[0]?.trim();
    if (!en || !de || en.length > MAX_ZEICHEN || de.length > MAX_ZEICHEN) continue;
    const karte = vokabelKarte(v, skill);
    if (gesehen.has(karte.key)) continue;
    gesehen.add(karte.key);
    out.push({
      karte,
      stufe: v.stufe ?? 1,
      en: v.en.map((x) => schluesselEn(x)).filter(Boolean),
      de: v.de.map((x) => teileDe(x).key).filter(Boolean),
    });
  }
  return out;
}

const ueberschneidet = (a: VokabelKandidat, b: VokabelKandidat) => a.en.some((x) => b.en.includes(x)) || a.de.some((x) => b.de.includes(x));

function mischen<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Eine Runde: zuerst Wörter, die zuletzt falsch waren (`wiederholen`, höchstens vier), dann neue. Aus den passenden
 * Stufen zuerst die, die in den letzten Runden nicht dran waren (`zuletzt`); reicht das nicht, die übrigen.
 * `vorrang` sind Wörter, die zuerst kommen sollen (die neueste eigene Liste): bis zu zwei Drittel der Runde.
 */
export function waehleVokabeln(
  pool: VokabelKandidat[],
  o: { stufen?: (0 | 1 | 2)[]; wiederholen?: string[]; zuletzt?: string[]; vorrang?: Set<string>; rng?: Rng; anzahl?: number } = {},
): SpielKarte[] {
  const rng = o.rng ?? Math.random;
  const anzahl = Math.min(o.anzahl ?? PAARE_JE_RUNDE, pool.length);
  const byKey = new Map(pool.map((k) => [k.karte.key, k]));
  const gewaehlt: VokabelKandidat[] = [];
  const passt = (k: VokabelKandidat) => !gewaehlt.some((g) => g.karte.key === k.karte.key || ueberschneidet(g, k));

  for (const key of o.wiederholen ?? []) {
    const k = byKey.get(key);
    if (k && gewaehlt.length < Math.min(WIEDERHOLUNGEN_MAX, anzahl) && passt(k)) gewaehlt.push(k);
  }

  const zuletzt = new Set(o.zuletzt ?? []);
  const inStufe = (k: VokabelKandidat) => !o.stufen || o.stufen.includes(k.stufe);
  const frisch = (k: VokabelKandidat) => !zuletzt.has(k.karte.key);
  const gaenge: { nimm: (k: VokabelKandidat) => boolean; bis: number }[] = [
    ...(o.vorrang?.size ? [{ nimm: (k: VokabelKandidat) => o.vorrang!.has(k.karte.key) && inStufe(k) && frisch(k), bis: Math.ceil((anzahl * 2) / 3) }] : []),
    { nimm: (k) => inStufe(k) && frisch(k), bis: anzahl },
    { nimm: inStufe, bis: anzahl },
    { nimm: frisch, bis: anzahl },
    { nimm: () => true, bis: anzahl },
  ];
  for (const g of gaenge) {
    for (const k of mischen(pool.filter(g.nimm), rng)) {
      if (gewaehlt.length >= g.bis) break;
      if (passt(k)) gewaehlt.push(k);
    }
    if (gewaehlt.length >= anzahl) break;
  }
  return mischen(gewaehlt, rng).map((k) => k.karte);
}

/** Welche Stufen einer Themenliste in eine Runde kommen: nach Schulstufe und Lernstand des Themas. */
export function vokabelStufen(schulstufe: number, volksschule: boolean, lernstand: number | null): (0 | 1 | 2)[] {
  let bis = volksschule ? (schulstufe <= 3 ? 0 : 1) : schulstufe <= 5 ? 1 : 2;
  if (lernstand !== null && lernstand < 0.5) bis = Math.max(0, bis - 1);
  if (lernstand !== null && lernstand >= 0.75) bis = Math.min(2, bis + 1);
  return ([0, 1, 2] as const).filter((s) => s <= bis);
}
