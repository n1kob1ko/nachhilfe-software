"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireTeacher } from "@/lib/auth";
import * as imp from "@/lib/curriculum-import";
import { matchSkills, setExamThresholds, splitTopics } from "@/lib/lehrplan";
import * as repo from "@/lib/repo";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => (str(f, k) === "" ? null : Number(str(f, k).replace(",", ".")));
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ---------- exams ----------
export type TopicSuggestion = { topic: string; skills: { id: string; name: string; area: string }[] };

/** Skill suggestions for the Stoff of an exam; nothing is linked until the teacher ticks it. */
export async function suggestSkillsAction(studentId: number, subject: string, text: string): Promise<TopicSuggestion[]> {
  await requireTeacher();
  const student = repo.getStudent(studentId);
  if (!student) return [];
  return splitTopics(text)
    .slice(0, 8)
    .map((topic) => ({ topic, skills: matchSkills(topic, subject, { student, limit: 6 }).map((m) => ({ id: m.skill.id, name: m.skill.parent_id ? `${repo.getSkill(m.skill.parent_id)?.name ?? ""} › ${m.skill.name}` : m.skill.name, area: m.skill.area })) }));
}

/** Quick entry from the student profile: Art, Fach, Datum, Stoff (and a result, if already written). */
export async function addExamAction(formData: FormData) {
  const teacher = await requireTeacher();
  const studentId = Number(str(formData, "student_id"));
  const topics = splitTopics(str(formData, "topics"));
  const grade = num(formData, "grade");
  const points = num(formData, "points");
  repo.addTest({
    student_id: studentId,
    date: str(formData, "date") || todayLocal(),
    subject: str(formData, "subject"),
    kind: str(formData, "kind") || "Schularbeit",
    title: str(formData, "title"),
    topic: topics.join(", "),
    topics,
    grade,
    points,
    max_points: num(formData, "max_points"),
    notes: str(formData, "notes"),
    skill_ids: [...new Set(formData.getAll("skill_ids").map(String))],
    teacher_id: teacher.id,
  });
  revalidatePath(`/schueler/${studentId}`);
  revalidatePath("/");
}

export async function setExamResultAction(testId: number, formData: FormData) {
  await requireTeacher();
  const t = repo.getTest(testId);
  if (!t) return;
  repo.setTestResult(testId, { grade: num(formData, "grade"), points: num(formData, "points"), max_points: num(formData, "max_points") });
  revalidatePath(`/schueler/${t.student_id}`);
  revalidatePath("/");
}

export async function cancelExamAction(testId: number) {
  await requireTeacher();
  const t = repo.getTest(testId);
  if (!t) return;
  repo.setTestStatus(testId, "abgesagt");
  revalidatePath(`/schueler/${t.student_id}`);
  revalidatePath("/");
}

/** The skills an exam covers, as ticked on the preparation page. */
export async function setExamSkillsAction(testId: number, formData: FormData) {
  await requireTeacher();
  const t = repo.getTest(testId);
  if (!t) return;
  repo.setTestSkills(testId, [...new Set(formData.getAll("skill_ids").map(String))]);
  revalidatePath(`/schueler/${t.student_id}/pruefung/${testId}`);
  revalidatePath(`/schueler/${t.student_id}`);
}

// ---------- curriculum admin ----------
/** A package from curriculum/, an uploaded file or pasted JSON → preview (nothing is changed yet). */
export async function previewImportAction(formData: FormData) {
  const admin = await requireAdmin();
  let raw = str(formData, "json");
  const bundled = str(formData, "bundled");
  const file = formData.get("file");
  if (bundled) raw = JSON.stringify(imp.readBundled(bundled));
  else if (file && typeof file === "object" && "text" in file && file.size > 0) {
    if (file.size > 2_000_000) redirect("/mehr/lehrplan?tab=importe&fehler=Datei%20zu%20gro%C3%9F");
    raw = await file.text();
  }
  const out = imp.preview(raw, admin.id);
  if (!out.id) redirect(`/mehr/lehrplan?tab=importe&fehler=${encodeURIComponent(out.diff.errors.slice(0, 3).join(" · ") || "Ungültiges Paket")}`);
  redirect(`/mehr/lehrplan?tab=importe&vorschau=${out.id}`);
}
/** Previews for several bundled packages at once (own structures first, so their skills exist when the Lehrplan links are applied). */
export async function previewManyAction(formData: FormData) {
  const admin = await requireAdmin();
  const order = (f: string) => (imp.readBundled(f)?.source.source_type === "eigen" ? 0 : 1);
  const files = [...new Set(formData.getAll("bundled").map(String))].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  const ids: number[] = [];
  const incoming = new Set<string>();
  for (const f of files) {
    const pkg = imp.readBundled(f);
    if (!pkg) continue;
    const out = imp.preview(pkg, admin.id, incoming);
    if (out.id) ids.push(out.id);
    pkg.skills?.forEach((s) => incoming.add(s.id));
  }
  if (!ids.length) redirect("/mehr/lehrplan?tab=importe&fehler=Keine%20Pakete%20ausgew%C3%A4hlt");
  redirect(`/mehr/lehrplan?tab=importe&vorschau=${ids.join(",")}`);
}
/** Applies several previews in the order they were made; stops at the first error. */
export async function applyManyAction(ids: number[]) {
  await requireAdmin();
  const done: number[] = [];
  for (const id of [...ids].sort((a, b) => a - b)) {
    const out = imp.applyImport(id);
    if (!out.ok && out.error !== "Genau dieses Paket wurde schon importiert") {
      revalidatePath("/mehr/lehrplan");
      redirect(`/mehr/lehrplan?tab=importe&vorschau=${ids.join(",")}&fehler=${encodeURIComponent(`${imp.getImport(id)?.label ?? id}: ${out.error ?? ""}`)}`);
    }
    if (out.ok) done.push(id);
    else imp.discardImport(id);
  }
  revalidatePath("/mehr/lehrplan");
  revalidatePath("/faehigkeiten");
  redirect(`/mehr/lehrplan?tab=importe&importiert=${done.join(",")}`);
}
export async function discardManyAction(ids: number[]) {
  await requireAdmin();
  ids.forEach((id) => imp.discardImport(id));
  redirect("/mehr/lehrplan?tab=importe");
}
export async function applyImportAction(id: number) {
  await requireAdmin();
  const out = imp.applyImport(id);
  revalidatePath("/mehr/lehrplan");
  revalidatePath("/faehigkeiten");
  redirect(out.ok ? `/mehr/lehrplan?tab=importe&importiert=${id}` : `/mehr/lehrplan?tab=importe&vorschau=${id}&fehler=${encodeURIComponent(out.error ?? "")}`);
}
export async function discardImportAction(id: number) {
  await requireAdmin();
  imp.discardImport(id);
  redirect("/mehr/lehrplan?tab=importe");
}
export async function removeDemoAction(sourceKey: string) {
  await requireAdmin();
  imp.removeDemo(sourceKey);
  revalidatePath("/mehr/lehrplan");
  revalidatePath("/faehigkeiten");
}
export async function setThresholdsAction(formData: FormData) {
  await requireAdmin();
  try {
    setExamThresholds(["start", "priority", "soon"].map((k) => Number(str(formData, k))));
  } catch {
    redirect("/mehr/lehrplan?tab=einstellungen&fehler=Bitte%20drei%20Zahlen%20eingeben");
  }
  revalidatePath("/");
  redirect("/mehr/lehrplan?tab=einstellungen&gespeichert=1");
}
