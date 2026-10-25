/**
 * **Anpassung im Unterricht** (niko, 25.10.2026: „Lernheft reagiert auf die Antworten des Schülers, zuerst nach
 * Regeln, KI nur wenn nötig“): die festen Regeln, ohne Datenbank und ohne KI. Aus den letzten Antworten auf die
 * gerade gesendete Übung (richtig oder falsch, Hilfen, Zeit, Fehlerart), dem Lernstand und den Fähigkeiten von heute
 * wird höchstens **ein Vorschlag** mit Grund, z. B. „2 Fehler: Kehrwert vergessen“ → Leichtere Aufgabe senden.
 *
 * Schwellen (bewusst einfach, docs/heute-unterricht-abschluss.md › Anpassung im Unterricht):
 * - **Leichter**: mindestens `FEHLER_AB` (2) falsche unter den letzten `FENSTER` (5) Antworten einer Fähigkeit. Dieselbe
 *   Fehlerart zweimal steht im Grund; kann ein Generator Aufgaben genau zu diesem Fehler bauen (Fehler korrigieren),
 *   kommt „Aufgabe zu diesem Fehler“ zuerst. Auf der leichtesten Stufe: eine nicht sichere Voraussetzung aus dem
 *   Fähigkeitsgraphen, sonst „Einfacher erklären“.
 * - **An der Tafel**: Hilfen bei mehr als der Hälfte (`HILFEN_ANTEIL`) von mindestens `HILFEN_AB` (2) Aufgaben. Keine Aufgabe.
 * - **Schwerer / Weiter**: mindestens `RICHTIG_AB` (3) Aufgaben (bei kürzeren Übungen alle) im ersten Versuch richtig,
 *   ohne Hilfe. Schnell (Median bis `SCHNELL_MS`, 60 s je Aufgabe) → Schwerere Aufgabe, sonst Weiter zum nächsten Schritt.
 * - **Zeichen des Lehrers** („Schüler versteht es nicht“, „Falsch“ bei einer Frage): derselbe leichtere Weg.
 * - Nichts gesendet, noch keine Antwort: kein Vorschlag.
 *
 * Es bleibt bei den Fähigkeiten von heute: Vorgabe für heute vor der Fähigkeit des Schritts vor dem Prüfungsstoff
 * (`heute`). Eine Voraussetzung einer Fähigkeit von heute gehört dazu.
 */
import { difficultyFor, levelOf } from "./curriculum";

/** So viele letzte Antworten je Fähigkeit zählen. */
export const FENSTER = 5;
/** Ab so vielen falschen darin: leichter. */
export const FEHLER_AB = 2;
/** Hilfen bei mehr als diesem Anteil der Aufgaben: gemeinsam an der Tafel … */
export const HILFEN_ANTEIL = 0.5;
/** … sobald mindestens so viele Aufgaben bearbeitet sind. */
export const HILFEN_AB = 2;
/** So viele Aufgaben im ersten Versuch richtig ohne Hilfe (kürzere Übung: alle): schwerer oder weiter. */
export const RICHTIG_AB = 3;
/** Schnell: Median der Zeit je Aufgabe bis hier. */
export const SCHNELL_MS = 60_000;
/** Ab diesem Lernstand gilt eine Voraussetzung als sicher genug (lib/mastery.ts „gut“). */
export const SICHER_AB = 0.7;

/** Eine Antwort des Schülers auf eine Aufgabe der gesendeten Übung (attempts), älteste zuerst. */
export type Antwort = {
  taskId: number;
  skillId: string | null;
  correct: boolean;
  hints: number;
  timeMs: number;
  solutionViewed: boolean;
  /** Fehlerart (lib/error-types.ts) */
  errorType: string | null;
  /** das Fehler-Etikett der Aufgabe, z. B. „Kehrwert vergessen“ */
  errorLabel: string | null;
};

