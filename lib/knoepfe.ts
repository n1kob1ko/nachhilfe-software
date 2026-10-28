/**
 * Die **Lehrer-Knöpfe** im Schritt (D1, niko, Abschnitt 8: „Der Lehrer steuert mit Knöpfen, die App passt sich an.“ Unterrichten
 * tut immer der Lehrer). Unter „Anpassen“ am Schritt auf dem Schirm fünf Knöpfe, alle mit dem, was es schon gibt (lib/cockpit.ts,
 * lib/steuerung.ts, lib/stundenplan.ts), kein zweites Steuersystem:
 *
 * 1. **Einfacher erklären**: ein einfacherer Text und ein neues, durchgerechnetes Beispiel derselben Fähigkeit, das in dieser
 *    Einheit noch nicht gezeigt oder gesendet wurde. Zuerst ohne KI: „Bei Fehler“ des Pakets, übernommene Anpassungen, eine schon
 *    gespeicherte einfachere Erklärung, die kurze Erklärung der Fähigkeit; das Beispiel aus Generator oder Bibliothek. Erst wenn
 *    kein Text übrig ist, bietet die Karte die KI an (auf Tippen, mit Kosten, gespeichert je Fähigkeit und Schulstufe,
 *    lib/ausfuehrlich.ts `einfacherTor` mit der Grenze des Schülers). Der frühere Text bleibt stehen.
 * 2. **Weitere Beispiele**: zwei durchgerechnete Beispiele (Aufgabe und Lösung), nie eines, das schon gezeigt oder gesendet
 *    wurde; Generator zuerst, dann Bibliothek; nur für den Lehrer.
 * 3. **Schwerere Aufgaben**: eine Übung derselben Fähigkeit eine Stufe höher (lib/steuerung.ts `sendeAngepasst`, A vor B, nur
 *    Aufgaben der Fähigkeit des Schritts), mit Vorschau vor dem Senden; Vorschau und Senden sind dieselben Aufgaben (`seed`). Haben
 *    Bestand und Generator dafür nichts, macht die KI sie (lib/ki-nachschub.ts, auf Tippen mit Kosten, im Budget der Einheit von
 *    selbst), immer erst als Vorschau „neu erstellt, ungeprüft“, mit „Senden“ oder „Drucken“.
 * 4. **Thema verstanden**: die Entscheidung des Lehrers, mit Zeit gespeichert. Der Rest des Themas wird weggelassen, die kurze
 *    Lernkontrolle bleibt, bis der Lehrer auch sie weglässt; der Rest der Einheit wird neu getaktet (nie länger als geplant). Der
 *    Abschluss nennt es als Beobachtung des Lehrers, nie als Ergebnis; der Lernstand ändert sich nur durch bewertete Antworten.
 * 5. **Anderes Thema**: die anderen Themen des Plans, die nächste Prüfung und die Empfehlung aus dem Lernstand. Die offenen
 *    Schritte des Themas auf dem Schirm kommen auf „Nächstes Mal“, nichts wird gelöscht (lib/cockpit.ts `anderesThema`). Mit einem
 *    eigens gewählten Lernpaket wird das Paket dabei ein Thema im Plan (`paketAlsPlan`), zur Wahl stehen die Themen des Plans für
 *    die ganze Einheit, Prüfung und Empfehlung.
 *
 * Bleibt am Ende Zeit, die kein Üben mehr nehmen kann (lib/stundenplan.ts `neuTakten`), kommt mit `themaDazu` ein Thema aus derselben
 * Wahl dazu, ohne etwas zu verschieben.
 *
 * Jedes Tippen, das etwas tut, steht in `einheit_knoepfe`; der Abschluss sagt daraus „Angepasst: einfacher erklärt (Past Simple),
 * schwerere Aufgaben (Past Simple)“. Mit der KI aus gehen 2–5 ganz, 1 ohne den KI-Text. Nichts hier kommt auf eine Schülerseite,
 * außer den Aufgaben, die der Lehrer bei „Schwerere Aufgaben“ sendet.
 */
import { anpassungen } from "./anpassen";
import { einfacherTor, erklaereAusfuehrlich, gespeicherteErklaerung, schulstufeVon } from "./ausfuehrlich";
import { aufgabeSchluessel, ausgeblendet } from "./bewertungen";
import {
  anderesThema,
  aufgabenImSchritt,
  themaDazu as themaInDieFreieZeit,
  beispielDerEinheit,
  beispielKandidaten,
  cockpit,
  erklaerungZu,
  fragbar,
  frageText,
  generatorSeed,
  gleicheFrage,
  knopfBeispielFragen,
  loesungText,
  paketAlsPlan,
  paketQuelle,
  planDerEinheit,
  skillsDesSchritts,
  ueberspringeSchritte,
  uebtFaehigkeit,
  type CockpitDaten,
  type PlanStep,
} from "./cockpit";
import { difficultyFor, levelOf } from "./curriculum";
import { db, json } from "./db";
import type { LernpaketSchritt } from "./lernpakete";
import { ANZAHL_VORSCHLAG, druckeNachschub, sendeNachschub, nachschub, type NachschubBedarf } from "./ki-nachschub";
import { alsEntwurf, NUTZBAR_SQL, oberfaehigkeit, passtZurFaehigkeit } from "./material-passt";
import { tagAddieren, wienerDatum } from "./planung/zeit";
import { nextSteps } from "./recommend";
import * as repo from "./repo";
import { analyzeStudent } from "./service";
import { ausGenerator, bestand, generatorKann, sendeAngepasst } from "./steuerung";
import type { Option } from "./steuerung-regeln";
import { themenDesPlans } from "./stundenplan";
import { shortDate } from "./summary";
import type { TaskDraft } from "./tasks";
import { getUnit } from "./units";

