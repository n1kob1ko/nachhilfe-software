import { subjectTone } from "@/components/Calendar";
import Link from "next/link";
import { ChevronDown, Library, Plus, Sparkles } from "lucide-react";
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
  // die letzten 14 Tage offen (mindestens 8, höchstens 15 Zeilen), alles Ältere eingeklappt
  const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
  const age = (w: (typeof all)[number]) => new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(w.created_at) ? w.created_at.replace(" ", "T") + "Z" : w.created_at).getTime();
  const openCount = Math.min(15, Math.max(8, list.filter((w) => age(w) >= cutoff).length));
  const recent = list.slice(0, openCount);
  const older = list.slice(openCount);
  const row = (w: (typeof all)[number]) => {
    const tone = subjectTone(w.subject);
    const type = worksheetTypeLabel(w.subject, w.task_type);
    const to = w.recipients.map((n) => n.split(" ")[0]);
    const an = to.length > 2 ? `${to.slice(0, 2).join(", ")} +${to.length - 2}` : to.join(", ");
    // Stand der gesendeten Übung in einem Chip: offen, begonnen oder erledigt mit Ergebnis (niko, 21.10.2026)
    const stand: { tone: "neutral" | "amber" | "green"; text: string } =
      w.assigned > 0 && w.completed === w.assigned
        ? { tone: "green", text: `erledigt · ${w.correct}/${w.task_count * w.completed} richtig` }
        : w.completed > 0
          ? { tone: "green", text: `${w.completed} von ${w.assigned} erledigt` }
          : w.started > 0
            ? { tone: "amber", text: "begonnen" }
            : { tone: "neutral", text: "noch offen" };
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
                <Pill tone={stand.tone} title={`Gesendet an ${w.recipients.join(", ")}`}>
                  an {an} · <span className="num">{stand.text}</span>
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
  };
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
                  className={`inline-flex min-h-[36px] items-center rounded-full px-3.5 text-[13px] font-medium ${active === k ? "bg-accent text-on-fill" : "bg-panel text-ink-2 hover:text-ink"}`}
                >
                  {label}
                  <span className="num ml-1.5 opacity-70">{n}</span>
                </Link>
              ))}
          </nav>
          <ul className="panel divide-y divide-line">
            {recent.map((w) => row(w))}
            {list.length === 0 && <li className="px-5 py-6 text-[14px] text-ink-3">Keine Übungen in diesem Filter.</li>}
          </ul>
          {older.length > 0 && (
            <details className="group mt-4">
              <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[14px] font-semibold text-accent">
                <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden />
                <span className="num">{older.length}</span> ältere Übungen
              </summary>
              <ul className="panel mt-3 divide-y divide-line">{older.map((w) => row(w))}</ul>
            </details>
          )}
        </>
      )}
    </>
  );
}
