/**
 * Bildgeschichte erstellen (Plan 5.2): the app makes the pictures of a Bildgeschichte itself, from the teacher's
 * short description, only on the teacher's click.
 *
 * 1. A plan through the router (`runAI("bildplan")`): the scenes in order and one fixed description of the figures
 *    (looks, clothes, colours), in words. No names: every name the app knows is replaced before it leaves.
 * 2. One picture per scene (`runImage`, always OpenRouter, lib/ai/router.ts): the fixed description goes with
 *    every picture, and from the second picture on the first one as reference, so the figures stay the same.
 *    „Dieses Bild neu“ makes one scene again the same way; the other pictures stay.
 *
 * Nothing about a student goes out: no name, no photo, no text of the student. The student id is only used for
 * the KI limit per student (the request is logged with it). The pictures are stored like uploaded ones
 * (lib/picture-story.ts `storeImageFile`: type from the content, size limit, uploads/bildgeschichten) and become
 * part of a Bildgeschichte when the teacher saves it; there they are marked „mit KI erstellt“ for teachers only.
 */
import fs from "node:fs";
import { z } from "zod";
import { db } from "./db";
import { budget, costOf, imagePrice, imageRoute, isLocalModel, routeFor } from "./ai/config";
import { BILDER_NICHT_EINGERICHTET, aiEnabled, budgetUsedUp, imagesReady, runAI, runImage } from "./ai/router";
import { budgetState } from "./ai/log";
import { grenzeErreichtText, schuelerStand } from "./ai/schueler-kosten";
import { dropFileIfUnused, imageFile, MAX_CAPTION, storeImageFile } from "./picture-story";
import { schulstufe } from "./school";
import { maskText, namePattern } from "./text-correction-core";

export const ANZAHL_STANDARD = 6;
export const ANZAHL_MIN = 3;
export const ANZAHL_MAX = 8;
export const MAX_BESCHREIBUNG = 600;
/** Bilderfolgen no story uses are removed after this many days (their pictures were paid, but nobody took them). */
const AUFRAEUMEN_TAGE = 14;

export type Szene = { bild: string; beschreibung: string };
/** The plan as stored: everything the picture requests are built from. `figuren`, `ort` and `bild` are in English for the model. */
export type BildPlan = { titel: string; figuren: string; ort: string; alter: string; szenen: Szene[] };

const PlanSchema = z.object({
  titel: z.string(),
  figuren: z.string(),
  ort: z.string(),
  szenen: z.array(z.object({ bild: z.string(), beschreibung: z.string() })),
});

/** The same style for every picture, so a story looks like one book. */
const STIL = "children's book illustration, clean outlines, soft flat colours, simple uncluttered background, the whole scene easy to read, no frame";

export const PLAN_SYSTEM = `Du planst eine Bildgeschichte für den Deutschunterricht in Österreich: eine Folge von Bildern ohne Text, zu der ein Kind eine Geschichte schreibt. Die Lehrkraft gibt eine kurze Beschreibung, die Anzahl der Bilder und das Alter der Kinder.

Regeln:
- Genau so viele Szenen wie verlangt, in zeitlicher Reihenfolge: Ausgangslage, ein Problem oder eine Überraschung, die Lösung. Jede Szene zeigt einen klar erkennbaren Moment; zusammen ergeben die Bilder ohne Worte eine verständliche Handlung.
- Altersgerecht: freundlich, keine Gewalt, keine Waffen, nichts Gruseliges, keine Markennamen, keine echten Personen.
- Höchstens drei Hauptfiguren. Sie haben keine Namen; nenne sie nach ihrer Rolle (z. B. "the girl", "the boy", "the grandmother", "the dog"). Steht in der Beschreibung [Name], ist das ein verborgener Name: nicht übernehmen.
- In den Bildern gibt es keine Schrift, keine Zahlen und keine Sprechblasen.

Felder:
- titel: ein kurzer deutscher Titel.
- figuren: auf Englisch, jede Hauptfigur einmal fest beschrieben: Art, ungefähres Alter, Haare, Kleidung mit Farben, ein auffälliges Merkmal. Diese Beschreibung gilt für alle Bilder.
- ort: auf Englisch, Ort, Jahreszeit und Tageszeit der Geschichte.
- szenen[].bild: auf Englisch, 1 bis 3 Sätze: was auf diesem Bild zu sehen ist. Die Figuren nur mit ihrer Rolle nennen, ihr Aussehen nicht ändern.
- szenen[].beschreibung: ein kurzer deutscher Satz, was auf dem Bild passiert (höchstens 120 Zeichen).

Antworte nur mit JSON.`;