export type KnopfArt = "einfacher" | "beispiele" | "schwerer" | "verstanden" | "thema";
export const KNOPF_ARTEN: readonly KnopfArt[] = ["einfacher", "beispiele", "schwerer", "verstanden", "thema"];
export const KNOPF_LABEL: Record<KnopfArt, string> = {
  einfacher: "Einfacher erklären",
  beispiele: "Weitere Beispiele",
  schwerer: "Schwerere Aufgaben",
  verstanden: "Thema verstanden",
  thema: "Anderes Thema",
};

/** Ein durchgerechnetes Beispiel zum Vorrechnen: Aufgabe, Lösung, `frage` zum Vergleichen (lib/cockpit.ts `gleicheFrage`). */
export type Beispiel = { aufgabe: string; loesung: string; frage: string; herkunft: "generator" | "bibliothek" | "ki" };

/** Woher ein einfacherer Text kommt; „ki“: von der KI geschrieben (gespeichert je Fähigkeit und Schulstufe). */
export type TextQuelle = "paket" | "anpassung" | "faehigkeit" | "ki";
export const TEXT_QUELLE: Record<TextQuelle, string> = {
  paket: "Bei Fehler, aus dem Lernpaket",
  anpassung: "Deine übernommene Anpassung",
  faehigkeit: "Kurze Erklärung der Fähigkeit",
  ki: "Von der KI geschrieben, gespeichert für diese Fähigkeit und Schulstufe",
};

/** Was ein Tippen getan hat, je Art. */
export type KnopfInhalt = {
  /** einfacher: der einfachere Text, null = nichts Einfacheres gespeichert */
  text?: string | null;
  quelle?: TextQuelle | null;
  /** einfacher (eines) und beispiele (zwei) */
  beispiele?: Beispiel[];
  /** schwerer: die Stufe 1–5, die Übung und woher die Aufgaben kamen (C: neu von der KI, nach der Vorschau); gedruckt statt gesendet */
  stufe?: number;
  worksheetId?: number;
  quelleAufgaben?: "A" | "B" | "C";
  gedruckt?: boolean;
  /** verstanden: die weggelassenen Schritte und die Lernkontrolle, die bleibt */
  schritte?: number[];
  kontrolle?: number | null;
  /** thema: von welchem Thema zu welchem, die verschobenen Schritte und der Schritt, mit dem es weitergeht */
  von?: string | null;
  nach?: string;
  verschoben?: number[];
  ziel?: number;
  /** thema: in die freie Zeit dazugenommen, nichts verschoben (`themaDazu`) */
  dazu?: boolean;
};

export type KnopfEintrag = { id: number; unitId: number; schrittId: number | null; art: KnopfArt; skillId: string | null; thema: string; inhalt: KnopfInhalt; at: string };

type Row = { id: number; unit_id: number; schritt_id: number | null; art: string; skill_id: string | null; thema: string; inhalt: string; created_at: string };
const zuEintrag = (r: Row): KnopfEintrag => ({ id: r.id, unitId: r.unit_id, schrittId: r.schritt_id, art: r.art as KnopfArt, skillId: r.skill_id, thema: r.thema, inhalt: json<KnopfInhalt>(r.inhalt, {}), at: r.created_at });

/** Alle Tipps auf die Knöpfe in dieser Einheit, ältester zuerst. */
export function knoepfeDerEinheit(unitId: number): KnopfEintrag[] {
  return (db().prepare("SELECT * FROM einheit_knoepfe WHERE unit_id = ? ORDER BY id").all(unitId) as Row[]).map(zuEintrag);
}

function eintrag(id: number): KnopfEintrag | null {
  const r = db().prepare("SELECT * FROM einheit_knoepfe WHERE id = ?").get(id) as Row | undefined;
  return r ? zuEintrag(r) : null;
}