export type Art = "leichter" | "voraussetzung" | "fehler" | "erklaeren" | "tafel" | "schwerer" | "weiter";
/** Eine Möglichkeit: mit Aufgabe (Fähigkeit und Stufe 1–5) oder ohne. `fokus`: welcher Fehler geübt werden soll. */
export type Option = { art: Art; skillId: string | null; level: number | null; fokus: string | null };
/** Wodurch der Vorschlag kam: die Antworten am Gerät oder ein Zeichen des Lehrers zum Schritt. */
export type Ausloeser = "antworten" | "lehrer";
export type Vorschlag = { grund: string; ausloeser: Ausloeser; haupt: Option; andere: Option[] };

/** Arten mit einer Aufgabe zum Senden. */
export const MIT_AUFGABE: readonly Art[] = ["leichter", "voraussetzung", "fehler", "schwerer"];

export type Lage = {
  /** Antworten auf die aktuelle Übung seit der letzten Reaktion, älteste zuerst */
  antworten: Antwort[];
  /** Aufgaben der aktuellen Übung (0: keine gesendet) */
  aufgaben: number;
  /** die Fähigkeit des Schritts auf dem Schirm (sonst die der aktuellen Übung) */
  skillId: string | null;
  /** bekannte Stufe 1–5 je Fähigkeit: aus den Aufgaben der aktuellen Übung, sonst aus dem Lernpaket; fehlt sie, gilt der Lernstand */
  stufen: Record<string, number>;
  /** die Fähigkeiten von heute, je Quelle in dieser Reihenfolge */
  heute: { vorgabe: string[]; schritt: string[]; pruefung: string[] };
  /** Voraussetzungen je Fähigkeit (Fähigkeitsgraph) */
  voraussetzungen: Record<string, string[]>;
  /** Lernstand je Fähigkeit (0–1, null: nicht getestet) */
  lernstand: Record<string, number | null>;
  /** gibt es zum Schritt etwas zum Erklären (Bei Fehler, Erklärung, typische Fehler)? */
  hilfe: boolean;
  /** gibt es nach dem Schritt einen offenen? */
  naechsterSchritt: boolean;
  /** Fähigkeiten, zu denen ein Generator Aufgaben zu einem Fehler bauen kann (Fehler korrigieren) */
  fehlerAufgaben: string[];
  /** das Zeichen des Lehrers zum Schritt auf dem Schirm */
  lehrer: "nicht_verstanden" | "falsch" | null;
};

const uniq = <T>(xs: T[]) => [...new Set(xs)];

/** Die Fähigkeiten von heute in ihrer Reihenfolge: Vorgabe, Schritt, Prüfungsstoff. */
export const heuteListe = (h: Lage["heute"]) => uniq([...h.vorgabe, ...h.schritt, ...h.pruefung]);

/**
 * Die Fähigkeit, für die vorgeschlagen wird: die der Antworten, wenn sie zu heute gehört (oder eine Voraussetzung einer
 * Fähigkeit von heute ist), sonst die erste von heute. Ohne Fähigkeiten von heute bleibt es die der Antworten.
 */
export function zielSkill(skillId: string | null, l: Pick<Lage, "heute" | "voraussetzungen">): string | null {
  const heute = heuteListe(l.heute);
  if (!heute.length) return skillId;
  if (skillId && (heute.includes(skillId) || heute.some((h) => (l.voraussetzungen[h] ?? []).includes(skillId)))) return skillId;
  return heute[0];
}

/** Die Stufe, die zum Lernstand passt (wie „automatisch an Schüler anpassen“). */
export const stufeAus = (mastery: number | null | undefined) => levelOf(difficultyFor(mastery ?? null));

const falsch = (a: Antwort) => !a.correct || a.solutionViewed;

