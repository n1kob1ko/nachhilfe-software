import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CopyLink } from "@/components/CopyLink";
import { MonatsberichtAnsicht } from "@/components/Monatsbericht";
import { PrintButton } from "@/components/PrintButton";
import { requireTeacher } from "@/lib/auth";
import { istMonat, monatName, monatsbericht, monatVerschieben } from "@/lib/monatsbericht";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";

export const metadata = { title: "Monatsbericht" };

/**
 * Monatsbericht für Eltern (lib/monatsbericht.ts): der Lehrer blättert die Monate, druckt als PDF oder kopiert den Link,
 * den die Familie über die Schüler-App öffnet (/lernen/[token]/bericht). Standard: der laufende Monat, in den ersten
 * fünf Tagen eines Monats der vorige.
 */
export default async function BerichtSeite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ monat?: string }> }) {
  await requireTeacher();
  const { id } = await params;
  const sp = await searchParams;
  const student = repo.getStudent(Number(id));
  if (!student) notFound();
  const heute = wienerDatum();
  const jetzt = heute.slice(0, 7);
  const monat = istMonat(sp.monat) ? sp.monat : Number(heute.slice(8, 10)) <= 5 ? monatVerschieben(jetzt, -1) : jetzt;
  const b = monatsbericht(student.id, monat);
  const vor = monatVerschieben(monat, -1);
  const nach = monatVerschieben(monat, 1);
  return (
    <div className="mx-auto max-w-[820px]">
      <div className="no-print mb-6 space-y-4">
        <Link href={`/schueler/${student.id}`} className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-medium text-ink-3 hover:text-ink">
          ← {student.name}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/schueler/${student.id}/bericht?monat=${vor}`} className="btn btn-secondary btn-sm" aria-label={`Monatsbericht ${monatName(vor)}`}>
            <ChevronLeft size={16} aria-hidden /> {monatName(vor)}
          </Link>
          {nach <= jetzt && (
            <Link href={`/schueler/${student.id}/bericht?monat=${nach}`} className="btn btn-secondary btn-sm" aria-label={`Monatsbericht ${monatName(nach)}`}>
              {monatName(nach)} <ChevronRight size={16} aria-hidden />
            </Link>
          )}
          <span className="ml-auto">
            <PrintButton label="Drucken / PDF" />
          </span>
        </div>
        <div className="panel px-5 py-4">
          <p className="mb-2 text-[14px] text-ink-2">Link für die Eltern (öffnet den Bericht in der Schüler-App, ohne Anmeldung):</p>
          <CopyLink path={`/lernen/${student.access_token}/bericht?monat=${monat}`} />
        </div>
      </div>
      <MonatsberichtAnsicht b={b} name={student.name} />
    </div>
  );
}
