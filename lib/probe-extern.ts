/**
 * **Eigene Probeschularbeit** (niko, Spezifikation Abschnitt 7): Probeschularbeiten entstehen oft außerhalb der App, als PDF mit
 * der Angabe und eines mit der Musterlösung. Lernheft nimmt beide, hält sie zusammen, der Schüler arbeitet am Gerät oder auf
 * Papier, und bewertet wird gegen die Musterlösung. Kein zweites System: es entsteht eine gewöhnliche Probeschularbeit
 * (lib/probeschularbeit.ts: `worksheets.probe_test_id`, Punkte je Aufgabe, Notenschlüssel, am Gerät Modus 'test'); auf Papier
 * bewertet „Arbeit fotografieren“ (lib/papier-einheit.ts) gegen ihre Aufgaben und die Musterlösung.
 *
 * 1. **Hochladen**: Angabe und Musterlösung (PDF oder Fotos) werden Material des Schülers (nur für Lehrer, wie jedes Material).
 *    Ein PDF mit Textebene liest die App selbst (lib/pdf-text.ts), ohne KI (`liesProbe` mit `ki: false`).
 * 2. **Lesen mit KI** nur auf Tippen, mit den Kosten davor und nur mit „kein Name darauf“: eine Anfrage je Feld (Angabe,
 *    Musterlösung), nur für das Feld, das die App nicht selbst lesen konnte. Zugeordnet wird über die Nummer
 *    (lib/probe-extern-regeln.ts): ohne Lösung „Lösung fehlt“, eine unklare Nummer „unsicher“.
 * 3. **Prüfen**: eine Zeile je Teilaufgabe, unsichere oben; Nummer, Text, Punkte, Lösung und Fähigkeit änderbar. Nichts entsteht
 *    vor „Übernehmen“ (`uebernimmProbe`): dann eine Übung für diesen Schüler, mit der Schularbeit verknüpft, eine Freitext-Aufgabe
 *    je Teilaufgabe mit ihren Punkten, die Musterlösung als Lösung (nur für die Lehrkraft), Quelle „eigene Probeschularbeit (Datei …)“.
 * 4. Ohne KI dieselbe Ansicht, leer oder mit dem Text aus dem PDF, die Seiten daneben.
 *
 * Schülerseiten bekommen weder die Musterlösung noch die Dateien: Material liefert nur `/material/[id]/datei` an Lehrer, und eine
 * Probeschularbeit (Modus 'test') schickt keine Lösung ans Gerät (lib/solver-tasks.ts, lib/service.ts).
 */
import fs from "node:fs";
import { leseProbeAngabe, leseProbeLoesung } from "./ai";
import { budget, costOf, FUNCTIONS, isLocalModel, routeFor } from "./ai/config";
import { aiEnabled, aiReadsImages, breakerState, budgetUsedUp, schuelerGestoppt } from "./ai/router";
import { grenzeErreichtText } from "./ai/schueler-kosten";
import { faehigkeitenFuer, seitenFuerKi } from "./blatt-einlesen";
import { db, json } from "./db";
import { matchSkills } from "./lehrplan";
import { getMaterial, hatDatei, materialFile, sniffType } from "./materials";
import { liesPdfText } from "./pdf-text";
import {
  absatz,
  aufgabenText,
  fehlerVorUebernehmen,
  GRENZEN,
  liesLoesungMitNummern,
  liesTextMitNummern,
  MAX_DATEIEN,
  nachNummer,
  nummerText,
  punkteVon,
  quelleText,
  teilVon,
  zeilenAusLesung,
  type AngabeGelesen,
  type LoesungGelesen,
  type ProbeVorschlag,
  type ProbeZeile,
} from "./probe-extern-regeln";
import * as repo from "./repo";
import type { TaskDraft } from "./tasks";

export * from "./probe-extern-regeln";

/** Titel der Dateien als Material, bis „Übernehmen“ den Namen der Probeschularbeit dazusetzt. */
export const DATEI_TITEL = { angabe: "Probeschularbeit: Angabe", loesung: "Probeschularbeit: Musterlösung" } as const;

