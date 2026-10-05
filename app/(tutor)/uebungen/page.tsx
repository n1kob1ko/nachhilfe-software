import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { Empty, PageHeader, Pill, formatDate } from "@/components/ui";
import { worksheetTypeLabel } from "@/lib/curriculum";
import { listWorksheets } from "@/lib/repo";
import { klassenLabel, stufeLabel } from "@/lib/school";

export const metadata = { title: "Übungen" };

export default function Worksheets() {
  const list = listWorksheets();
  return (
    <>
      <PageHeader
        title="Übungen"
        subtitle="Alle Übungen mit Lösungen. Entwürfe sehen Schüler erst nach der Freigabe."
        actions={
          <Link href="/uebungen/neu" className="btn btn-primary">
            <Plus size={16} aria-hidden /> Übung erstellen
          </Link>
        }
      />
      {list.length === 0 ? (
        <Empty title="Noch keine Übungen" action={<Link href="/uebungen/neu" className="btn btn-primary">Erste Übung erstellen</Link>}>
          Wähle Fach, Klasse, Thema, Schwierigkeit, Anzahl und Aufgabentyp. Lösungswege werden automatisch mit erstellt.
        </Empty>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-line text-[12px] text-ink-3">
                <th className="px-5 py-3 font-semibold">Titel</th>
                <th className="px-3 py-3 font-semibold">Fach</th>
                <th className="px-3 py-3 font-semibold">Typ</th>
                <th className="px-3 py-3 font-semibold">Schwierigkeit</th>
                <th className="px-3 py-3 text-right font-semibold">Aufgaben</th>
                <th className="px-5 py-3 text-right font-semibold">Erstellt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((w) => (
                <tr key={w.id} className="group">
                  <td className="px-5 py-3">
                    <Link href={`/uebungen/${w.id}`} className="font-medium group-hover:text-accent">
                      {w.title}
                    </Link>
                    <div className="mt-0.5 flex gap-1.5">
                      {w.status === "entwurf" && <Pill tone="amber">Entwurf</Pill>}
                      {w.source === "ki" && (
                        <Pill tone="accent">
                          <Sparkles size={11} aria-hidden /> KI
                        </Pill>
                      )}
                      {w.kind === "ueberpruefung" && <Pill tone="green">Überprüfung</Pill>}
                      {w.assigned > 0 && <Pill>{w.assigned}× zugewiesen</Pill>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-ink-2">
                    {w.subject}
                    <div className="text-[12px] text-ink-3">{w.klasse ? klassenLabel(w.school_type, w.klasse, { short: true }) : stufeLabel(w.grade)}</div>
                  </td>
                  <td className="px-3 py-3 text-ink-2">{worksheetTypeLabel(w.subject, w.task_type)}</td>
                  <td className="px-3 py-3 text-ink-2">{w.difficulty}</td>
                  <td className="num px-3 py-3 text-right">{w.task_count}</td>
                  <td className="num px-5 py-3 text-right text-ink-2">{formatDate(w.created_at, { day: "numeric", month: "short" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