type Row = { id: number; teacher_id: number | null; student_id: number | null; beschreibung: string; plan: string; plan_call_id: number | null; created_at: string };
export type BildfolgeBild = { id: number; bildfolge_id: number; szene: number; mime: string; size: number; sha256: string; stored_path: string; call_id: number | null; created_at: string };
export type Bildfolge = Omit<Row, "plan"> & { plan: BildPlan };

const iso = () => new Date().toISOString();
const clip = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function getBildfolge(id: number): Bildfolge | null {
  if (!Number.isInteger(id)) return null;
  const r = db().prepare("SELECT * FROM bildfolgen WHERE id = ?").get(id) as Row | undefined;
  if (!r) return null;
  try {
    return { ...r, plan: JSON.parse(r.plan) as BildPlan };
  } catch {
    return null;
  }
}

/** The current picture of each scene of a Bilderfolge, in scene order. */
export function bildfolgeBilder(id: number): BildfolgeBild[] {
  return db().prepare("SELECT * FROM bildfolge_bilder WHERE bildfolge_id = ? ORDER BY szene").all(id) as BildfolgeBild[];
}

export function bildfolgeBild(id: number): BildfolgeBild | null {
  if (!Number.isInteger(id)) return null;
  return (db().prepare("SELECT * FROM bildfolge_bilder WHERE id = ?").get(id) as BildfolgeBild | undefined) ?? null;
}

/** Age of the children, from Schulart and Klasse (1. Schulstufe: 6 to 7 years); without them the primary-school ages. */
export function alterFuer(schulart: string, klasse: number | null): string {
  if (!schulart || !klasse) return "7–11";
  const stufe = schulstufe(schulart, klasse);
  return `${stufe + 5}–${stufe + 6}`;
}

/** Names that never leave the app: every teacher and every student. */
function bekannteNamen(): string[] {
  return (db().prepare("SELECT name FROM teachers UNION SELECT name FROM students").all() as { name: string }[]).map((r) => r.name);
}

/** A text with every known name replaced by [Name]. */
function ohneNamen(text: string, pattern: RegExp | null): string {
  return pattern ? maskText(text, pattern).masked : text;
}

