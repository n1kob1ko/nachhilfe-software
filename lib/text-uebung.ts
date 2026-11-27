/**
 * „Übungen zu allen Fehlern senden“ (niko, 27.11.2026, erste Stunde mit einer 2. Klasse: „konnte nur eine Übung weitersenden“):
 * nach der Korrektur des Texts von heute geht EINE Übung ans Tablet, die alle offenen Fehlerbereiche des Texts übt, der
 * häufigste zuerst, dazu am Ende ein paar Sätze aus dem eigenen Text zum Verbessern. Vorher ging je Fähigkeit eine Übung, und
 * die nächste kam erst, wenn die erste fertig war.
 */
import { generatorAufgabenZur } from "./cockpit";
import { db } from "./db";
import { skillAusStelle, textFehler, zumUeben } from "./einheit-ablauf";
import { expectedFixes } from "./fix-text";
import * as repo from "./repo";
import { schulstufe } from "./school";
import { latestCorrection, listItems, snapshotDoc } from "./text-correction";
import { placed, type CorrectionItem } from "./text-correction-core";
import { categoryLabel } from "./text-correction-rules";
import { blockText } from "./text-doc";
import type { TaskDraft } from "./tasks";
import { getUnit } from "./units";

/** Höchstens so viele Fehlerbereiche in einer Übung; die übrigen kommen danach wie bisher einzeln. */
export const MAX_BEREICHE = 5;
/** So viele Aufgaben aus den Generatoren ungefähr insgesamt, verteilt nach der Zahl der Fehler. */
const ZIEL = 12;
/** Höchstens so viele Sätze aus dem eigenen Text. */
export const MAX_EIGENE = 4;

export type TextUebung = {
  textId: number;
  titel: string;
  bereiche: { skillId: string; name: string; anzahl: number; aufgaben: number }[];
  eigene: TaskDraft[];
};

/** Wie viele Aufgaben je Fehlerbereich: nach der Zahl der Fehler, mindestens 3, höchstens 6; ein einzelner Bereich wie sonst. */
export function verteile(anzahlen: number[], normal: number[]): number[] {
  if (anzahlen.length === 1) return [normal[0]];
  const summe = anzahlen.reduce((a, b) => a + b, 0) || 1;
  return anzahlen.map((n, i) => Math.min(normal[i], Math.max(3, Math.min(6, Math.round((ZIEL * n) / summe)))));
}

/**
 * Was „Übungen zu allen Fehlern senden“ jetzt hinausschicken würde, ohne etwas zu speichern; null, wenn kein Fehlerbereich aus
 * den Generatoren offen ist (dann bleibt der Knopf je Fähigkeit).
 */
export function textUebungPlan(unitId: number): TextUebung | null {
  const tf = textFehler(unitId);
  if (!tf || tf.korrektur !== "fertig") return null;
  const offen = tf.skills.filter((x) => x.offen).filter((x) => generatorAufgabenZur(unitId, x.skillId, 1) !== null).slice(0, MAX_BEREICHE);
  if (!offen.length) return null;
  const normal = offen.map((x) => generatorAufgabenZur(unitId, x.skillId, 1)!.count);
  const n = verteile(offen.map((x) => x.anzahl), normal);
  return {
    textId: tf.textId,
    titel: tf.titel,
    bereiche: offen.map((x, i) => ({ skillId: x.skillId, name: x.name, anzahl: x.anzahl, aufgaben: n[i] })),
    eigene: eigeneSaetzeAusText(unitId, MAX_EIGENE),
  };
}

/**
 * Sätze aus dem Text von heute, in denen ein markierter Fehler steckt, als „Fehler korrigieren“: der Satz wie geschrieben, richtig
 * ist er mit allen Verbesserungen darin (nicht abgelehnt). Nur Sätze mit 1 bis 3 Fehlern und mindestens drei Wörtern.
 */
export function eigeneSaetzeAusText(unitId: number, max: number): TaskDraft[] {
  const tf = textFehler(unitId);
  if (!tf || tf.korrektur !== "fertig" || max <= 0) return [];
  const c = latestCorrection(tf.textId);
  if (!c) return [];
  const doc = snapshotDoc(c);
  const deutsch = (getUnit(unitId)?.subject || "Deutsch") === "Deutsch";
  const items = listItems(c.id).filter((i) => i.kind === "fehler" && i.status !== "abgelehnt" && placed(i) && i.replacement.trim() !== i.quote.trim()) as (CorrectionItem & { block: number; pos_start: number; pos_end: number })[];
  const out: TaskDraft[] = [];
  const gesehen = new Set<string>();
  for (const i of items) {
    if (out.length >= max) break;
    const b = doc[i.block];
    if (!b) continue;
    const text = blockText(b);
    const [von, bis] = satzUm(text, i.pos_start, i.pos_end);
    const key = `${i.block}:${von}`;
    if (gesehen.has(key)) continue;
    gesehen.add(key);
    const drin = items.filter((x) => x.block === i.block && x.pos_start >= von && x.pos_end <= bis).sort((a, z) => a.pos_start - z.pos_start);
    let richtig = "";
    let at = von;
    for (const x of drin) {
      if (x.pos_start < at) continue; // überlappend: die erste gilt
      richtig += text.slice(at, x.pos_start) + x.replacement;
      at = x.pos_end;
    }
    richtig += text.slice(at, bis);
    const falsch = text.slice(von, bis).trim();
    richtig = richtig.trim();
    if (falsch.length < 12 || falsch.length > 240 || falsch.split(/\s+/).length < 3 || falsch === richtig) continue;
    const fixes = expectedFixes(falsch, richtig);
    if (fixes.length < 1 || fixes.length > 3) continue;
    const skillId = i.skill_id && repo.getSkill(i.skill_id) ? i.skill_id : deutsch ? skillAusStelle(i) : null;
    const labels = [...new Set(drin.map((x) => categoryLabel(x.category)))];
    const n = fixes.length;
    out.push({
      type: "fix",
      skillId,
      skillIds: skillId ? [skillId] : [],
      category: "korrigieren",
      difficulty: "mittel",
      prompt: `Dieser Satz stammt aus deinem Text. ${n === 1 ? "Darin steckt ein Fehler" : `Darin stecken ${n} Fehler`}. Schreib ihn richtig.`,
      data: { faulty: falsch },
      answer: {
        accepted: [richtig],
        mode: "exact",
        fixes: fixes.map((f) => ({ ...f, label: labels.join(", "), errorType: null })),
        criteria: [n === 1 ? "Der Fehler ist verbessert." : `Alle ${n} Fehler sind verbessert.`, "Richtiges wurde nicht verändert."],
      },
      solution: richtig,
      hints: [`Worauf du achten musst: ${labels.join(", ")}.`],
      errorMap: [],
    });
  }
  return out;
}

