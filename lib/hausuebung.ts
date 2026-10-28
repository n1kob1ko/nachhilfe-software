/**
 * **Hausübung vorbereitet** (E1, niko: „Am Ende jeder Einheit soll Lernheft anhand der tatsächlichen Ergebnisse automatisch eine passende
 * Hausübung vorschlagen. Sie soll sich an den Schwierigkeiten des Schülers orientieren.“ „Bereits vorhandene passende Aufgaben sollen
 * bevorzugt werden.“ „Der Lehrer kann die Hausübung ändern oder überspringen.“ „Keine Hausübung darf ohne ausreichende fachliche
 * Prüfung ungeprüft veröffentlicht werden.“).
 *
 * - Der Vorschlag im Abschluss kommt ohne KI aus den geprüften Ergebnissen dieser Einheit (lib/abschluss.ts `belegeDerEinheit`):
 *   „noch schwierig“ zuerst (etwa 4 Aufgaben), dann „teilweise“ (3–4), „gut verstanden“ höchstens 1–2 zur Wiederholung und nur, wenn es
 *   weniger als zwei schwächere Themen gibt; höchstens `MAX_THEMEN` Themen und `MAX_AUFGABEN` Aufgaben. Wurde heute geschrieben
 *   (Deutsch, Englisch), kommt eine kurze Schreibaufgabe dazu. Antworten unter „Zu bewerten“ zählen nicht.
 * - Woher die Aufgaben kommen, in dieser Reihenfolge: Bibliothek und freigegebene Übungen (nichts, was in dieser Einheit gesendet,
 *   gedruckt oder als Beispiel gezeigt wurde, nichts, was der Schüler in den letzten `KUERZLICH_TAGE` Tagen gelöst hat), dann die
 *   Generatoren und Banken, erst dann die KI (im KI-Budget der Einheit von selbst, sonst auf Tippen mit Kosten; „neu erstellt, ungeprüft“).
 * - Bis die Lehrkraft etwas ändert, wird der Vorschlag bei jedem Zeigen neu gebaut (dieselben Aufgaben: feste Seeds); danach steht er in
 *   `einheit_hausuebung`. Nichts erreicht den Schüler vor „Hausübung freigeben“; Aufgaben der KI oder ungeprüfte brauchen vorher je ein
 *   „geprüft“.
 * - „Hausübung freigeben“ legt genau eine Übung für den Schüler an und eine Hausübung dazu (`homework.unit_id`, `assignment_id`,
 *   Fälligkeit): sie steht im Schülerportal, „erledigt“ und Antworten laufen wie bei jeder Hausübung mit Übung. „Heute keine Hausübung“
 *   steht so in Abschluss und Dokumentation.
 */
import { budget } from "./ai/config";
import { generateWithAI } from "./ai/features";
import { kiGrund, protokolliere } from "./ai/grund";
import { belegeDerEinheit, karteDerEinheit, schreibeAbschluss, sichereFaehigkeiten, type AbschlussBelege } from "./abschluss";
import { KRITERIUM_KEYS, KRITERIUM_KURZ } from "./bewertung-kriterien";
import { aufgabeSchluessel, ausgeblendet, ohneAusgeblendete } from "./bewertungen";
import { generatorSeed, gleicheFrage, knopfBeispielFragen, skillsDesPlans, skillsNichtVerstanden } from "./cockpit";
import { DIFFICULTIES, levelOf } from "./curriculum";
import { db, json } from "./db";
import { hasBuiltInGenerator } from "./generators";
import { nachschubTor, schaetzungUsd } from "./ki-nachschub";
import { alsEntwurf, NUTZBAR_SQL, oberfaehigkeit, passtZurFaehigkeit } from "./material-passt";
import { slotDatum } from "./planung/repo";
import { istDatum, tagAddieren, wienerDatum } from "./planung/zeit";
import * as repo from "./repo";
import { klassenLabel, schulstufe } from "./school";
import { sorteOfSkill } from "./schreibauftrag";
import { generatorAufgaben } from "./service";
import { shortDate } from "./summary";
import type { TaskDraft } from "./tasks";
import { textLaeufe } from "./textarbeit-ablauf";
import { bewertungFuerBericht, SCHWACHE_STUFE, skillFuerText } from "./text-note";
import { getUnit } from "./units";
import { EIGENE_VOKABELN } from "./vokabeln";
import { vorgabeDerEinheit } from "./vorgabe";

// ---------- Regeln ----------

/** Wie es heute lief: aus den geprüften Ergebnissen; „plan“: ein Thema aus dem Plan von heute ohne Ergebnis (von der Lehrkraft gewählt). */
export type Stand = "schwierig" | "teilweise" | "gut" | "plan";
export const STAND_LABEL: Record<Stand, string> = { schwierig: "noch schwierig", teilweise: "teilweise", gut: "gut verstanden", plan: "aus dem Plan von heute" };
/** So viele Aufgaben je Thema zuerst … */
export const ANZAHL: Record<Stand, number> = { schwierig: 4, teilweise: 4, gut: 2, plan: 3 };
/** … und so weit darf gekürzt werden, bevor ein Thema wegfällt. */
export const MIN_ANZAHL: Record<Stand, number> = { schwierig: 3, teilweise: 3, gut: 1, plan: 2 };
/** Höchstens so viele Themen schlägt die App vor (die Lehrkraft kann eines dazunehmen) … */
export const MAX_THEMEN = 3;
/** … und höchstens so viele Aufgaben, ohne die Schreibaufgabe. */
export const MAX_AUFGABEN = 10;
/** Höchstens so viele Aufgaben je Thema über „Ändern“. */
export const MAX_JE_THEMA = 8;
/** Was der Schüler in so vielen Tagen schon gelöst hat, kommt nicht wieder. */
export const KUERZLICH_TAGE = 30;
/** Die kurze Schreibaufgabe: so viele Wörter. */
export const SCHREIB_WOERTER = { Englisch: 60, Deutsch: 80 } as const;
/** Unter so viel richtig (Anteil) gilt ein Thema als „noch schwierig“. */
export const SCHWIERIG_UNTER = 0.5;

export type ThemaErgebnis = { skillId: string; name: string; stand: Stand; grund: string };

const FRAGE = (art: string) => (art === "kontrolle" ? "Kontrolle" : "Frage");
const uniq = <T>(xs: T[]) => [...new Set(xs)];

/**
 * Die Themen von heute nach ihren Ergebnissen, das schwächste zuerst. Nur Gezähltes: Aufgaben mit Antwort (offene unter „Zu bewerten“
 * stehen gar nicht im Bericht), deine Beobachtungen, die Anpassung im Unterricht und „Schüler versteht es nicht“.
 * - schwierig: weniger als die Hälfte richtig, eine Frage dazu falsch, eine leichtere Aufgabe oder die Grundlage war nötig, oder
 *   „versteht es nicht“;
 * - gut: ein sicheres Ergebnis nach den Regeln von „Gut verstanden“ (lib/abschluss.ts), oder nur dein „Richtig“ bei einer Frage;
 * - teilweise: alles dazwischen.
 */
