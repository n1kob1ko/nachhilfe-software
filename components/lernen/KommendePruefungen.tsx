import { GraduationCap } from "lucide-react";
import { More, Pill } from "@/components/ui";
import { inTagen } from "@/lib/exams";
import { kommendePruefungen, type PortalPruefung } from "@/lib/schuelerportal";
import { Abschnitt, kalenderblatt, tagLabel } from "./Abschnitt";

/** Kommende Prüfungen in der Schüler-App: Datum, Art, Fach und der Stoff kurz, die nächste zuerst. */
export function KommendePruefungen({ studentId }: { studentId: number }) {
  const liste = kommendePruefungen(studentId);
  return (
    <Abschnitt titel="Kommende Prüfungen" icon={GraduationCap} anzahl={liste.length} testId="pruefungen">
      {liste.length === 0 ? (
        <p className="mt-2 text-[15px] text-ink-2">Keine Prüfungen eingetragen.</p>
      ) : (
        <div className="mt-1">
          <More limit={3} className="divide-y divide-line" items={liste.map((t) => <Zeile key={t.id} t={t} />)} />
        </div>
      )}
    </Abschnitt>
  );
}

function Zeile({ t }: { t: PortalPruefung }) {
  const k = kalenderblatt(t.datum);
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="num flex w-[52px] shrink-0 flex-col items-center rounded-xl bg-panel py-1.5 text-center leading-tight">
        <span className="sr-only">{tagLabel(t.datum)}</span>
        <span className="text-[12px] text-ink-2" aria-hidden>
          {k.wochentag}
        </span>
        <span className="text-[18px] font-semibold" aria-hidden>
          {k.tag}
        </span>
        <span className="text-[12px] text-ink-2" aria-hidden>
          {k.monat}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[16px] font-semibold">{t.titel || t.art}</span>
          <Pill tone={t.tage <= 3 ? "amber" : "neutral"}>{inTagen(t.tage)}</Pill>
        </span>
        <span className="block text-[14px] text-ink-2">
          {t.titel && t.titel !== t.art ? `${t.art} · ` : ""}
          {t.fach}
        </span>
        {t.stoff.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Stoff">
            {t.stoff.slice(0, 3).map((s) => (
              <Pill key={s}>{s}</Pill>
            ))}
            {t.stoff.length > 3 && <Pill>+{t.stoff.length - 3}</Pill>}
          </span>
        )}
      </span>
    </div>
  );
}