/** Anfang und Ende des Satzes um eine Stelle: nach dem letzten . ! ? davor bis einschließlich zum nächsten danach. */
export function satzUm(text: string, start: number, end: number): [number, number] {
  let von = 0;
  for (let k = start - 1; k > 0; k--) {
    if (!/\s/.test(text[k])) continue;
    // davor ein Satzzeichen, auch mit Anführungszeichen dazwischen („Komm mit.“ Dann …)
    let j = k - 1;
    while (j > 0 && /["“”„«»]/.test(text[j])) j--;
    if (/[.!?]/.test(text[j])) {
      von = k + 1;
      break;
    }
  }
  let bis = text.length;
  for (let k = Math.max(end, start); k < text.length; k++) {
    if (/[.!?]/.test(text[k]) && (k + 1 >= text.length || /[\s"“”„«»]/.test(text[k + 1]))) {
      bis = k + 1;
      // Anführungszeichen nach dem Satzzeichen gehören dazu
      while (bis < text.length && /["“”„«»]/.test(text[bis])) bis++;
      break;
    }
  }
  return [von, bis];
}

/**
 * Baut die Übung zu allen offenen Fehlern des Texts von heute und weist sie dem Schüler der Einheit zu. Die Fehlerbereiche stehen
 * in `skill_ids`, damit sie in „Text von heute“ als geübt gelten.
 */
export function sendeZuDenTextFehlern(unitId: number, teacherId: number | null): { worksheetId: number; assignmentId: number } | { fehler: string } {
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet") return { fehler: "Diese Einheit läuft nicht mehr." };
  const student = repo.getStudent(unit.student_id);
  if (!student) return { fehler: "Diesen Schüler gibt es nicht." };
  const plan = textUebungPlan(unitId);
  if (!plan) return { fehler: "Zu den Fehlern im Text gibt es gerade keine Übung ohne KI." };
  const aufgaben: TaskDraft[] = [];
  let difficulty: TaskDraft["difficulty"] | null = null;
  const skillIds: string[] = [];
  for (const b of plan.bereiche) {
    const g = generatorAufgabenZur(unitId, b.skillId, b.aufgaben);
    if (!g?.aufgaben.length) continue;
    aufgaben.push(...g.aufgaben);
    difficulty ??= g.difficulty;
    skillIds.push(b.skillId);
  }
  aufgaben.push(...plan.eigene);
  for (const t of plan.eigene) if (t.skillId && !skillIds.includes(t.skillId)) skillIds.push(t.skillId);
  if (!aufgaben.length) return { fehler: "Zu den Fehlern im Text gibt es gerade keine Übung ohne KI." };
  const erste = repo.getSkill(skillIds[0] ?? plan.bereiche[0].skillId);
  const worksheetId = repo.createWorksheet(
    {
      title: `${student.name.split(" ")[0]} – Fehler im Text „${plan.titel}“`,
      subject: erste?.subject ?? unit.subject ?? "Deutsch",
      grade: schulstufe(student.school_type, student.klasse ?? 1),
      school_type: student.school_type,
      klasse: student.klasse ?? 1,
      topic: "Fehler im Text",
      difficulty: difficulty ?? "mittel",
      task_type: "mixed",
      kind: "uebung",
      source: "generator",
      skill_ids: skillIds,
      student_id: student.id,
      teacher_id: teacherId,
    },
    aufgaben,
  );
  if (!repo.listTasks(worksheetId).length) {
    repo.deleteWorksheet(worksheetId);
    return { fehler: "Die Übung konnte nicht erstellt werden." };
  }
  const assignmentId = repo.assignWorksheet(worksheetId, student.id, "", unit.id);
  // auch von der Korrektur-Seite aus: die Einheit zeigt danach „Üben“ mit dem Stand der Übung, nicht den Start
  zumUeben(unit.id);
  return { worksheetId, assignmentId };
}

/** Die laufende Einheit, in der dieser Text der Text von heute ist; null sonst (für die Korrektur-Seite). */
export function laufendeEinheitDesTexts(textId: number): number | null {
  const rows = db().prepare("SELECT tu.unit_id FROM text_units tu JOIN units u ON u.id = tu.unit_id WHERE tu.text_id = ? AND u.status = 'gestartet' ORDER BY tu.last_at DESC").all(textId) as { unit_id: number }[];
  return rows.map((r) => r.unit_id).find((u) => textFehler(u)?.textId === textId) ?? null;
}