export function ergebnisThemen(b: Pick<AbschlussBelege, "aufgaben" | "beobachtungen" | "reaktionen">, o: { nichtVerstanden?: string[]; name?: (id: string) => string } = {}): ThemaErgebnis[] {
  const sicher = sichereFaehigkeiten(b);
  const nv = o.nichtVerstanden ?? [];
  const leichter = (id: string) => b.reaktionen.some((r) => r.skillId === id && (r.art === "leichter" || r.art === "voraussetzung" || r.art === "fehler"));
  const ids = uniq([
    ...b.aufgaben.map((t) => t.skillId),
    ...b.beobachtungen.flatMap((x) => x.skillIds),
    ...b.reaktionen.filter((r) => leichter(r.skillId ?? "")).map((r) => r.skillId),
    ...nv,
  ]).filter((x): x is string => Boolean(x));
  const out: (ThemaErgebnis & { rang: number; quote: number })[] = [];
  for (const id of ids) {
    const ts = b.aufgaben.filter((t) => t.skillId === id && (t.finished || t.tries > 0));
    const richtig = ts.filter((t) => t.finished && t.correct).length;
    const quote = ts.length ? richtig / ts.length : 1;
    const beob = b.beobachtungen.filter((x) => x.skillIds.includes(id));
    const falsch = beob.find((x) => x.antwort === "falsch");
    const teil = beob.find((x) => x.antwort === "teilweise");
    const name = o.name?.(id) ?? ts[0]?.skill ?? b.reaktionen.find((r) => r.skillId === id)?.skill ?? id;
    const zahl = `${richtig} von ${ts.length} richtig`;
    let stand: Stand;
    let grund: string;
    if (ts.length && quote < SCHWIERIG_UNTER) [stand, grund] = ["schwierig", zahl];
    else if (falsch) [stand, grund] = ["schwierig", `${FRAGE(falsch.art)} „${falsch.titel}“ falsch beantwortet`];
    else if (leichter(id)) [stand, grund] = ["schwierig", ts.length ? `leichtere Aufgabe war nötig, ${zahl}` : "leichtere Aufgabe war nötig"];
    else if (nv.includes(id)) [stand, grund] = ["schwierig", "„Schüler versteht es nicht“ getippt"];
    else if (sicher.has(id)) [stand, grund] = ["gut", ts.length ? zahl : "sicheres Ergebnis"];
    else if (ts.length) [stand, grund] = ["teilweise", teil ? `${zahl}, ${FRAGE(teil.art)} „${teil.titel}“ teilweise richtig` : zahl];
    else if (teil) [stand, grund] = ["teilweise", `${FRAGE(teil.art)} „${teil.titel}“ teilweise richtig`];
    else if (beob.some((x) => x.antwort === "richtig")) [stand, grund] = ["gut", "deine Beobachtung: richtig beantwortet"];
    else continue;
    out.push({ skillId: id, name, stand, grund: `${STAND_LABEL[stand]}: ${grund}`, rang: ["schwierig", "teilweise", "gut", "plan"].indexOf(stand), quote });
  }
  // the weakest first; the same state in the order the topics came up
  return out
    .map((x, i) => ({ ...x, i }))
    .sort((a, b) => a.rang - b.rang || a.quote - b.quote || a.i - b.i)
    .map(({ skillId, name, stand, grund }) => ({ skillId, name, stand, grund }));
}

/**
 * Welche Themen mit wie vielen Aufgaben: schwächere zuerst, „gut verstanden“ nur, wenn es weniger als zwei schwächere gibt; höchstens
 * `MAX_THEMEN`. Über `MAX_AUFGABEN` wird erst das letzte Thema bis `MIN_ANZAHL` gekürzt, dann das davor; reicht das nicht, fällt das
 * letzte Thema weg.
 */
export function auswahl<T extends { stand: Stand }>(themen: T[]): (T & { soll: number })[] {
  const schwach = themen.filter((t) => t.stand === "schwierig" || t.stand === "teilweise");
  const liste = (schwach.length >= 2 ? schwach : themen).slice(0, MAX_THEMEN).map((t) => ({ ...t, soll: ANZAHL[t.stand] }));
  const summe = () => liste.reduce((s, t) => s + t.soll, 0);
  for (let i = liste.length - 1; summe() > MAX_AUFGABEN && i >= 0; ) {
    if (liste[i].soll > MIN_ANZAHL[liste[i].stand]) liste[i].soll--;
    else i--;
  }
  while (summe() > MAX_AUFGABEN && liste.length > 1) liste.pop();
  return liste;
}

// ---------- Dauer ----------

/** Minuten für eine Aufgabe als Spanne: geschlossene Aufgaben 1–2, Rechnung 2–3, Rechenweg 3–4, freie Antwort 3, Schreiben nach Wörtern. */
export function minutenFuer(t: Pick<TaskDraft, "type" | "data" | "estimatedTimeSec">): [number, number] {
  const woerter = t.data?.schreibauftrag?.woerter ?? schreibWoerter(t);
  if (woerter) return [Math.max(2, Math.round(woerter / 15)), Math.max(3, Math.round(woerter / 10))];
  if (t.estimatedTimeSec && t.estimatedTimeSec > 0) {
    const m = t.estimatedTimeSec / 60;
    return [Math.max(1, Math.round(m)), Math.max(1, Math.ceil(m * 1.5))];
  }
  switch (t.type) {
    case "mc":
    case "cloze":
    case "grammar":
    case "order":
      return [1, 2];
    case "calc":
    case "fix":
    case "zuordnung":
      return [2, 3];
    case "reading":
      return [2, 4];
    case "rechenweg":
      return [3, 4];
    case "sachaufgabe":
      return [4, 6];
    case "memorize":
      return [3, 5];
    default:
      return [3, 3];
  }
}

// a writing task of the homework names its words in the prompt (Deutsch has no data.schreibauftrag)
const schreibWoerter = (t: Pick<TaskDraft, "data">): number | null => (t.data as { hausuebungWoerter?: number } | undefined)?.hausuebungWoerter ?? null;

/** So weit reicht die Spanne um die geschätzte Dauer: ±25 %. */
export const DAUER_SPANNE = 0.25;

/**
 * Die geschätzte Bearbeitungsdauer als Text „ca. 15–20 min“ (F0b: vorher nach außen gerundet, „ca. 5–20 min“ für 8 Aufgaben): je Aufgabe
 * die Mitte ihrer Minuten (`minutenFuer`), zusammengezählt, ±25 %, auf 5 Minuten gerundet. `von`/`bis`: die Summen der Spannen.
 */
export function dauer(tasks: Pick<TaskDraft, "type" | "data" | "estimatedTimeSec">[]): { von: number; bis: number; minuten: number; text: string } {
  const [von, bis] = tasks.map(minutenFuer).reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0]);
  if (!tasks.length) return { von: 0, bis: 0, minuten: 0, text: "" };
  const minuten = (von + bis) / 2;
  const auf5 = (x: number) => Math.round(x / 5) * 5;
  const a = Math.max(5, auf5(minuten * (1 - DAUER_SPANNE)));
  const b = Math.max(a, auf5(minuten * (1 + DAUER_SPANNE)));
  return { von, bis, minuten, text: b <= 5 ? "ca. 5 min" : a === b ? `ca. ${a} min` : `ca. ${a}–${b} min` };
}

/**
 * Der Kopf einer Themenzeile: „4 Aufgaben Present Continuous“; ohne Aufgabe „Question Tags: keine passenden Aufgaben“, und wenn auch die
 * KI keine macht (`selbst`) „…, bitte selbst ergänzen“ (F0b: vorher „0 Aufgaben Question Tags“).
 */
