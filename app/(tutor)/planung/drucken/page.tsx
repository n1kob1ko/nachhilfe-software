import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { PageHeader, Pill } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { darfWocheSehen, darfWochenplanBearbeiten } from "@/lib/planung/berechtigungen";
import { wochenUebersicht, type UebersichtPlatz } from "@/lib/planung/uebersicht";
import { istDatum, minutenLabel, wochenstartVon, wienerWochenstart } from "@/lib/planung/zeit";

export const metadata = { title: "Wochenplan drucken" };

const tagLabel = (p: UebersichtPlatz, tage: { tag: number; label: string }[]) => tage.find((t) => t.tag === p.weekday)?.label ?? "";

/**
 * Der A4-Wochendruck (`app/(tutor)/planung/drucken`): erst der ganze Plan als Tabelle, dann je
 * Lehrer eine eigene Seite. Gedruckt wird mit dem Browser (`components/PrintButton.tsx`) und den
 * `@page`-Regeln, die auch `app/arbeitsblatt` benutzt — kein PDF-Werkzeug (ADR 0001).
 *
 * Die Verwaltung druckt den Stand der Woche (Entwurf oder veröffentlicht, je Platz vermerkt), ein
 * Lehrer nur seine eigene veröffentlichte Woche (D23).
 */
