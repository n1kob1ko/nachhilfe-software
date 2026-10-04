import Link from "next/link";
import { Plus } from "lucide-react";
import { loadDemoData } from "@/app/actions";
import { Empty, MasteryBar, PageHeader, TrendBadge } from "@/components/ui";
import { listStudents } from "@/lib/repo";
import { analyzeStudent } from "@/lib/service";

export const metadata = { title: "Schüler" };

export default function Students() {
  const students = listStudents();
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
                <Link href={`/schueler/${s.id}`} className="panel block h-full px-5 py-4 transition-colors hover:border-line-strong">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[16px] font-semibold">{s.name}</span>
                    <TrendBadge trend={a.overall.trend} compact />
                  </div>
                  <p className="mt-0.5 text-[13px] text-ink-2">
                    {s.grade}. Schulstufe · {s.school_type || "Schultyp offen"}
                  </p>
                  <p className="mt-3 text-[14px]">{s.subjects.join(", ") || "Keine Fächer"}</p>
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
