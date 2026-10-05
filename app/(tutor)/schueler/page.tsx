import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { loadDemoData } from "@/app/actions";
import { Empty, PageHeader } from "@/components/ui";
import { listStudents, listTeachers } from "@/lib/repo";
import { klassenLabel } from "@/lib/school";
import { Avatar } from "@/components/Art";
import { subjectTone } from "@/components/Calendar";
import { analyzeStudent } from "@/lib/service";

export const metadata = { title: "Schüler" };

export default async function Students({ searchParams }: { searchParams: Promise<{ suche?: string }> }) {
  const q = ((await searchParams).suche ?? "").trim();
  const all = listStudents();
  const students = q ? all.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())) : all;
  const teachers = new Map(listTeachers().map((t) => [t.id, t.name]));
  return (
    <>
      <PageHeader
        title="Schüler"
        subtitle={`${all.length} Schüler`}
        actions={
          <Link href="/schueler/neu" className="btn btn-secondary">
            <Plus size={16} aria-hidden /> Neuer Schüler
          </Link>
        }
      />
      {all.length > 0 && (
        <form className="mb-6 flex max-w-[520px] gap-2" role="search">
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
            <input className="input !min-h-[48px] !pl-11 text-[16px]" name="suche" defaultValue={q} placeholder="Schüler suchen" aria-label="Schüler suchen" autoComplete="off" />
          </div>
          <button className="btn btn-secondary !min-h-[48px]">Suchen</button>
        </form>
      )}
      {q && students.length === 0 ? (
        <p className="text-[15px] text-ink-2">
          Kein Schüler heißt „{q}“. <Link href="/schueler" className="link">Alle anzeigen</Link>
        </p>
      ) : students.length === 0 ? (
        <Empty
          title="Noch keine Schüler"
          action={
            <form action={loadDemoData}>
              <button className="btn btn-secondary">Demo-Daten laden</button>
            </form>
          }
        >
          Ein Schülerprofil sammelt Einheiten, Hausübungen, Tests und Übungsergebnisse und berechnet daraus den Lernstand pro Fähigkeit.
        </Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {students.map((s) => {
            const a = analyzeStudent(s.id)!;
            return (
              <li key={s.id}>
                <Link href={`/schueler/${s.id}`} className="panel block h-full px-5 py-4 transition-transform hover:-translate-y-0.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} size={44} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold">{s.name}</span>
                      <span className="block truncate text-[13px] text-ink-2">
                        {klassenLabel(s.school_type, s.klasse)}
                        {teachers.get(s.teacher_id ?? 0) && ` · ${teachers.get(s.teacher_id ?? 0)}`}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.subjects.length ? (
                      s.subjects.map((sub) => {
                        const t = subjectTone(sub);
                        return (
                          <span key={sub} className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ background: t.soft, color: t.fg }}>
                            {sub}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[13px] text-ink-3">Keine Fächer</span>
                    )}
                  </div>
                  <p className="mt-3 text-[14px] text-ink-2">
                    {a.mainProblem ? (
                      <>
                        Schwierigkeit: <span className="font-medium text-red">{a.mainProblem.skill.name}</span>
                      </>
                    ) : (
                      "Keine Schwierigkeit erkannt"
                    )}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
