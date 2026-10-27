/**
 * Gelöstes Blatt einlesen (niko, 21.10.2026): „ich habe mit Victoria zb viele Probe Schularbeiten hier in Claude
 * erstellen lassen und machen lassen aber wie gebe ich Lernheft die information wie sie sich getan hat“. Die Blätter
 * werden ausgedruckt und auf Papier gelöst. Der Lehrer fotografiert die Seiten am Profil unter Prüfungen; die KI
 * liest jede Aufgabe ab, rechnet sie nach (oder übernimmt die Korrektur auf dem Blatt) und ordnet sie einer
 * Fähigkeit zu. Der Lehrer prüft alles in der Vorschau; erst „Ins Profil übernehmen“ speichert.
 *
 * Gespeichert wird es wie eine am Gerät gelöste Übung, damit Lernstand, Lernverlauf und Dokumentation es ohne
 * Sonderweg kennen: eine Überprüfung (kind 'ueberpruefung') mit einer Freitext-Aufgabe je Zeile, eine erledigte
 * Zuweisung und je Aufgabe eine Antwort mit der Bewertung des Lehrers (richtig, teilweise = halb, falsch). Die
 * Punkte vom Blatt stehen in `settings.papier.erreicht`; eine Probeschularbeit zu einer Schularbeit hängt über
 * `probe_test_id` an ihr, eine echte Schularbeit bekommt Note und Punkte bei den Prüfungen.
 *
 * - Die Fotos gehen nur nach der Bestätigung „kein Name darauf“ an die KI. Kein Name aus der App geht mit, nur das
 *   Fach und die Liste der Fähigkeiten.
 * - Ohne KI (oder im Modus ohne Bilder) trägt der Lehrer die Zeilen selbst ein; die Vorschau ist dieselbe.
 */
import fs from "node:fs";
import { aiEnabled, aiReadsImages, leseGeloestesBlatt, type BlattGelesen } from "./ai";
import { documentAssignment } from "./autodoc";
import { levelOf } from "./curriculum";
import { db } from "./db";
import { dayOf } from "./exams";
import { matchSkills, skillsForPrompt } from "./lehrplan";
import { getMaterial, hatDatei, materialFile, MAX_ANALYSIS_IMAGE_BYTES, MAX_ANALYSIS_PDF_BYTES, sniffType } from "./materials";
import { PRUEFUNGSARTEN } from "./pruefungsarten";
import * as repo from "./repo";
import { erreichtVon, istBewertung, MAX_SEITEN, MAX_ZEILEN, type Bewertung, type BlattVorschlag, type BlattZeile } from "./blatt-regeln";

export * from "./blatt-regeln";

/** Titel eines frisch hochgeladenen Blatts; beim Übernehmen bekommt es den Namen des Tests. */
export const BLATT_TITEL = "Gelöstes Blatt";
export const PAPIER_ANTWORT = "Auf Papier gelöst";

/** Ob ein Blatt jetzt gelesen werden kann; sonst der Grund, in Worten für den Lehrer. */
export function blattLesbar(): { ok: true } | { ok: false; grund: string } {
  if (!aiEnabled("blatt")) return { ok: false, grund: "Lesen kann nur die KI, und die ist gerade nicht eingerichtet. Trag die Aufgaben selbst ein." };
  if (!aiReadsImages("blatt")) return { ok: false, grund: "Im eingestellten KI-Modus kann die KI keine Fotos lesen. Trag die Aufgaben selbst ein." };
  return { ok: true };
}

const eineZeile = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
/** Punkte: nicht negativ, auf halbe Punkte, höchstens 100; sonst null. */
const punkt = (x: unknown): number | null => {
  const n = typeof x === "string" ? Number(x.replace(",", ".")) : x;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 2) / 2 : null;
};
const noteVon = (x: unknown): number | null => (typeof x === "number" && Number.isInteger(x) && x >= 1 && x <= 5 ? x : null);

/**
 * Prüft, was die KI gelesen hat: nur Fähigkeiten aus der Liste (sonst die beste nach dem Thema, zum Prüfen
 * markiert), Punkte nur wenn sie Sinn ergeben, eine Note nur von 1 bis 5. Was nicht passt, bleibt leer.
 */