function merke(unitId: number, e: { schrittId: number | null; art: KnopfArt; skillId: string | null; thema: string | null; inhalt: KnopfInhalt; teacherId: number | null }): number {
  return Number(
    db()
      .prepare("INSERT INTO einheit_knoepfe (unit_id, schritt_id, art, skill_id, thema, inhalt, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(unitId, e.schrittId, e.art, e.skillId, e.thema ?? "", JSON.stringify(e.inhalt), e.teacherId).lastInsertRowid,
  );
}

const setzeInhalt = (id: number, inhalt: KnopfInhalt) => db().prepare("UPDATE einheit_knoepfe SET inhalt = ? WHERE id = ?").run(JSON.stringify(inhalt), id);

// ---------- the step on screen ----------

/**
 * Was die Knöpfe über einen Schritt wissen müssen: seine Fähigkeit, sein Thema (im Plan das Thema, mit Lernpaket der Titel,
 * sonst der Name der Fähigkeit), der Planschritt oder Schritt des Pakets und was unter „Das sagst du“ steht.
 */
export type SchrittLage = { schrittId: number; skillId: string | null; thema: string | null; plan: PlanStep | null; paketSchritt: LernpaketSchritt | null; sagt: string | null; imPaket: boolean };

export function schrittLage(c: CockpitDaten, schrittId: number, studentStufe: number | null = null): SchrittLage | null {
  if (c.paket) {
    const s = c.schritte.find((x) => x.id === schrittId);
    if (!s) return null;
    return { schrittId, skillId: skillsDesSchritts(s)[0] ?? null, thema: c.paket.title, plan: null, paketSchritt: s, sagt: s.lehrer_sagt.trim() || null, imPaket: true };
  }
  const p = c.plan.find((x) => x.id === schrittId);
  if (!p) return null;
  const q = c.planQuellen.get(p.id)?.schritt ?? null;
  const skillId = p.skillId ?? (q ? (skillsDesSchritts(q)[0] ?? null) : null);
  const name = skillId ? (repo.getSkill(skillId)?.name ?? null) : null;
  const ausfuehrlich = skillId && studentStufe !== null ? gespeicherteErklaerung(skillId, studentStufe)?.sagt : null;
  const sagt = q ? q.lehrer_sagt.trim() || null : ausfuehrlich || erklaerungZu(skillId);
  return { schrittId, skillId, thema: p.thema ?? name, plan: p, paketSchritt: q, sagt, imPaket: false };
}

/** Ist der Schritt eine Lernkontrolle (im Plan, im Schritt eines Pakets oder im gewählten Paket)? */
function istKontrolle(c: CockpitDaten, id: number): boolean {
  if (c.paket) return c.schritte.find((x) => x.id === id)?.art === "kontrolle";
  const p = c.plan.find((x) => x.id === id);
  if (!p) return false;
  return p.art === "kontrolle" || (paketQuelle(p) !== null && c.planQuellen.get(p.id)?.schritt.art === "kontrolle");
}

const fertig = (c: CockpitDaten, id: number) => c.stand.erledigt.includes(id) || c.stand.uebersprungen.includes(id);

/** Läuft die Einheit, und gibt es den Schüler? Sonst der Grund. */
function laufend(unitId: number): { unit: NonNullable<ReturnType<typeof getUnit>>; student: repo.Student } | { fehler: string } {
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet") return { fehler: "Diese Einheit läuft nicht mehr." };
  const student = repo.getStudent(unit.student_id);
  return student ? { unit, student } : { fehler: "Schüler nicht gefunden." };
}

// ---------- examples that were never shown or sent ----------

/** Was in dieser Einheit schon gezeigt oder gesendet ist (als `gleicheFrage`): Übungen, bereite Übungen, Beispiele, die Aufgaben des Schritts. */
function schonGezeigt(unitId: number, c: CockpitDaten, lage: SchrittLage): Set<string> {
  const blaetter = db().prepare("SELECT DISTINCT worksheet_id FROM assignments WHERE unit_id = ?").all(unitId) as { worksheet_id: number }[];
  const fragen = blaetter.flatMap((w) => repo.listTasks(w.worksheet_id).map(gleicheFrage));
  const bereit = (db().prepare("SELECT aufgaben FROM einheit_bereit WHERE unit_id = ?").all(unitId) as { aufgaben: string }[]).flatMap((r) => json<TaskDraft[]>(r.aufgaben, []).map(gleicheFrage));
  const beispiel = lage.skillId ? beispielDerEinheit(unitId, lage.skillId) : null;
  const imSchritt = lage.paketSchritt ? lage.paketSchritt.aufgaben : lage.plan ? aufgabenImSchritt(unitId, { ...lage.plan, skillId: lage.skillId }, c.stand.gesendet[lage.plan.id] ?? []) : [];
  return new Set([...fragen, ...bereit, ...(beispiel ? [gleicheFrage(beispiel)] : []), ...imSchritt.map(gleicheFrage), ...knopfBeispielFragen(unitId)]);
}

/** Aufgaben der Fähigkeit aus der Bibliothek und freigegebenen Übungen, die der Schüler sehen darf (lib/material-passt.ts); nichts schlecht Bewertetes. */
function ausDerBibliothek(studentId: number, skillId: string): TaskDraft[] {
  const ids = db()
    .prepare(
      `SELECT t.id FROM tasks t JOIN worksheets w ON w.id = t.worksheet_id
       WHERE w.archived_at IS NULL AND (w.status = 'freigegeben' OR w.kind = 'bibliothek') AND w.kind IN ('uebung', 'ueberpruefung', 'bibliothek')
         AND w.probe_test_id IS NULL AND ${NUTZBAR_SQL}
         AND (t.skill_id = ? OR EXISTS (SELECT 1 FROM task_skills ts WHERE ts.task_id = t.id AND ts.skill_id = ?))
       ORDER BY w.kind = 'bibliothek' DESC, t.id LIMIT 40`,
    )
    .all(studentId, studentId, skillId, skillId) as { id: number }[];
  const weg = ausgeblendet();
  return ids
    .map(({ id }) => repo.getTask(id))
    .filter((t): t is repo.Task => Boolean(t))
    .map(alsEntwurf)
    .filter((t) => !weg.has(aufgabeSchluessel(t)) && !t.data?.pruefen?.length);
}

/**
 * Neue durchgerechnete Beispiele zur Fähigkeit des Schritts, höchstens `n`: aus den Generatoren (mit eigenem Seed je Tippen),
 * dann aus der Bibliothek; nur Aufgaben dieser Fähigkeit, zum Vorlesen, mit Lösung, nie eine, die in dieser Einheit schon gezeigt
 * oder gesendet ist. Ohne KI; leer, wenn nichts mehr da ist.
 */
export function neueBeispiele(unitId: number, c: CockpitDaten, lage: SchrittLage, n: number): Beispiel[] {
  const unit = getUnit(unitId);
  const skillId = lage.skillId;
  if (!unit || !skillId) return [];
  const schon = schonGezeigt(unitId, c, lage);
  const out: Beispiel[] = [];
  const nimm = (t: TaskDraft, herkunft: Beispiel["herkunft"]) => {
    if (out.length >= n || !fragbar(t) || !uebtFaehigkeit(t, skillId)) return;
    const loesung = loesungText(t).trim();
    const frage = gleicheFrage(t);
    if (!loesung || schon.has(frage)) return;
    schon.add(frage);
    out.push({ aufgabe: frageText(t), loesung, frage, herkunft });
  };
  const runde = (db().prepare("SELECT COUNT(*) FROM einheit_knoepfe WHERE unit_id = ? AND skill_id = ? AND art IN ('einfacher', 'beispiele')").pluck().get(unitId, skillId) as number) * 4;
  for (let r = 1; r <= 4 && out.length < n; r++) for (const t of beispielKandidaten(unitId, skillId, runde + r)) nimm(t, "generator");
  if (out.length < n) for (const t of ausDerBibliothek(unit.student_id, skillId)) nimm(t, "bibliothek");
  return out;
}

// ---------- 1. Einfacher erklären ----------

const norm = (x: string) => x.replace(/\s+/g, " ").trim().toLowerCase();

/** Die einfacheren Texte zum Schritt, die es ohne neue KI gibt, in dieser Reihenfolge; keiner gleich dem, was schon dasteht. */
export function einfacheTexte(unitId: number, lage: SchrittLage, schulstufe: number): { text: string; quelle: TextQuelle }[] {
  const out: { text: string; quelle: TextQuelle }[] = [];
  const ps = lage.paketSchritt;
  if (ps?.bei_fehler.trim()) out.push({ text: ps.bei_fehler.trim(), quelle: "paket" });
  if (ps)
    for (const a of anpassungen(unitId, "uebernommen"))
      if (a.schritt_id === ps.id && (a.art === "leichter" || a.art === "beispiel" || a.art === "bei_fehler") && a.text.trim()) out.push({ text: a.text.trim(), quelle: "anpassung" });
  if (lage.skillId) {
    const ki = gespeicherteErklaerung(lage.skillId, schulstufe, "einfach");
    if (ki?.sagt) out.push({ text: ki.sagt, quelle: "ki" });
    // the skill's short explanation, when the step says something longer (a package step's own script)
    const kurz = erklaerungZu(lage.skillId);
    if (kurz && lage.sagt && kurz.trim().length < lage.sagt.length) out.push({ text: kurz.trim(), quelle: "faehigkeit" });
  }
  const da = new Set(lage.sagt ? [norm(lage.sagt)] : []);
  return out.filter((t) => {
    const k = norm(t.text);
    if (da.has(k)) return false;
    da.add(k);
    return true;
  });
}

/** Die einfacheren Texte, die diese Einheit zur Fähigkeit schon gezeigt hat (`norm`). */
const schonErklaert = (unitId: number, skillId: string) =>
  new Set(
    knoepfeDerEinheit(unitId)
      .filter((e) => e.art === "einfacher" && e.skillId === skillId && e.inhalt.text)
      .map((e) => norm(e.inhalt.text!)),
  );

/**
 * Was die Karte unter „Einfacher:“ ohne Text anbietet: die KI (mit Kosten oder dem Grund, warum nicht), oder null, wenn es nichts
 * anzubieten gibt (ein Text steht da, oder die KI-Erklärung zu Fähigkeit und Schulstufe ist schon gespeichert und gezeigt).
 */
export function einfacherKiAngebot(e: Pick<KnopfEintrag, "skillId" | "inhalt">, student: repo.Student): ReturnType<typeof einfacherTor> | null {
  if (e.inhalt.text || !e.skillId) return null;
  if (gespeicherteErklaerung(e.skillId, schulstufeVon(student), "einfach")) return null;
  return einfacherTor(student.id);
}

/**
 * „Einfacher erklären“: der nächste einfachere Text, der in dieser Einheit noch nicht kam, und ein neues Beispiel, beides ohne
 * KI. Ist kein Text mehr übrig, bleibt er leer; die Karte bietet dann die KI an (`einfacherMitKi`). Gibt den Eintrag zurück.
 */
export function einfacherErklaeren(unitId: number, schrittId: number, teacherId: number | null): { ok: true; id: number; eintrag: KnopfInhalt } | { fehler: string } {
  const l = laufend(unitId);
  if ("fehler" in l) return l;
  const c = cockpit(unitId, { mitPlan: true });
  const stufe = schulstufeVon(l.student);
  const lage = schrittLage(c, schrittId, stufe);
  if (!lage) return { fehler: "Dieser Schritt gehört nicht zur Einheit." };
  if (!lage.skillId) return { fehler: "Zu diesem Schritt gibt es keine Fähigkeit." };
  const benutzt = schonErklaert(unitId, lage.skillId);
  const text = einfacheTexte(unitId, lage, stufe).find((t) => !benutzt.has(norm(t.text))) ?? null;
  const inhalt: KnopfInhalt = { text: text?.text ?? null, quelle: text?.quelle ?? null, beispiele: neueBeispiele(unitId, c, lage, 1) };
  const id = merke(unitId, { schrittId, art: "einfacher", skillId: lage.skillId, thema: lage.thema, inhalt, teacherId });
  return { ok: true, id, eintrag: inhalt };
}

/**
 * Die einfachere Erklärung der KI für einen Eintrag ohne Text: nur auf Tippen, nur wenn nichts Einfacheres gespeichert ist und
 * die KI darf (Schalter, Budget, Grenze des Schülers). Gespeichert je Fähigkeit und Schulstufe: danach für jeden Schüler ohne Kosten.
 */
export async function einfacherMitKi(unitId: number, eintragId: number, teacherId: number | null): Promise<{ ok: true } | { fehler: string }> {
  const l = laufend(unitId);
  if ("fehler" in l) return l;
  const e = eintrag(eintragId);
  if (!e || e.unitId !== unitId || e.art !== "einfacher" || !e.skillId) return { fehler: "Diesen Schritt gibt es nicht mehr." };
  if (e.inhalt.text) return { ok: true };
  const stufe = schulstufeVon(l.student);
  // already written for this skill and Schulstufe: free, unless this unit has shown it already (then there is nothing simpler)
  const schon = gespeicherteErklaerung(e.skillId, stufe, "einfach")?.sagt;
  if (schon && schonErklaert(unitId, e.skillId).has(norm(schon))) return { fehler: "Mehr Einfacheres ist dazu nicht gespeichert; der frühere Text steht darunter." };
  if (!schon) {
    const tor = einfacherTor(l.student.id);
    if (!tor.erlaubt) return { fehler: tor.grund };
  }
  const out = await erklaereAusfuehrlich(e.skillId, stufe, teacherId, "einfach", unitId);
  if (!out.ok) return { fehler: out.error };
  if (!out.inhalt.sagt) return { fehler: "Die KI hat keine brauchbare einfachere Erklärung geliefert." };
  const b = out.inhalt.beispiel;
  const beispiele = e.inhalt.beispiele?.length || !b ? (e.inhalt.beispiele ?? []) : [{ aufgabe: b.aufgabe, loesung: [...b.rechnung, b.loesung].filter(Boolean).join("\n"), frage: norm(b.aufgabe), herkunft: "ki" as const }];
  setzeInhalt(e.id, { ...e.inhalt, text: out.inhalt.sagt, quelle: "ki", beispiele });
  return { ok: true };
}

// ---------- 2. Weitere Beispiele ----------

/** „Weitere Beispiele“: zwei neue durchgerechnete Beispiele, nur für den Lehrer, ohne KI. */
export function weitereBeispiele(unitId: number, schrittId: number, teacherId: number | null): { ok: true; beispiele: Beispiel[] } | { fehler: string } {
  const l = laufend(unitId);
  if ("fehler" in l) return l;
  const c = cockpit(unitId, { mitPlan: true });
  const lage = schrittLage(c, schrittId, schulstufeVon(l.student));
  if (!lage) return { fehler: "Dieser Schritt gehört nicht zur Einheit." };
  if (!lage.skillId) return { fehler: "Zu diesem Schritt gibt es keine Fähigkeit." };
  const beispiele = neueBeispiele(unitId, c, lage, 2);
  const name = repo.getSkill(lage.skillId)?.name ?? "dieser Fähigkeit";
  if (!beispiele.length) return { fehler: `Zu ${name} gibt es ohne KI gerade keine weiteren Beispiele.` };
  merke(unitId, { schrittId, art: "beispiele", skillId: lage.skillId, thema: lage.thema, inhalt: { beispiele }, teacherId });
  return { ok: true, beispiele };
}

// ---------- 3. Schwerere Aufgaben ----------

const mitte = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)];

