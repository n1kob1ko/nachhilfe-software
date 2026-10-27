import Link from "next/link";
import { ChevronDown, Play } from "lucide-react";
import { startUnitAction } from "@/app/session-actions";
import { Avatar } from "@/components/Art";
import type * as repo from "@/lib/repo";
import { klassenLabel } from "@/lib/school";

/**
 * „Anderen Schüler starten“: ein Tippen startet die Einheit, jeder Schüler ist ein eigener Knopf. Für Schüler ohne
 * Platz heute. `offen` zeigt die Liste gleich (wenn heute niemand eingeplant ist).
 */
export function SchuelerWahl({ students, offen, label = "Anderen Schüler starten" }: { students: repo.Student[]; offen?: boolean; label?: string }) {
  const liste = (
    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
      {students.slice(0, 8).map((s) => (
        <li key={s.id}>
          <form action={startUnitAction.bind(null, s.id, null)}>
            <button className="panel flex min-h-[60px] w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:border-line-strong" aria-label={`Einheit mit ${s.name} starten`}>
              <Avatar name={s.name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.name}</span>
                <span className="block truncate text-[13px] text-ink-2">{s.subjects.join(", ") || klassenLabel(s.school_type, s.klasse, { short: true })}</span>
              </span>
              <Play size={18} className="shrink-0 text-accent" aria-hidden />
            </button>
          </form>
        </li>
      ))}
      {students.length > 8 && (
        <li className="sm:col-span-2">
          <Link href="/schueler" className="link text-[14px] font-medium">
            Alle {students.length} Schüler anzeigen
          </Link>
        </li>
      )}
    </ul>
  );
  if (offen) return liste;
  return (
    <details className="group">
      <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[15px] font-medium text-accent">
        {label} <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      {liste}
    </details>
  );
}
