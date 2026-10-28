/**
 * **Ausführlicher erklären** im Unterricht (niko, 27.10.2026: „Lehrerskripte sollen ausreichend ausführlich sein, damit der
 * Lehrer sie tatsächlich verwenden kann.“ „So vermeiden wir unnötige KI-Kosten.“): ist der Lehrertext eines Schritts zu einer
 * Fähigkeit dünn, schreibt die KI auf Tippen des Lehrers einen längeren: was er sagt, ein Beispiel, eine Frage mit erwarteter
 * Antwort und zwei typische Fehler. Etwa 1 Cent, nur für den Lehrer, nie auf einer Schülerseite.
 *
 * Die Anfrage kennt nur Fähigkeit, Fach und Schulstufe (lib/ai/ausfuehrlich.ts), keinen Schüler. Deshalb wird die Antwort je
 * Fähigkeit, Schulstufe und Fassung des Prompts gespeichert (`ki_erklaerungen`) und für jeden Schüler wieder verwendet: ein zweites
 * Tippen oder ein anderer Schüler kostet nichts. Ohne KI, mit aufgebrauchtem Budget oder im manuellen Modus sagt der Knopf warum;
 * der Unterricht läuft ohne ihn weiter. Eine gespeicherte Erklärung bleibt auch ohne KI lesbar.
 *
 * „Einfacher erklären“ (lib/knoepfe.ts, D1) nutzt denselben Weg mit einem eigenen Prompt (`art` „einfach“, eigene Fassung in
 * derselben Tabelle, eigene KI-Funktion `einfacher`), nur wenn nichts Einfacheres gespeichert ist, und nur, solange die Grenze des
 * Schülers nicht erreicht ist (`einfacherTor`).
 */
import { kiAusfuehrlich, type Ausfuehrlich, type ErklaerArt } from "./ai/ausfuehrlich";
import { budget, costOf, isLocalModel, routeFor, type AIFunction } from "./ai/config";
import { grenzeErreichtText } from "./ai/schueler-kosten";
import { aiEnabled, breakerState, budgetUsedUp, schuelerGestoppt } from "./ai/router";
import { db, json } from "./db";
import { erklaerungZu } from "./cockpit";
import * as repo from "./repo";
import { schulstufe } from "./school";
import { typischeFehler } from "./themen";

export type { Ausfuehrlich } from "./ai/ausfuehrlich";

/** Die Fassung des Prompts: eine neue Fassung fragt die KI für jede Fähigkeit einmal neu. */
export const FASSUNG = "1";
/** Die Fassung des Prompts für „Einfacher erklären“. */
export const FASSUNG_EINFACH = "einfach-1";
const fassungVon = (art: ErklaerArt) => (art === "einfach" ? FASSUNG_EINFACH : FASSUNG);
const fnVon = (art: ErklaerArt): AIFunction => (art === "einfach" ? "einfacher" : "ausfuehrlich");
/** Ein Lehrertext unter so vielen Zeichen gilt als dünn: dann gibt es „Ausführlicher erklären“. */
export const DUENN_BIS = 320;

/** Die Schulstufe eines Schülers (aus Schulart und Klasse, sonst wie im Profil): mit ihr wird die Erklärung gespeichert. */
export const schulstufeVon = (s: Pick<repo.Student, "school_type" | "klasse" | "grade">) => (s.klasse ? schulstufe(s.school_type, s.klasse) : s.grade);

/** Ist der Lehrertext eines Schritts dünn? */
export const istDuenn = (sagt: string | null | undefined) => (sagt ?? "").trim().length < DUENN_BIS;

/** Die gespeicherte Erklärung zu Fähigkeit und Schulstufe (dieser Fassung), oder null. `art` „einfach“: die einfachere. */
export function gespeicherteErklaerung(skillId: string, schulstufe: number, art: ErklaerArt = "ausfuehrlich"): Ausfuehrlich | null {
  const r = db().prepare("SELECT inhalt FROM ki_erklaerungen WHERE skill_id = ? AND schulstufe = ? AND fassung = ?").get(skillId, schulstufe, fassungVon(art)) as { inhalt: string } | undefined;
  return r ? json<Ausfuehrlich | null>(r.inhalt, null) : null;
}

/** Typische Größe einer Anfrage (Prompt mit Erklärung und Fehlern) und Antwort, für die Schätzung vor dem Tippen. */
const TYPISCH_EIN = 1_200;
const TYPISCH_AUS = 900;

/** Was ein Tippen etwa kostet: „ca. 1 Cent“, im manuellen Modus oder mit lokalem Modell nichts. */
export function kostenAusfuehrlich(art: ErklaerArt = "ausfuehrlich"): string {
  const route = routeFor(fnVon(art));
  if (route.provider === "manual") return "kostet nichts (manueller Modus)";
  if (isLocalModel(route.provider)) return "kostet nichts (lokales Modell)";
  const usd = costOf(route.model, "standard", { input: TYPISCH_EIN, output: TYPISCH_AUS, cacheWrite: 0, cacheRead: 0 });
  return `ca. ${Math.max(1, Math.round((usd / budget().usdPerEur) * 100))} Cent`;
}

