import Link from "next/link";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { bikoBriefingNeuAction } from "@/app/biko-actions";
import { BikoBriefing } from "@/components/biko/BikoBriefing";
import { Empty, PageHeader, Pill, SectionTitle, formatDate, formatTime } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { BIKO_STATUS_TEXT, bikoAn, briefingAb, briefingHeute, letzterAbruf, listAuftraege, mitNamen, type BikoAuftrag, type MaterialBiko } from "@/lib/biko";
import { getMaterial } from "@/lib/materials";

export const metadata = { title: "Biko" };

const ton = { offen: "amber", abgeholt: "accent", fertig: "green", fehler: "red", verworfen: "neutral" } as const;
const dollar = (x: number) => `${x.toFixed(2).replace(".", ",")} $`;

/**
 * **Biko** (lib/biko.ts): was Biko-Chef für diese Lehrkraft erledigt. Oben das heutige Tagesbriefing (mit „Neu schreiben
 * lassen“), darunter die Aufträge: Briefings und Lernzettel aus Dokumenten. Die Verwaltung sieht alle Aufträge.
 */
export default async function BikoPage({ searchParams }: { searchParams: Promise<{ fehler?: string; neu?: string }> }) {
  const teacher = await requireTeacher();
  const sp = await searchParams;
  const an = bikoAn();
  const abruf = letzterAbruf();
  const heute = briefingHeute(teacher.id);
  const liste = listAuftraege({ teacherId: teacher.is_admin ? undefined : teacher.id, limit: 40 });
  return (
    <>
      <PageHeader
        title="Biko"
        back={{ href: "/mehr", label: "Erweitert" }}
        info="Biko-Chef schreibt jeden Morgen dein Tagesbriefing und macht aus Dokumenten Lernzettel. Er bekommt keine Namen: Schüler heißen S1, S2 …, jeder bekannte Name wird vorher ersetzt. Ein Dokument geht nur mit, wenn du bestätigst, dass kein Name darauf steht. Die Kosten zählen für die KI-Grenze des Schülers."
        subtitle={
          an ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-green" aria-hidden /> Verbunden{abruf ? ` · Biko hat zuletzt am ${formatDate(abruf)} um ${formatTime(abruf)} gefragt` : " · Biko hat noch nie gefragt"}
            </span>
          ) : (
            "Nicht verbunden: BIKO_TOKEN fehlt am Server."
          )
        }
      />
      {sp.fehler && (
        <p className="mb-6 rounded-2xl bg-red-wash px-4 py-3 text-[14px] text-red" role="alert">
          {sp.fehler}
        </p>
      )}
      {sp.neu && (
        <p className="mb-6 text-[14px] font-semibold text-green" role="status">
          Biko schreibt das Briefing neu. Das dauert ein paar Minuten.
        </p>
      )}

      <section className="mb-10 max-w-[760px]" aria-label="Dein Briefing für heute">
        <SectionTitle
          action={
            an ? (
              <form action={bikoBriefingNeuAction}>
                <button className="btn btn-ghost btn-sm">
                  <RefreshCw size={14} aria-hidden /> Neu schreiben lassen
                </button>
              </form>
            ) : null
          }
        >
          Dein Briefing für heute
        </SectionTitle>
        {heute?.status === "fertig" ? (
          <BikoBriefing a={heute} />
        ) : heute ? (
          <p className="text-[15px] text-ink-2">{heute.status === "fehler" ? `Das hat nicht geklappt: ${heute.fehler}` : `${BIKO_STATUS_TEXT[heute.status]}.`}</p>
        ) : (
          <p className="text-[15px] text-ink-2">Noch keins. Biko schreibt es ab {briefingAb()} Uhr, wenn heute jemand eingeplant ist.</p>
        )}
      </section>

      <section className="max-w-[760px]" aria-label="Aufträge">
        <SectionTitle>Aufträge</SectionTitle>
        {liste.length === 0 ? (
          <Empty title="Noch keine Aufträge">Ein Dokument gibst du auf seiner Seite unter Material an Biko.</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {liste.map((a) => (
              <li key={a.id}>
                <Link href={`/mehr/biko/${a.id}`} className="flex min-h-[56px] items-center gap-3 px-4 py-2 hover:bg-panel/60">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{titel(a)}</span>
                    <span className="block text-[13px] text-ink-3">
                      {formatDate(a.created_at)}
                      {a.kosten_usd > 0 && ` · ${dollar(a.kosten_usd)}`}
                    </span>
                  </span>
                  <Pill tone={ton[a.status]}>{BIKO_STATUS_TEXT[a.status]}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function titel(a: BikoAuftrag): string {
  if (a.art === "briefing") return `Tagesbriefing ${formatDate(a.datum)}`;
  const e = a.ergebnis as MaterialBiko | null;
  const m = a.material_id ? getMaterial(a.material_id) : null;
  return `Lernzettel für ${mitNamen("S1", a.zuordnung)}: ${e?.lernzettel.titel ?? m?.title ?? "Dokument"}`;
}