export function themaKopf(t: Pick<HuThema, "name" | "aufgaben">, o: { selbst: boolean }): string {
  const n = t.aufgaben.length;
  if (n) return `${n} ${n === 1 ? "Aufgabe" : "Aufgaben"} ${t.name}`;
  return `${t.name}: keine passenden Aufgaben${o.selbst ? ", bitte selbst ergänzen" : ""}`;
}

// ---------- Fälligkeit ----------

/**
 * Der nächste Termin des Schülers nach `nach` (Wiener Datum): ein Platz im Wochenplan oder eine geplante Stunde. null, wenn keiner
 * eingetragen ist; dann bleibt die Fälligkeit leer und die Lehrkraft wählt sie (keine erfundenen Termine).
 */
export function naechsterTermin(studentId: number, nach: string): string | null {
  const plaetze = (db().prepare("SELECT week_start, weekday FROM geplante_einheiten WHERE student_id = ? AND week_start >= ?").all(studentId, tagAddieren(nach, -7)) as { week_start: string; weekday: number }[])
    .map((p) => slotDatum(p.week_start, p.weekday))
    .filter((d) => d > nach);
  const stunden = (db().prepare("SELECT substr(starts_at, 1, 10) AS d FROM lessons WHERE student_id = ? AND status = 'geplant' AND substr(starts_at, 1, 10) > ?").all(studentId, nach) as { d: string }[]).map((r) => r.d);
  return [...plaetze, ...stunden].sort()[0] ?? null;
}

// ---------- Aufgaben ----------

/** Woher eine Aufgabe kommt: Bibliothek, eine freigegebene Übung, Generator oder Bank, die KI, oder die Schreibaufgabe aus dem Unterricht. */
export type Herkunft = "bibliothek" | "bestand" | "generator" | "ki" | "schreiben";
export const HERKUNFT: Record<Herkunft, string> = { bibliothek: "Bibliothek", bestand: "aus einer Übung", generator: "Generator", ki: "neu erstellt", schreiben: "aus dem Unterricht" };

/** `geprueft`: darf so hinaus. Aufgaben der KI (auch aus der Bibliothek) brauchen dein „geprüft“. */
export type HuAufgabe = { key: string; task: TaskDraft; herkunft: Herkunft; geprueft: boolean };
/** Die letzte Anfrage an die KI für ein Thema: läuft, fertig (die Aufgaben stehen im Thema) oder ging nicht. Von selbst fragt die App je Thema nur einmal. */
export type KiStand = { status: "laeuft" | "fertig" | "fehler"; problem: string; automatisch: boolean };
export type HuThema = {
  /** die Fähigkeit, oder „schreiben“ */
  id: string;
  skillId: string | null;
  name: string;
  stand: Stand | "schreiben";
  /** woraus: „noch schwierig: 1 von 4 richtig“ */
  grund: string;
  soll: number;
  level: number;
  aufgaben: HuAufgabe[];
  /** entfernte oder getauschte Aufgaben (key), die nicht wiederkommen */
  weg: string[];
  ki: KiStand | null;
};
type Inhalt = { themen: HuThema[]; ausPlan: boolean };

/** So viele Aufgaben fehlen dem Thema ohne KI. */
export const fehlt = (t: Pick<HuThema, "soll" | "aufgaben">) => Math.max(0, t.soll - t.aufgaben.length);

/** Was in dieser Einheit schon da war und was der Schüler kürzlich gelöst hat: kommt nicht in die Hausübung. */
type Umgebung = { unitId: number; student: repo.Student; weg: Set<string>; fragen: Set<string> };

function umgebung(unitId: number, student: repo.Student, nach: string): Umgebung {
  const weg = new Set(ausgeblendet());
  const fragen = new Set(knopfBeispielFragen(unitId));
  const blaetter = db()
    .prepare("SELECT worksheet_id AS id FROM assignments WHERE unit_id = ? UNION SELECT id FROM worksheets WHERE gedruckt_unit_id = ? OR minitest_unit_id = ?")
    .all(unitId, unitId, unitId) as { id: number }[];
  const merke = (t: Pick<TaskDraft, "type" | "prompt" | "data" | "answer">) => {
    weg.add(aufgabeSchluessel(t));
    fragen.add(gleicheFrage(t));
  };
  for (const b of blaetter) repo.listTasks(b.id).forEach(merke);
  for (const r of db().prepare("SELECT aufgabe FROM einheit_beispiele WHERE unit_id = ?").all(unitId) as { aufgabe: string }[]) {
    const t = json<TaskDraft | null>(r.aufgabe, null);
    if (t?.prompt) merke(t);
  }
  const seit = `${tagAddieren(nach, -KUERZLICH_TAGE)}`;
  const geloest = db().prepare("SELECT DISTINCT task_id FROM attempts WHERE student_id = ? AND substr(created_at, 1, 10) >= ?").pluck().all(student.id, seit) as number[];
  for (const id of geloest) {
    const t = repo.getTask(id);
    if (t) merke(t);
  }
  return { unitId, student, weg, fragen };
}

const frei = (env: Umgebung, schon: Set<string>, t: TaskDraft) => !env.weg.has(aufgabeSchluessel(t)) && !env.fragen.has(gleicheFrage(t)) && !schon.has(aufgabeSchluessel(t)) && !t.data?.pruefen?.length;

/** A: Bibliothek und freigegebene Übungen zur Fähigkeit, die Stufe zuerst, höchstens eine Stufe daneben. */
function ausBestand(env: Umgebung, skillId: string, level: number, n: number, schon: Set<string>): HuAufgabe[] {
  if (n <= 0) return [];
  const rows = db()
    .prepare(
      `SELECT t.id, w.kind FROM tasks t JOIN worksheets w ON w.id = t.worksheet_id
       WHERE w.archived_at IS NULL AND (w.status = 'freigegeben' OR w.kind = 'bibliothek') AND w.kind IN ('uebung', 'ueberpruefung', 'bibliothek')
         AND w.probe_test_id IS NULL AND ${NUTZBAR_SQL} AND ABS(COALESCE(t.level, 3) - ?) <= 1
         AND (t.skill_id = ? OR EXISTS (SELECT 1 FROM task_skills ts WHERE ts.task_id = t.id AND ts.skill_id = ?))
       ORDER BY w.kind = 'bibliothek' DESC, ABS(COALESCE(t.level, 3) - ?), t.id DESC LIMIT 80`,
    )
    .all(env.student.id, env.student.id, level, skillId, skillId, level) as { id: number; kind: string }[];
  const out: HuAufgabe[] = [];
  for (const r of rows) {
    const t = repo.getTask(r.id);
    if (!t) continue;
    const d = alsEntwurf(t);
    if (!frei(env, schon, d) || !passtZurFaehigkeit(d, skillId, oberfaehigkeit)) continue;
    const key = aufgabeSchluessel(d);
    schon.add(key);
    out.push({ key, task: d, herkunft: r.kind === "bibliothek" ? "bibliothek" : "bestand", geprueft: d.sourceType !== "ki" });
    if (out.length >= n) break;
  }
  return out;
}