export function vorschlagAusGelesen(g: BlattGelesen, o: { erlaubt: Set<string>; fach: string; student: Pick<repo.Student, "school_type" | "klasse" | "grade"> }): BlattVorschlag {
  const hinweise: string[] = [];
  const zeilen: BlattZeile[] = [];
  for (const a of g.aufgaben.slice(0, MAX_ZEILEN)) {
    const aufgabe = eineZeile(a.aufgabe, 300);
    if (!aufgabe) continue;
    let skillId = a.faehigkeit && o.erlaubt.has(a.faehigkeit) ? a.faehigkeit : null;
    let geraten = false;
    if (!skillId) {
      const treffer = matchSkills(`${a.thema} ${aufgabe}`, o.fach, { student: o.student, limit: 1 })[0];
      if (treffer && o.erlaubt.has(treffer.skill.id)) {
        skillId = treffer.skill.id;
        geraten = true;
      }
    }
    const max = punkt(a.punkte_max) || null;
    let punkte = punkt(a.punkte);
    if (punkte != null && max != null && punkte > max) punkte = null;
    zeilen.push({
      nr: eineZeile(a.nr, 8) || String(zeilen.length + 1),
      aufgabe,
      antwort: eineZeile(a.antwort, 200),
      bewertung: istBewertung(a.bewertung) ? a.bewertung : "falsch",
      punkte,
      max,
      skillId,
      fehler: a.bewertung === "richtig" ? "" : eineZeile(a.fehler, 200),
      pruefen: a.unsicher || geraten || !skillId,
      // for the Abschluss of a unit („2 unsicher geprüft“, lib/papier-einheit.ts): the KI itself was not sure
      warUnsicher: a.unsicher,
    });
  }
  if (g.aufgaben.length > MAX_ZEILEN) hinweise.push(`Nur die ersten ${MAX_ZEILEN} Aufgaben übernommen.`);
  if (!zeilen.length) hinweise.push("Keine Aufgaben gefunden. Bitte die Aufgaben selbst eintragen.");
  if (zeilen.some((z) => !z.skillId)) hinweise.push("Nicht jede Aufgabe hat eine Fähigkeit. Ohne Fähigkeit zählt sie für die Punkte, aber nicht für den Lernstand.");
  if (zeilen.some((z) => z.pruefen)) hinweise.push("Gelb markierte Zeilen bitte genau prüfen.");
  for (const u of g.unsicher.slice(0, 4)) {
    const text = eineZeile(u, 140);
    if (text) hinweise.push(`Unsicher: ${text}`);
  }
  const gesamtMax = punkt(g.gesamt_max);
  let gesamt = punkt(g.gesamt_punkte);
  if (gesamt != null && gesamtMax != null && gesamt > gesamtMax) gesamt = null;
  return { titel: eineZeile(g.titel, 120), zeilen, gesamt, gesamtMax, note: noteVon(g.note), hinweise };
}

/** Die Fähigkeiten, aus denen die KI und die Vorschau wählen: die des Schülers in diesem Fach. */
export function faehigkeitenFuer(student: Pick<repo.Student, "school_type" | "klasse" | "grade">, fach: string) {
  return skillsForPrompt(student, fach).map((s) => ({ id: s.id, name: s.name, area: s.area }));
}

/**
 * Liest gespeicherte Seiten (Material) mit der KI. Wirft einen Fehler mit einem Satz für den Lehrer; die Seiten
 * bleiben dann gespeichert.
 */
export async function liesBlatt(o: { materialIds: number[]; studentId: number; teacherId: number; fach: string; unitId?: number | null }): Promise<BlattVorschlag> {
  const geht = blattLesbar();
  if (!geht.ok) throw new Error(geht.grund);
  const student = repo.getStudent(o.studentId);
  if (!student) throw new Error("Diesen Schüler gibt es nicht.");
  const seiten = seitenFuerKi(o.materialIds, student.id);
  const skills = faehigkeitenFuer(student, o.fach);
  const gelesen = await leseGeloestesBlatt(seiten, { fach: o.fach, skills }, { teacherId: o.teacherId, studentId: student.id, unitId: o.unitId ?? null, trigger: "blatt" });
  if (!gelesen) throw new Error("Die KI hat das Blatt nicht gelesen. Trag die Aufgaben bitte selbst ein.");
  return vorschlagAusGelesen(gelesen, { erlaubt: new Set(skills.map((s) => s.id)), fach: o.fach, student });
}

/**
 * Die gespeicherten Seiten (Material des Schülers) für die KI, höchstens `MAX_SEITEN`. Wirft einen Fehler mit einem Satz für
 * den Lehrer; auch „Arbeit fotografieren“ (lib/papier-einheit.ts) liest so.
 */
export function seitenFuerKi(materialIds: number[], studentId: number) {
  if (!materialIds.length) throw new Error("Bitte zuerst die Seiten fotografieren.");
  return materialIds.slice(0, MAX_SEITEN).map((id) => {
    const m = getMaterial(id);
    if (!m || !hatDatei(m) || (m.student_id != null && m.student_id !== studentId)) throw new Error("Eine Seite gibt es nicht mehr. Bitte noch einmal fotografieren.");
    let data: Buffer;
    try {
      data = fs.readFileSync(materialFile(m));
    } catch {
      throw new Error("Die Datei einer Seite fehlt. Bitte noch einmal fotografieren.");
    }
    const type = sniffType(data);
    if (!type) throw new Error("Nur Fotos (JPG, PNG, WebP) und PDF-Dateien sind möglich.");
    const pdf = type.mime === "application/pdf";
    const max = pdf ? MAX_ANALYSIS_PDF_BYTES : MAX_ANALYSIS_IMAGE_BYTES;
    if (data.length > max) throw new Error(`${pdf ? "Ein PDF" : "Ein Foto"} ist zu groß für die KI (höchstens ${max / 1024 / 1024} MB).`);
    return { mime: type.mime as "application/pdf" | "image/jpeg" | "image/png" | "image/webp", base64: data.toString("base64") };
  });
}