/** The request for one picture: style, the fixed figures, the place and this scene (exported for tests). */
export function bildPrompt(plan: BildPlan, szene: number, mitReferenz: boolean): string {
  const s = plan.szenen[szene - 1];
  return [
    `Picture ${szene} of ${plan.szenen.length} of a wordless picture story for children aged ${plan.alter}.`,
    `Style: ${STIL}.`,
    `Characters, drawn exactly like this in every picture: ${plan.figuren}`,
    `Setting: ${plan.ort}`,
    `This picture: ${s.bild}`,
    mitReferenz ? "The attached picture belongs to the same story: keep the characters, their clothes and colours and the drawing style exactly the same, but draw this scene." : "",
    "No text, letters, numbers, signs, speech bubbles or captions anywhere in the picture. Friendly and suitable for children: nothing violent or scary.",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------- before the click ----------

/** Why pictures cannot be made now, or null. `studentId`: the student the story is for (KI limit per student). */
export function bilderAusGrund(studentId: number | null = null): string | null {
  if (!imagesReady()) return BILDER_NICHT_EINGERICHTET;
  if (!aiEnabled("bildplan")) return "Die KI ist aus oder für den gewählten Anbieter ist kein Schlüssel hinterlegt (Erweitert › KI-Kosten).";
  if (budgetUsedUp("bildplan") || budgetState(Date.now(), "allgemein").level === "aus") return "Das KI-Budget für diesen Monat ist aufgebraucht.";
  if (studentId != null && schuelerStand(studentId).stufe === "aus") return grenzeErreichtText();
  return null;
}

/** Euro cents (with decimals) of an amount in US dollars. */
const cents = (usd: number) => (usd / budget().usdPerEur) * 100;

/**
 * What it will cost, before the click, in euro cents: the plan (about 1 500 tokens of instructions and
 * description, up to 1 500 of answer) and one picture (the list price of AI_IMAGE_MODEL).
 */
export function kostenSchaetzung(): { planCent: number; bildCent: number; modell: string } {
  const route = routeFor("bildplan");
  const plan = route.provider === "manual" || isLocalModel(route.provider) ? 0 : costOf(route.model, "standard", { input: Math.round(PLAN_SYSTEM.length / 3.2) + 300, output: 1_500, cacheWrite: 0, cacheRead: 0 });
  const { model } = imageRoute();
  return { planCent: cents(plan), bildCent: cents(imagePrice(model).usd), modell: model };
}

/** What a logged request cost, in euro cents (0 without one). */
function gezahltCent(callId: number | null): number {
  if (!callId) return 0;
  const r = db().prepare("SELECT cost_usd FROM ai_calls WHERE id = ?").get(callId) as { cost_usd: number } | undefined;
  return r ? cents(r.cost_usd) : 0;
}

// ---------- the plan ----------

export type PlanEingabe = { beschreibung: string; anzahl: number; schulart: string; klasse: number | null };
export type PlanErgebnis = { ok: true; id: number; titel: string; szenen: { szene: number; beschreibung: string }[]; cent: number } | { ok: false; error: string };
type Wer = { teacherId: number | null; studentId: number | null };

/** Bilderfolgen older than two weeks that no story took: rows and the files nobody else uses. */
function aufraeumen(now = Date.now()) {
  const vor = new Date(now - AUFRAEUMEN_TAGE * 86_400_000).toISOString();
  const alt = db()
    .prepare("SELECT id FROM bildfolgen WHERE created_at < ? AND id NOT IN (SELECT bildfolge_id FROM picture_story_images WHERE bildfolge_id IS NOT NULL)")
    .all(vor) as { id: number }[];
  for (const { id } of alt) {
    const files = bildfolgeBilder(id).map((b) => b.stored_path);
    db().prepare("DELETE FROM bildfolgen WHERE id = ?").run(id);
    for (const f of files) dropFileIfUnused(f);
  }
}

/** One plan per teacher and input at a time: a double click waits for the running one instead of paying twice. */
const laufend = ((globalThis as unknown as { __bildfolgeLaufend?: Map<string, Promise<unknown>> }).__bildfolgeLaufend ??= new Map());
function einmal<T>(key: string, job: () => Promise<T>): Promise<T> {
  const running = laufend.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = job().finally(() => laufend.delete(key));
  laufend.set(key, p);
  return p;
}

/**
 * Step 1: the plan from the teacher's description, stored as a new Bilderfolge (no picture yet). Never throws.
 * `wer.studentId`: the student the story is made for, so the KI limit per student applies; null when for nobody.
 */
export function planeBildfolge(e: PlanEingabe, wer: Wer): Promise<PlanErgebnis> {
  const beschreibung = clip(e.beschreibung, MAX_BESCHREIBUNG);
  const anzahl = Math.max(ANZAHL_MIN, Math.min(ANZAHL_MAX, Math.round(Number(e.anzahl)) || ANZAHL_STANDARD));
  return einmal(`plan:${wer.teacherId ?? 0}:${wer.studentId ?? 0}:${anzahl}:${beschreibung}`, async (): Promise<PlanErgebnis> => {
    try {
      if (beschreibung.length < 10) return { ok: false, error: "Bitte kurz beschreiben, worum es in der Geschichte geht (mindestens ein Satz)." };
      const aus = bilderAusGrund(wer.studentId);
      if (aus) return { ok: false, error: aus };
      aufraeumen();
      const pattern = namePattern(bekannteNamen());
      const alter = alterFuer(e.schulart, e.klasse);
      const prompt = `Beschreibung der Lehrkraft: ${ohneNamen(beschreibung, pattern)}\nAnzahl der Bilder: ${anzahl}\nAlter der Kinder: ${alter} Jahre`;
      const out = await runAI("bildplan", PlanSchema, PLAN_SYSTEM, prompt, { meta: { teacherId: wer.teacherId, studentId: wer.studentId, trigger: "bildgeschichte" } });
      if (!out.ok) return { ok: false, error: out.message };
      const szenen = out.data.szenen
        .slice(0, anzahl)
        .map((s) => ({ bild: ohneNamen(clip(s.bild, 800), pattern), beschreibung: ohneNamen(clip(s.beschreibung, MAX_CAPTION), pattern) }))
        .filter((s) => s.bild);
      const figuren = ohneNamen(clip(out.data.figuren, 1_500), pattern);
      if (szenen.length < ANZAHL_MIN || !figuren) return { ok: false, error: "Der Plan der KI war unvollständig. Bitte noch einmal versuchen." };
      const plan: BildPlan = { titel: ohneNamen(clip(out.data.titel, 140), pattern) || "Bildgeschichte", figuren, ort: ohneNamen(clip(out.data.ort, 400), pattern), alter, szenen };
      const id = Number(
        db()
          .prepare("INSERT INTO bildfolgen (teacher_id, student_id, beschreibung, plan, plan_call_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(wer.teacherId, wer.studentId, beschreibung, JSON.stringify(plan), out.callId, iso()).lastInsertRowid,
      );
      return { ok: true, id, titel: plan.titel, szenen: szenen.map((s, i) => ({ szene: i + 1, beschreibung: s.beschreibung })), cent: gezahltCent(out.callId) };
    } catch (err) {
      console.error("[Bildgeschichte erstellen]", err instanceof Error ? err.message : err);
      return { ok: false, error: "Der Plan konnte nicht erstellt werden." };
    }
  });
}

// ---------- the pictures ----------

export type ErstelltesBild = { id: number; bildfolgeId: number; szene: number; beschreibung: string; size: number; url: string };
export type BildErgebnis = { ok: true; bild: ErstelltesBild; cent: number } | { ok: false; error: string };

export const bildUrl = (id: number) => `/material/bildfolge/bild/${id}`;

/** The picture another scene of the same story has (the lowest scene first): figures and style to keep. */
function referenz(bildfolgeId: number, szene: number) {
  const ref = bildfolgeBilder(bildfolgeId).find((b) => b.szene !== szene);
  if (!ref) return [];
  try {
    return [{ mime: ref.mime as "image/png", base64: fs.readFileSync(imageFile(ref)).toString("base64") }];
  } catch {
    return [];
  }
}

/**
 * Step 2, and „Dieses Bild neu“: the picture of one scene, with the fixed figures and (when there is one) another
 * picture of the story as reference. Replaces the scene's earlier picture in the Bilderfolge; a story that took the
 * earlier one keeps it until the teacher saves the new one. Never throws.
 */
export function erstelleBild(bildfolgeId: number, szene: number, wer: { teacherId: number | null }): Promise<BildErgebnis> {
  return einmal(`bild:${bildfolgeId}:${szene}`, async (): Promise<BildErgebnis> => {
    try {
      const f = getBildfolge(bildfolgeId);
      if (!f || !Number.isInteger(szene) || szene < 1 || szene > f.plan.szenen.length) return { ok: false, error: "Diese Bilderfolge gibt es nicht mehr. Bitte neu beginnen." };
      const aus = bilderAusGrund(f.student_id);
      if (aus) return { ok: false, error: aus };
      const refs = referenz(f.id, szene);
      const out = await runImage(bildPrompt(f.plan, szene, refs.length > 0), refs, { meta: { teacherId: wer.teacherId, studentId: f.student_id, trigger: "bildgeschichte" } });
      if (!out.ok) return { ok: false, error: out.message };
      let file: ReturnType<typeof storeImageFile>;
      try {
        file = storeImageFile({ name: `bild-${szene}`, data: out.data });
      } catch {
        return { ok: false, error: "Das Bild kam in einem Format, das die App nicht speichert. Bitte noch einmal versuchen." };
      }
      const conn = db();
      const alt = conn.prepare("SELECT stored_path FROM bildfolge_bilder WHERE bildfolge_id = ? AND szene = ?").all(f.id, szene) as { stored_path: string }[];
      const id = conn.transaction(() => {
        conn.prepare("DELETE FROM bildfolge_bilder WHERE bildfolge_id = ? AND szene = ?").run(f.id, szene);
        return Number(
          conn
            .prepare("INSERT INTO bildfolge_bilder (bildfolge_id, szene, mime, size, sha256, stored_path, call_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .run(f.id, szene, file.mime, file.size, file.sha256, file.stored, out.callId, iso()).lastInsertRowid,
        );
      })();
      for (const a of alt) if (a.stored_path !== file.stored) dropFileIfUnused(a.stored_path);
      return { ok: true, bild: { id, bildfolgeId: f.id, szene, beschreibung: f.plan.szenen[szene - 1].beschreibung, size: file.size, url: bildUrl(id) }, cent: gezahltCent(out.callId) };
    } catch (err) {
      console.error("[Bildgeschichte erstellen]", err instanceof Error ? err.message : err);
      return { ok: false, error: "Das Bild konnte nicht erstellt werden." };
    }
  });
}
