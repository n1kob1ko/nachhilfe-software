import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { vorbereitenAction } from "@/app/cockpit-actions";
import { PaketAuswahl } from "@/components/cockpit/Cockpit";
import { SchuelerWorteKarte } from "@/components/SchuelerNotiz";
import { PageHeader } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { vorbereitung } from "@/lib/cockpit";
import { paketWahl } from "@/lib/cockpit-vorschlag";
import { getLernpaket } from "@/lib/lernpakete";
import { wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { schuelerWorte } from "@/lib/schueler-notiz";
import { runningUnitForStudent } from "@/lib/units";

export const metadata = { title: "Einheit vorbereiten" };

/**
 * „Einheit vorbereiten“ aus dem Tagesplan der Startseite: das Lernpaket für die heutige Einheit eines Schülers
 * wählen, bevor sie beginnt. Beim Start steht es im Cockpit schon gewählt da (lib/cockpit.ts).
 */
export default async function VorbereitenPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string }> }) {
  await requireTeacher();
  const { id } = await params;
  const sp = await searchParams;
  const student = repo.getStudent(Number(id));
  if (!student) notFound();
  const v = vorbereitung(student.id, wienerDatum());
  const p = v ? getLernpaket(v.paket_id) : null;
  const laeuft = runningUnitForStudent(student.id);
  const wahl = paketWahl(student.id);
  // was der Schüler für die nächste Einheit geschrieben hat (lib/schueler-notiz.ts); passt es zu einem Paket, steht es bei „Warum heute“
  const worte = laeuft ? null : schuelerWorte(student.id, null);
  return (
    <>
      <PageHeader title={`Einheit vorbereiten: ${student.name}`} back={{ href: "/", label: "Heute" }} subtitle="Das Lernpaket für heute. Beim Start der Einheit steht es im Cockpit bereit." />
      <div className="grid max-w-[1100px] gap-6">
        {sp.fehler && (
          <p role="alert" className="rounded-2xl bg-red-wash px-4 py-3 text-[15px] text-red">
            {sp.fehler}
          </p>
        )}
        {laeuft && (
          <p className="rounded-2xl bg-accent-wash px-4 py-3 text-[15px]">
            Die Einheit läuft schon. Das Lernpaket wählst du jetzt im{" "}
            <Link href={`/einheiten/${laeuft.id}?bereich=cockpit`} className="font-semibold text-accent underline underline-offset-2">
              Cockpit der Einheit
            </Link>
            .
          </p>
        )}
        {p && (
          <div className="panel flex flex-wrap items-center gap-3 px-5 py-4">
            <CheckCircle2 size={18} className="text-green" aria-hidden />
            <p className="min-w-0 flex-1 text-[15px]">
              Für heute vorbereitet: <span className="font-semibold">{p.title}</span>
            </p>
            <form action={vorbereitenAction.bind(null, student.id)}>
              <input type="hidden" name="paket_id" value="" />
              <button className="btn btn-ghost btn-sm">Zurücknehmen</button>
            </form>
          </div>
        )}
        {worte && <SchuelerWorteKarte worte={worte} name={student.name.split(" ")[0]} />}
        <PaketAuswahl wahl={wahl} action={vorbereitenAction.bind(null, student.id)} gewaehlt={p?.id ?? null} />
      </div>
    </>
  );
}