// ---------- Übernehmen ----------

export type BlattEingabe = {
  studentId: number;
  teacherId: number;
  fach: string;
  /** JJJJ-MM-TT: wann das Blatt gelöst wurde */
  datum: string;
  titel: string;
  /** probe: Probeschularbeit oder Übungsblatt; pruefung: eine echte Schularbeit oder ein Test (bekommt die Note) */
  art: "probe" | "pruefung";
  /** die Schularbeit, zu der es gehört (probe) oder deren Ergebnis es ist (pruefung); null: keine bzw. neu */
  testId: number | null;
  /** Art einer neu eingetragenen Prüfung (Schularbeit, Test …) */
  pruefungsart?: string;
  note: number | null;
  gesamt: number | null;
  gesamtMax: number | null;
  zeilen: BlattZeile[];
  materialIds: number[];
  /**
   * Arbeit fotografieren (lib/papier-einheit.ts): ein Blatt, das nicht aus der laufenden Einheit stammt, aber in ihr gelöst
   * wurde. Zuweisung und Antworten bekommen dann diese Einheit (unit_id), damit Abschluss und Dokumentation sie sehen.
   */
  unitId?: number | null;
};

const echtesDatum = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;

/**
 * Übernimmt ein geprüftes Blatt ins Profil: eine erledigte Überprüfung mit den Bewertungen des Lehrers (zählt für
 * den Lernstand), bei einer echten Prüfung dazu Note und Punkte. Alles oder nichts.
 */
