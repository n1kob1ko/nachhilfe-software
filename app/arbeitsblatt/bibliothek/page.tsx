import type { Metadata } from "next";
import { SheetPage } from "@/components/arbeitsblatt/SheetPage";
import { buildSheet, readOptions } from "@/lib/arbeitsblatt";
import { requireTeacher } from "@/lib/auth";
import { getLibraryEntry, type LibraryEntry } from "@/lib/library";
import * as repo from "@/lib/repo";
import { klassenLabel, stufeLabel } from "@/lib/school";

type Params = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Tasks chosen in the library (?eintrag=1&eintrag=5) as one worksheet, without creating an exercise. */
function load(sp: Record<string, string | string[] | undefined>) {
  const raw = sp.eintrag;
  const ids = [
    ...new Set(
      (Array.isArray(raw) ? raw : raw ? [raw] : []).map(Number).filter(Boolean),
    ),
  ].slice(0, 60);
  const entries = ids
    .map(getLibraryEntry)
    .filter((e): e is LibraryEntry => Boolean(e));
  const topics = [...new Set(entries.map((e) => e.topic).filter(Boolean))];
  const title =
    entries.length === 1
      ? entries[0].title
      : topics.length
        ? topics.slice(0, 3).join(", ")
        : "Aufgaben aus der Bibliothek";
  return { ids, entries, title };
}

export async function generateMetadata({
  searchParams,
}: Params): Promise<Metadata> {
  const sp = await searchParams;
  return { title: { absolute: readOptions(sp, load(sp).title).title } };
}

export default async function LibrarySheetPage({ searchParams }: Params) {
  await requireTeacher();
  const sp = await searchParams;
  const { ids, entries, title } = load(sp);
  const o = readOptions(sp, title);
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].join(", ");
  const doc = buildSheet(
    {
      title,
      subject: uniq(entries.map((e) => e.subject)),
      klasseLabel: uniq(
        entries.map((e) =>
          e.klasse
            ? klassenLabel(e.school_type, e.klasse)
            : e.grade
              ? stufeLabel(e.grade)
              : "",
        ),
      ),
      topic: uniq(entries.map((e) => e.topic)),
      studentName: null,
      tasks: entries.map((e) => e.task),
      subjectOf: (i) => entries[i].subject,
    },
    (sid) => repo.getSkill(sid)?.name ?? null,
    o,
  );
  const back =
    entries.length === 1
      ? {
          href: `/uebungen/bibliothek/${entries[0].id}`,
          label: "Aufgabenbibliothek",
        }
      : { href: "/uebungen/bibliothek", label: "Aufgabenbibliothek" };
  return (
    <SheetPage
      doc={doc}
      o={o}
      path="/arbeitsblatt/bibliothek"
      extra={ids.map((id) => ["eintrag", String(id)])}
      back={back}
    />
  );
}
