/**
 * **Erkannt** (niko, 25.10.2026: „Ich möchte das tatsächlich erkannte Ergebnis und die zugeordneten Fähigkeiten sehen
 * und mit den Originalen vergleichen“): der Prüfungsstoff einer Prüfung (lib/pruefungsstoff.ts) als eine Ansicht, nach
 * Gruppen, je Punkt Wortlaut → Lerninhalt → Fähigkeit mit Lernstand, und was das für den Unterricht heißt: welche
 * Fähigkeiten Lücken haben, wofür ein geprüftes Lernpaket oder Übungen bereitliegen und wofür noch Übungen fehlen.
 * Liest nur; keine KI, nichts wird erzeugt.
 */
import { db } from "./db";
import { examPrep } from "./exams";
import { hasBuiltInGenerator } from "./generators";
import { listLernpakete, ungeprueft } from "./lernpakete";
import { masteryStatus, type MasteryStatus } from "./mastery";
import { getLesung, GRUPPE_LABEL, stoffDerPruefung, type Gruppe, type StoffZeile } from "./pruefungsstoff";
import * as repo from "./repo";
import { analyzeStudent } from "./service";
import { STOFF_GRUPPEN } from "./ai";

/** Eine Fähigkeit des Prüfungsstoffs mit Lernstand und dem, was für sie bereitliegt. */
export type SkillStand = {
  skill: repo.Skill;
  mastery: number | null;
  status: MasteryStatus;
  /** ein geprüftes Lernpaket dazu (mit Präsentation?) */
  paket: { id: number; title: string; praesentation: boolean } | null;
  /** Übungen ohne KI: ein Generator, eine Aufgabenbank oder Aufgaben im Bestand */
  uebungen: boolean;
  /** wie viele Punkte des Stoffs sie nennen */
  punkte: number;
};

export type ErkanntAnsicht = {
  test: repo.TestResult;
  student: repo.Student;
  /** die gelesenen Dateien in der Reihenfolge der Anfrage, mit ihrer Rolle */
  dokumente: { nr: number; materialId: number; rolle: string }[];
  gruppen: { gruppe: Gruppe; label: string; zeilen: StoffZeile[] }[];
  /** zu bestätigen: unklar zugeordnet (und nicht ausgeschlossen) */
  zuBestaetigen: StoffZeile[];
  /** noch zu klären, ob es zur Prüfung gehört */
  zuKlaeren: StoffZeile[];
  skills: Map<string, SkillStand>;
  /** Lücken zuerst (kritisch, üben, nicht getestet), dann gut und sicher */
  reihenfolge: SkillStand[];
  /** wofür etwas bereitliegt, die größten Lücken zuerst (höchstens drei) */
  vorbereitet: SkillStand[];
  /** Lücken ohne Paket und ohne Übungen */
  fehlt: SkillStand[];
};

const ROLLE: Record<string, string> = { stoffzettel: "Stoffzettel", inhaltsverzeichnis: "Inhaltsverzeichnis", erklaerung: "Erklärung", aufgaben: "Blatt mit Aufgaben", sonstiges: "Weiteres Blatt" };
const LUECKE: MasteryStatus[] = ["kritisch", "üben", "nicht getestet"];
const ORDNUNG: MasteryStatus[] = ["kritisch", "üben", "nicht getestet", "gut", "sicher"];

/** Die Ansicht „Erkannt“ für eine Prüfung; null, wenn es sie nicht gibt. */
export function erkanntAnsicht(testId: number, heute: string): ErkanntAnsicht | null {
  const prep = examPrep(testId, heute);
  if (!prep) return null;
  const { test, student } = prep;
  const zeilen = stoffDerPruefung(testId);
  const lesung = getLesung(test.lesung_id ?? null);
  const dokumente = (lesung?.dateien ?? []).map((d, i) => ({ nr: i + 1, materialId: d.material_id, rolle: ROLLE[lesung!.lesung.dokumente.find((x) => x.nr === i + 1)?.rolle ?? "sonstiges"] }));
  const gruppen = STOFF_GRUPPEN.map((g) => ({ gruppe: g, label: GRUPPE_LABEL[g], zeilen: zeilen.filter((z) => z.gruppe === g) })).filter((g) => g.zeilen.length);

  // Lernstand of every skill a row names (linked or to confirm), packages and exercises without KI
  const ids = [...new Set(zeilen.flatMap((z) => (z.skill_id ? [z.skill_id] : [])))];
  const stand = new Map((analyzeStudent(student.id)?.skills ?? []).map((s) => [s.skill.id, s]));
  const pakete = listLernpakete().filter((p) => p.status === "geprueft" && !ungeprueft(p) && p.schritt_zahl > 0 && p.fach === test.subject);
  const imBestand = db().prepare("SELECT COUNT(*) AS n FROM task_skills WHERE skill_id = ?");
  const skills = new Map<string, SkillStand>();
  for (const id of ids) {
    const skill = repo.getSkill(id);
    if (!skill) continue;
    const s = stand.get(id);
    const mastery = s?.mastery ?? null;
    const p = pakete.find((x) => x.skill_ids.some((k) => k === id || repo.getSkill(k)?.parent_id === id || skill.parent_id === k));
    skills.set(id, {
      skill,
      mastery,
      status: masteryStatus(mastery),
      paket: p ? { id: p.id, title: p.title, praesentation: p.praesentation_id !== null } : null,
      uebungen: hasBuiltInGenerator(id) || (imBestand.get(id) as { n: number }).n > 0,
      punkte: zeilen.filter((z) => z.skill_id === id).length,
    });
  }
  // only what belongs to the Prüfung counts for „vorbereitet“ and „fehlt“
  const zaehlt = new Set(zeilen.filter((z) => z.status === "pruefung" && z.skill_id).map((z) => z.skill_id!));
  const reihenfolge = [...skills.values()].sort((a, b) => ORDNUNG.indexOf(a.status) - ORDNUNG.indexOf(b.status) || (a.mastery ?? 0) - (b.mastery ?? 0) || b.punkte - a.punkte);
  const luecken = reihenfolge.filter((s) => zaehlt.has(s.skill.id) && LUECKE.includes(s.status));
  return {
    test,
    student,
    dokumente,
    gruppen,
    zuBestaetigen: zeilen.filter((z) => z.zuordnung === "unklar" && z.status !== "ausgeschlossen" && z.vorschlaege.length),
    zuKlaeren: zeilen.filter((z) => z.status === "unklar"),
    skills,
    reihenfolge,
    vorbereitet: luecken.filter((s) => s.paket || s.uebungen).slice(0, 3),
    fehlt: luecken.filter((s) => !s.paket && !s.uebungen),
  };
}
