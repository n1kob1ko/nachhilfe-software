import { abschnitte, auftragVon, heftInfo, ohneAuftrag } from "@/lib/uebungsheft-ansicht";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SheetPage } from "@/components/arbeitsblatt/SheetPage";
import { buildSheet, readOptions } from "@/lib/arbeitsblatt";
import { requireTeacher } from "@/lib/auth";
import { blattDaten } from "@/lib/probeschularbeit";
import * as repo from "@/lib/repo";
import { klassenLabel, stufeLabel } from "@/lib/school";
import { getUnit } from "@/lib/units";

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
  // Übungsheft zu den Fehlern: Teile und Merke vor den Aufgaben, die Anweisung einmal im Kopf der Übung
  const info = heftInfo(w.settings);
  const roh = repo.listTasks(w.id);
  const tasks = info ? roh.map((t) => ({ ...t, prompt: ohneAuftrag(t.prompt, auftragVon(info, t.data.heft)) })) : roh;
  const heft = info ? { vorweg: info.vorweg, kontrolle: info.kontrolle, abschnitte: abschnitte(info, roh.map((t) => t.data.heft)) } : null;
  return { w, student, title, tasks, heft };
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
  const { w, student, title, tasks, heft } = data;
  const sp = await searchParams;
  const o = readOptions(sp, title);
  // aus einer Einheit geöffnet (Minitest drucken): zurück zur Einheit
  const unit = typeof sp.einheit === "string" ? getUnit(Number(sp.einheit)) : null;
  const ausEinheit = unit && unit.student_id === w.student_id ? unit : null;
  const names = new Map<string, string | null>();
  const skillName = (sid: string) => {
    if (!names.has(sid)) names.set(sid, repo.getSkill(sid)?.name ?? null);
    return names.get(sid)!;
  };
  const doc = {
    ...buildSheet(
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
    ),
    // Probeschularbeit: Punkte je Aufgabe und Notenschlüssel
    probe: blattDaten(w, tasks),
    heft,
  };
  const back = ausEinheit
    ? { href: `/einheiten/${ausEinheit.id}`, label: "Zur Einheit" }
    : w.kind === "bibliothek"
      ? { href: `/uebungen/bibliothek/${w.id}`, label: "Aufgabenbibliothek" }
      : { href: `/uebungen/${w.id}`, label: "Zur Übung" };
  return (
    <SheetPage
      doc={doc}
      o={o}
      path={`/arbeitsblatt/${w.id}`}
      extra={ausEinheit ? [["einheit", String(ausEinheit.id)]] : []}
      back={back}
    />
  );
}