export function speichereBlatt(e: BlattEingabe): { worksheetId: number; assignmentId: number; testId: number | null } | { error: string } {
  const student = repo.getStudent(e.studentId);
  if (!student) return { error: "Diesen Schüler gibt es nicht." };
  const fach = eineZeile(e.fach, 60);
  if (!fach) return { error: "Bitte das Fach wählen." };
  if (!echtesDatum(e.datum)) return { error: "Bitte ein gültiges Datum eintragen." };
  if (e.datum > dayOf(new Date())) return { error: "Das Datum liegt in der Zukunft. Bitte den Tag eintragen, an dem das Blatt gelöst wurde." };
  const zeilen = e.zeilen
    .slice(0, MAX_ZEILEN)
    .map((z) => ({ ...z, aufgabe: eineZeile(z.aufgabe, 300), antwort: eineZeile(z.antwort, 200), fehler: eineZeile(z.fehler, 200), nr: eineZeile(z.nr, 8), punkte: punkt(z.punkte), max: punkt(z.max) || null }))
    .filter((z) => z.aufgabe);
  if (!zeilen.length) return { error: "Bitte mindestens eine Aufgabe eintragen." };
  if (zeilen.some((z) => !istBewertung(z.bewertung))) return { error: "Unbekannte Bewertung." };
  if (zeilen.some((z) => z.punkte != null && z.max != null && z.punkte > z.max)) return { error: "Bei einer Aufgabe sind mehr Punkte erreicht als möglich." };
  const test = e.testId ? repo.getTest(e.testId) : null;
  if (e.testId && test?.student_id !== student.id) return { error: "Diese Prüfung gehört zu einem anderen Schüler." };
  const note = e.note == null ? null : noteVon(e.note);
  if (e.note != null && note == null) return { error: "Die Note muss 1 bis 5 sein." };
  const gesamtMax = punkt(e.gesamtMax);
  const gesamt = punkt(e.gesamt);
  if (gesamt != null && gesamtMax != null && gesamt > gesamtMax) return { error: "Insgesamt sind mehr Punkte erreicht als möglich." };

  // nur Fähigkeiten dieses Fachs; eine andere zählt nicht für den Lernstand
  const skill = (id: string | null) => {
    const s = id ? repo.getSkill(id) : null;
    return s && s.subject === fach ? s.id : null;
  };
  const titel = eineZeile(e.titel, 100) || (e.art === "probe" ? "Probeschularbeit" : (test?.title || `${e.pruefungsart || "Schularbeit"} ${fach}`));
  const first = student.name.split(" ")[0];
  // in einer laufenden Einheit: jetzt (dann stehen die Antworten in der richtigen Reihenfolge im Bericht der Einheit)
  const am = e.unitId ? new Date().toISOString().slice(0, 19).replace("T", " ") : `${e.datum} 10:00:00`;
  const skillIds = [...new Set(zeilen.map((z) => skill(z.skillId)).filter((x): x is string => Boolean(x)))];
  const materialIds = e.materialIds.filter((id) => {
    const m = getMaterial(id);
    return m && hatDatei(m) && (m.student_id == null || m.student_id === student.id);
  });

  const out = db().transaction(() => {
    const worksheetId = repo.createWorksheet(
      {
        title: `${first}: ${titel} (auf Papier)`.slice(0, 120),
        subject: fach,
        grade: student.grade,
        school_type: student.school_type,
        klasse: student.klasse,
        topic: [...new Set(skillIds.map((id) => repo.getSkill(id)!.area))].join(", "),
        difficulty: "gemischt",
        task_type: "free",
        kind: "ueberpruefung",
        source: "manuell",
        skill_ids: skillIds,
        student_id: student.id,
        teacher_id: e.teacherId,
      },
      zeilen.map((z) => ({
        type: "free",
        skillId: skill(z.skillId),
        skillIds: skill(z.skillId) ? [skill(z.skillId)!] : [],
        category: null,
        difficulty: "mittel",
        prompt: z.aufgabe,
        data: { lines: 1 },
        answer: { sample: "", criteria: [] },
        solution: "",
        hints: [],
        errorMap: [],
        sourceType: "eigen",
      })),
    );
    const tasks = repo.listTasks(worksheetId);
    const erreicht: Record<number, number> = {};
    tasks.forEach((t, i) => {
      const z = zeilen[i];
      if (z.max != null) db().prepare("UPDATE tasks SET points = ? WHERE id = ?").run(z.max, t.id);
      const p = erreichtVon(z);
      if (p != null) erreicht[t.id] = p;
    });
    db()
      .prepare("UPDATE worksheets SET settings = ?, probe_test_id = ? WHERE id = ?")
      .run(JSON.stringify({ papier: { datum: e.datum, materialIds, erreicht } }), e.art === "probe" && test ? test.id : null, worksheetId);

    // in einer Einheit kein Test-Modus: der Bericht der Einheit hielte das Blatt sonst für den Minitest
    const assignmentId = repo.assignWorksheet(worksheetId, student.id, PAPIER_ANTWORT, e.unitId ?? null, e.unitId ? "normal" : "test");
    tasks.forEach((t, i) => {
      const z = zeilen[i];
      const review = z.bewertung === "leer" ? "falsch" : z.bewertung;
      const attemptId = repo.recordAttempt({
        assignment_id: assignmentId,
        task_id: t.id,
        student_id: student.id,
        skill_id: t.skillId,
        attempt_no: 1,
        answer: z.bewertung === "leer" ? "(nicht bearbeitet)" : z.antwort || PAPIER_ANTWORT,
        correct: review === "richtig" ? 1 : 0,
        final: 1,
        time_ms: 0,
        hints_used: 0,
        solution_viewed: 0,
        error_label: null,
        feedback: z.fehler,
        teacher_id: e.teacherId,
        level: levelOf("mittel"),
        created_at: am,
        unit_id: e.unitId ?? null,
      });
      repo.setAttemptReview(attemptId, review, e.teacherId, e.unitId ? new Date() : new Date(`${e.datum}T10:00:00Z`));
    });
    // gelöst am Tag des Blatts, nicht heute; schon „angekommen“, damit es nie am Gerät auftaucht
    db().prepare("UPDATE assignments SET assigned_at = ?, started_at = ?, completed_at = ?, delivered_at = ? WHERE id = ?").run(am, am, am, am, assignmentId);

    let testId: number | null = e.art === "probe" ? (test?.id ?? null) : null;
    if (e.art === "pruefung") {
      if (test) {
        repo.setTestResult(test.id, { grade: note, points: gesamt, max_points: gesamtMax });
        testId = test.id;
      } else {
        const kind = PRUEFUNGSARTEN.find((a) => a === e.pruefungsart) ?? "Schularbeit";
        testId = repo.addTest({
          student_id: student.id, date: e.datum, subject: fach, kind, topic: "", grade: note, points: gesamt, max_points: gesamtMax, notes: "",
          skill_ids: skillIds, title: eineZeile(e.titel, 100), topics: [], status: "geschrieben", teacher_id: e.teacherId, material_id: materialIds[0] ?? null,
        });
      }
    }
    for (const id of materialIds) {
      db().prepare("UPDATE materials SET title = ?, subject = ? WHERE id = ? AND title = ?").run(`${BLATT_TITEL}: ${titel}`.slice(0, 120), fach, id, BLATT_TITEL);
    }
    return { worksheetId, assignmentId, testId };
  })();
  documentAssignment(out.assignmentId);
  return out;
}