const eineZeile = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Die Schularbeit, wenn sie zu diesem Schüler gehört. */
function pruefungVon(studentId: number, testId: number) {
  const test = repo.getTest(testId);
  return test && test.student_id === studentId ? test : null;
}

/** Die Fähigkeiten zur Wahl: die des Schülers im Fach der Schularbeit, dazu die mit der Schularbeit verknüpften. */
export function faehigkeitenZurProbe(student: repo.Student, test: repo.TestResult): { id: string; name: string; area: string }[] {
  const liste = faehigkeitenFuer(student, test.subject);
  const da = new Set(liste.map((s) => s.id));
  for (const id of test.skill_ids) {
    const s = repo.getSkill(id);
    if (s && s.subject === test.subject && !da.has(id)) {
      liste.push({ id: s.id, name: s.name, area: s.area });
      da.add(id);
    }
  }
  return liste;
}

/** Name und Art der gespeicherten Dateien, für die Seiten neben der Prüfansicht (nur Lehrerseiten). */
export const dateiInfo = (ids: number[]) =>
  ids.flatMap((id) => {
    const m = getMaterial(id);
    return m ? [{ id, name: m.file_name ?? m.title, pdf: m.mime === "application/pdf" }] : [];
  });

/** Nur Material dieses Schülers mit Datei, jede höchstens einmal, höchstens MAX_DATEIEN. */
export const eigeneDateien = (ids: number[], studentId: number) =>
  [...new Set(ids)].slice(0, MAX_DATEIEN).filter((id) => {
    const m = getMaterial(id);
    return Boolean(m && hatDatei(m) && m.student_id === studentId);
  });

// ---------- KI: Tor und Kosten ----------

/** Typische Größe einer Lesung: je Seite, der Text der Anfrage (mit der Liste der Fähigkeiten), die Antwort. */
const TYPISCH_SEITE = 1_800;
const TYPISCH_TEXT = { angabe: 3_000, loesung: 600 } as const;
const TYPISCH_AUS = { angabe: 3_500, loesung: 2_500 } as const;

/** Seiten eines PDFs (für die Kostenangabe); ein Foto ist eine Seite. */
export function seitenVon(data: Buffer): number {
  if (sniffType(data)?.mime !== "application/pdf") return 1;
  const n = data.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g)?.length ?? 1;
  return Math.max(1, Math.min(n, 40));
}

/**
 * Was das Lesen etwa kostet („Lesen kostet ca. 6 Cent“): je Feld eine Anfrage, nur für die Felder, die die App nicht selbst
 * lesen konnte. Der Schnitt der letzten Lesungen, sonst aus dem Preis des Modells und der Zahl der Seiten.
 */
export function kostenProbe(seiten: { angabe: number; loesung: number }, now = Date.now()): string {
  const route = routeFor("probe");
  if (route.provider === "manual") return "Lesen kostet nichts (manueller Modus)";
  if (isLocalModel(route.provider)) return "Lesen kostet nichts (lokales Modell)";
  const seit = new Date(now - 60 * 86_400_000).toISOString();
  const m = db().prepare("SELECT COUNT(*) AS n, AVG(cost_usd) AS usd FROM ai_calls WHERE fn = 'probe' AND status = 'ok' AND test = 0 AND cost_usd > 0 AND created_at >= ?").get(seit) as { n: number; usd: number | null };
  const eine = (feld: "angabe" | "loesung", n: number) =>
    m.n >= 3 && m.usd !== null ? m.usd : costOf(route.model, FUNCTIONS.probe.tier, { input: Math.max(1, n) * TYPISCH_SEITE + TYPISCH_TEXT[feld], output: TYPISCH_AUS[feld], cacheWrite: 0, cacheRead: 0 });
  const usd = (seiten.angabe ? eine("angabe", seiten.angabe) : 0) + (seiten.loesung ? eine("loesung", seiten.loesung) : 0);
  return `Lesen kostet ca. ${Math.max(1, Math.round((usd / budget().usdPerEur) * 100))} Cent`;
}

