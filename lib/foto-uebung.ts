/**
 * Foto vom Stoff (niko, 19.10.2026): Der Schüler bringt mit, was er lernen muss, der Lehrer fotografiert die
 * Buchseite oder das Arbeitsblatt in der laufenden Einheit. Die KI liest das Foto wie bei „Material erkennen“
 * (analyzeMaterialWithAI: Fach, Thema, Fähigkeiten, die Aufgaben darauf), dann macht der Builder daraus eine
 * Übung als Entwurf (createDraft): neue Aufgaben in der Art des Fotos, nicht dieselben. Der Lehrer prüft sie in
 * der Vorschau und sendet sie wie jede andere Übung.
 *
 * - Das Foto geht nur nach der Bestätigung „keine Namen darauf“ an die KI, und nur einmal: es bleibt als
 *   Material des Schülers gespeichert, die Erkennung daran auch. Ein zweiter Versuch liest es nicht neu.
 * - Die zweite Anfrage (Aufgaben erstellen) bekommt nur Text: das Thema und die erkannten Aufgaben als Vorbild.
 * - Ohne KI, oder wenn der KI-Weg keine Bilder lesen kann (manueller Modus), gibt es das nicht. Die Seite sagt
 *   das und führt zum normalen Builder.
 * - Der Lernstand ändert sich erst durch die Antworten des Schülers, wie bei jeder Übung.
 */
import fs from "node:fs";
import { aiEnabled, aiReadsImages, analyzeMaterialWithAI } from "./ai";
import { AUTO, createDraft, studentContext } from "./builder";
import { matchSkills, skillsForPrompt } from "./lehrplan";
import { getMaterial, hatDatei, materialFile, MAX_ANALYSIS_IMAGE_BYTES, setAnalysis, type Material } from "./materials";
import * as repo from "./repo";
import { getUnit } from "./units";

export const FOTO_ANZAHL = [5, 10, 15] as const;
export const FOTO_STANDARD = 10;
/** So viele Aufgaben vom Foto gehen als Vorbild an die KI; so viele Fähigkeiten bekommt die Übung höchstens. */
const VORBILDER = 6;
const FAEHIGKEITEN = 4;

/** Ob ein Foto jetzt gelesen werden kann; sonst der Grund, in Worten für den Lehrer. */
export function fotoMoeglich(): { ok: true } | { ok: false; grund: string } {
  if (!aiEnabled("material")) return { ok: false, grund: "Ein Foto lesen kann nur die KI, und die ist gerade nicht eingerichtet." };
  if (!aiReadsImages("material")) return { ok: false, grund: "Im eingestellten KI-Modus kann die KI keine Fotos lesen (zum Beispiel im manuellen Modus)." };
  return { ok: true };
}

/** Die Fähigkeiten der Übung: die von der KI erkannten, sonst die zum erkannten Thema am besten passenden. Alle aus einem Fach. */
function faehigkeiten(a: Material["analysis"], student: repo.Student, fachDerEinheit: string): repo.Skill[] {
  const alle = repo.listSkills();
  const erkannt = (a?.skill_ids ?? []).map((id) => alle.find((s) => s.id === id)).filter((s): s is repo.Skill => Boolean(s));
  const fach = erkannt[0]?.subject ?? a?.subject ?? fachDerEinheit;
  const gleich = erkannt.filter((s) => s.subject === fach);
  if (gleich.length) return gleich.slice(0, FAEHIGKEITEN);
  if (!fach || !a?.topic) return [];
  // nur die am besten passenden: „Brüche kürzen und erweitern“ gibt Kürzen und Erweitern, nicht noch Dividieren
  const passend = matchSkills(a.topic, fach, { student }).filter((m) => m.via === "faehigkeit");
  return passend
    .filter((m) => m.score === passend[0].score)
    .slice(0, FAEHIGKEITEN)
    .map((m) => m.skill);
}