/**
 * Darf die KI jetzt ausführlicher erklären? Dieselben kurzen Gründe wie bei „Neue passende Aufgabe erstellen“ (lib/steuerung.ts
 * kiTor): aus, im manuellen Modus nicht im Unterricht, Budget aufgebraucht, nach Ausfällen pausiert. Ohne Schüler: keine Grenze je Schüler.
 */
export function ausfuehrlichTor(art: ErklaerArt = "ausfuehrlich"): { erlaubt: true; kosten: string } | { erlaubt: false; grund: string } {
  const fn = fnVon(art);
  if (!aiEnabled(fn)) return { erlaubt: false, grund: "Die KI ist aus." };
  if (routeFor(fn).provider === "manual") return { erlaubt: false, grund: "Im manuellen KI-Modus nicht im Unterricht." };
  if (budgetUsedUp(fn)) return { erlaubt: false, grund: "Das KI-Budget für diesen Monat ist aufgebraucht." };
  if (breakerState().paused) return { erlaubt: false, grund: "Die KI war zuletzt nicht erreichbar und pausiert ein paar Minuten." };
  return { erlaubt: true, kosten: kostenAusfuehrlich(art) };
}

/**
 * Darf die KI für „Einfacher erklären“ jetzt schreiben? Wie `ausfuehrlichTor`, dazu die Grenze je Schüler (lib/steuerung.ts
 * `kiTor`): ist sie erreicht, fragt die App für diesen Schüler nicht, auch wenn die Antwort für alle gespeichert würde.
 */
export function einfacherTor(studentId: number): { erlaubt: true; kosten: string } | { erlaubt: false; grund: string } {
  const tor = ausfuehrlichTor("einfach");
  if (tor.erlaubt && schuelerGestoppt("einfacher", studentId)) return { erlaubt: false, grund: grenzeErreichtText() };
  return tor;
}

export type AusfuehrlichErgebnis = { ok: true; inhalt: Ausfuehrlich; neu: boolean } | { ok: false; error: string };

/** Eine Anfrage je Fähigkeit und Schulstufe zur Zeit: ein Doppeltippen (oder ein zweiter Lehrer) wartet, statt zweimal zu zahlen. */
const laufend = ((globalThis as unknown as { __ausfuehrlichLaufend?: Map<string, Promise<AusfuehrlichErgebnis>> }).__ausfuehrlichLaufend ??= new Map());

/**
 * Die ausführliche Erklärung zu einer Fähigkeit und Schulstufe: gespeichert, sonst eine Anfrage an die KI, deren geprüfte
 * Antwort gespeichert wird. `neu`: diesmal gefragt (und bezahlt). `art` „einfach“: die einfachere Erklärung (eigene Fassung).
 * `unitId`: die Einheit, in der getippt wurde; ihr zählen die Kosten (KI-Budget je Einheit), der Schüler bleibt aus der Anfrage.
 */
export function erklaereAusfuehrlich(skillId: string, schulstufe: number, teacherId: number | null, art: ErklaerArt = "ausfuehrlich", unitId: number | null = null): Promise<AusfuehrlichErgebnis> {
  const schon = gespeicherteErklaerung(skillId, schulstufe, art);
  if (schon) return Promise.resolve({ ok: true, inhalt: schon, neu: false });
  const key = `${skillId}|${schulstufe}|${art}`;
  const running = laufend.get(key);
  if (running) return running;
  const job = (async (): Promise<AusfuehrlichErgebnis> => {
    const skill = repo.getSkill(skillId);
    if (!skill) return { ok: false, error: "Diese Fähigkeit gibt es nicht." };
    const tor = ausfuehrlichTor(art);
    if (!tor.erlaubt) return { ok: false, error: tor.grund };
    const out = await kiAusfuehrlich(
      { fach: skill.subject, bereich: skill.area, name: skill.name, schulstufe, erklaerung: erklaerungZu(skill.id), typischeFehler: typischeFehler(skill.id) },
      { teacherId, trigger: fnVon(art), kostenEinheitId: unitId },
      art,
    );
    if (!out.ok) return { ok: false, error: out.error };
    db()
      .prepare(
        `INSERT INTO ki_erklaerungen (skill_id, schulstufe, fassung, inhalt, call_id, teacher_id) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(skill_id, schulstufe, fassung) DO UPDATE SET inhalt = excluded.inhalt, call_id = excluded.call_id, teacher_id = excluded.teacher_id, created_at = datetime('now')`,
      )
      .run(skillId, schulstufe, fassungVon(art), JSON.stringify(out.inhalt), out.callId, teacherId);
    return { ok: true, inhalt: out.inhalt, neu: true };
  })().finally(() => laufend.delete(key));
  laufend.set(key, job);
  return job;
}
