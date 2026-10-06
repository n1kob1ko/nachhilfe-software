import { subjectTone } from "@/components/Calendar";
import Link from "next/link";
import { Library, Plus, Sparkles } from "lucide-react";
import { Empty, PageHeader, Pill, formatDate } from "@/components/ui";
import { worksheetTypeLabel } from "@/lib/curriculum";
import { libraryCount } from "@/lib/library";
import { listStudents, listWorksheets } from "@/lib/repo";
import { klassenLabel, stufeLabel } from "@/lib/school";

export const metadata = { title: "Übungen" };

export default async function Worksheets({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const all = listWorksheets();
  const lib = libraryCount();
  const students = new Map(listStudents().map((s) => [s.id, s.name.split(" ")[0]]));
  const subjects = [...new Set(all.map((w) => w.subject))];
  const filters: [string, string, number][] = [
    ["", "Alle", all.length],
    ["entwurf", "Entwürfe", all.filter((w) => w.status === "entwurf").length],
    ...subjects.map((s) => [s, s, all.filter((w) => w.subject === s).length] as [string, string, number]),
  ];
  const active = filters.find(([k]) => k === filter)?.[0] ?? "";
  const list = all.filter((w) => !active || (active === "entwurf" ? w.status === "entwurf" : w.subject === active));
  return (
    <>
      <PageHeader
        title="Übungen"
        info="Alle Übungen mit Lösungen. Entwürfe sehen Schüler erst, wenn du sie sendest."
        actions={
          <>
            <Link href="/uebungen/bibliothek" className="btn btn-secondary">
              <Library size={16} aria-hidden /> Bibliothek
              {lib > 0 && <span className="num text-ink-3">{lib}</span>}
            </Link>
            <Link href="/uebungen/neu" className="btn btn-primary">
              <Plus size={16} aria-hidden /> Übung erstellen
            </Link>
          </>
        }
      />
      {all.length === 0 ? (
        <Empty title="Noch keine Übungen" action={<Link href="/uebungen/neu" className="btn btn-primary">Erste Übung erstellen</Link>}>
          Lösungswege werden automatisch mit erstellt.
        </Empty>
      ) : (
        <>
          <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Übungen filtern">
            {filters
              .filter(([k, , n]) => !k || n > 0)
              .map(([k, label, n]) => (
                <Link
                  key={k || "alle"}
                  href={k ? `/uebungen?filter=${encodeURIComponent(k)}` : "/uebungen"}
                  aria-current={active === k ? "true" : undefined}
                  className={`inline-flex min-h-[36px] items-center rounded-full px-3.5 text-[13px] font-medium ${active === k ? "bg-ink text-surface" : "bg-panel text-ink-2 hover:text-ink"}`}
                >
                  {label}
                  <span className="num ml-1.5 opacity-70">{n}</span>
                </Link>
              ))}
          </nav>
          <ul className="panel divide-y divide-line">
            {list.map((w) => {
              const tone = subjectTone(w.subject);
              const type = worksheetTypeLabel(w.subject, w.task_type);
              const to = w.recipients.map((n) => n.split(" ")[0]);
              return (
                <li key={w.id}>
                  <Link href={`/uebungen/${w.id}`} className="group flex min-h-[60px] items-center gap-4 px-5 py-2.5 hover:bg-panel/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium group-hover:text-accent" title={w.title}>
                        {w.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px]">
                        <span className="rounded-full px-2.5 py-0.5 font-semibold" style={{ background: tone.soft, color: tone.fg }}>
                          {w.subject} · {w.klasse ? klassenLabel(w.school_type, w.klasse, { short: true }) : stufeLabel(w.grade)}
                        </span>
                        {w.status === "entwurf" ? (
                          <Pill tone="amber">Entwurf{w.student_id && students.get(w.student_id) ? ` für ${students.get(w.student_id)}` : ""}</Pill>
                        ) : to.length > 0 ? (
                          <Pill tone="green" title={`Gesendet an ${w.recipients.join(", ")}`}>
                            an {to.length > 2 ? `${to.slice(0, 2).join(", ")} +${to.length - 2}` : to.join(", ")}
                          </Pill>
                        ) : null}
                        {w.kind === "ueberpruefung" && <Pill tone="accent">Überprüfung</Pill>}
                        {w.kind === "diagnose" && <Pill tone="accent">Diagnose</Pill>}
                        {w.source === "ki" && (
                          <Pill title="Von Claude erstellt">
                            <Sparkles size={11} aria-label="KI" />
                          </Pill>
                        )}
                        <span className="text-ink-3">
                          {w.difficulty} · <span className="num">{w.task_count}</span> Aufg.
                          {w.task_type !== "mixed" && ` · ${type}`}
                        </span>
                      </div>
                    </div>
                    <span className="num shrink-0 text-[13px] text-ink-3" title={formatDate(w.created_at)}>
                      {formatDate(w.created_at, { day: "numeric", month: "numeric" })}
                    </span>
                  </Link>
                </li>
              );
            })}
            {list.length === 0 && <li className="px-5 py-6 text-[14px] text-ink-3">Keine Übungen in diesem Filter.</li>}
          </ul>
        </>
      )}
    </>
  );
}