/** Die Stufe 1–5, auf der die Fähigkeit gerade geübt wird: die der letzten Übung dazu in dieser Einheit, sonst nach dem Lernstand. */
export function aktuelleStufe(unitId: number, studentId: number, skillId: string): number {
  const r = db()
    .prepare("SELECT a.worksheet_id FROM assignments a JOIN worksheets w ON w.id = a.worksheet_id WHERE a.unit_id = ? AND EXISTS (SELECT 1 FROM json_each(w.skill_ids) j WHERE j.value = ?) ORDER BY a.id DESC LIMIT 1")
    .get(unitId, skillId) as { worksheet_id: number } | undefined;
  const stufen = r
    ? repo
        .listTasks(r.worksheet_id)
        .filter((t) => passtZurFaehigkeit(t, skillId, oberfaehigkeit))
        .map((t) => t.level ?? levelOf(t.difficulty))
    : [];
  if (stufen.length) return mitte(stufen);
  const mastery = analyzeStudent(studentId)?.skills.find((s) => s.skill.id === skillId)?.mastery ?? null;
  return levelOf(difficultyFor(mastery));
}

export type SchwererVorschau = { option: Option; stufe: number; skill: string; aufgaben: TaskDraft[]; quelle: "A" | "B"; seed: number };

/**
 * Die Vorschau für „Schwerere Aufgaben“: dieselbe Fähigkeit, eine Stufe höher, aus dem Bestand (A), sonst aus den Generatoren
 * (B, mit festem Seed, damit genau diese Aufgaben gesendet werden). Nur Aufgaben der Fähigkeit des Schritts. Haben beide nichts, kommt
 * mit dem Grund die `option` zurück: dafür kann die KI Aufgaben machen (`schwererBedarf`).
 */