export default async function PlanungDruckenPage({ searchParams }: { searchParams: Promise<{ woche?: string; lehrer?: string }> }) {
  const me = await requireTeacher();
  const sp = await searchParams;
  const darfBearbeiten = darfWochenplanBearbeiten(me);

  const woche = sp.woche && istDatum(sp.woche) ? wochenstartVon(sp.woche) : wienerWochenstart();
  const uebersicht = wochenUebersicht(woche, darfBearbeiten ? { status: "alle" } : { status: "veroeffentlicht", nurLehrerId: me.id });

  // Ein einzelner Lehrer kann auch aus der Verwaltung heraus gedruckt werden (?lehrer=<id>) — aber
  // nur, wenn man ihn auch sehen darf (D23).
  const gewuenscht = Number(sp.lehrer) || 0;
  const nurLehrer = gewuenscht > 0 && darfWocheSehen(me, gewuenscht) && uebersicht.lehrer.some((l) => l.id === gewuenscht) ? gewuenscht : 0;
  const plaetze = (nurLehrer ? uebersicht.plaetze.filter((p) => p.teacherId === nurLehrer) : uebersicht.plaetze).slice().sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin);
  const lehrer = nurLehrer ? uebersicht.lehrer.filter((l) => l.id === nurLehrer) : uebersicht.lehrer;
  const entwuerfe = plaetze.filter((p) => p.status === "entwurf").length;

  const zeitraum = (p: UebersichtPlatz) => `${minutenLabel(p.startMin)}–${minutenLabel(p.startMin + p.dauer)}`;
  const raum = (p: UebersichtPlatz) => (p.roomName ? `${p.roomName}${p.roomMode === "online" ? " (online)" : ""}` : "–");

  return (
    <>
      {/* @page kommt aus derselben Ecke wie bei den Arbeitsblättern (components/arbeitsblatt/Sheet.tsx). */}
      <style>{`@page { size: A4 portrait; margin: 12mm 12mm 14mm }`}</style>
      <style>{`@media print { .wp-neue-seite { break-before: page; } .wp-tabelle { break-inside: auto; } .wp-tabelle tr { break-inside: avoid; } }`}</style>

      <PageHeader
        title="Wochenplan drucken"
        subtitle={uebersicht.label}
        back={{ href: `/planung?woche=${woche}`, label: "Zurück zur Planung" }}
        actions={<PrintButton />}
      />

      <div className="no-print mb-6 flex flex-wrap items-center gap-3 text-[13px] text-ink-2">
        <Pill tone={uebersicht.status === "veroeffentlicht" ? "green" : "amber"}>
          {uebersicht.status === "veroeffentlicht" ? "veröffentlicht" : uebersicht.status === "entwurf" ? "Entwurf" : "leer"}
        </Pill>
        <span className="num">{plaetze.length} geplante Einheiten</span>
        {entwuerfe > 0 && uebersicht.status === "veroeffentlicht" && <span className="num text-amber">{entwuerfe} davon im Entwurf</span>}
        {darfBearbeiten && !nurLehrer && (
          <span>
            {lehrer.map((l) => (
              <Link key={l.id} href={`/planung/drucken?woche=${woche}&lehrer=${l.id}`} className="link mr-3">
                nur {l.name} drucken
              </Link>
            ))}
          </span>
        )}
        <span>Seitenumbrüche zeigt die Druckvorschau; je Lehrer beginnt eine neue Seite.</span>
      </div>

      <section className="panel px-5 py-5 print:border-0 print:shadow-none">
        <h2 className="text-[17px] font-semibold">Wochenplan · {uebersicht.label}</h2>
        <p className="mb-3 text-[13px] text-ink-2">
          {uebersicht.status === "veroeffentlicht" ? "Veröffentlichter Plan" : "Stand dieser Woche (Entwurf)"}
          {nurLehrer ? ` · nur ${lehrer[0]?.name ?? ""}` : ""} · gedruckt aus Lernheft
        </p>

        {plaetze.length === 0 ? (
          <p className="text-[14px] text-ink-2">Für diese Woche ist nichts geplant.</p>
        ) : (
          <table className="wp-tabelle w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-ink text-left">
                <th className="py-1.5 pr-2">Tag</th>
                <th className="py-1.5 pr-2">Zeit</th>
                <th className="py-1.5 pr-2">Lehrer</th>
                <th className="py-1.5 pr-2">Schüler</th>
                <th className="py-1.5 pr-2">Raum</th>
                <th className="py-1.5">Zustand</th>
              </tr>
            </thead>
            <tbody>
              {plaetze.map((p) => (
                <tr key={p.id} className="border-b border-line align-top">
                  <td className="py-1.5 pr-2 whitespace-nowrap">{tagLabel(p, uebersicht.tage)}</td>
                  <td className="num py-1.5 pr-2 whitespace-nowrap">{zeitraum(p)}</td>
                  <td className="py-1.5 pr-2">{p.teacherName}</td>
                  <td className="py-1.5 pr-2">{p.studentName}</td>
                  <td className="py-1.5 pr-2">{raum(p)}</td>
                  <td className="py-1.5">
                    {p.status === "entwurf" ? "Entwurf" : "veröffentlicht"}
                    {p.locked ? " · gesperrt" : ""}
                    {p.zugleichMit.length ? ` · gleichzeitig mit ${p.zugleichMit.join(", ")}` : ""}
                    {p.nichtStattgefunden ? " · nicht stattgefunden" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {lehrer.map((l) => {
        const meine = plaetze.filter((p) => p.teacherId === l.id);
        const minuten = meine.reduce((summe, p) => summe + p.dauer, 0);
        return (
          <section key={l.id} className="wp-neue-seite panel mt-6 px-5 py-5 print:mt-0 print:border-0 print:shadow-none">
            <h2 className="text-[16px] font-semibold">
              {l.name} <span className="num font-normal text-ink-2">· {meine.length} Einheiten · {minuten} min</span>
            </h2>
            {meine.length === 0 ? (
              <p className="mt-2 text-[13px] text-ink-2">Keine Einheiten in dieser Woche.</p>
            ) : (
              <table className="wp-tabelle mt-2 w-full border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-ink text-left">
                    <th className="py-1.5 pr-2">Tag</th>
                    <th className="py-1.5 pr-2">Zeit</th>
                    <th className="py-1.5 pr-2">Schüler</th>
                    <th className="py-1.5">Raum</th>
                  </tr>
                </thead>
                <tbody>
                  {meine.map((p) => (
                    <tr key={p.id} className="border-b border-line align-top">
                      <td className="py-1.5 pr-2 whitespace-nowrap">{tagLabel(p, uebersicht.tage)}</td>
                      <td className="num py-1.5 pr-2 whitespace-nowrap">{zeitraum(p)}</td>
                      <td className="py-1.5 pr-2">{p.studentName}</td>
                      <td className="py-1.5">{raum(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </>
  );
}