/** Bauen Generator oder Bank Aufgaben zur Fähigkeit? Nicht für Schreibaufträge und die eigenen Wortlisten des Schülers. */
const generatorFuer = (skillId: string) => hasBuiltInGenerator(skillId) && !sorteOfSkill(skillId) && skillId !== EIGENE_VOKABELN;

/** B: Generatoren und Banken, ohne KI; mit festem Seed je Runde, damit Vorschau und Freigabe dieselben Aufgaben sind. */
function ausGenerator(env: Umgebung, skill: repo.Skill, level: number, n: number, schon: Set<string>, runde: number): HuAufgabe[] {
  if (n <= 0 || !generatorFuer(skill.id)) return [];
  let roh: TaskDraft[] = [];
  try {
    roh = generatorAufgaben(
      {
        subject: skill.subject,
        schoolType: env.student.school_type,
        klasse: env.student.klasse ?? 1,
        skillIds: [skill.id],
        difficulty: DIFFICULTIES[Math.max(1, Math.min(5, level)) - 1],
        count: Math.min(30, n * 3),
        taskType: "mixed",
        seed: generatorSeed(env.unitId, `${skill.id}:hausuebung:${runde}`),
      },
      [skill],
    );
  } catch {
    return [];
  }
  const out: HuAufgabe[] = [];
  for (const t of roh) {
    const d = { ...t, skillId: t.skillId ?? skill.id };
    if (!frei(env, schon, d) || !passtZurFaehigkeit(d, skill.id, oberfaehigkeit)) continue;
    const key = aufgabeSchluessel(d);
    schon.add(key);
    out.push({ key, task: d, herkunft: "generator", geprueft: true });
    if (out.length >= n) break;
  }
  return out;
}

/** Die nächsten `n` Aufgaben zur Fähigkeit in der Reihenfolge der Quellen (A, dann B mit weiteren Runden). */
function kandidaten(env: Umgebung, skill: repo.Skill, level: number, n: number, schon: Set<string>): HuAufgabe[] {
  const out = ausBestand(env, skill.id, level, n, schon);
  for (let runde = 0; out.length < n && runde < 4; runde++) out.push(...ausGenerator(env, skill, level, n - out.length, schon, runde));
  return out;
}

/** Die Stufe, auf der heute geübt wurde (Mitte der Antworten); bei „noch schwierig“ eine Stufe leichter. Ohne Antwort 3. */
function stufeFuer(unitId: number, skillId: string, stand: Stand): number {
  const xs = (db().prepare("SELECT level FROM attempts WHERE unit_id = ? AND skill_id = ? AND level IS NOT NULL").pluck().all(unitId, skillId) as number[]).sort((a, b) => a - b);
  const mitte = xs.length ? xs[Math.floor((xs.length - 1) / 2)] : 3;
  return Math.max(1, Math.min(5, stand === "schwierig" ? mitte - 1 : mitte));
}

/**
 * Die kurze Schreibaufgabe: nur in Deutsch und Englisch und nur, wenn heute geschrieben wurde (eine Textarbeit mit Wörtern). Dieselbe
 * Textsorte, ein freies Thema, die schwachen Kriterien einer übernommenen Bewertung als Hinweis. Kein Text eines anderen Schülers, kein Name.
 */
function schreibThema(unitId: number, fach: string, student: repo.Student): HuThema | null {
  const englisch = /englisch/i.test(fach);
  if (!englisch && !/deutsch/i.test(fach)) return null;
  const t = textLaeufe(unitId).find((x) => x.woerter > 0);
  if (!t) return null;
  const sorte = t.textsorte.trim();
  const woerter = englisch ? SCHREIB_WOERTER.Englisch : SCHREIB_WOERTER.Deutsch;
  const b = bewertungFuerBericht(t.id, unitId);
  const schwach = b?.stand === "bestaetigt" ? KRITERIUM_KEYS.filter((k) => b.stufen[k] >= SCHWACHE_STUFE).map((k) => KRITERIUM_KURZ[k]) : [];
  const prompt = englisch
    ? `Write a short text${sorte ? ` (${sorte})` : ""} on a topic of your choice. About ${woerter} words.`
    : `Schreibe einen kurzen Text${sorte ? ` (${sorte})` : ""} zu einem Thema deiner Wahl. Etwa ${woerter} Wörter.`;
  const skill = skillFuerText({ fach, textsorte: sorte, schulstufe: schulstufe(student.school_type, student.klasse ?? 1) }, repo.listSkills());
  const task: TaskDraft = {
    type: "free",
    skillId: skill?.id ?? null,
    difficulty: "mittel",
    prompt: schwach.length ? `${prompt}\n${englisch ? "Pay attention to" : "Achte besonders auf"}: ${schwach.join(", ")}.` : prompt,
    // Englisch: wie ein Writing der Matura (Wortzähler); Deutsch: eine freie Antwort mit Platz
    data: englisch ? { schreibauftrag: { textsorte: sorte || "Text", woerter } } : ({ lines: 12, hausuebungWoerter: woerter } as TaskDraft["data"]),
    answer: { criteria: KRITERIUM_KEYS.map((k) => KRITERIUM_KURZ[k]) },
    solution: "",
    hints: [],
    errorMap: [],
    sourceType: "eigen",
  };
  return {
    id: "schreiben",
    skillId: skill?.id ?? null,
    name: englisch ? "Writing" : "Schreiben",
    stand: "schreiben",
    grund: `heute geschrieben: ${sorte || t.titel}${schwach.length ? `, schwach: ${schwach.join(", ")}` : ""}`,
    soll: 1,
    level: 3,
    aufgaben: [{ key: aufgabeSchluessel(task), task, herkunft: "schreiben", geprueft: true }],
    weg: [],
    ki: null,
  };
}

// ---------- der Vorschlag ----------

type Kontext = { unit: NonNullable<ReturnType<typeof getUnit>>; lesson: repo.Lesson; student: repo.Student; fach: string; tag: string; belege: AbschlussBelege };

function kontext(unitId: number): Kontext | null {
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "beendet") return null;
  const lesson = repo.getLessonForUnit(unitId);
  const student = repo.getStudent(unit.student_id);
  if (!lesson || !student) return null;
  return { unit, lesson, student, fach: unit.subject || lesson.subject, tag: wienerDatum(new Date(unit.started_at)), belege: belegeDerEinheit(unitId, lesson) };
}

const skillName = (id: string) => repo.getSkill(id)?.name ?? id;

/** Die Themen aus den Ergebnissen dieser Einheit (`ergebnisThemen`). */
function ergebnisseDerEinheit(k: Kontext): ThemaErgebnis[] {
  return ergebnisThemen(k.belege, { nichtVerstanden: skillsNichtVerstanden(k.unit.id), name: skillName }).filter((t) => repo.getSkill(t.skillId));
}

/** Die Themen von heute ohne Ergebnis: Plan oder Lernpaket, Vorgabe, Fähigkeiten der Aufgaben. Zum Dazunehmen und für „aus dem Plan“. */
function planThemenVon(k: Kontext): { skillId: string; name: string }[] {
  const ids = uniq([...skillsDesPlans(k.unit.id), ...(vorgabeDerEinheit(k.unit.id)?.skillIds ?? []), ...k.belege.aufgaben.map((t) => t.skillId).filter((x): x is string => Boolean(x))]);
  return ids.filter((id) => repo.getSkill(id) && !sorteOfSkill(id)).map((id) => ({ skillId: id, name: skillName(id) }));
}

