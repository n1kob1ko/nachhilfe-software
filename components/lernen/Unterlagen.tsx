import Link from "next/link";
import { BookOpenCheck, ChevronRight, FolderOpen, Presentation } from "lucide-react";
import { More, Pill } from "@/components/ui";
import { praesentationenFuer, uebungenMitLoesung } from "@/lib/schuelerportal";
import { Abschnitt } from "./Abschnitt";

/**
 * Deine Unterlagen in der Schüler-App: die Präsentationen aus deinen Einheiten (nur die Folien) und die Übungen,
 * deren Lösung freigegeben ist. Nur was dir freigegeben ist; ohne beides kein Abschnitt.
 */
export function Unterlagen({ studentId, token }: { studentId: number; token: string }) {
  const praes = praesentationenFuer(studentId);
  const uebungen = uebungenMitLoesung(studentId);
  if (praes.length === 0 && uebungen.length === 0) return null;
  return (
    <Abschnitt titel="Deine Unterlagen" icon={FolderOpen} anzahl={praes.length + uebungen.length} testId="unterlagen">
      {praes.length > 0 && (
        <div className="mt-4">
          <p className="text-[13px] font-semibold text-ink-2">Präsentationen</p>
          <More
            limit={3}
            className="divide-y divide-line"
            items={praes.map((p) => (
              <Zeile key={p.id} href={`/lernen/${token}/praesentation/${p.id}`} icon={<Presentation size={18} aria-hidden />} titel={p.titel} meta={[p.fach, p.thema].filter(Boolean).join(" · ")} />
            ))}
          />
        </div>
      )}
      {uebungen.length > 0 && (
        <div className="mt-4">
          <p className="text-[13px] font-semibold text-ink-2">Übungen mit Lösung</p>
          <More
            limit={3}
            className="divide-y divide-line"
            items={uebungen.map((u) => (
              <Zeile
                key={u.id}
                href={`/lernen/${token}/${u.id}`}
                icon={<BookOpenCheck size={18} aria-hidden />}
                titel={u.titel}
                meta={u.fach}
                chip={
                  <>
                    {u.mitErklaerung && <Pill tone="accent">mit Erklärung</Pill>}
                    {u.fertig && <Pill tone="green">erledigt</Pill>}
                  </>
                }
              />
            ))}
          />
        </div>
      )}
    </Abschnitt>
  );
}

function Zeile({ href, icon, titel, meta, chip }: { href: string; icon: React.ReactNode; titel: string; meta: string; chip?: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 py-3 hover:text-accent">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-wash text-accent">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold break-words">{titel}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-ink-2">
          {meta && <span>{meta}</span>}
          {chip}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-ink-3" aria-hidden />
    </Link>
  );
}
