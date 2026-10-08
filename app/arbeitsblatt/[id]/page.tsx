import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SheetPage } from "@/components/arbeitsblatt/SheetPage";
import { buildSheet, readOptions } from "@/lib/arbeitsblatt";
import { requireTeacher } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { klassenLabel, stufeLabel } from "@/lib/school";

type Params = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** An exercise (or one library task) as an A4 worksheet, built on demand from its tasks. */
function load(id: number) {
  const w = repo.getWorksheet(id);
  if (!w) return null;
  const student = w.student_id ? repo.getStudent(w.student_id) : null;
  const first = student?.name.split(" ")[0];
  // "Max – Bruchrechnen" → "Bruchrechnen": the name has its own field on the sheet
  const title =
    first && w.title.startsWith(`${first} – `)
      ? w.title.slice(first.length + 3)
      : w.title;
  return { w, student, title, tasks: repo.listTasks(w.id) };
}

export async function generateMetadata({
  params,
  searchParams,
}: Params): Promise<Metadata> {
  const data = load(Number((await params).id));
  // the title becomes the file name when the sheet is saved as PDF
  return {
    title: {
      absolute: data
        ? readOptions(await searchParams, data.title).title
        : "Arbeitsblatt",
    },
  };
}

export default async function WorksheetSheetPage({
  params,
  searchParams,
}: Params) {
  await requireTeacher();
  const { id } = await params;
  const data = load(Number(id));
  if (!data) notFound();
  const { w, student, title, tasks } = data;
  const o = readOptions(await searchParams, title);
  const names = new Map<string, string | null>();
  const skillName = (sid: string) => {
    if (!names.has(sid)) names.set(sid, repo.getSkill(sid)?.name ?? null);
    return names.get(sid)!;
  };
  const doc = buildSheet(
    {
      title,
      subject: w.subject,
      klasseLabel: w.klasse
        ? klassenLabel(w.school_type, w.klasse)
        : stufeLabel(w.grade),
      topic: w.topic,
      studentName: student?.name ?? null,
      tasks,
    },
    skillName,
    o,
  );
  const back =
    w.kind === "bibliothek"
      ? { href: `/uebungen/bibliothek/${w.id}`, label: "Aufgabenbibliothek" }
      : { href: `/uebungen/${w.id}`, label: "Zur Übung" };
  return (
    <SheetPage
      doc={doc}
      o={o}
      path={`/arbeitsblatt/${w.id}`}
      extra={[]}
      back={back}
    />
  );
}
