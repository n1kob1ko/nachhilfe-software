import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Printer } from "lucide-react";
import { bikoUebernehmenAction } from "@/app/biko-actions";
import { BikoBriefing } from "@/components/biko/BikoBriefing";
import { LernzettelInhalt } from "@/components/Lernzettel";
import { PageHeader, Pill, SectionTitle, formatDate } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { BIKO_STATUS_TEXT, getAuftrag, mitNamen, zettelMitNamen, type MaterialBiko } from "@/lib/biko";
import { getMaterial } from "@/lib/materials";

export const metadata = { title: "Biko" };

const ton = { offen: "amber", abgeholt: "accent", fertig: "green", fehler: "red", verworfen: "neutral" } as const;

/** Ein Auftrag an Biko: das Briefing oder der Lernzettel mit Zusammenfassung, „Für den Schüler übernehmen“. */
export default async function BikoAuftragPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string; uebernommen?: string }> }) {
  const teacher = await requireTeacher();
  const a = getAuftrag(Number((await params).id));
  if (!a || (!teacher.is_admin && a.teacher_id !== teacher.id)) notFound();
  const sp = await searchParams;
  const m = a.material_id ? getMaterial(a.material_id) : null;
  const e = a.art === "material" ? (a.ergebnis as MaterialBiko | null) : null;
  const wer = mitNamen("S1", a.zuordnung);
  return (
    <>
      <PageHeader
        back={{ href: "/mehr/biko", label: "Biko" }}
        title={a.art === "briefing" ? `Tagesbriefing ${formatDate(a.datum)}` : `Lernzettel für ${wer}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5">
            <Pill tone={ton[a.status]}>{BIKO_STATUS_TEXT[a.status]}</Pill>
            {m && (
              <Link href={`/mehr/material/${m.id}`} className="link">
                {m.title}
              </Link>
            )}
            {a.kosten_usd > 0 && <span>· {a.kosten_usd.toFixed(2).replace(".", ",")} $</span>}
          </span>
        }
      />
      {sp.fehler && (
        <p className="mb-6 rounded-2xl bg-red-wash px-4 py-3 text-[14px] text-red" role="alert">
          {sp.fehler}
        </p>
      )}
      {a.status === "fehler" && <p className="mb-6 text-[15px] text-red">Das hat nicht geklappt: {a.fehler}</p>}
      {(a.status === "offen" || a.status === "abgeholt") && <p className="mb-6 text-[15px] text-ink-2">Biko ist dran. Das dauert meist ein paar Minuten.</p>}

      {a.art === "briefing" && a.status === "fertig" && (
        <div className="max-w-[760px]">
          <BikoBriefing a={a} />
        </div>
      )}

      {e && (
        <div className="grid max-w-[760px] gap-8">
          <section aria-label="Zusammenfassung">
            <SectionTitle>Zusammenfassung für dich</SectionTitle>
            <p className="text-[15px] leading-relaxed">{mitNamen(e.zusammenfassung, a.zuordnung)}</p>
          </section>
          <section aria-label="Lernzettel">
            <SectionTitle
              action={
                a.uebernommen_id ? (
                  <Link href={`/arbeitsblatt/lernzettel/${a.uebernommen_id}`} className="btn btn-ghost btn-sm">
                    <Printer size={14} aria-hidden /> Drucken
                  </Link>
                ) : null
              }
            >
              Lernzettel
            </SectionTitle>
            {a.uebernommen_id ? (
              <p className="mb-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-green" role="status">
                <CheckCircle2 size={16} aria-hidden /> Übernommen. {wer} sieht ihn in der Schüler-App unter „Deine Unterlagen“.
              </p>
            ) : (
              <form action={bikoUebernehmenAction.bind(null, a.id)} className="mb-4">
                <button className="btn btn-primary">Für {wer} übernehmen</button>
                <p className="mt-1.5 text-[13px] text-ink-3">Danach steht er in der Schüler-App und lässt sich drucken. Bitte vorher lesen.</p>
              </form>
            )}
            <div className="rounded-2xl border border-line px-5 py-4">
              <LernzettelInhalt z={zettelMitNamen(e.lernzettel, a.zuordnung)} />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
