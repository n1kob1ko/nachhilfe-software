"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireTeacher } from "@/lib/auth";
import * as imp from "@/lib/curriculum-import";
import { merkeZuordnung, setExamThresholds, splitTopics, stoffVorschlag, STOFF_THEMEN_MAX } from "@/lib/lehrplan";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { alleFachNamen } from "@/lib/faecher";
import { fachAus } from "@/lib/school";
import { bestaetigeZuordnung, getLesung, setzeStatus, stoffAusLesung } from "@/lib/pruefungsstoff";
import { stoffzettelFuer } from "@/lib/stoffzettel";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => (str(f, k) === "" ? null : Number(str(f, k).replace(",", ".")));

// ---------- exams ----------
export type TopicSuggestion = { topic: string; skills: { id: string; name: string; area: string }[]; best: string[] };

/** Skill suggestions per topic of the Stoff, the sure ones to be shown ticked; nothing is linked before „Eintragen“. */
export async function suggestSkillsAction(studentId: number, subject: string, text: string): Promise<TopicSuggestion[]> {
  await requireTeacher();
  const student = repo.getStudent(studentId);
  if (!student) return [];
  return stoffVorschlag(splitTopics(text).slice(0, STOFF_THEMEN_MAX), subject, student).map((v) => ({
    topic: v.topic,
    skills: v.skills.map((s) => ({ id: s.id, name: s.parent_id ? `${repo.getSkill(s.parent_id)?.name ?? ""} › ${s.name}` : s.name, area: s.area })),
    best: v.best,
  }));
}

/**
 * The skills ticked on a Stoff form: per topic (`stoff_thema` in order, `stoff_<i>` ticked or chosen, `stoff_auto_<i>`
 * what was suggested) and `skill_ids` without a topic. Unknown ids are dropped. A topic whose ticks differ from the
 * suggestion is remembered for next time (lib/lehrplan.ts merkeZuordnung).
 */
function zuordnungAus(formData: FormData, subject: string, teacherId: number): string[] {
  const ids = new Set(formData.getAll("skill_ids").map(String));
  formData.getAll("stoff_thema").forEach((raw, i) => {
    const topic = String(raw).trim();
    const chosen = [...new Set(formData.getAll(`stoff_${i}`).map(String).filter(Boolean))].filter((id) => repo.getSkill(id));
    const auto = str(formData, `stoff_auto_${i}`).split(",").filter(Boolean);
    for (const id of chosen) ids.add(id);
    const same = chosen.length === auto.length && chosen.every((id) => auto.includes(id));
    if (topic && !same) merkeZuordnung(subject, topic, chosen, teacherId);
  });
  return [...ids].filter((id) => repo.getSkill(id));
}

/** Quick entry from the student profile: Art, Fach, Datum, Stoff (and a result, if already written). */
export async function addExamAction(formData: FormData) {
  const teacher = await requireTeacher();
  const studentId = Number(str(formData, "student_id"));
  const topics = splitTopics(str(formData, "topics"));
  const grade = num(formData, "grade");
  const points = num(formData, "points");
  // the Fach may be one outside the profile when the Stoffzettel names it (Biologie)
  const subject = fachAus(str(formData, "subject"), repo.getStudent(studentId)?.subjects ?? [], alleFachNamen());
  const kind = str(formData, "kind") || "Schularbeit";
  const title = str(formData, "title").slice(0, 120);
  const materialId = stoffzettelFuer(Number(str(formData, "material_id")), { student_id: studentId, title, kind, subject, topics });
  // the documents read together (lib/pruefungsstoff.ts): only a reading for this student
  const lesung = getLesung(Number(str(formData, "lesung_id")) || null);
  const lesungId = lesung && lesung.studentId === studentId ? lesung.id : null;
  const testId = repo.addTest({
    student_id: studentId,
    date: str(formData, "date") || wienerDatum(),
    subject,
    kind,
    title,
    topic: topics.join(", "),
    topics,
    grade,
    points,
    max_points: num(formData, "max_points"),
    notes: str(formData, "notes"),
    skill_ids: zuordnungAus(formData, subject, teacher.id),
    teacher_id: teacher.id,
    material_id: materialId,
  });
  revalidatePath(`/schueler/${studentId}`);
  revalidatePath("/");
  if (materialId) revalidatePath("/mehr/material", "layout");
  if (lesungId) {
    // the recognised Stoff goes with the Prüfung; „Erkannt“ shows it and asks only about the unclear points
    stoffAusLesung(testId, lesungId);
    redirect(`/schueler/${studentId}/pruefung/${testId}/stoff`);
  }
}

/** „Erkannt“: die kurze Bestätigung je unklarer Zuordnung (`zuordnung_<id>`: Fähigkeit oder leer) und „Gehört dazu / nicht dazu“. */
export async function bestaetigeStoffAction(testId: number, formData: FormData) {
  const teacher = await requireTeacher();
  const t = repo.getTest(testId);
  if (!t) return;
  for (const [key, value] of formData.entries()) {
    const m = key.match(/^zuordnung_(\d+)$/);
    if (m) bestaetigeZuordnung(testId, Number(m[1]), String(value) || null, teacher.id);
  }
  const status = str(formData, "status");
  const zeile = Number(str(formData, "zeile"));
  if (zeile && (status === "pruefung" || status === "ausgeschlossen")) setzeStatus(testId, zeile, status);
  revalidatePath(`/schueler/${t.student_id}/pruefung/${testId}`);
  revalidatePath(`/schueler/${t.student_id}`);
  redirect(`/schueler/${t.student_id}/pruefung/${testId}/stoff?bestaetigt=1`);
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

/** The skills an exam covers, as ticked on the preparation page („Stoff zuordnen“ or „Fähigkeiten der Prüfung ändern“). */
export async function setExamSkillsAction(testId: number, formData: FormData) {
  const teacher = await requireTeacher();
  const t = repo.getTest(testId);
  if (!t) return;
  const ids = zuordnungAus(formData, t.subject, teacher.id);
  repo.setTestSkills(testId, ids);
  revalidatePath(`/schueler/${t.student_id}/pruefung/${testId}`);
  revalidatePath(`/schueler/${t.student_id}`);
  // from „Probeschularbeit“ on the profile: on to creating it
  redirect(`/schueler/${t.student_id}/pruefung/${testId}?zugeordnet=${ids.length}${str(formData, "ziel") === "probe" ? "#probeschularbeit" : ""}`);
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
