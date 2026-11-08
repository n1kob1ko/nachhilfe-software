/**
 * Die Regeln von „Einheit aus Text übernehmen“ (lib/einheit-aus-text.ts) ohne Datenbank: was ein Entwurf ist, wie die
 * Antwort der KI geprüft wird und was die App ohne KI aus dem Text macht.
 */
import { ERROR_TYPES, type ErrorType } from "./error-types";

/** So viel Text liest die App höchstens. */
export const MAX_TEXT = 6000;
/** So viele Fehler und geübte Fähigkeiten übernimmt ein Entwurf höchstens. */
export const MAX_FEHLER = 15;
export const MAX_FAEHIGKEITEN = 8;

export type EntwurfFehler = { text: string; skillId: string | null; fehlerart: ErrorType | null };
export type EntwurfPruefung = { art: string; punkte: number | null; max: number | null; note: number | null; teile: string[] };
export type EinheitEntwurf = {
  fach: string | null;
  thema: string;
  /** JJJJ-MM-TT, nur wenn es im Text steht */
  datum: string | null;
  gemacht: string[];
  fehler: EntwurfFehler[];
  gut: string[];
  verstaendnis: number | null;
  skillIds: string[];
  beobachtungen: string;
  naechstesMal: string;
  pruefung: EntwurfPruefung | null;
  /** ohne KI: die App hat den Text nur in Zeilen geteilt */
  ohneKi: boolean;
};

/** Was die KI liefert (lib/ai/einheit-text.ts), ohne die Abhängigkeit von zod hier. */
export type EinheitGelesen = {
  fach: string | null;
  thema: string;
  datum: string | null;
  gemacht: string[];
  fehler: { text: string; faehigkeit: string | null; fehlerart: string | null }[];
  gut: string[];
  verstaendnis: number | null;
  faehigkeiten: string[];
  beobachtungen: string;
  naechstes_mal: string;
  pruefung: { art: string; punkte: number | null; max: number | null; note: number | null; teile: string[] } | null;
};

const zeile = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
const zeilen = (a: unknown, max: number, anzahl: number) => (Array.isArray(a) ? a.map((x) => zeile(x, max)).filter(Boolean).slice(0, anzahl) : []);
const istFehlerart = (x: unknown): x is ErrorType => ERROR_TYPES.some((e) => e.key === x);
const zahl = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.round(x * 2) / 2 : null);

/** Ein echtes Datum JJJJ-MM-TT, sonst null. */
export function istTag(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Prüft die Antwort der KI: nur Fächer des Schülers, nur bekannte Fähigkeiten und Fehlerarten, Verständnis und Note 1 bis 5,
 * nicht mehr Punkte als möglich, kein Datum in der Zukunft, kurze Zeilen.
 */
export function entwurfAusGelesen(g: EinheitGelesen, o: { faecher: string[]; erlaubt: Set<string>; heute: string }): EinheitEntwurf {
  const fach = o.faecher.find((f) => f.toLowerCase() === (g.fach ?? "").trim().toLowerCase()) ?? null;
  const skill = (id: unknown) => (typeof id === "string" && o.erlaubt.has(id) ? id : null);
  const fehler: EntwurfFehler[] = [];
  for (const f of Array.isArray(g.fehler) ? g.fehler : []) {
    const text = zeile(f?.text, 200);
    if (!text || fehler.some((x) => x.text.toLowerCase() === text.toLowerCase())) continue;
    fehler.push({ text, skillId: skill(f.faehigkeit), fehlerart: istFehlerart(f.fehlerart) ? f.fehlerart : null });
  }
  const skillIds = [...new Set((Array.isArray(g.faehigkeiten) ? g.faehigkeiten : []).map(skill).filter((x): x is string => Boolean(x)))].slice(0, MAX_FAEHIGKEITEN);
  const v = typeof g.verstaendnis === "number" ? Math.round(g.verstaendnis) : null;
  let pruefung: EntwurfPruefung | null = null;
  if (g.pruefung) {
    const punkte = zahl(g.pruefung.punkte);
    const max = zahl(g.pruefung.max) || null;
    const note = typeof g.pruefung.note === "number" && Number.isInteger(g.pruefung.note) && g.pruefung.note >= 1 && g.pruefung.note <= 5 ? g.pruefung.note : null;
    const teile = zeilen(g.pruefung.teile, 80, 12);
    const stimmt = punkte == null || max == null || punkte <= max;
    if ((punkte != null || note != null || teile.length) && stimmt) pruefung = { art: zeile(g.pruefung.art, 40) || "Schularbeit", punkte, max, note, teile };
  }
  return {
    fach,
    thema: zeile(g.thema, 120),
    datum: istTag(g.datum) && g.datum <= o.heute ? g.datum : null,
    gemacht: zeilen(g.gemacht, 300, 20),
    fehler: fehler.slice(0, MAX_FEHLER),
    gut: zeilen(g.gut, 200, 10),
    verstaendnis: v != null && v >= 1 && v <= 5 ? v : null,
    skillIds,
    beobachtungen: typeof g.beobachtungen === "string" ? g.beobachtungen.trim().slice(0, 1500) : "",
    naechstesMal: typeof g.naechstes_mal === "string" ? g.naechstes_mal.trim().slice(0, 1500) : "",
    pruefung,
    ohneKi: false,
  };
}

/** Ohne KI: jede Zeile des Texts (ohne Aufzählungszeichen) unter „Was wurde gemacht?“, sonst nichts. */
export function regelEntwurf(text: string): EinheitEntwurf {
  const gemacht = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 40);
  return { fach: null, thema: "", datum: null, gemacht, fehler: [], gut: [], verstaendnis: null, skillIds: [], beobachtungen: "", naechstesMal: "", pruefung: null, ohneKi: true };
}

/** „Was wurde gemacht?“ als Text: ein Punkt je Zeile. */
export const gemachtText = (e: EinheitEntwurf) => e.gemacht.join("\n");
/** Die Beobachtungen mit dem, was gut lief. */
export function beobachtungenText(e: EinheitEntwurf): string {
  const gut = e.gut.length ? `Gut lief: ${e.gut.join("; ")}` : "";
  return [e.beobachtungen, gut].filter(Boolean).join("\n");
}
/** Die Teile und Punkte einer Prüfung als eine Zeile für die Notiz der Prüfung. */
export function pruefungNotiz(p: EntwurfPruefung): string {
  const gesamt = p.punkte != null && p.max != null ? `${fmt(p.punkte)}/${fmt(p.max)} Punkte` : "";
  return [gesamt, ...p.teile].filter(Boolean).join(" · ");
}
const fmt = (n: number) => String(n).replace(".", ",");