/**
 * Liest das Foto (falls es noch nicht gelesen ist) und legt die Übung als Entwurf an. Wirft einen Fehler mit
 * einem Satz für den Lehrer, wenn etwas fehlt; das Foto bleibt dann gespeichert, ein zweiter Versuch geht ohne
 * neues Hochladen.
 */
export async function uebungAusFoto(o: { unitId: number; teacherId: number; materialId: number; anzahl?: number; hinweis?: string }): Promise<{ worksheetId: number; aiError?: string }> {
  const unit = getUnit(o.unitId);
  if (!unit || unit.status !== "gestartet") throw new Error("Diese Einheit läuft nicht mehr.");
  const student = repo.getStudent(unit.student_id)!;
  const m = getMaterial(o.materialId);
  if (!m || !hatDatei(m) || !m.mime?.startsWith("image/")) throw new Error("Das Foto ist nicht mehr da. Bitte noch einmal fotografieren.");
  const geht = fotoMoeglich();
  if (!geht.ok) throw new Error(geht.grund);
  const fach = unit.subject || (student.subjects.length === 1 ? student.subjects[0] : "");
  let analyse = m.analysis;
  if (!analyse) {
    if ((m.size ?? 0) > MAX_ANALYSIS_IMAGE_BYTES) throw new Error(`Das Foto ist zu groß für die KI (höchstens ${MAX_ANALYSIS_IMAGE_BYTES / 1024 / 1024} MB).`);
    const pool = skillsForPrompt(student, fach || undefined);
    let gelesen: Awaited<ReturnType<typeof analyzeMaterialWithAI>> = null;
    let problem = "";
    try {
      gelesen = await analyzeMaterialWithAI(
        { mime: m.mime, base64: fs.readFileSync(materialFile(m)).toString("base64") },
        { subject: fach || undefined, skills: pool.map(({ id, name, area, subject }) => ({ id, name, area, subject })) },
        { teacherId: o.teacherId, unitId: unit.id, studentId: student.id, trigger: "foto" },
      );
    } catch (e) {
      problem = e instanceof Error ? e.message : String(e);
    }
    if (!gelesen) throw new Error(`Die KI konnte das Foto nicht lesen.${problem ? ` ${problem}` : ""} Versuch es noch einmal oder mit einem schärferen Foto.`);
    setAnalysis(m.id, gelesen, "ki");
    analyse = getMaterial(m.id)!.analysis;
  }
  const skills = faehigkeiten(analyse, student, fach);
  if (!skills.length)
    throw new Error(`Zu diesem Foto${analyse?.topic ? ` („${analyse.topic}“)` : ""} hat die KI keine passende Fähigkeit gefunden. Ordne das Foto selbst ein oder erstelle die Übung im Builder.`);
  const ctx = studentContext(student.id);
  const thema = analyse?.topic?.trim() ?? "";
  const hinweis = (o.hinweis ?? "").trim().slice(0, 300);
  const anzahl = (FOTO_ANZAHL as readonly number[]).includes(Number(o.anzahl)) ? Number(o.anzahl) : FOTO_STANDARD;
  const out = await createDraft(
    {
      studentId: student.id,
      subject: skills[0].subject,
      schoolType: ctx?.schoolType || student.school_type || "Mittelschule",
      klasse: ctx?.klasse ?? student.klasse ?? 1,
      skillIds: skills.map((s) => s.id),
      difficulty: AUTO,
      count: anzahl,
      categories: [],
      focus: [thema && `Stoff vom Foto: ${thema}`, hinweis].filter(Boolean).join(". ").slice(0, 500),
      useAI: true,
      title: thema ? `${student.name.split(" ")[0]} – ${thema}`.slice(0, 120) : "",
      materialId: m.id,
      examples: (analyse?.tasks ?? []).map((t) => t.prompt.trim()).filter(Boolean).slice(0, VORBILDER),
    },
    o.teacherId,
  );
  return { worksheetId: out.id, aiError: out.aiError };
}
