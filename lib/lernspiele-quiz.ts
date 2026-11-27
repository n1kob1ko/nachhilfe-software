/**
 * Das Quiz je Fach (niko 2026-11-17: „spiele sind da was fehlt ist stoff“): große Fragensammlungen ohne KI, je Thema des
 * Lehrplans (lib/themen) eigene Karten. Mathe-Quiz, Deutsch-Quiz und Englisch-Quiz sind Themenspiele wie „Kopfrechnen“:
 * jede Runde spielt ein Thema, das aus dem Stoff des Schülers (Prüfung, aktueller Stoff, letzte Einheit), sonst das
 * nächste seiner Schulstufe (`themenPlan` in lib/lernspiele.ts). Blockwerk, Funkelfeld und Torlauf holen sich ihre
 * Fragen so auch zu Pythagoras, Kurvendiskussion oder Erörterung.
 *
 * Die Fragen stehen als Text in lib/quiz/*.ts, geschrieben wie die Spielkarten der Lehrkraft (lib/spielkarten-text.ts):
 * `Frage = richtig | falsch | falsch`, `___` ist die Lücke, `Merke: …` darunter erscheint nach einem Fehler. Eine Zeile
 * `# schwer` trennt die leichten Karten (Stufe 1) von den schweren (Stufe 2): wer unsicher ist, bekommt die leichten.
 * Rechen-Themen haben dazu Erzeuger (`erzeuge`), die mit festem Zufall immer dieselben, aber viele Karten bauen. Ein
 * Gleichheitszeichen in einer Antwort steht im Text als „＝“ (sonst trennte es Frage und Antworten), im Spiel als „=“.
 *
 * Nur Reines (keine Datenbank), damit es sich testen lässt.
 */
import type { Stufe } from "./banken-regeln";
import type { Kandidat } from "./lernspiele-karten";
import { festerZufall, zahlAus, type SpielArt, type SpielKarte, type SpielThema } from "./lernspiele-typen";
import { alsSpielKarte, leseKarten, type EigeneKarte } from "./spielkarten-text";
import { THEMEN } from "./themen";
import { QUIZ_DEUTSCH } from "./quiz/deutsch";
import { QUIZ_ENGLISCH } from "./quiz/englisch";
import { QUIZ_MATHE } from "./quiz/mathe";

/** Ein Erzeuger baut Karten mit dem festen Zufall; jede Karte ist eine Zeile wie im Text. */
export type QuizErzeuger = (rng: () => number) => EigeneKarte[];
/** Die Fragen eines Themas: Text wie bei den Spielkarten, dazu wahlweise ein Erzeuger. */
export type QuizEintrag = { text?: string; erzeuge?: QuizErzeuger; /** so viele Karten baut der Erzeuger (Standard 40) */ anzahl?: number };
export type QuizBank = Record<string, QuizEintrag | string>;

export const QUIZ_ARTEN = ["quizmathe", "quizdeutsch", "quizenglisch"] as const satisfies readonly SpielArt[];
export type QuizArt = (typeof QUIZ_ARTEN)[number];
export const istQuiz = (art: SpielArt): art is QuizArt => (QUIZ_ARTEN as readonly string[]).includes(art);

const BANKEN: Record<QuizArt, QuizBank> = { quizmathe: QUIZ_MATHE, quizdeutsch: QUIZ_DEUTSCH, quizenglisch: QUIZ_ENGLISCH };
/** Das Fach der Fähigkeiten eines Quiz (wie in lib/themen). */
export const QUIZ_FACH: Record<QuizArt, string> = { quizmathe: "Mathematik", quizdeutsch: "Deutsch", quizenglisch: "Englisch" };

/** Trennt im Text die leichten Karten von den schweren. */
const SCHWER = /^#\s*schwer\s*$/im;
/** So viele Karten baut ein Erzeuger, wenn das Thema nichts anderes sagt. */
const ERZEUGT = 40;

/** „＝“ in einer Antwort wird zum gewöhnlichen „=“. */
const GLEICH = /＝/g;
function gleich(k: EigeneKarte): EigeneKarte {
  if (k.art !== "wahl") return k;
  return { ...k, frage: k.frage.replace(GLEICH, "="), richtig: k.richtig.replace(GLEICH, "="), falsch: k.falsch.map((f) => f.replace(GLEICH, "=")) };
}

const eintrag = (e: QuizEintrag | string): QuizEintrag => (typeof e === "string" ? { text: e } : e);