export function schwererVorschau(unitId: number, schrittId: number, c: CockpitDaten = cockpit(unitId, { mitPlan: true })): SchwererVorschau | { fehler: string; option?: Option } {
  const l = laufend(unitId);
  if ("fehler" in l) return l;
  const lage = schrittLage(c, schrittId);
  if (!lage) return { fehler: "Dieser Schritt gehört nicht zur Einheit." };
  const skill = lage.skillId ? repo.getSkill(lage.skillId) : null;
  if (!skill) return { fehler: "Zu diesem Schritt gibt es keine Fähigkeit." };
  const jetzt = aktuelleStufe(unitId, l.student.id, skill.id);
  if (jetzt >= 5) return { fehler: `${skill.name} übt ${l.student.name.split(" ")[0]} schon auf der schwersten Stufe (5 von 5).` };
  const option: Option = { art: "schwerer", skillId: skill.id, level: jetzt + 1, fokus: null };
  const schon = db().prepare("SELECT COUNT(*) FROM einheit_knoepfe WHERE unit_id = ? AND art = 'schwerer' AND skill_id = ?").pluck().get(unitId, skill.id) as number;
  const seed = generatorSeed(unitId, `${skill.id}:schwerer:${schon}`);
  const a = bestand(unitId, option, c);
  const aufgaben = a.length ? a : generatorKann(option) ? ausGenerator(unitId, option, seed) : [];
  if (!aufgaben.length) return { fehler: `Auf Stufe ${jetzt + 1} gibt es zu ${skill.name} gerade keine Aufgaben ohne KI.`, option };
  return { option, stufe: jetzt + 1, skill: skill.name, aufgaben, quelle: a.length ? "A" : "B", seed };
}

