"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import * as dq from "@/lib/datenqualitaet";
import { setSetting } from "@/lib/lehrplan";
import { CARELESS_SETTING } from "@/lib/service";

// Mehr › Datenqualität and the correction sections on the page of a skill. Everything is written
// through lib/datenqualitaet.ts: own corrections only, the official data stays unchanged.

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const DQ = "/mehr/datenqualitaet";
const skillPage = (id: string) => `/faehigkeiten/${encodeURIComponent(id)}`;
const query = (p: Record<string, string | null | undefined>) => {
  const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
  return q ? `?${q}` : "";
};
/** Corrections change lists, Lernstand and recommendations everywhere. */
const refresh = () => revalidatePath("/", "layout");

/** Back to the page of a skill, the message next to the section it came from. */
function backToSkill(skillId: string, section: string, res: dq.Result<object>, ok = "gespeichert"): never {
  refresh();
  redirect(`${skillPage(skillId)}${query("error" in res ? { fehler: res.error, bei: section } : { ok, bei: section })}#${section}`);
}
function backToPage(res: dq.Result<object>, ok: string, params: Record<string, string | null | undefined> = {}): never {
  refresh();
  redirect(`${DQ}${query({ ...params, ...("error" in res ? { fehler: res.error } : { ok }) })}`);
}

// ---------- page of a skill ----------
export async function saveSkillPlacementAction(skillId: string, f: FormData) {
  const teacher = await requireTeacher();
  const grade = (k: string) => (str(f, k) === "" ? undefined : Number(str(f, k)));
  const res = dq.setSkillOverride(
    skillId,
    { area: str(f, "area"), subtopic: str(f, "subtopic"), grade_min: grade("grade_min"), grade_max: grade("grade_max"), practice_shift: str(f, "practice_shift"), note: str(f, "note") },
    teacher.id,
  );
  backToSkill(skillId, "einordnung", res);
}
/** Einordnung back to the original; a merge stays. */
export async function resetSkillPlacementAction(skillId: string) {
  const teacher = await requireTeacher();
  backToSkill(skillId, "einordnung", dq.resetSkillOverride(skillId, teacher.id, { keepMerge: true }), "zurueckgesetzt");
}
export async function addCurriculumLinkAction(skillId: string, f: FormData) {
  const teacher = await requireTeacher();
  const nodeId = Number(str(f, "node_id"));
  backToSkill(skillId, "lehrplan", Number.isInteger(nodeId) && nodeId > 0 ? dq.addCurriculumLink(skillId, nodeId, teacher.id) : { error: "Bitte einen Lehrplan-Eintrag wählen." });
}
export async function removeCurriculumLinkAction(skillId: string, nodeId: number) {
  const teacher = await requireTeacher();
  backToSkill(skillId, "lehrplan", dq.removeCurriculumLink(skillId, nodeId, teacher.id), "entfernt");
}
/** Merges this skill (the duplicate) into the chosen one. */
export async function mergeSkillAction(fromId: string, f: FormData) {
  const teacher = await requireTeacher();
  const into = str(f, "into");
  backToSkill(fromId, "zusammenfuehren", into ? dq.mergeSkills(fromId, into, teacher.id) : { error: "Bitte die Fähigkeit wählen, die bleibt." }, "zusammengefuehrt");
}
/** Undoes a merge; back to the page of `pageSkillId`, or to Mehr › Datenqualität. */
export async function unmergeSkillAction(fromId: string, pageSkillId: string | null) {
  const teacher = await requireTeacher();
  const res = dq.unmergeSkills(fromId, teacher.id);
  if (pageSkillId) backToSkill(pageSkillId, "zusammenfuehren", res, "getrennt");
  backToPage(res, "getrennt");
}

// ---------- Mehr › Datenqualität ----------
/** One pair of Dubletten: `keep` stays, the other one is merged into it. */
export async function mergePairAction(f: FormData) {
  const teacher = await requireTeacher();
  const [a, b, keep] = [str(f, "a"), str(f, "b"), str(f, "keep")];
  const res = keep === a || keep === b ? dq.mergeSkills(keep === a ? b : a, keep, teacher.id) : { error: "Bitte wählen, welche Fähigkeit bleibt." };
  backToPage(res, "zusammengefuehrt", { fach: str(f, "fach"), alle: str(f, "alle") });
}
/** Every own correction of a skill back to the original, a merge included. */
export async function resetSkillOverrideAction(skillId: string) {
  const teacher = await requireTeacher();
  backToPage(dq.resetSkillOverride(skillId, teacher.id), "zurueckgesetzt");
}
export async function moveSkillsAction(f: FormData) {
  const teacher = await requireTeacher();
  const area = str(f, "ziel");
  const res = dq.moveSkills([...new Set(f.getAll("skill_ids").map(String))], area, teacher.id);
  backToPage(res, "verschoben", { fach: str(f, "fach"), thema: "error" in res ? str(f, "thema") : area.replace(/\s+/g, " ") });
}
/** Lernstand: Flüchtigkeitsfehler marked by the teacher count milder (on by default). */
export async function setCarelessAction(on: boolean) {
  await requireTeacher();
  setSetting(CARELESS_SETTING, on ? "an" : "aus");
  backToPage({ ok: true }, "gespeichert");
}