/** Die Karten eines Eintrags mit Stufe (Text: vor `# schwer` Stufe 1, danach 2; Erzeuger: Stufe 1 und 2 im Wechsel). */
export function quizKarten(e: QuizEintrag | string, seed = ""): { karte: EigeneKarte; stufe: Stufe }[] {
  const { text = "", erzeuge, anzahl = ERZEUGT } = eintrag(e);
  const teile = text.split(SCHWER);
  const out: { karte: EigeneKarte; stufe: Stufe }[] = teile.flatMap((t, i) => leseKarten(t).karten.map((karte) => ({ karte: gleich(karte), stufe: (i === 0 ? 1 : 2) as Stufe })));
  if (erzeuge) {
    const gesehen = new Set(out.map((k) => k.karte.frage.toLowerCase()));
    const rng = festerZufall(zahlAus(seed) + anzahl);
    const ziel = out.length + anzahl;
    // ein Erzeuger kann dieselbe Aufgabe zweimal würfeln: höchstens dreimal so viele Versuche
    for (let i = 0; i < anzahl * 3 && out.length < ziel; i++) {
      for (const karte of erzeuge(rng)) {
        if (out.length >= ziel) break;
        const f = karte.frage.toLowerCase();
        if (gesehen.has(f)) continue;
        gesehen.add(f);
        out.push({ karte: gleich(karte), stufe: (out.length % 2 ? 2 : 1) as Stufe });
      }
    }
  }
  return out;
}

/** Die Fähigkeiten, zu denen es Quizfragen gibt, je Quiz. */
const SKILLS = new Map<string, QuizArt>(QUIZ_ARTEN.flatMap((art) => Object.keys(BANKEN[art]).map((skill) => [skill, art] as [string, QuizArt])));
export const hatQuiz = (skill: string) => SKILLS.has(skill);
export const quizArtVon = (skill: string): QuizArt | undefined => SKILLS.get(skill);

const karten = new Map<string, { karte: EigeneKarte; stufe: Stufe }[]>();
/** Die Karten eines Themas, wie sie im Text stehen (für Übungen ohne KI, lib/generators.ts `quizAufgabe`); leer ohne Quiz. */
export function quizKartenZur(skill: string): { karte: EigeneKarte; stufe: Stufe }[] {
  let k = karten.get(skill);
  if (!k) {
    const art = SKILLS.get(skill);
    const e = art ? BANKEN[art][skill] : undefined;
    karten.set(skill, (k = e ? quizKarten(e, skill) : []));
  }
  return k;
}

const cache = new Map<string, Kandidat[]>();
/** Alle Karten eines Themas für das Lernspiel (Mathe gesetzt wie in den Übungen). */
export function quizKandidaten(skill: string): Kandidat[] {
  const c = cache.get(skill);
  if (c) return c;
  const art = SKILLS.get(skill);
  const e = art ? BANKEN[art][skill] : undefined;
  const out: Kandidat[] = e
    ? quizKarten(e, skill).map(({ karte, stufe }) => {
        const k: SpielKarte = { ...alsSpielKarte(karte, skill), key: `quiz:${zahlAus(`${skill}|${karte.frage.toLocaleLowerCase("de")}`)}` };
        if (art === "quizmathe") k.mathe = true;
        return { karte: k, stufe };
      })
    : [];
  cache.set(skill, out);
  return out;
}

/** Den Namen eines Themas kürzer für den Schüler: ohne Klammer am Ende („Satz des Pythagoras: fehlende Seite berechnen“). */
const kurzName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;

/**
 * Die Themen eines Quiz in der Reihenfolge des Lehrplans (lib/themen), mit den Schulstufen der Fähigkeit und, wo die
 * Fähigkeit nur in manchen Schularten dran ist, diesen Schularten.
 */
export function quizThemen(art: QuizArt): SpielThema[] {
  const bank = BANKEN[art];
  return THEMEN.filter((t) => bank[t.id] !== undefined).map((t) => ({
    skill: t.id,
    name: kurzName(t.name),
    ab: t.gradeMin,
    bis: t.gradeMax,
    ...(t.schoolTypes?.length ? { schularten: t.schoolTypes } : {}),
  }));
}

export const QUIZ_THEMEN: Record<QuizArt, SpielThema[]> = { quizmathe: quizThemen("quizmathe"), quizdeutsch: quizThemen("quizdeutsch"), quizenglisch: quizThemen("quizenglisch") };