/**
 * Darf die KI jetzt lesen? Sonst der Grund in einem Satz, und die Lehrkraft trägt die Aufgaben selbst ein: KI aus oder ohne
 * Dateien, Monatsbudget aufgebraucht, Grenze je Schüler erreicht, nach Ausfällen pausiert.
 */
export function probeTor(studentId: number): { erlaubt: true } | { erlaubt: false; grund: string } {
  const selbst = "Trag die Aufgaben selbst ein, die Seiten stehen daneben.";
  if (!aiEnabled("probe")) return { erlaubt: false, grund: `Lesen kann nur die KI, und die ist gerade nicht eingerichtet. ${selbst}` };
  if (!aiReadsImages("probe")) return { erlaubt: false, grund: `Im eingestellten KI-Modus kann die KI keine Dateien lesen. ${selbst}` };
  if (budgetUsedUp("probe")) return { erlaubt: false, grund: `Das KI-Budget für diesen Monat ist aufgebraucht. ${selbst}` };
  if (schuelerGestoppt("probe", studentId)) return { erlaubt: false, grund: `${grenzeErreichtText()} ${selbst}` };
  if (breakerState().paused) return { erlaubt: false, grund: `Die KI war zuletzt nicht erreichbar und pausiert ein paar Minuten. ${selbst}` };
  return { erlaubt: true };
}

// ---------- Lesen ----------

/** Der gespeicherte Text der Dateien, Seite für Seite (lib/pdf-text.ts); null, sobald eine Datei keinen hat (Foto, Scan). */
export function textDerDateien(ids: number[]): string[] | null {
  if (!ids.length) return null;
  const zeilen: string[] = [];
  for (const id of ids) {
    const m = getMaterial(id);
    if (!m || !hatDatei(m) || m.mime !== "application/pdf") return null;
    try {
      zeilen.push(...liesPdfText(fs.readFileSync(materialFile(m))).zeilen, "");
    } catch {
      return null;
    }
  }
  return zeilen;
}

export type ProbeLesung = ProbeVorschlag & {
  /** woher jedes Feld kommt: aus dem Text der PDFs, von der KI, oder (noch) nicht gelesen */
  quelle: { angabe: "text" | "ki" | null; loesung: "text" | "ki" | null };
  /** was die KI noch lesen könnte (nur auf Tippen): die Felder ohne Textebene, mit ihrer Zahl an Seiten */
  offen: { angabe: number; loesung: number };
};

/**
 * Liest Angabe und Musterlösung: zuerst der gespeicherte Text der PDFs (ohne KI); mit `ki` dazu die KI für jedes Feld, das so
 * nicht ging, eine Anfrage je Feld. Gibt die Zeilen der Prüfansicht zurück und speichert nichts außer dem Protokoll der KI.
 * Wirft einen Fehler mit einem Satz für die Lehrkraft.
 */