/** Der Fehler, der mindestens zweimal kam: sein Etikett („Kehrwert vergessen“), sonst die Fehlerart. */
export function wiederholterFehler(xs: Antwort[]): { text: string; typ: string | null } | null {
  const zaehle = (key: (a: Antwort) => string | null) => {
    const m = new Map<string, number>();
    for (const a of xs.filter(falsch)) {
      const k = key(a)?.trim();
      if (k && k !== "unbekannt") m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  const label = zaehle((a) => a.errorLabel);
  if (label) return { text: label, typ: xs.find((a) => a.errorLabel?.trim() === label)?.errorType ?? null };
  const typ = zaehle((a) => a.errorType);
  return typ ? { text: typ, typ } : null;
}

/**
 * Der leichtere Weg für eine Fähigkeit: Aufgabe zum Fehler (wenn ein Generator das kann), eine Stufe leichter, eine nicht
 * sichere Voraussetzung (die von heute zuerst, dann die schwächste), Einfacher erklären. Die erste ist der Vorschlag.
 */
export function leichtererWeg(l: Lage, skillId: string | null, level: number, fehler: { text: string; typ: string | null } | null, o: { erklaeren: boolean }): Option[] {
  const out: Option[] = [];
  const fokus = fehler?.text ?? null;
  if (skillId && fehler && l.fehlerAufgaben.includes(skillId)) out.push({ art: "fehler", skillId, level, fokus });
  if (skillId && level > 1) out.push({ art: "leichter", skillId, level: level - 1, fokus });
  const heute = heuteListe(l.heute);
  const ms = (id: string) => l.lernstand[id] ?? null;
  const voraus = (skillId ? (l.voraussetzungen[skillId] ?? []) : [])
    .filter((id) => (ms(id) ?? 0) < SICHER_AB)
    .sort((a, b) => Number(heute.includes(b)) - Number(heute.includes(a)) || (ms(a) ?? 0.5) - (ms(b) ?? 0.5))[0];
  if (voraus) out.push({ art: "voraussetzung", skillId: voraus, level: stufeAus(ms(voraus)), fokus: null });
  if (o.erklaeren && l.hilfe) out.push({ art: "erklaeren", skillId, level: null, fokus: null });
  return out;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

const sekunden = (ms: number) => `${Math.max(1, Math.round(ms / 1000))} s`;

const vorschlag = (grund: string, ausloeser: Ausloeser, optionen: Option[]): Vorschlag | null => (optionen.length ? { grund, ausloeser, haupt: optionen[0], andere: optionen.slice(1) } : null);

/** Höchstens ein Vorschlag aus den Regeln oben, mit Grund in einfachen Worten; null, wenn nichts zu tun ist. */
export function schlageVor(l: Lage): Vorschlag | null {
  const levelVon = (skillId: string | null) => (skillId && l.stufen[skillId]) || stufeAus(skillId ? l.lernstand[skillId] : null);

  // 1. Fehler: die Fähigkeit mit den meisten falschen in ihren letzten Antworten
  const jeSkill = new Map<string, Antwort[]>();
  for (const a of l.antworten) {
    const k = a.skillId ?? l.skillId ?? "";
    jeSkill.set(k, [...(jeSkill.get(k) ?? []), a]);
  }
  const schlimmste = [...jeSkill]
    .map(([k, xs]) => ({ skill: k || null, xs: xs.slice(-FENSTER) }))
    .map((x) => ({ ...x, falsch: x.xs.filter(falsch).length }))
    .sort((a, b) => b.falsch - a.falsch)[0];
  if (schlimmste && schlimmste.falsch >= FEHLER_AB) {
    const fehler = wiederholterFehler(schlimmste.xs);
    const skill = zielSkill(schlimmste.skill, l);
    const level = levelVon(skill);
    const weg = leichtererWeg(l, skill, level, fehler, { erklaeren: true });
    const leichteste = level <= 1 && !weg.some((o) => o.art === "fehler") ? ", schon die leichteste Stufe" : "";
    const v = vorschlag(`${schlimmste.falsch} Fehler${fehler ? `: ${fehler.text}` : ""}${leichteste}`, "antworten", weg);
    if (v) return v;
  }

  // 2. Zeichen des Lehrers: „Schüler versteht es nicht“ (die Hilfe steht schon da) oder „Falsch“ bei einer Frage
  if (l.lehrer) {
    const skill = zielSkill(l.skillId, l);
    const weg = leichtererWeg(l, skill, levelVon(skill), null, { erklaeren: l.lehrer === "falsch" });
    const v = vorschlag(l.lehrer === "falsch" ? "Frage falsch beantwortet" : "Schüler versteht es nicht", "lehrer", weg);
    if (v) return v;
  }

  // je Aufgabe: der erste Versuch, Hilfen, Zeit
  const aufgaben = new Map<number, Antwort[]>();
  for (const a of l.antworten) aufgaben.set(a.taskId, [...(aufgaben.get(a.taskId) ?? []), a]);
  const bearbeitet = [...aufgaben.values()];
  const n = bearbeitet.length;

  // 3. Hilfen bei den meisten Aufgaben: gemeinsam an der Tafel erklären, ohne neue Aufgabe
  const mitHilfe = bearbeitet.filter((xs) => xs.some((a) => a.hints > 0)).length;
  if (n >= HILFEN_AB && mitHilfe / n > HILFEN_ANTEIL) {
    const skill = zielSkill(l.antworten[0]?.skillId ?? l.skillId, l);
    const level = levelVon(skill);
    const andere: Option[] = skill && level > 1 ? [{ art: "leichter", skillId: skill, level: level - 1, fokus: null }] : [];
    return { grund: `Hilfe bei ${mitHilfe} von ${n} Aufgaben`, ausloeser: "antworten", haupt: { art: "tafel", skillId: skill, level: null, fokus: null }, andere };
  }

  // 4. alles im ersten Versuch richtig, ohne Hilfe: schwerer, wenn es schnell ging, sonst weiter
  const genug = Math.min(RICHTIG_AB, Math.max(1, l.aufgaben));
  const gut = bearbeitet.every((xs) => xs[0].correct && !xs[0].solutionViewed && xs.every((a) => a.hints === 0));
  if (n >= genug && gut) {
    const skill = zielSkill(l.antworten[0]?.skillId ?? l.skillId, l);
    const level = levelVon(skill);
    const zeit = median(bearbeitet.map((xs) => xs[0].timeMs));
    const schnell = zeit > 0 && zeit <= SCHNELL_MS;
    const schwerer: Option | null = skill && level < 5 ? { art: "schwerer", skillId: skill, level: level + 1, fokus: null } : null;
    const weiter: Option | null = l.naechsterSchritt ? { art: "weiter", skillId: null, level: null, fokus: null } : null;
    const reihe = (schnell ? [schwerer, weiter] : [weiter, schwerer]).filter((o): o is Option => o !== null);
    return vorschlag(`${n} von ${n} richtig${schnell ? `, schnell (je Aufgabe ${sekunden(zeit)})` : ""}`, "antworten", reihe);
  }
  return null;
}

// ---------- woher die Aufgabe kommt: A → B → C ----------

/** A: vorhandene Aufgaben (Paket, freigegebene Übungen, Bibliothek), B: Generatoren und Banken, C: neue Aufgaben der KI. */
export type Quelle = "A" | "B" | "C";

/** Darf die KI jetzt (C)? Sonst warum nicht, in einem Satz. */
export type KiTor = { erlaubt: true; kosten: string } | { erlaubt: false; grund: string };

/**
 * Woher eine Aufgabe kommt: zuerst A, dann B. C nur, wenn A und B nichts Passendes haben; gesperrt (KI aus, Budget,
 * Grenze des Schülers, manueller Modus) steht C mit dem Grund da und lässt sich nicht tippen.
 */
export function quelleFuer(o: { bestand: number; generator: boolean; ki: KiTor }): { quelle: Quelle; gesperrt: string | null } {
  if (o.bestand > 0) return { quelle: "A", gesperrt: null };
  if (o.generator) return { quelle: "B", gesperrt: null };
  return { quelle: "C", gesperrt: o.ki.erlaubt ? null : o.ki.grund };
}