function neuesThema(k: Kontext, env: Umgebung, t: { skillId: string; name: string; stand: Stand; grund: string; soll: number }, schon: Set<string>): HuThema {
  const skill = repo.getSkill(t.skillId)!;
  const level = stufeFuer(k.unit.id, t.skillId, t.stand);
  return { id: t.skillId, skillId: t.skillId, name: t.name, stand: t.stand, grund: t.grund, soll: t.soll, level, aufgaben: kandidaten(env, skill, level, t.soll, schon), weg: [], ki: null };
}

/** Baut den Vorschlag, ohne KI und ohne zu speichern. `ausPlan`: aus den Themen des Plans, wenn noch kein Ergebnis zählt. */
function baue(k: Kontext, o: { ausPlan?: boolean } = {}): Inhalt {
  const env = umgebung(k.unit.id, k.student, k.tag);
  const schon = new Set<string>();
  const wahl = o.ausPlan
    ? planThemenVon(k)
        .slice(0, MAX_THEMEN)
        .map((p) => ({ ...p, stand: "plan" as const, grund: STAND_LABEL.plan, soll: ANZAHL.plan }))
    : auswahl(ergebnisseDerEinheit(k));
  const themen = wahl.map((t) => neuesThema(k, env, t, schon));
  const schreiben = schreibThema(k.unit.id, k.fach, k.student);
  if (schreiben) themen.push(schreiben);
  return { themen, ausPlan: Boolean(o.ausPlan) };
}

type Zeile = { unit_id: number; status: "vorschlag" | "freigegeben" | "uebersprungen"; inhalt: string; notiz: string; faellig: string | null; doku: string; homework_id: number | null; worksheet_id: number | null; teacher_id: number | null; updated_at: string };
const zeileVon = (unitId: number) => db().prepare("SELECT * FROM einheit_hausuebung WHERE unit_id = ?").get(unitId) as Zeile | undefined;
/** Der gespeicherte Inhalt; eine Zeile von „keine Hausübung“ ohne Vorschlag hat keinen. */
const inhaltVon = (r: Pick<Zeile, "inhalt">): Inhalt => {
  const i = json<Partial<Inhalt>>(r.inhalt, {});
  return { themen: Array.isArray(i.themen) ? i.themen : [], ausPlan: i.ausPlan === true };
};

export type Vorschlag = {
  unitId: number;
  studentId: number;
  fach: string;
  status: Zeile["status"];
  /** gespeichert: von der Lehrkraft geändert (sonst bei jedem Zeigen neu aus den Ergebnissen) */
  gespeichert: boolean;
  themen: HuThema[];
  ausPlan: boolean;
  notiz: string;
  /** gespeicherte Fälligkeit, sonst der nächste Termin; null: keiner bekannt, die Lehrkraft wählt */
  faellig: string | null;
  faelligAusTermin: boolean;
  /** Antworten unter „Zu bewerten“: sie zählen hier nicht */
  offen: number;
  /** es gibt kein geprüftes Ergebnis, aus dem eine Hausübung folgt (und sie ist nicht aus dem Plan gebaut) */
  ohneErgebnisse: boolean;
  /** Themen von heute, die noch nicht drin sind (zum Dazunehmen) */
  planThemen: { skillId: string; name: string }[];
  doku: string;
  homeworkId: number | null;
  worksheetId: number | null;
  /** alle Aufgaben, in der Reihenfolge der Themen */
  aufgaben: HuAufgabe[];
  dauer: ReturnType<typeof dauer>;
  /** warum „Hausübung freigeben“ nicht geht; null: es geht */
  gesperrt: string | null;
  /** die KI darf jetzt neue Aufgaben machen (auf Tippen), mit Kosten; sonst der Grund */
  ki: { erlaubt: true; kosten: string | null; automatisch: boolean } | { erlaubt: false; grund: string };
};

/** Höchstens so lange gilt ein Abschluss für den Vorschlag als frisch (lib/situation.ts ABSCHLUSS_TAGE); ältere Einheiten zeigen nur, was entschieden ist. */
export const VORSCHLAG_TAGE = 14;

/** Der Vorschlag (oder was entschieden ist) für den Abschluss einer beendeten Einheit; null ohne Dokumentation oder Schüler. */
export function hausuebungDerEinheit(unitId: number): Vorschlag | null {
  const k = kontext(unitId);
  if (!k) return null;
  const r = zeileVon(unitId);
  const inhalt: Inhalt = r ? inhaltVon(r) : baue(k);
  const themen = inhalt.themen;
  const aufgaben = themen.flatMap((t) => t.aufgaben);
  const termin = naechsterTermin(k.student.id, k.tag);
  const anzahl = Math.max(1, themen.reduce((s, t) => s + fehlt(t), 0));
  const tor = nachschubTor(unitId, k.student.id, Math.min(3, anzahl));
  const usd = schaetzungUsd(Math.min(3, anzahl));
  const ki: Vorschlag["ki"] = tor.ki.erlaubt
    ? { erlaubt: true, kosten: usd > 0 ? `ca. ${Math.max(1, Math.round((usd / budget().usdPerEur) * 100))} Cent` : tor.ki.kosten, automatisch: tor.automatisch.erlaubt }
    : { erlaubt: false, grund: tor.ki.grund };
  const offenKi = aufgaben.filter((a) => !a.geprueft).length;
  const gesperrt = themen.some((t) => t.ki?.status === "laeuft")
    ? "Neue Aufgaben werden noch erstellt."
    : !aufgaben.length
      ? "Noch keine Aufgabe in der Hausübung."
      : offenKi
        ? `${offenKi === 1 ? "Eine neue Aufgabe ist" : `${offenKi} neue Aufgaben sind`} noch nicht geprüft: in der Vorschau „geprüft“ setzen.`
        : null;
  const drin = new Set(themen.map((t) => t.skillId));
  return {
    unitId,
    studentId: k.student.id,
    fach: k.fach,
    status: r?.status ?? "vorschlag",
    gespeichert: Boolean(r),
    themen,
    ausPlan: inhalt.ausPlan,
    notiz: r?.notiz ?? "",
    faellig: r?.faellig ?? termin,
    faelligAusTermin: !r?.faellig && termin !== null,
    offen: k.belege.offen ?? 0,
    ohneErgebnisse: !r && !themen.length,
    planThemen: planThemenVon(k).filter((p) => !drin.has(p.skillId)),
    doku: r?.doku ?? "",
    homeworkId: r?.homework_id ?? null,
    worksheetId: r?.worksheet_id ?? null,
    aufgaben,
    dauer: dauer(aufgaben.map((a) => a.task)),
    gesperrt,
    ki,
  };
}

/** Darf der Vorschlag gezeigt werden: eine beendete Einheit der letzten `VORSCHLAG_TAGE` Tage oder schon entschieden. */
export function vorschlagZeigen(v: Pick<Vorschlag, "status" | "gespeichert">, endedAt: string | null, now = Date.now()): boolean {
  if (v.status !== "vorschlag" || v.gespeichert) return true;
  return Boolean(endedAt) && now - Date.parse(endedAt!) <= VORSCHLAG_TAGE * 86_400_000;
}

