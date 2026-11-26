import Link from "next/link";
import { notFound } from "next/navigation";
import { MonatsberichtAnsicht } from "@/components/Monatsbericht";
import { istMonat, monatName, monatsbericht, monatVerschieben } from "@/lib/monatsbericht";
import { wienerDatum } from "@/lib/planung/zeit";
import { getStudentByToken } from "@/lib/repo";

export const metadata = { title: "Monatsbericht" };

/** Der Monatsbericht für die Familie über den Link der Schüler-App (lib/monatsbericht.ts); nur lesen, vergangene und laufender Monat. */
export default async function BerichtFamilie({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ monat?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const student = getStudentByToken(token);
  if (!student) notFound();
  const jetzt = wienerDatum().slice(0, 7);
  const monat = istMonat(sp.monat) && sp.monat <= jetzt ? sp.monat : jetzt;
  const vor = monatVerschieben(monat, -1);
  const nach = monatVerschieben(monat, 1);
  return (
    <div className="pt-4">
      <nav className="no-print mb-4 flex flex-wrap gap-2" aria-label="Monat">
        <Link href={`/lernen/${token}/bericht?monat=${vor}`} className="btn btn-secondary btn-sm">
          ← {monatName(vor)}
        </Link>
        {nach <= jetzt && (
          <Link href={`/lernen/${token}/bericht?monat=${nach}`} className="btn btn-secondary btn-sm">
            {monatName(nach)} →
          </Link>
        )}
      </nav>
      <MonatsberichtAnsicht b={monatsbericht(student.id, monat)} name={student.name} />
    </div>
  );
}