export async function liesProbe(o: { studentId: number; testId: number; teacherId: number; angabeIds: number[]; loesungIds: number[]; ki: boolean }): Promise<ProbeLesung> {
  const student = repo.getStudent(o.studentId);
  if (!student) throw new Error("Diesen Schüler gibt es nicht.");
  const test = pruefungVon(student.id, o.testId);
  if (!test) throw new Error("Diese Schularbeit gehört zu einem anderen Schüler.");
  const angabeIds = eigeneDateien(o.angabeIds, student.id);
  const loesungIds = eigeneDateien(o.loesungIds, student.id);
  if (!angabeIds.length) throw new Error("Bitte zuerst die Angabe hochladen.");
  const skills = faehigkeitenZurProbe(student, test);
  const erlaubt = new Set(skills.map((s) => s.id));
  // a suggestion by the words only among the Schularbeit's own skills: the word match on a task text is often far off
  // („Kürze 6/8“ ranks „Abzählen“ first), a wrong guess would count for the Lernstand, an empty one the teacher picks
  const skill = (text: string) =>
    matchSkills(text, test.subject, { student, limit: 8 }).find((m) => m.via === "faehigkeit" && test.skill_ids.includes(m.skill.id) && erlaubt.has(m.skill.id))?.skill.id ?? null;

  // the text stored in the PDFs first: no KI needed when it has numbered tasks
  const angabeText = textDerDateien(angabeIds);
  let angabe: AngabeGelesen | null = angabeText ? liesTextMitNummern(angabeText) : null;
  if (angabe && !angabe.aufgaben.length) angabe = null;
  const loesungText = textDerDateien(loesungIds);
  let loesung: LoesungGelesen | null = loesungText ? liesLoesungMitNummern(loesungText) : null;
  if (loesung && !loesung.loesungen.length) loesung = null;
  const quelle: ProbeLesung["quelle"] = { angabe: angabe ? "text" : null, loesung: loesung ? "text" : null };

  if (o.ki && (!angabe || (loesungIds.length && !loesung))) {
    const tor = probeTor(student.id);
    if (!tor.erlaubt) throw new Error(tor.grund);
    const meta = { teacherId: o.teacherId, studentId: student.id, trigger: "probe-extern" };
    if (!angabe) {
      const g = await leseProbeAngabe(seitenFuerKi(angabeIds, student.id), { fach: test.subject, skills }, meta);
      if (!g) throw new Error("Die KI hat die Angabe nicht gelesen. Trag die Aufgaben bitte selbst ein.");
      angabe = g;
      quelle.angabe = "ki";
    }
    if (loesungIds.length && !loesung) {
      const nummern = nachNummer(zeilenAusLesung(angabe, null, { erlaubt }).zeilen).map(nummerText);
      const g = await leseProbeLoesung(seitenFuerKi(loesungIds, student.id), { fach: test.subject, nummern: [...new Set(nummern)] }, meta);
      if (!g) throw new Error("Die KI hat die Musterlösung nicht gelesen. Trag die Lösungen bitte selbst ein.");
      loesung = g;
      quelle.loesung = "ki";
    }
  }

  const seiten = (ids: number[]) => ids.reduce((n, id) => n + seitenVon(fs.readFileSync(materialFile(getMaterial(id)!))), 0);
  const offen = { angabe: angabe ? 0 : seiten(angabeIds), loesung: loesung || !loesungIds.length ? 0 : seiten(loesungIds) };
  if (!angabe) return { titel: "", zeilen: [], hinweise: [], quelle, offen };
  const v = zeilenAusLesung(angabe, loesungIds.length ? loesung : null, { erlaubt, skill });
  if (!loesungIds.length) v.hinweise.unshift("Ohne Musterlösung bewertest du jede Teilaufgabe selbst.");
  else if (!loesung) v.hinweise.unshift("Die Musterlösung ist noch nicht gelesen.");
  return { ...v, quelle, offen };
}

// ---------- Übernehmen ----------

export type ProbeEingabe = {
  studentId: number;
  testId: number;
  teacherId: number;
  titel: string;
  zeilen: ProbeZeile[];
  angabeIds: number[];
  loesungIds: number[];
  /** woher die Zeilen kommen (für die Lehrkraft beim nächsten Öffnen): ki, text oder hand */
  gelesen: "ki" | "text" | "hand";
};

/** Was an einer übernommenen Probeschularbeit gespeichert ist (`worksheets.settings.extern`). */
export type ExternDaten = { angabe: number[]; loesung: number[]; datei: string; gelesen: string };

/** Die Dateien einer eigenen Probeschularbeit, oder null für jede andere Übung. */
export function externDaten(w: Pick<repo.Worksheet, "settings">): ExternDaten | null {
  const e = json<{ extern?: ExternDaten }>(w.settings ?? "{}", {}).extern;
  return e && Array.isArray(e.angabe) ? { angabe: e.angabe.map(Number), loesung: (e.loesung ?? []).map(Number), datei: String(e.datei ?? ""), gelesen: String(e.gelesen ?? "") } : null;
}

/**
 * „Übernehmen“: aus den geprüften Zeilen eine Probeschularbeit für diesen Schüler, mit der Schularbeit verknüpft. Je Teilaufgabe
 * eine Freitext-Aufgabe (bewertet von der Lehrkraft, teilweise = halbe Punkte), ihre Punkte, die Musterlösung als Lösung und
 * Musterantwort, die Nummer wie auf dem Blatt und die Quelle. Eine unsichere Zeile, fehlende Punkte oder eine doppelte Nummer
 * werden nie gespeichert. Alles oder nichts; die Schularbeit selbst bleibt, wie sie ist.
 */
