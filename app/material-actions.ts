"use server";

import fs from "node:fs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { aiEnabled, analyzeMaterialWithAI } from "@/lib/ai";
import { requireTeacher } from "@/lib/auth";
import { DIFFICULTIES, type Difficulty } from "@/lib/curriculum";
import { cleanTags } from "@/lib/library";
import {
  classifyMaterial,
  deleteMaterial,
  getMaterial,
  MATERIAL_KINDS,
  MATERIAL_ORIGINS,
  materialFile,
  MAX_ANALYSIS_IMAGE_BYTES,
  MAX_ANALYSIS_PDF_BYTES,
  setAnalysis,
  setMaterialSource,
  takeOverTask,
  type MaterialKind,
  type MaterialOrigin,
} from "@/lib/materials";
import * as repo from "@/lib/repo";
import { schoolType } from "@/lib/school";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const page = (id: number, q = "") => `/mehr/material/${id}${q ? `?${q}` : ""}`;
const fail = (id: number, msg: string, anchor = "") => redirect(`${page(id, `fehler=${encodeURIComponent(msg)}`)}${anchor}`);

/** Where the material belongs. Saving it counts as checked. */
export async function classifyMaterialAction(id: number, f: FormData) {
  await requireTeacher();
  const type = schoolType(str(f, "school_type"))?.name ?? "";
  const kind = str(f, "kind");
  const ok = classifyMaterial(id, {
    title: str(f, "title"),
    kind: (kind in MATERIAL_KINDS ? kind : "foto") as MaterialKind,
    subject: str(f, "subject"),
    schoolType: type,
    klasse: type ? Number(f.get("klasse")) || null : null,
    topic: str(f, "topic"),
    skillIds: f.getAll("skill_ids").map(String),
    studentId: Number(f.get("student_id")) || null,
    notes: str(f, "notes"),
  });
  revalidatePath("/mehr/material", "layout");
  redirect(ok ? page(id, "gespeichert=einordnung") : "/mehr/material");
}

export async function setMaterialSourceAction(id: number, f: FormData) {
  await requireTeacher();
  const origin = str(f, "origin");
  if (!(origin in MATERIAL_ORIGINS)) fail(id, "Bitte angeben, woher das Material kommt.", "#herkunft");
  const src = setMaterialSource(id, {
    origin: origin as MaterialOrigin,
    name: str(f, "name"),
    author: str(f, "author"),
    url: str(f, "url"),
    license: str(f, "license"),
    attribution: str(f, "attribution"),
  });
  revalidatePath(page(id));
  redirect(src ? `${page(id, "gespeichert=herkunft")}#herkunft` : "/mehr/material");
}

/**
 * Optional recognition with Claude: the file itself is sent, so the teacher confirms that no names or
 * other personal data are on it. The result is only stored as a suggestion.
 */
export async function analyzeMaterialAction(id: number, f: FormData) {
  const teacher = await requireTeacher();
  const m = getMaterial(id);
  if (!m) redirect("/mehr/material");
  if (!aiEnabled()) fail(id, "Kein KI-Schlüssel hinterlegt.", "#erkennung");
  if (f.get("keine_namen") !== "1") fail(id, "Bitte bestätigen, dass auf dem Material keine Namen oder persönlichen Angaben stehen.", "#erkennung");
  const limit = m.mime === "application/pdf" ? MAX_ANALYSIS_PDF_BYTES : MAX_ANALYSIS_IMAGE_BYTES;
  if (m.size > limit) fail(id, `Für die Erkennung ist die Datei zu groß (höchstens ${limit / 1024 / 1024} MB).`, "#erkennung");
  let data: Buffer;
  try {
    data = fs.readFileSync(materialFile(m));
  } catch {
    return fail(id, "Die Datei fehlt auf dem Server.", "#erkennung");
  }
  const subject = m.subject || undefined;
  const skills = repo
    .listSkills()
    .filter((s) => !subject || s.subject === subject)
    .map(({ id, name, area, subject }) => ({ id, name, area, subject }));
  let a: Awaited<ReturnType<typeof analyzeMaterialWithAI>> = null;
  let problem = "Claude hat nichts erkannt.";
  try {
    a = await analyzeMaterialWithAI({ mime: m.mime, base64: data.toString("base64") }, { subject, skills }, { teacherId: teacher.id, trigger: "material" });
  } catch (e) {
    problem = e instanceof Error ? e.message : String(e);
  }
  if (!a) fail(id, `${problem} Du kannst das Material auch selbst einordnen.`, "#erkennung");
  setAnalysis(id, a!, "ki");
  revalidatePath(page(id));
  redirect(`${page(id, "erkannt=1")}#erkennung`);
}

/** A checked task from the material goes into the library. */
export async function takeOverTaskAction(id: number, f: FormData) {
  const teacher = await requireTeacher();
  const difficulty = ((DIFFICULTIES as readonly string[]).includes(str(f, "difficulty")) ? str(f, "difficulty") : "mittel") as Difficulty;
  const out = takeOverTask(
    id,
    {
      prompt: str(f, "prompt"),
      answers: str(f, "answers").split(/\n|;/),
      solution: str(f, "solution"),
      skillId: str(f, "skill_id") || null,
      difficulty,
      reviewed: f.get("reviewed") === "1",
      ownWords: f.get("own_words") === "1",
      tags: cleanTags(str(f, "tags")),
    },
    teacher.id,
  );
  if ("error" in out) fail(id, out.error, "#uebernehmen");
  revalidatePath("/uebungen/bibliothek", "layout");
  revalidatePath(page(id));
  redirect(`${page(id, `uebernommen=${"libraryId" in out ? out.libraryId : ""}`)}#uebernehmen`);
}

export async function deleteMaterialAction(id: number) {
  await requireTeacher();
  deleteMaterial(id);
  revalidatePath("/mehr/material", "layout");
  redirect("/mehr/material?geloescht=1");
}
