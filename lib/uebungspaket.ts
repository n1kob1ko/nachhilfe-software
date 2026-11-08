/**
 * **Übungspaket aus Erkenntnissen** (niko, 08.11.2026: „er hat es bewertet und dann daraufhin Übungen erstellt … für die
 * Geschichte hat Claude keine Übung erstellt, weil sie nicht mehr kommt“). Der Kreislauf in der App:
 *
 * 1. Erkenntnisse sammeln: aus einer eingefügten Zusammenfassung (lib/einheit-aus-text.ts) oder einer eingelesenen
 *    Schularbeit (lib/blatt-einlesen.ts).
 * 2. **Paket erstellen** (`erstellePaket`): die Lehrkraft hakt die offenen Fehler an, die drankommen, und schreibt, was nicht
 *    mehr kommt. Die KI des Builders bekommt die Fehlermuster wörtlich als Auftrag, nicht nur die Fähigkeiten. Das Paket ist
 *    eine normale Übung im Entwurf: Vorschau, dann drucken oder aufs Tablet schicken. Am Tablet bewertet die App selbst, auf
 *    Papier liest „Arbeit fotografieren“ die Antworten gegen die Aufgaben.
 * 3. **Paket auswerten** (`wertePaketAus`): sobald Ergebnisse da sind, sagt die KI je Fehlermuster behoben, besser oder offen
 *    und nennt neue Muster. Die Lehrkraft bestätigt; behobene Erkenntnisse werden erledigt, neue kommen dazu. Dann das
 *    nächste Paket.
 *
 * Ohne KI: das Paket kommt aus den Generatoren der Fähigkeiten, die Auswertung zählt richtige Aufgaben je Fähigkeit.
 */
import { aiEnabled } from "./ai";
import { budgetUsedUp, schuelerGestoppt } from "./ai/router";
import { KiFehler } from "./ai/grund";
import { wertePaketAus as kiAuswertung } from "./ai/uebungspaket";
import { AUTO, createDraft, parseSettings, studentContext } from "./builder";
import { db } from "./db";
import { ERROR_TYPES, type ErrorType } from "./error-types";
import { listErkenntnisse, setzeErkenntnisStatus, speichereErkenntnisse, type Erkenntnis } from "./erkenntnisse";
import { skillsForPrompt } from "./lehrplan";
import * as repo from "./repo";

export const PAKET_ANZAHL = [8, 12, 16] as const;
export const PAKET_STANDARD = 12;

export type PaketStand = "behoben" | "besser" | "offen";
export type PaketAuswertung = {
  muster: { erkenntnisId: number; text: string; stand: PaketStand; grund: string }[];
  neue: { text: string; skillId: string | null; fehlerart: ErrorType | null }[];
  staerken: string[];
  ohneKi: boolean;
  hinweis: string | null;
};
/** Was ein Paket in `worksheets.settings.paket` über sich weiß. */
export type PaketInfo = { nr: number; fach: string; erkenntnisIds: number[]; nichtMehr: string; auswertung?: PaketAuswertung; ausgewertetAm?: string };

type PaketZeile = { id: number; title: string; status: string; created_at: string; subject: string; settings: string | null };

/** Die Übungspakete eines Schülers, das neueste zuerst. */
export function paketeVon(studentId: number, fach?: string): (PaketZeile & { paket: PaketInfo })[] {
  const rows = db()
    .prepare("SELECT id, title, status, created_at, subject, settings FROM worksheets WHERE student_id = ? AND source_worksheet_id IS NULL AND json_extract(settings, '$.paket.nr') IS NOT NULL ORDER BY id DESC")
    .all(studentId) as PaketZeile[];
  return rows.map((r) => ({ ...r, paket: (parseSettings(r.settings) as { paket: PaketInfo }).paket })).filter((r) => !fach || r.paket.fach === fach);
}

function paketVonId(worksheetId: number, studentId: number) {
  return paketeVon(studentId).find((p) => p.id === worksheetId) ?? null;
}