export function uebernimmProbe(e: ProbeEingabe): { worksheetId: number } | { error: string } {
  const student = repo.getStudent(e.studentId);
  if (!student) return { error: "Diesen Schüler gibt es nicht." };
  const test = pruefungVon(student.id, e.testId);
  if (!test) return { error: "Diese Schularbeit gehört zu einem anderen Schüler." };
  const angabeIds = eigeneDateien(e.angabeIds, student.id);
  const loesungIds = eigeneDateien(e.loesungIds, student.id).filter((id) => !angabeIds.includes(id));
  if (!angabeIds.length) return { error: "Bitte die Angabe hochladen." };
  const erlaubt = new Set(faehigkeitenZurProbe(student, test).map((s) => s.id));
  const zeilen = nachNummer(
    e.zeilen.map((z) => ({
      aufgabe: eineZeile(z.aufgabe, GRENZEN.nummer).replace(/\D+$/, ""),
      teil: teilVon(z.teil),
      einleitung: absatz(z.einleitung, GRENZEN.einleitung),
      text: absatz(z.text, GRENZEN.text),
      punkte: punkteVon(z.punkte),
      loesung: absatz(z.loesung, GRENZEN.loesung),
      skillId: z.skillId?.trim() || null,
      unsicher: Boolean(z.unsicher),
      grund: "",
    })),
  );
  const fehler = fehlerVorUebernehmen(zeilen, erlaubt);
  if (fehler.length) return { error: fehler[0] };

  const datei = getMaterial(angabeIds[0])?.file_name ?? "";
  const quelle = quelleText(datei);
  const titel = eineZeile(e.titel, GRENZEN.titel) || test.title || `${test.kind} ${test.subject}`;
  const first = student.name.split(" ")[0];
  const skillIds = [...new Set(zeilen.map((z) => z.skillId).filter((x): x is string => Boolean(x)))];
  const drafts: TaskDraft[] = zeilen.map((z) => ({
    type: "free",
    skillId: z.skillId,
    skillIds: z.skillId ? [z.skillId] : [],
    category: null,
    difficulty: "mittel",
    prompt: aufgabenText(z),
    data: { lines: 4, nummer: nummerText(z) },
    answer: { sample: z.loesung, criteria: [] },
    solution: z.loesung,
    hints: [],
    errorMap: [],
    sourceType: "eigen",
    quelle,
  }));

  const worksheetId = db().transaction(() => {
    const id = repo.createWorksheet(
      {
        title: `${first} – Probeschularbeit: ${titel}`.slice(0, 120),
        subject: test.subject,
        grade: student.grade,
        school_type: student.school_type,
        klasse: student.klasse,
        topic: [...new Set(skillIds.map((s) => repo.getSkill(s)?.area ?? "").filter(Boolean))].join(", "),
        difficulty: "gemischt",
        task_type: "free",
        kind: "ueberpruefung",
        source: "manuell",
        skill_ids: skillIds,
        student_id: student.id,
        teacher_id: e.teacherId,
        status: "freigegeben",
        settings: JSON.stringify({ extern: { angabe: angabeIds, loesung: loesungIds, datei, gelesen: e.gelesen } satisfies ExternDaten }),
      },
      drafts,
    );
    const tasks = repo.listTasks(id);
    tasks.forEach((t, i) => db().prepare("UPDATE tasks SET points = ? WHERE id = ?").run(zeilen[i].punkte, t.id));
    db().prepare("UPDATE worksheets SET probe_test_id = ? WHERE id = ?").run(test.id, id);
    for (const [ids, art] of [[angabeIds, "angabe"], [loesungIds, "loesung"]] as const)
      for (const m of ids) db().prepare("UPDATE materials SET title = ?, subject = ? WHERE id = ? AND title = ?").run(`${DATEI_TITEL[art]} ${titel}`.slice(0, 120), test.subject, m, DATEI_TITEL[art]);
    return id;
  })();
  return { worksheetId };
}