/** „Senden“ in der Vorschau: genau diese Aufgaben an den Schüler dieser Einheit (lib/steuerung.ts `sendeAngepasst`), dann gemerkt. */
export function sendeSchwerer(unitId: number, schrittId: number, teacherId: number | null): { worksheetId: number; assignmentId: number } | { fehler: string } {
  const c = cockpit(unitId, { mitPlan: true });
  const v = schwererVorschau(unitId, schrittId, c);
  if ("fehler" in v) return v;
  const out = sendeAngepasst(unitId, v.option, teacherId, c, v.seed);
  if ("fehler" in out) return out;
  const lage = schrittLage(c, schrittId);
  merke(unitId, { schrittId, art: "schwerer", skillId: v.option.skillId, thema: lage?.thema ?? v.skill, inhalt: { stufe: v.stufe, worksheetId: out.worksheetId, quelleAufgaben: out.quelle }, teacherId });
  return { worksheetId: out.worksheetId, assignmentId: out.assignmentId };
}

/**
 * Wofür die KI bei „Schwerere Aufgaben“ neue Aufgaben macht, wenn Bestand und Generator nichts haben: dieselbe Fähigkeit und Stufe,
 * zwei Aufgaben (wie „Neue passende Aufgabe erstellen“), als Vorschau im Schritt (lib/ki-nachschub.ts). Je Schritt, Stufe und Runde
 * (wie oft schon schwerer gesendet) ein Schlüssel: nach dem Senden fragt ein neues Tippen neu.
 */
export function schwererBedarf(unitId: number, schrittId: number, o: Option): NachschubBedarf | null {
  if (o.art !== "schwerer" || !o.skillId || !o.level) return null;
  const runde = db().prepare("SELECT COUNT(*) FROM einheit_knoepfe WHERE unit_id = ? AND art = 'schwerer' AND skill_id = ?").pluck().get(unitId, o.skillId) as number;
  return { schluessel: `knopf:schwerer:${schrittId}:${o.skillId}:${o.level}:${runde}`, schrittId, ziel: { art: "schwerer", skillId: o.skillId, level: o.level, fokus: null, kontrolle: false, anzahl: ANZAHL_VORSCHLAG }, dazu: [] };
}

/** Die neuen Aufgaben der KI zu „Schwerere Aufgaben“ dieses Schritts (`schwererBedarf`), oder null. */
function schwererKi(unitId: number, schrittId: number, id: number) {
  const n = nachschub(id);
  return n && n.unitId === unitId && n.ziel.art === "schwerer" && n.schluessel.startsWith(`knopf:schwerer:${schrittId}:`) ? n : null;
}

/** „Senden“ in der Vorschau der KI zu „Schwerere Aufgaben“: genau diese an den Schüler (lib/ki-nachschub.ts `sendeNachschub`), dann gemerkt. */
export async function sendeSchwererKi(unitId: number, schrittId: number, id: number, teacherId: number | null): Promise<{ worksheetId: number; assignmentId: number } | { fehler: string }> {
  const n = schwererKi(unitId, schrittId, id);
  if (!n) return { fehler: "Diese Aufgaben gehören nicht zu diesem Schritt." };
  const thema = schrittLage(cockpit(unitId, { mitPlan: true }), schrittId)?.thema ?? repo.getSkill(n.ziel.skillId)?.name ?? "";
  const out = await sendeNachschub(unitId, id, teacherId);
  if ("fehler" in out) return out;
  merke(unitId, { schrittId, art: "schwerer", skillId: n.ziel.skillId, thema, inhalt: { stufe: n.ziel.level, worksheetId: out.worksheetId, quelleAufgaben: "C" }, teacherId });
  return out;
}

/** „Drucken“ in derselben Vorschau: genau diese Aufgaben auf Papier (`druckeNachschub`), gemerkt wie gesendet, mit „gedruckt“. */
export async function druckeSchwererKi(unitId: number, schrittId: number, id: number, teacherId: number | null): Promise<{ worksheetId: number } | { fehler: string }> {
  const n = schwererKi(unitId, schrittId, id);
  if (!n) return { fehler: "Diese Aufgaben gehören nicht zu diesem Schritt." };
  const schon = n.status === "gedruckt";
  const thema = schrittLage(cockpit(unitId, { mitPlan: true }), schrittId)?.thema ?? repo.getSkill(n.ziel.skillId)?.name ?? "";
  const out = await druckeNachschub(unitId, id, teacherId);
  if ("fehler" in out) return out;
  if (!schon) merke(unitId, { schrittId, art: "schwerer", skillId: n.ziel.skillId, thema, inhalt: { stufe: n.ziel.level, worksheetId: out.worksheetId, quelleAufgaben: "C", gedruckt: true }, teacherId });
  return out;
}

// ---------- 4. Thema verstanden ----------

/**
 * „Thema verstanden“: die Entscheidung des Lehrers. Die offenen Schritte des Themas werden weggelassen (übersprungen, im Abschluss
 * nicht zum Wiederholen), außer der ersten offenen Lernkontrolle: sie bleibt, kurz, und steht danach auf dem Schirm. Der Rest
 * der Einheit wird neu getaktet. Der Lernstand bleibt, wie er ist.
 */