/** „9 Aufgaben (Present Continuous 4, Past Simple Questions 4, Writing 1), ca. 15–20 min“ */
export function zusammenfassung(themen: Pick<HuThema, "name" | "aufgaben">[]): string {
  const mit = themen.filter((t) => t.aufgaben.length);
  const n = mit.reduce((s, t) => s + t.aufgaben.length, 0);
  const d = dauer(mit.flatMap((t) => t.aufgaben.map((a) => a.task))).text;
  return `${n} ${n === 1 ? "Aufgabe" : "Aufgaben"} (${mit.map((t) => `${t.name} ${t.aufgaben.length}`).join(", ")})${d ? `, ${d}` : ""}`;
}

/** Die Zeile in Abschluss und Dokumentation. */
export const dokuZeile = (themen: Pick<HuThema, "name" | "aufgaben">[], faellig: string) => `Hausübung: ${zusammenfassung(themen)}, fällig ${shortDate(faellig)}`;
export const KEINE_HAUSUEBUNG = "Heute keine Hausübung";

// ---------- ändern ----------

type Ergebnis = { ok: true } | { fehler: string };

function speichere(unitId: number, inhalt: Inhalt, teacherId: number | null, felder: { notiz?: string; faellig?: string | null } = {}) {
  const r = zeileVon(unitId);
  db()
    .prepare(
      `INSERT INTO einheit_hausuebung (unit_id, status, inhalt, notiz, faellig, teacher_id, updated_at) VALUES (?, 'vorschlag', ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(unit_id) DO UPDATE SET inhalt = excluded.inhalt, notiz = excluded.notiz, faellig = excluded.faellig, teacher_id = excluded.teacher_id, updated_at = excluded.updated_at
       WHERE einheit_hausuebung.status = 'vorschlag'`,
    )
    .run(unitId, JSON.stringify(inhalt), felder.notiz ?? r?.notiz ?? "", felder.faellig !== undefined ? felder.faellig : (r?.faellig ?? null), teacherId);
}

/** Holt den Vorschlag (gespeichert oder frisch gebaut), ändert ihn mit `fn` und speichert ihn. Nur solange nichts entschieden ist. */
function aendere(unitId: number, teacherId: number | null, fn: (i: Inhalt, k: Kontext, env: () => Umgebung) => string | void): Ergebnis {
  const k = kontext(unitId);
  if (!k) return { fehler: "Diese Einheit ist nicht beendet." };
  const r = zeileVon(unitId);
  if (r && r.status !== "vorschlag") return { fehler: r.status === "freigegeben" ? "Die Hausübung ist schon freigegeben." : "Für heute ist „keine Hausübung“ eingetragen." };
  const inhalt: Inhalt = r ? inhaltVon(r) : baue(k);
  let env: Umgebung | null = null;
  const fehler = fn(inhalt, k, () => (env ??= umgebung(unitId, k.student, k.tag)));
  if (fehler) return { fehler };
  speichere(unitId, inhalt, teacherId);
  return { ok: true };
}

const themaIn = (i: Inhalt, themaId: string) => i.themen.find((t) => t.id === themaId) ?? null;
/** Alle Schlüssel, die schon drin oder weg sind: kommen beim Tauschen und Auffüllen nicht wieder. */
const belegt = (i: Inhalt) => new Set(i.themen.flatMap((t) => [...t.aufgaben.map((a) => a.key), ...t.weg]));

/** „Entfernen“: die Aufgabe fällt weg und kommt nicht wieder. */
export function entferneAufgabe(unitId: number, themaId: string, key: string, teacherId: number | null): Ergebnis {
  return aendere(unitId, teacherId, (i) => {
    const t = themaIn(i, themaId);
    if (!t?.aufgaben.some((a) => a.key === key)) return "Diese Aufgabe gibt es hier nicht.";
    t.aufgaben = t.aufgaben.filter((a) => a.key !== key);
    t.weg.push(key);
    t.soll = Math.max(t.aufgaben.length, t.soll - 1);
    if (!t.aufgaben.length && t.stand === "schreiben") i.themen = i.themen.filter((x) => x !== t);
  });
}

/** „Tauschen“: die nächste passende Aufgabe aus derselben Reihenfolge der Quellen (Bibliothek, dann Generator) an ihre Stelle. */
export function tauscheAufgabe(unitId: number, themaId: string, key: string, teacherId: number | null): Ergebnis {
  return aendere(unitId, teacherId, (i, _k, env) => {
    const t = themaIn(i, themaId);
    const pos = t?.aufgaben.findIndex((a) => a.key === key) ?? -1;
    if (!t || pos < 0) return "Diese Aufgabe gibt es hier nicht.";
    const skill = t.skillId ? repo.getSkill(t.skillId) : null;
    const neu = skill && t.stand !== "schreiben" ? kandidaten(env(), skill, t.level, 1, belegt(i)) : [];
    if (!neu.length) return "Dazu gibt es ohne KI keine weitere passende Aufgabe.";
    t.weg.push(key);
    t.aufgaben[pos] = neu[0];
  });
}

/** Die Zahl der Aufgaben eines Themas (0 nimmt es heraus); mehr werden aus Bibliothek und Generator aufgefüllt. */
export function setzeAnzahl(unitId: number, themaId: string, n: number, teacherId: number | null): Ergebnis {
  if (!Number.isInteger(n) || n < 0 || n > MAX_JE_THEMA) return { fehler: `Bitte 0 bis ${MAX_JE_THEMA} Aufgaben.` };
  return aendere(unitId, teacherId, (i, _k, env) => {
    const t = themaIn(i, themaId);
    if (!t) return "Dieses Thema gibt es hier nicht.";
    if (n === 0) {
      i.themen = i.themen.filter((x) => x !== t);
      return;
    }
    if (t.stand === "schreiben") return "Die Schreibaufgabe bleibt eine Aufgabe.";
    t.soll = n;
    if (t.aufgaben.length > n) t.aufgaben = t.aufgaben.slice(0, n);
    const skill = t.skillId ? repo.getSkill(t.skillId) : null;
    if (skill && t.aufgaben.length < n) t.aufgaben.push(...kandidaten(env(), skill, t.level, n - t.aufgaben.length, belegt(i)));
  });
}

/** Ein Thema aus dem Plan von heute dazunehmen (mit seinem Ergebnis, wenn es eines gibt). */
export function themaDazu(unitId: number, skillId: string, teacherId: number | null): Ergebnis {
  return aendere(unitId, teacherId, (i, k, env) => {
    if (i.themen.some((t) => t.skillId === skillId && t.stand !== "schreiben")) return "Dieses Thema ist schon dabei.";
    const p = planThemenVon(k).find((x) => x.skillId === skillId);
    if (!p) return "Dieses Thema war heute nicht dran.";
    const e = ergebnisseDerEinheit(k).find((x) => x.skillId === skillId);
    const t = e ? { ...e, soll: ANZAHL[e.stand] } : { ...p, stand: "plan" as const, grund: STAND_LABEL.plan, soll: ANZAHL.plan };
    const neu = neuesThema(k, env(), t, belegt(i));
    // before the writing task, which stays last
    const s = i.themen.findIndex((x) => x.stand === "schreiben");
    i.themen.splice(s < 0 ? i.themen.length : s, 0, neu);
  });
}

