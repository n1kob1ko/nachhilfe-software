import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { notFound } from "next/navigation";
import { Pill, formatDate } from "@/components/ui";
import { KommendePruefungen } from "@/components/lernen/KommendePruefungen";
import { SeitenKopf } from "@/components/lernen/SeitenKopf";
import { Unterlagen } from "@/components/lernen/Unterlagen";
import { eintraegeFuerSchueler, STATUS_LABEL } from "@/lib/pruefliste";
import * as repo from "@/lib/repo";

/**
 * Prüfungen in der Schüler-App: die kommenden, die selbst eingetragenen mit „Prüfung eintragen“ (Foto vom
 * Stoffzettel) und die Unterlagen zum Lernen (Präsentationen, Übungen mit Lösung).
 */
export default async function PruefungenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const student = repo.getStudentByToken(token);
  if (!student) notFound();
  // eingetragene Prüfungen: nur die eigenen Angaben und der Stand (lib/pruefliste.ts)
  const pruefungen = eintraegeFuerSchueler(student.id);

  return (
    <>
      <SeitenKopf titel="Prüfungen" text="Was ansteht, was du eingetragen hast und deine Unterlagen zum Lernen." />

      <KommendePruefungen studentId={student.id} />

      <section id="pruefungen" className="mt-8 scroll-mt-6" aria-label="Von dir eingetragen" data-testid="pruefung-eintraege">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[18px] font-semibold">Von dir eingetragen</h2>
          <Link href={`/lernen/${token}/pruefung`} className="btn btn-secondary" data-testid="pruefung-eintragen">
            <CalendarPlus size={17} aria-hidden /> Prüfung eintragen
          </Link>
        </div>
        {pruefungen.length === 0 ? (
          <p className="text-[15px] text-ink-2">Steht eine Schularbeit oder ein Test an? Trag sie hier ein, mit einem Foto vom Stoffzettel.</p>
        ) : (
          <ul className="panel divide-y divide-line">
            {pruefungen.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {p.art} {p.fach}
                  </span>
                  <span className="block text-[14px] break-words text-ink-2">
                    <span className="num">{p.datum ? formatDate(p.datum, { weekday: "short", day: "numeric", month: "short" }) : "Datum offen"}</span>
                    {p.stoff && ` · ${p.stoff}`}
                  </span>
                </span>
                <Pill tone={p.status === "uebernommen" || p.status === "automatisch" ? "green" : p.status === "eingereicht" ? "accent" : "neutral"}>{STATUS_LABEL[p.status]}</Pill>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Unterlagen studentId={student.id} token={token} />
    </>
  );
}