/** Was das Formular „Übungspaket erstellen“ vorschlägt: die Fächer mit offenen Fehlern, die offenen Fehler, was zuletzt nicht mehr kam. */
export function paketVorschlag(studentId: number, fach?: string) {
  const student = repo.getStudent(studentId);
  // in der Reihenfolge, in der sie gefunden wurden (die KI nennt das wichtigste Muster zuerst)
  const offen = listErkenntnisse(studentId, { status: "offen", art: "fehler" }).reverse();
  const faecher = [...new Set([...offen.map((e) => e.subject), ...(student?.subjects ?? [])])].filter(Boolean);
  const gewaehlt = fach && faecher.includes(fach) ? fach : (offen[0]?.subject ?? faecher[0] ?? "");
  const letztes = paketeVon(studentId, gewaehlt)[0];
  return {
    faecher,
    fach: gewaehlt,
    offen: offen.filter((e) => e.subject === gewaehlt),
    staerken: listErkenntnisse(studentId, { art: "staerke", subject: gewaehlt }).slice(0, 4),
    nichtMehr: letztes?.paket.nichtMehr ?? "",
    nr: (letztes?.paket.nr ?? 0) + 1,
  };
}

/**
 * Der Auftrag an die KI: jedes Fehlermuster wörtlich, wie die Aufgaben es herausfordern sollen, was nicht mehr kommt und
 * was schon sicher ist. Der Builder legt ihn als „Besonderer Wunsch der Lehrkraft“ in die Anfrage.
 */