export function themaVerstanden(unitId: number, schrittId: number, teacherId: number | null): { ok: true; weggelassen: number[]; kontrolle: number | null } | { fehler: string } {
  const l = laufend(unitId);
  if ("fehler" in l) return l;
  const c = cockpit(unitId, { mitPlan: true });
  const lage = schrittLage(c, schrittId);
  if (!lage) return { fehler: "Dieser Schritt gehört nicht zur Einheit." };
  const p = lage.plan;
  const gruppe = c.paket
    ? c.schritte.map((x) => x.id)
    : p?.thema
      ? c.plan.filter((x) => x.thema === p.thema).map((x) => x.id)
      : p?.skillId
        ? c.plan.filter((x) => x.skillId === p.skillId).map((x) => x.id)
        : [];
  if (!gruppe.length) return { fehler: "Dieser Schritt gehört zu keinem Thema." };
  const offen = gruppe.filter((id) => !fertig(c, id));
  const kontrolle = offen.find((id) => istKontrolle(c, id)) ?? null;
  const weg = offen.filter((id) => id !== kontrolle);
  if (!weg.length && kontrolle === null) return { fehler: "Von diesem Thema ist nichts mehr offen." };
  if (!ueberspringeSchritte(unitId, schrittId, weg, kontrolle)) return { fehler: "Dieser Schritt gehört nicht zur Einheit." };
  merke(unitId, { schrittId, art: "verstanden", skillId: lage.skillId, thema: lage.thema, inhalt: { schritte: weg, kontrolle }, teacherId });
  return { ok: true, weggelassen: weg, kontrolle };
}

/** Nach „Thema verstanden“ auch die kurze Lernkontrolle weglassen (die Entscheidung des Lehrers). */
export function kontrolleWeglassen(unitId: number, eintragId: number): { ok: true } | { fehler: string } {
  const l = laufend(unitId);
  if ("fehler" in l) return l;
  const e = eintrag(eintragId);
  const k = e?.inhalt.kontrolle ?? null;
  if (!e || e.unitId !== unitId || e.art !== "verstanden" || k === null) return { fehler: "Diese Lernkontrolle gibt es nicht mehr." };
  if (!ueberspringeSchritte(unitId, k, [k])) return { fehler: "Diese Lernkontrolle gibt es nicht mehr." };
  setzeInhalt(e.id, { ...e.inhalt, schritte: [...(e.inhalt.schritte ?? []), k], kontrolle: null });
  return { ok: true };
}

// ---------- 5. Anderes Thema ----------

/** Eine Wahl unter „Anderes Thema“: ein Thema des Plans oder eine Fähigkeit, die neu dazukommt, mit dem Grund. */
export type ThemaWahl = { art: "plan"; name: string; minuten: number; warum: string } | { art: "neu"; skillId: string; name: string; warum: string };

/** So viele Fähigkeiten außerhalb des Plans stehen höchstens zur Wahl. */
export const NEU_MAX = 4;

/**
 * Wohin „Anderes Thema“ wechseln kann: die anderen Themen des Plans mit offenen Schritten, dann der Stoff der nächsten Prüfung
 * im Fach (bis 30 Tage) und die Empfehlung aus dem Lernstand, ohne was schon im Plan steht. Mit einem eigens gewählten Lernpaket
 * zuerst die Themen des Plans für die ganze Einheit (lib/stundenplan.ts) als neue Fähigkeiten, ohne die des Pakets.
 */
export function themenZurWahl(unitId: number, c: CockpitDaten, schrittId: number | null): ThemaWahl[] {
  const unit = getUnit(unitId);
  if (!unit || (!c.paket && !c.plan.length)) return [];
  const jetzt = schrittId === null || c.paket ? null : (c.plan.find((x) => x.id === schrittId)?.thema ?? null);
  const plan: ThemaWahl[] = c.paket
    ? []
    : themenDesPlans(c.plan)
        .filter((t) => t.name !== jetzt && t.ids.some((id) => !fertig(c, id)))
        .map((t) => ({ art: "plan", name: t.name, minuten: t.ids.reduce((a, id) => a + (fertig(c, id) ? 0 : (c.plan.find((x) => x.id === id)?.minuten ?? 0)), 0), warum: t.ids.every((id) => fertig(c, id) || c.verschoben.has(id)) ? "Nächstes Mal geplant" : "Im Plan für heute" }));
  const fach = unit.subject ?? "";
  const imPlan = new Set(c.paket ? [...c.paket.skill_ids, ...c.schritte.flatMap(skillsDesSchritts)] : c.plan.map((x) => x.skillId).filter((x): x is string => Boolean(x)));
  // with a chosen package: the topics the plan for the whole unit would have had (without the package), in their order
  const ganz = c.paket
    ? [...new Set(planDerEinheit(unitId).filter((x) => x.thema && x.skillId && x.art !== "grundlage").map((x) => x.skillId!))].map((id) => ({ id, warum: "Im Plan für die ganze Einheit" }))
    : [];
  const heute = wienerDatum();
  const bis = tagAddieren(heute, 30);
  const pruefung = repo
    .upcomingTests(heute, unit.student_id)
    .filter((t) => t.date <= bis && (!fach || !t.subject || t.subject === fach))
    .flatMap((t) => t.skill_ids.map((id) => ({ id, warum: `${t.kind || "Prüfung"} ${shortDate(t.date)}` })));
  const empfohlen = nextSteps(unit.student_id, { today: heute, limit: 6 })
    .filter((s) => !fach || s.skill.subject === fach)
    .map((s) => ({ id: s.skill.id, warum: "Empfehlung aus dem Lernstand" }));
  const neu: ThemaWahl[] = [];
  for (const k of [...ganz, ...pruefung, ...empfohlen]) {
    const skill = repo.getSkill(k.id);
    if (!skill || imPlan.has(k.id) || neu.some((n) => n.art === "neu" && n.skillId === k.id) || plan.some((p) => p.name === skill.name)) continue;
    if (neu.length < NEU_MAX) neu.push({ art: "neu", skillId: skill.id, name: skill.name, warum: k.warum });
  }
  return [...plan, ...neu];
}

