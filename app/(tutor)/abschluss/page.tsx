import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/Art";
import { SectionTitle, formatDate, formatTime } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { wienerDatum } from "@/lib/planung/zeit";
import { ABSCHLUSS_TAGE, abschlussZiel, offeneAbschluesse } from "@/lib/situation";

export const metadata = { title: "Abschluss" };

/**
 * **Abschluss**: führt zur zuletzt beendeten Einheit von heute, deren Dokumentation noch nicht bestätigt ist. Sonst
 * „Nichts zu bestätigen“ und, ruhig darunter, was in den letzten 14 Tagen noch offen ist (nur als Links: ältere
 * Einheiten, etwa aus den Beispieldaten, sollen nie hierher zwingen).
 */
export default async function AbschlussPage() {
  const teacher = await requireTeacher();
  const now = new Date();
  const offen = offeneAbschluesse(teacher.id, { now });
  const ziel = abschlussZiel(offen, wienerDatum(now));
  if (ziel !== null) redirect(`/einheiten/${ziel}`);
  return (
    <>
      <header className="mb-6">
        {offen.length === 0 && (
          <p className="inline-flex items-center gap-2 text-[15px] font-semibold text-green">
            <CheckCircle2 size={18} aria-hidden /> Alles bestätigt
          </p>
        )}
        <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-[-0.02em] md:text-[32px]">{offen.length ? "Heute nichts zu bestätigen" : "Nichts zu bestätigen"}</h1>
        <p className="mt-1 text-[15px] text-ink-2">Nach jeder Einheit steht hier ihr Abschluss: was gemacht wurde, was gut ging, was noch schwierig ist und was als Nächstes kommt.</p>
      </header>
      <Link href="/" className="btn btn-primary">
        Zurück zu Heute
      </Link>
      {offen.length > 0 && (
        <section className="mt-10 max-w-[720px]" aria-label="Noch nicht bestätigt">
          <SectionTitle>{`Noch nicht bestätigt (letzte ${ABSCHLUSS_TAGE} Tage)`}</SectionTitle>
          <ul className="panel divide-y divide-line">
            {offen.map((o) => (
              <li key={o.unitId}>
                <Link href={`/einheiten/${o.unitId}`} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 hover:bg-panel/60">
                  <Avatar name={o.studentName} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{o.studentName}</span>
                    <span className="num block truncate text-[13px] text-ink-2">
                      {formatDate(o.startedAt, { weekday: "short", day: "numeric", month: "short" })} · {formatTime(o.startedAt)}
                      {o.subject && ` · ${o.subject}`}
                      {o.endedBy === "automatisch" && " · automatisch beendet"}
                    </span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-ink-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