export function paketAuftrag(o: { nr: number; muster: Pick<Erkenntnis, "text" | "skill_id">[]; nichtMehr: string; staerken: string[] }): string {
  const name = (id: string | null) => (id ? repo.getSkill(id)?.name : null);
  const zeilen = o.muster.map((m, i) => `${i + 1}. ${m.text}${name(m.skill_id) ? ` (${name(m.skill_id)})` : ""}`);
  return [
    `Gezieltes Übungspaket ${o.nr} gegen diese Fehlermuster des Schülers. Jede Aufgabe trainiert genau eines davon, ungefähr gleich viele je Muster, von leicht zu schwer. Die Aufgaben sollen den Fehler gezielt herausfordern (z. B. Sätze, in denen die falsche Strategie in die Irre führt), und die Lösung nennt kurz die richtige Strategie.`,
    ...zeilen,
    o.nichtMehr.trim() ? `Nicht üben, kommt nicht mehr: ${o.nichtMehr.trim()}` : "",
    o.staerken.length ? `Schon sicher, nicht üben: ${o.staerken.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2400);
}

/** Erstellt das Paket als Entwurf (Vorschau unter /uebungen/[id]). Wirft einen Fehler mit einem Satz für die Lehrkraft. */
export async function erstellePaket(o: { studentId: number; teacherId: number | null; fach: string; erkenntnisIds: number[]; nichtMehr: string; anzahl: number }): Promise<{ worksheetId: number; aiError?: string }> {
  const student = repo.getStudent(o.studentId);
  if (!student) throw new Error("Diesen Schüler gibt es nicht.");
  const v = paketVorschlag(student.id, o.fach);
  const muster = v.offen.filter((e) => o.erkenntnisIds.includes(e.id));
  if (!muster.length) throw new Error("Bitte mindestens einen Fehler ankreuzen.");
  let skillIds = [...new Set(muster.map((e) => e.skill_id).filter((x): x is string => Boolean(x && repo.getSkill(x))))];
  const ctx = studentContext(student.id);
  // nur Fehler ohne Fähigkeit (z. B. „liest die Aufgabenstellung nicht genau“): die schwächsten Fähigkeiten des Fachs tragen sie
  if (!skillIds.length) skillIds = (ctx?.weakSkills ?? []).map((w) => w.id).filter((id) => repo.getSkill(id)?.subject === v.fach).slice(0, 3);
  if (!skillIds.length) throw new Error("Keiner der angekreuzten Fehler hat eine Fähigkeit. Bitte unter Erkenntnisse bei mindestens einem eine Fähigkeit wählen.");
  const anzahl = (PAKET_ANZAHL as readonly number[]).includes(o.anzahl) ? o.anzahl : PAKET_STANDARD;
  const nichtMehr = o.nichtMehr.replace(/\s+/g, " ").trim().slice(0, 300);
  const paket: PaketInfo = { nr: v.nr, fach: v.fach, erkenntnisIds: muster.map((e) => e.id), nichtMehr };
  const out = await createDraft(
    {
      studentId: student.id,
      subject: v.fach,
      schoolType: ctx?.schoolType || student.school_type || "Mittelschule",
      klasse: ctx?.klasse ?? student.klasse ?? 1,
      skillIds,
      difficulty: AUTO,
      count: anzahl,
      categories: [],
      focus: paketAuftrag({ nr: v.nr, muster, nichtMehr, staerken: v.staerken.map((s) => s.text) }),
      useAI: true,
      title: `${student.name.split(" ")[0]} – Übungspaket ${v.nr}`,
      paket,
    },
    o.teacherId,
  );
  return { worksheetId: out.id, aiError: out.aiError };
}

// ---------- auswerten ----------

export type PaketAufgabe = { nr: number; taskId: number; aufgabe: string; skillId: string | null; antwort: string; bewertung: "richtig" | "teilweise" | "falsch" | "offen" | "fehlt"; fehler: string };

/** Die Aufgaben des Pakets mit der letzten Antwort des Schülers (neueste Zuweisung mit Antworten). */
export function paketErgebnis(worksheetId: number): { aufgaben: PaketAufgabe[]; beantwortet: number; richtig: number } {
  const tasks = repo.listTasks(worksheetId);
  const zuweisung = repo.listAssignmentsForWorksheet(worksheetId).find((a) => a.done_count > 0);
  const versuche = zuweisung ? repo.listAttemptsForAssignment(zuweisung.id).filter((a) => a.final) : [];
  const aufgaben = tasks.map((t, i): PaketAufgabe => {
    const a = [...versuche].reverse().find((x) => x.task_id === t.id);
    const review = (a as { review?: string | null } | undefined)?.review ?? null;
    const bewertung = !a ? "fehlt" : review === "offen" ? "offen" : review === "teilweise" ? "teilweise" : review === "richtig" || (!review && a.correct) ? "richtig" : "falsch";
    return { nr: i + 1, taskId: t.id, aufgabe: t.prompt.replace(/\s+/g, " ").slice(0, 300), skillId: t.skillId, antwort: (a?.answer ?? "").slice(0, 200), bewertung, fehler: (a?.error_label || a?.feedback || "").slice(0, 160) };
  });
  return { aufgaben, beantwortet: aufgaben.filter((a) => a.bewertung !== "fehlt" && a.bewertung !== "offen").length, richtig: aufgaben.filter((a) => a.bewertung === "richtig").length };
}

/** Ohne KI: je Fehlermuster die Aufgaben seiner Fähigkeit; alle richtig = behoben, mehr als die Hälfte = besser. */
export function regelAuswertung(muster: Erkenntnis[], aufgaben: PaketAufgabe[]): PaketAuswertung["muster"] {
  return muster.map((m) => {
    const dazu = aufgaben.filter((a) => m.skill_id && a.skillId === m.skill_id && (a.bewertung === "richtig" || a.bewertung === "teilweise" || a.bewertung === "falsch"));
    const richtig = dazu.filter((a) => a.bewertung === "richtig").length;
    if (!dazu.length) return { erkenntnisId: m.id, text: m.text, stand: "offen" as const, grund: "Keine bewertete Aufgabe dazu." };
    const stand: PaketStand = richtig === dazu.length && dazu.length >= 2 ? "behoben" : richtig * 2 > dazu.length ? "besser" : "offen";
    return { erkenntnisId: m.id, text: m.text, stand, grund: `${richtig} von ${dazu.length} Aufgaben dazu richtig (${dazu.map((a) => a.nr).join(", ")}).` };
  });
}

function kannAuswerten(studentId: number): string | null {
  if (!aiEnabled("paket_auswertung")) return "Die KI ist gerade nicht eingerichtet.";
  if (budgetUsedUp("paket_auswertung")) return "Das KI-Budget für diesen Monat ist aufgebraucht.";
  if (schuelerGestoppt("paket_auswertung", studentId)) return "Die KI-Grenze für diesen Schüler ist erreicht.";
  return null;
}

/** Wertet das Paket aus und legt den Vorschlag beim Paket ab. Wirft einen Fehler mit einem Satz für die Lehrkraft. */
export async function wertePaketAus(worksheetId: number, studentId: number, teacherId: number | null): Promise<PaketAuswertung> {
  const p = paketVonId(worksheetId, studentId);
  if (!p) throw new Error("Dieses Übungspaket gibt es nicht.");
  const { aufgaben, beantwortet } = paketErgebnis(worksheetId);
  if (!beantwortet) throw new Error("Zu diesem Paket gibt es noch keine bewerteten Antworten.");
  const alle = listErkenntnisse(studentId);
  const muster = p.paket.erkenntnisIds.map((id) => alle.find((e) => e.id === id)).filter((e): e is Erkenntnis => Boolean(e));
  const student = repo.getStudent(studentId)!;
  const skills = skillsForPrompt(student, p.paket.fach).map((s) => ({ id: s.id, name: s.name, area: s.area }));
  let auswertung: PaketAuswertung = { muster: regelAuswertung(muster, aufgaben), neue: [], staerken: [], ohneKi: true, hinweis: null };
  const grund = kannAuswerten(studentId);
  if (grund) auswertung.hinweis = `${grund} Ausgewertet nach richtigen Aufgaben je Fähigkeit.`;
  else {
    try {
      const name = (id: string | null) => (id ? (repo.getSkill(id)?.name ?? "") : "");
      const g = await kiAuswertung(
        { fach: p.paket.fach, muster: muster.map((m) => m.text), aufgaben: aufgaben.filter((a) => a.bewertung !== "fehlt").map((a) => ({ nr: a.nr, aufgabe: a.aufgabe, skill: name(a.skillId), antwort: a.antwort, bewertung: a.bewertung, fehler: a.fehler })), skills },
        { teacherId, studentId, trigger: "paket_auswertung" },
      );
      if (g) {
        const erlaubt = new Set(skills.map((s) => s.id));
        auswertung = {
          muster: muster.map((m, i) => {
            const k = g.muster.find((x) => x.nr === i + 1);
            const regel = auswertung.muster[i];
            return k ? { erkenntnisId: m.id, text: m.text, stand: k.stand, grund: k.grund.replace(/\s+/g, " ").slice(0, 200) } : regel;
          }),
          neue: g.neue
            .map((n) => ({ text: n.text.replace(/\s+/g, " ").trim().slice(0, 220), skillId: n.faehigkeit && erlaubt.has(n.faehigkeit) ? n.faehigkeit : null, fehlerart: ERROR_TYPES.find((t) => t.key === n.fehlerart)?.key ?? null }))
            .filter((n) => n.text && !muster.some((m) => m.text.toLowerCase() === n.text.toLowerCase()))
            .slice(0, 4),
          staerken: g.staerken.map((s) => s.replace(/\s+/g, " ").trim().slice(0, 160)).filter(Boolean).slice(0, 3),
          ohneKi: false,
          hinweis: null,
        };
      } else auswertung.hinweis = "Die KI hat nicht ausgewertet. Ausgewertet nach richtigen Aufgaben je Fähigkeit.";
    } catch (e) {
      auswertung.hinweis = `${e instanceof KiFehler ? e.message : "Die KI hat nicht geantwortet."} Ausgewertet nach richtigen Aufgaben je Fähigkeit.`;
    }
  }
  setzePaket(worksheetId, { ...p.paket, auswertung });
  return auswertung;
}

function setzePaket(worksheetId: number, paket: PaketInfo) {
  db().prepare("UPDATE worksheets SET settings = json_set(COALESCE(settings, '{}'), '$.paket', json(?)) WHERE id = ?").run(JSON.stringify(paket), worksheetId);
}

/**
 * Übernimmt die geprüfte Auswertung: die angehakten Erkenntnisse werden erledigt, die neuen und die Stärken kommen dazu
 * (Quelle paket). Ein Paket wird einmal übernommen.
 */
export function uebernimmAuswertung(o: { worksheetId: number; studentId: number; teacherId: number | null; erledigt: number[]; neue: { text: string; skillId: string | null; fehlerart: ErrorType | null }[]; staerken: string[] }): { erledigt: number; neu: number } | { error: string } {
  const p = paketVonId(o.worksheetId, o.studentId);
  if (!p) return { error: "Dieses Übungspaket gibt es nicht." };
  if (p.paket.ausgewertetAm) return { error: "Dieses Paket ist schon ausgewertet." };
  const eigene = new Set(p.paket.erkenntnisIds);
  let erledigt = 0;
  const neu = db().transaction(() => {
    for (const id of o.erledigt.filter((id) => eigene.has(id))) {
      setzeErkenntnisStatus(id, o.studentId, "erledigt");
      erledigt++;
    }
    const n = speichereErkenntnisse({
      studentId: o.studentId,
      subject: p.paket.fach,
      teacherId: o.teacherId,
      quelle: "paket",
      worksheetId: o.worksheetId,
      zeilen: [...o.neue.map((x) => ({ art: "fehler" as const, text: x.text, skillId: x.skillId && repo.getSkill(x.skillId) ? x.skillId : null, fehlerart: x.fehlerart })), ...o.staerken.map((text) => ({ art: "staerke" as const, text }))],
    });
    setzePaket(o.worksheetId, { ...p.paket, ausgewertetAm: new Date().toISOString() });
    return n;
  })();
  return { erledigt, neu };
}

export { paketVonId };