/**
 * „Anderes Thema“: wechselt zu einem Thema aus `themenZurWahl` (nichts anderes); die offenen Schritte des Themas auf dem Schirm
 * kommen auf „Nächstes Mal“, nichts wird gelöscht, der Rest wird neu getaktet. Mit einem eigens gewählten Lernpaket wird das Paket
 * zuerst ein Thema im Plan (lib/cockpit.ts `paketAlsPlan`, mit seinem Stand); seine offenen Schritte kommen auf „Nächstes Mal“.
 */
export function wechsleThema(unitId: number, schrittId: number, wahl: { thema?: string | null; skillId?: string | null }, teacherId: number | null): { ok: true; verschoben: number[]; nach: string } | { fehler: string } {
  const l = laufend(unitId);
  if ("fehler" in l) return l;
  const c = cockpit(unitId, { mitPlan: true });
  if (c.paket && !c.schritte.some((x) => x.id === schrittId)) return { fehler: "Dieser Schritt gehört nicht zur Einheit." };
  const w = themenZurWahl(unitId, c, schrittId).find((x) => (x.art === "plan" ? Boolean(wahl.thema) && x.name === wahl.thema : Boolean(wahl.skillId) && x.skillId === wahl.skillId));
  if (!w) return { fehler: "Dieses Thema steht nicht zur Wahl." };
  if (c.paket && !paketAlsPlan(unitId)) return { fehler: "Dieses Lernpaket gibt es nicht mehr." };
  const out = anderesThema(unitId, schrittId, w.art === "plan" ? { thema: w.name } : { skillId: w.skillId, name: w.name });
  if ("fehler" in out) return out;
  const nachher = cockpit(unitId, { mitPlan: true });
  const zielSkill = nachher.plan.find((x) => x.id === out.ziel)?.skillId ?? null;
  merke(unitId, { schrittId, art: "thema", skillId: zielSkill, thema: out.von, inhalt: { von: out.von, nach: w.name, verschoben: out.verschoben, ziel: out.ziel }, teacherId });
  return { ok: true, verschoben: out.verschoben, nach: w.name };
}

/**
 * Zeit frei am Ende, die kein Üben mehr nehmen kann (lib/stundenplan.ts `neuTakten`): ein Thema aus der Wahl von „Anderes Thema“
 * (nur neue Fähigkeiten: Prüfung, Empfehlung) kommt vor den Abschluss, in genau diese Minuten; nichts wird verschoben.
 */
export function themaDazu(unitId: number, skillId: string, teacherId: number | null): { ok: true; nach: string } | { fehler: string } {
  const l = laufend(unitId);
  if ("fehler" in l) return l;
  const c = cockpit(unitId, { mitPlan: true });
  if (c.paket) return { fehler: "Dieses Thema steht nicht zur Wahl." };
  const w = themenZurWahl(unitId, c, null).find((x) => x.art === "neu" && x.skillId === skillId);
  if (!w || w.art !== "neu") return { fehler: "Dieses Thema steht nicht zur Wahl." };
  const out = themaInDieFreieZeit(unitId, { skillId: w.skillId });
  if ("fehler" in out) return out;
  merke(unitId, { schrittId: out.ziel, art: "thema", skillId: w.skillId, thema: null, inhalt: { von: null, nach: w.name, verschoben: [], ziel: out.ziel, dazu: true }, teacherId });
  return { ok: true, nach: w.name };
}

// ---------- for the Abschluss ----------

const ART_TEXT: Partial<Record<KnopfArt, string>> = { einfacher: "einfacher erklärt", beispiele: "weitere Beispiele", schwerer: "schwerere Aufgaben" };

/**
 * Die Zeile für den Abschluss: „Angepasst: einfacher erklärt (Past Simple), schwerere Aufgaben (Past Simple), anderes Thema
 * (Present Perfect statt Past Simple)“; null ohne Tippen. „Thema verstanden“ steht nicht hier (`verstandenZeilen`).
 */
export function angepasstZeile(eintraege: Pick<KnopfEintrag, "art" | "thema" | "inhalt">[]): string | null {
  const teile: string[] = [];
  for (const art of ["einfacher", "beispiele", "schwerer"] as const) {
    const themen = [...new Set(eintraege.filter((e) => e.art === art).map((e) => e.thema.trim()))];
    if (themen.length) teile.push(`${ART_TEXT[art]}${themen.some(Boolean) ? ` (${themen.filter(Boolean).join(", ")})` : ""}`);
  }
  for (const e of eintraege.filter((x) => x.art === "thema"))
    teile.push(e.inhalt.dazu ? `Thema dazu (${e.inhalt.nach ?? ""})` : `anderes Thema (${e.inhalt.nach ?? ""}${e.inhalt.von ? ` statt ${e.inhalt.von}` : ""})`);
  return teile.length ? `Angepasst: ${teile.join(", ")}` : null;
}

/** „Lehrkraft: Thema verstanden (Past Simple)“ je Thema: die Beobachtung des Lehrers, nie ein gemessenes Ergebnis. */
export function verstandenZeilen(eintraege: Pick<KnopfEintrag, "art" | "thema">[]): string[] {
  return [...new Set(eintraege.filter((e) => e.art === "verstanden").map((e) => e.thema.trim()))].map((t) => `Lehrkraft: Thema verstanden${t ? ` (${t})` : ""}`);
}