/** „geprüft“ bei einer Aufgabe der KI (oder einer ungeprüften): erst dann darf sie in die Hausübung. */
export function setzeGeprueft(unitId: number, themaId: string, key: string, geprueft: boolean, teacherId: number | null): Ergebnis {
  return aendere(unitId, teacherId, (i) => {
    const a = themaIn(i, themaId)?.aufgaben.find((x) => x.key === key);
    if (!a) return "Diese Aufgabe gibt es hier nicht.";
    a.geprueft = geprueft;
  });
}

/** Der Hinweis für den Schüler (steht im Schülerportal bei der Hausübung) und die Fälligkeit. */
export function setzeNotiz(unitId: number, notiz: string, teacherId: number | null): Ergebnis {
  const text = notiz.replace(/\s+/g, " ").trim().slice(0, 300);
  const out = aendere(unitId, teacherId, () => undefined);
  if ("fehler" in out) return out;
  db().prepare("UPDATE einheit_hausuebung SET notiz = ?, updated_at = datetime('now') WHERE unit_id = ? AND status = 'vorschlag'").run(text, unitId);
  return out;
}

/** Wieder aus den Ergebnissen (alle Änderungen weg), oder `ausPlan`: aus den Themen von heute, solange kein Ergebnis zählt. */
export function neuBauen(unitId: number, teacherId: number | null, o: { ausPlan?: boolean } = {}): Ergebnis {
  const k = kontext(unitId);
  if (!k) return { fehler: "Diese Einheit ist nicht beendet." };
  const r = zeileVon(unitId);
  if (r && r.status !== "vorschlag") return { fehler: "Die Hausübung ist schon entschieden." };
  if (!o.ausPlan) {
    db().prepare("DELETE FROM einheit_hausuebung WHERE unit_id = ? AND status = 'vorschlag'").run(unitId);
    return { ok: true };
  }
  const inhalt = baue(k, { ausPlan: true });
  if (!inhalt.themen.length) return { fehler: "Im Plan von heute gibt es kein Thema mit Aufgaben." };
  speichere(unitId, inhalt, teacherId);
  return { ok: true };
}

// ---------- KI ----------

/**
 * Neue Aufgaben der KI für ein Thema, dem ohne KI Aufgaben fehlen: auf Tippen (`automatisch` false) oder von selbst im KI-Budget der
 * Einheit (lib/ki-nachschub.ts `nachschubTor`). Über denselben Weg wie „Neue passende Aufgabe erstellen“ (`generateWithAI`, Funktion
 * `neue_aufgabe`, Kosten zur Einheit). Die Aufgaben kommen als „neu erstellt, ungeprüft“ in den Vorschlag; erst dein „geprüft“ lässt sie
 * hinaus. Nichts geht an den Schüler.
 */
export async function kiAufgaben(unitId: number, themaId: string, o: { automatisch: boolean; teacherId: number | null }): Promise<Ergebnis> {
  const k = kontext(unitId);
  if (!k) return { fehler: "Diese Einheit ist nicht beendet." };
  let ziel: { skill: repo.Skill; anzahl: number; level: number; vermeiden: string[] } | null = null;
  const start = aendere(unitId, o.teacherId, (i) => {
    const t = themaIn(i, themaId);
    const skill = t?.skillId ? repo.getSkill(t.skillId) : null;
    if (!t || !skill || t.stand === "schreiben") return "Dieses Thema gibt es hier nicht.";
    if (t.ki?.status === "laeuft") return "Die Aufgaben werden schon erstellt.";
    const n = Math.min(3, fehlt(t));
    if (!n) return "Hier fehlen keine Aufgaben.";
    if (o.automatisch && t.ki) return "Dafür hat die App schon einmal selbst gefragt.";
    const tor = nachschubTor(unitId, k.student.id, n);
    if (!tor.ki.erlaubt) return tor.ki.grund;
    if (o.automatisch && !tor.automatisch.erlaubt) return tor.automatisch.grund;
    t.ki = { status: "laeuft", problem: "", automatisch: o.automatisch };
    ziel = { skill, anzahl: n, level: t.level, vermeiden: i.themen.flatMap((x) => x.aufgaben.map((a) => a.task.prompt)) };
  });
  if ("fehler" in start || !ziel) return start;
  const z = ziel as { skill: repo.Skill; anzahl: number; level: number; vermeiden: string[] };
  let tasks: TaskDraft[] | null = null;
  let problem = "";
  try {
    const { contextForAI, studentContext, wortartenSetting } = await import("./builder");
    const ctx = studentContext(k.student.id);
    tasks = await generateWithAI(
      {
        subject: z.skill.subject,
        level: klassenLabel(k.student.school_type, k.student.klasse),
        skills: [{ id: z.skill.id, name: z.skill.name, area: z.skill.area, difficulty: DIFFICULTIES[z.level - 1] }],
        count: z.anzahl,
        categories: [],
        studentContext: ctx ? contextForAI(ctx, [z.skill.id]) : null,
        focusNote: "Hausübung: der Schüler löst sie allein zu Hause.",
        avoid: z.vermeiden,
        wortarten: wortartenSetting([z.skill.id], k.student.school_type, k.student.klasse ?? 1, ctx),
      },
      { teacherId: o.teacherId, unitId, trigger: o.automatisch ? "hausuebung_automatisch" : "hausuebung" },
      "neue_aufgabe",
    );
  } catch (e) {
    protokolliere("Hausübung: neue Aufgaben", e);
    problem = kiGrund(e);
  }
  const env = umgebung(unitId, k.student, k.tag);
  const gut = ohneAusgeblendete((tasks ?? []).map((t) => ({ ...t, skillId: t.skillId ?? z.skill.id, sourceType: "ki" }))).filter(
    (t) => !t.data.pruefen?.length && passtZurFaehigkeit(t, z.skill.id, oberfaehigkeit) && !env.fragen.has(gleicheFrage(t)),
  );
  // the proposal may have changed meanwhile: fill what is still missing, never more
  const r = zeileVon(unitId);
  if (!r || r.status !== "vorschlag") return { fehler: "Die Hausübung ist inzwischen entschieden." };
  const inhalt = inhaltVon(r);
  const t = themaIn(inhalt, themaId);
  if (!t) return { fehler: "Dieses Thema ist nicht mehr dabei." };
  const schon = belegt(inhalt);
  const neu = gut.filter((x) => !schon.has(aufgabeSchluessel(x))).slice(0, fehlt(t));
  t.aufgaben.push(...neu.map((task): HuAufgabe => ({ key: aufgabeSchluessel(task), task, herkunft: "ki", geprueft: false })));
  t.ki = neu.length ? { status: "fertig", problem: "", automatisch: o.automatisch } : { status: "fehler", problem: (problem || "Die KI hat keine passenden Aufgaben geliefert.").slice(0, 300), automatisch: o.automatisch };
  db().prepare("UPDATE einheit_hausuebung SET inhalt = ?, updated_at = datetime('now') WHERE unit_id = ? AND status = 'vorschlag'").run(JSON.stringify(inhalt), unitId);
  return neu.length ? { ok: true } : { fehler: t.ki!.problem };
}

/**
 * Von selbst, nach dem Zeigen des Abschlusses: für jedes Thema, dem ohne KI Aufgaben fehlen, eine Anfrage, nur im KI-Budget der Einheit
 * (Standard 0 € = nie) und nur einmal je Thema. Gibt die Zahl der Anfragen zurück.
 */
