import Link from "next/link";
import { Plus } from "lucide-react";
import { loadDemoData } from "@/app/actions";
import { Empty, MasteryBar, PageHeader, TrendBadge } from "@/components/ui";
import { listStudents, listTeachers } from "@/lib/repo";
import { klassenLabel } from "@/lib/school";
import { Avatar } from "@/components/Art";
import { subjectTone } from "@/components/Calendar";
import { analyzeStudent } from "@/lib/service";

export const metadata = { title: "Schüler" };

export default function Students() {
  const students = listStudents();
  const teachers = new Map(listTeachers().map((t) => [t.id, t.name]));
  return (
    <>
      <PageHeader
        title="Schüler"
        subtitle={`${students.length} ${students.length === 1 ? "Schüler" : "Schüler"} in Betreuung`}
        actions={
          <Link href="/schueler/neu" className="btn btn-primary">
            <Plus size={16} aria-hidden /> Neuer Schüler
          </Link>
        }
      />
      {students.length === 0 ? (
        <Empty
          title="Noch keine Schüler"
          action={
            <form action={loadDemoData}>
              <button className="btn btn-secondary">Demo-Daten laden</button>
            </form>
          }
        >
          Ein Schülerprofil sammelt Stunden, Hausübungen, Tests und Übungsergebnisse und berechnet daraus den Lernstand pro Fähigkeit.
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
                    <TrendBadge trend={a.overall.trend} compact />
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
                  <div className="mt-3">
                    <MasteryBar value={a.overall.mastery} size="sm" />
                  </div>
                  <p className="mt-2 text-[13px] text-ink-2">
                    {a.mainProblem ? (
                      <>
                        Problem: <span className="font-medium text-red">{a.mainProblem.skill.name}</span> ({a.mainProblem.skill.area})
                      </>
                    ) : (
                      "Kein Problem erkannt"
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
