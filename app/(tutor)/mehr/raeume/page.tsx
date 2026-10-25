import Link from "next/link";
import { DoorOpen, Pencil } from "lucide-react";
import { RaumAktionen } from "@/components/planung/RaumAktionen";
import { RaumForm } from "@/components/planung/RaumForm";
import { PageHeader, Pill, SectionTitle } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { darfRaeumeVerwalten } from "@/lib/planung/berechtigungen";
import { listRaeume, raumVerweise } from "@/lib/planung/repo";

export const metadata = { title: "Räume" };

/**
 * Mehr › Räume (D22): wo eine geplante Einheit stattfindet — Gebäude, Name, vor Ort oder online.
 * Ein Raum wird **deaktiviert statt gelöscht**, sobald Plätze auf ihn zeigen; das prüft
 * `lib/planung/aktionen.ts` (und die Liste zeigt es an). Ändern darf nur die Verwaltung (D23),
 * sehen darf sie jeder Lehrer — er braucht sie für seine Raumwünsche.
 */
export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ bearbeiten?: string; fehler?: string; ok?: string }> }) {
  const me = await requireTeacher();
  const sp = await searchParams;
  const darf = darfRaeumeVerwalten(me);
  const alle = listRaeume({ mitInaktiven: true });
  const bearbeitenId = Number(sp.bearbeiten) || 0;
  const bearbeiten = bearbeitenId ? alle.find((r) => r.id === bearbeitenId) : undefined;
  const zurueck = "/mehr/raeume";
  const gebaeude = [...new Set(alle.map((r) => r.building))];

  return (
    <>
      <PageHeader
        title="Räume"
        back={{ href: "/mehr", label: "Mehr" }}
        info="Ein Raum ist der Ort einer geplanten Einheit: Gebäude, Name und ob vor Ort oder online. Sobald Plätze auf einen Raum zeigen, wird er deaktiviert statt gelöscht — so bleibt die Dokumentation vollständig."
      />

      {(sp.fehler || sp.ok) && (
        <p className={`mb-6 max-w-[760px] rounded-2xl px-4 py-3 text-[14px] ${sp.fehler ? "bg-red-wash text-red" : "bg-green-wash text-green"}`} role="status">
          {sp.fehler ?? sp.ok}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section>
          <SectionTitle>Alle Räume</SectionTitle>
          {alle.length === 0 ? (
            <div className="panel flex flex-col items-start gap-3 px-5 py-6">
              <DoorOpen size={28} className="text-ink-3" aria-hidden />
              <p className="font-semibold">Noch kein Raum angelegt</p>
              {!darf && <p className="text-[14px] text-ink-2">Räume legt die Verwaltung an.</p>}
            </div>
          ) : (
            <ul className="panel divide-y divide-line">
              {alle.map((r) => {
                const verweise = raumVerweise(r.id);
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 font-semibold">
                        {r.name}
                        <Pill tone={r.mode === "online" ? "accent" : "neutral"}>{r.mode === "online" ? "online" : "vor Ort"}</Pill>
                        {!r.active && <Pill>deaktiviert</Pill>}
                        {verweise > 0 && <Pill tone="green">{verweise} geplante Einheiten</Pill>}
                      </div>
                      <div className="text-[13px] text-ink-2">{r.building}</div>
                    </div>
                    {darf && (
                      <>
                        <Link href={`/mehr/raeume?bearbeiten=${r.id}`} className="btn btn-ghost btn-sm">
                          <Pencil size={15} aria-hidden /> Bearbeiten
                        </Link>
                        <RaumAktionen roomId={r.id} active={!!r.active} verweise={verweise} zurueck={zurueck} />
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {!darf && <p className="mt-3 text-[13px] text-ink-3">Ändern kann Räume nur die Verwaltung. Für deine Raumwünsche findest du sie unter Erweitert › Lehrer &amp; Verfügbarkeit.</p>}
        </section>

        {darf && (
          <aside>
            <div className="panel px-4 py-4">
              <h2 className="mb-3 font-semibold">{bearbeiten ? `${bearbeiten.name} bearbeiten` : "Raum hinzufügen"}</h2>
              <RaumForm raum={bearbeiten} gebaeude={gebaeude} zurueck={bearbeiten ? `${zurueck}?bearbeiten=${bearbeiten.id}` : zurueck} />
              {bearbeiten && (
                <p className="mt-3 text-[13px] text-ink-2">
                  <Link href={zurueck} className="underline underline-offset-2">
                    Neuen Raum anlegen statt bearbeiten
                  </Link>
                </p>
              )}
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