export async function kiAutomatisch(unitId: number): Promise<number> {
  const v = hausuebungDerEinheit(unitId);
  if (!v || v.status !== "vorschlag" || !v.ki.erlaubt || !v.ki.automatisch) return 0;
  let n = 0;
  for (const t of v.themen) {
    if (!fehlt(t) || t.ki || !t.skillId || t.stand === "schreiben") continue;
    const out = await kiAufgaben(unitId, t.id, { automatisch: true, teacherId: null });
    if ("ok" in out) n++;
  }
  return n;
}

// ---------- entscheiden ----------

/** Die Zeile von Abschluss und Dokumentation neu, wenn die Dokumentation schon bestätigt ist (nur in automatische Felder). */
function inDoku(unitId: number) {
  const lesson = repo.getLessonForUnit(unitId);
  if (lesson?.reviewed_at) schreibeAbschluss(lesson.id, karteDerEinheit(unitId, lesson));
}

/** „Heute keine Hausübung“: so in Abschluss und Dokumentation. Nichts geht an den Schüler. */
export function ueberspringe(unitId: number, teacherId: number | null): Ergebnis {
  if (!kontext(unitId)) return { fehler: "Diese Einheit ist nicht beendet." };
  const r = zeileVon(unitId);
  if (r?.status === "freigegeben") return { fehler: "Die Hausübung ist schon freigegeben." };
  db()
    .prepare(
      `INSERT INTO einheit_hausuebung (unit_id, status, doku, teacher_id, updated_at) VALUES (?, 'uebersprungen', ?, ?, datetime('now'))
       ON CONFLICT(unit_id) DO UPDATE SET status = 'uebersprungen', doku = excluded.doku, teacher_id = excluded.teacher_id, updated_at = excluded.updated_at`,
    )
    .run(unitId, KEINE_HAUSUEBUNG, teacherId);
  inDoku(unitId);
  return { ok: true };
}

/** „Doch eine Hausübung“: „keine Hausübung“ zurücknehmen; der Vorschlag kommt wieder (mit deinen Änderungen). */
export function zuruecknehmen(unitId: number): Ergebnis {
  const r = zeileVon(unitId);
  if (r?.status !== "uebersprungen") return { fehler: "Hier ist nichts zurückzunehmen." };
  const leer = !inhaltVon(r).themen.length;
  if (leer) db().prepare("DELETE FROM einheit_hausuebung WHERE unit_id = ?").run(unitId);
  else db().prepare("UPDATE einheit_hausuebung SET status = 'vorschlag', doku = '', updated_at = datetime('now') WHERE unit_id = ?").run(unitId);
  inDoku(unitId);
  return { ok: true };
}

/**
 * „Hausübung freigeben“: genau eine Übung für den Schüler (die Herkunft jeder Aufgabe bleibt, ohne Zuweisung zur Einheit, damit ihre
 * Antworten nicht als Unterricht zählen) und eine Hausübung dazu mit `unit_id`, Übung und Fälligkeit. Gesperrt, solange eine Aufgabe der
 * KI ungeprüft ist, neue Aufgaben noch entstehen oder die Fälligkeit fehlt. Die Zeile kommt in Abschluss und Dokumentation.
 */
export function freigeben(unitId: number, o: { faellig: string; teacherId: number | null }): { ok: true; worksheetId: number; homeworkId: number } | { fehler: string } {
  const v = hausuebungDerEinheit(unitId);
  const k = kontext(unitId);
  if (!v || !k) return { fehler: "Diese Einheit ist nicht beendet." };
  if (v.status !== "vorschlag") return { fehler: v.status === "freigegeben" ? "Die Hausübung ist schon freigegeben." : "Für heute ist „keine Hausübung“ eingetragen." };
  if (v.gesperrt) return { fehler: v.gesperrt };
  const faellig = o.faellig.trim();
  if (!istDatum(faellig)) return { fehler: "Bitte eine Fälligkeit wählen." };
  if (faellig < k.tag) return { fehler: "Die Fälligkeit liegt vor der Einheit." };
  const themen = v.themen.filter((t) => t.aufgaben.length);
  const tasks = themen.flatMap((t) => t.aufgaben.map((a) => ({ ...a.task, sourceType: a.task.sourceType ?? (a.herkunft === "ki" ? "ki" : "eigen") })));
  const skills = uniq(tasks.flatMap((t) => [t.skillId, ...(t.skillIds ?? [])]).filter((x): x is string => Boolean(x)));
  const levels = tasks.map((t) => levelOf(t.difficulty)).sort((a, b) => a - b);
  const quelle = tasks.some((t) => t.sourceType === "ki") ? "ki" : themen.every((t) => t.aufgaben.every((a) => a.herkunft === "generator")) ? "generator" : "manuell";
  const beschreibung = `${zusammenfassung(themen)}${v.notiz ? ` – ${v.notiz}` : ""}`;
  const doku = dokuZeile(themen, faellig);
  const first = k.student.name.split(" ")[0];
  let worksheetId = 0;
  let homeworkId = 0;
  db().transaction(() => {
    worksheetId = repo.createWorksheet(
      {
        title: `${first} – Hausübung: ${themen.map((t) => t.name).join(", ")}`.slice(0, 160),
        subject: repo.getSkill(skills[0] ?? "")?.subject ?? k.fach,
        grade: schulstufe(k.student.school_type, k.student.klasse ?? 1),
        school_type: k.student.school_type,
        klasse: k.student.klasse,
        topic: themen.map((t) => t.name).join(", ").slice(0, 160),
        difficulty: DIFFICULTIES[(levels[Math.floor((levels.length - 1) / 2)] ?? 3) - 1],
        task_type: "mixed",
        kind: "uebung",
        source: quelle,
        skill_ids: skills,
        student_id: k.student.id,
        teacher_id: o.teacherId,
        status: "freigegeben",
      },
      tasks,
    );
    const assignmentId = repo.assignWorksheet(worksheetId, k.student.id, "", null);
    homeworkId = repo.addHomework({ student_id: k.student.id, subject: k.fach, description: beschreibung, due_date: faellig, status: "offen", notes: "Hausübung vorbereitet (Abschluss)", assignment_id: assignmentId, unit_id: unitId });
    db()
      .prepare(
        `INSERT INTO einheit_hausuebung (unit_id, status, inhalt, notiz, faellig, doku, homework_id, worksheet_id, teacher_id, updated_at)
         VALUES (?, 'freigegeben', ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(unit_id) DO UPDATE SET status = 'freigegeben', inhalt = excluded.inhalt, faellig = excluded.faellig, doku = excluded.doku,
           homework_id = excluded.homework_id, worksheet_id = excluded.worksheet_id, teacher_id = excluded.teacher_id, updated_at = excluded.updated_at`,
      )
      .run(unitId, JSON.stringify({ themen: v.themen, ausPlan: v.ausPlan } satisfies Inhalt), v.notiz, faellig, doku, homeworkId, worksheetId, o.teacherId);
    // the documentation's own field for the homework, only when the teacher has not written one
    db().prepare("UPDATE lessons SET homework_note = ? WHERE id = ? AND TRIM(homework_note) = ''").run(doku, k.lesson.id);
  })();
  inDoku(unitId);
  return { ok: true, worksheetId, homeworkId };
}

