import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { StundenplanImport } from "@/components/planung/StundenplanImport";
import { PageHeader } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { darfWochenplanBearbeiten } from "@/lib/planung/berechtigungen";
import { wochenStatus } from "@/lib/planung/repo";
import { buchstabenZuordnung, stundenplanFotoMoeglich } from "@/lib/planung/stundenplan-foto";
import { istDatum, tagAddieren, wienerWochenstart, wochenLabel, wochenstartVon } from "@/lib/planung/zeit";
import { listStudents, listTeachers } from "@/lib/repo";

export const metadata = { title: "Stundenplan-Fotos" };

/** So viele Wochen ab dieser stehen zur Wahl. */
const WOCHEN = 6;

/**
 * Stundenplan-Fotos (lib/planung/stundenplan-foto.ts): die Wochenpläne der Lehrer fotografieren, die KI liest
 * sie, die Verwaltung prüft jede Zeile und trägt sie in eine Woche ein. Nur die Verwaltung (D23).
 */
export default async function StundenplanFotosPage({ searchParams }: { searchParams: Promise<{ woche?: string }> }) {
  const me = await requireTeacher();
  const sp = await searchParams;
  const zurueck = { href: `/planung${sp.woche && istDatum(sp.woche) ? `?woche=${wochenstartVon(sp.woche)}` : ""}`, label: "Planung" };
  const info =
    "Fotografiere die Wochenpläne der Lehrer, ein Foto je Lehrer. Die KI liest Tage, Zeiten und Vornamen ab. Du prüfst jede Zeile, dann kommen die Plätze gesperrt in den Wochenplan.";

  if (!darfWochenplanBearbeiten(me))
    return (
      <div className="max-w-[720px]">
        <PageHeader title="Stundenplan-Fotos" back={zurueck} info={info} />
        <p className="panel px-5 py-5 text-[15px]">Den Wochenplan ändert nur die Verwaltung.</p>
      </div>
    );

  const geht = stundenplanFotoMoeglich();
  if (!geht.ok)
    return (
      <div className="max-w-[720px]">
        <PageHeader title="Stundenplan-Fotos" back={zurueck} info={info} />
        <section className="panel grid gap-4 px-5 py-5" data-testid="sp-ohne-ki">
          <p className="text-[15px]">{geht.grund}</p>
          <div>
            <Link href={zurueck.href} className="btn btn-primary">
              <CalendarDays size={16} aria-hidden /> Zum Wochenplan
            </Link>
          </div>
        </section>
      </div>
    );

  const diese = wienerWochenstart();
  const wochen = Array.from({ length: WOCHEN }, (_, i) => {
    const start = tagAddieren(diese, 7 * i);
    return { start, label: wochenLabel(start), status: wochenStatus(start) };
  });
  // vorgewählt: die Woche aus dem Wochenplan, sonst die erste leere ab dieser, sonst die nächste
  const gewuenscht = sp.woche && istDatum(sp.woche) ? wochenstartVon(sp.woche) : "";
  const startWoche = wochen.some((w) => w.start === gewuenscht) ? gewuenscht : (wochen.find((w) => w.status === "leer")?.start ?? wochen[1].start);

  return (
    <div className="max-w-[880px]">
      <PageHeader title="Stundenplan-Fotos" subtitle="Vom Foto in den Wochenplan" back={zurueck} info={info} />
      <StundenplanImport
        lehrer={listTeachers().map((t) => ({ id: t.id, name: t.name }))}
        schueler={listStudents().map((s) => ({ id: s.id, name: s.name, teacher_id: s.teacher_id }))}
        wochen={wochen}
        startWoche={startWoche}
        zuordnung={buchstabenZuordnung()}
      />
    </div>
  );
}
