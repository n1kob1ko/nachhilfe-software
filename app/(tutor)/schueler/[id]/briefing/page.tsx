import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { BriefingAnsicht } from "@/components/BriefingAnsicht";
import { Info } from "@/components/Info";
import { PageHeader } from "@/components/ui";
import { briefingAnfrage } from "@/lib/ai/briefing";
import { costOf, routeFor } from "@/lib/ai/config";
import { aiEnabled, budgetUsedUp, schuelerGestoppt } from "@/lib/ai/router";
import { grenzeErreichtText } from "@/lib/ai/schueler-kosten";
import { requireTeacher } from "@/lib/auth";
import { briefingDaten, einfachesBriefing, gespeichertesBriefing, schuelerZeile, uebungLinks } from "@/lib/briefing";

export const metadata = { title: "Briefing" };

/** Ungefähre Kosten einer KI-Anfrage für dieses Briefing: Länge der Anfrage, dazu Antwort und Denken. */
function kostenText(prompt: string, system: string): string {
  const route = routeFor("briefing");
  if (route.provider === "manual") return "kostet nichts (manueller Modus)";
  const usd = costOf(route.model, "standard", { input: Math.round((prompt.length + system.length) / 3.2), output: 2_500, cacheWrite: 0, cacheRead: 0 });
  return `ca. ${usd.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

/**
 * Das **Tagesbriefing** eines Schülers (lib/briefing.ts): die Version aus den Daten sofort, die
 * KI-Fassung gespeichert oder auf Klick. `?start=1` (Knopf „Briefing“ auf der Startseite) fragt die KI
 * gleich, wenn es heute noch keine gibt; `?platz=` ist der Platz im Wochenplan, dessen Dauer gilt.
 */
export default async function BriefingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ start?: string; platz?: string }> }) {
  await requireTeacher();
  const { id } = await params;
  const sp = await searchParams;
  const d = briefingDaten(Number(id), { platzId: Number(sp.platz) || null });
  if (!d) notFound();
  const gespeichert = gespeichertesBriefing(d.student.id, d.datum);
  const kiAus = !aiEnabled("briefing")
    ? "Die KI ist aus oder für den gewählten Anbieter ist kein Schlüssel hinterlegt (Erweitert › KI-Kosten)."
    : budgetUsedUp("briefing")
      ? "Das KI-Budget für diesen Monat ist aufgebraucht."
      : schuelerGestoppt("briefing", d.student.id)
        ? grenzeErreichtText()
        : null;
  const anfrage = briefingAnfrage(d);

  return (
    <>
      <PageHeader
        title={`Briefing: ${d.student.name}`}
        back={{ href: `/schueler/${d.student.id}`, label: d.student.name }}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <CalendarClock size={16} aria-hidden />
            <span>
              Heute{d.zeit && <span className="num"> {d.zeit}</span>} · <span className="num">{d.minuten}</span> min geplant
            </span>
            <span className="text-ink-3">· {schuelerZeile(d.student)}</span>
            <Info label="Was geht an die KI?">
              Nur auf Klick: Lernverlauf, Lernstand je Fähigkeit, Empfehlungen, die letzten drei Dokumentationen, Ziele, Schulstufe, Fächer, die nächste Schularbeit und die passenden Übungen aus dem Bestand. Namen von
              Schüler, Lehrern, Eltern und Geschwistern sind vorher durch [Name] ersetzt, Profil-Notizen gehen nicht mit. Die KI ändert nichts am Lernstand; das Briefing wird für heute gespeichert und kostet beim
              nächsten Öffnen nichts.
            </Info>
          </span>
        }
      />
      <div className="max-w-[1100px]">
        <BriefingAnsicht
          studentId={d.student.id}
          platzId={d.platzId}
          einfach={einfachesBriefing(d)}
          gespeichert={gespeichert}
          veraltet={Boolean(gespeichert && gespeichert.stand !== d.stand)}
          uebungen={uebungLinks(d.kandidaten)}
          kiAus={kiAus}
          kosten={kostenText(anfrage.prompt, anfrage.system)}
          start={sp.start === "1"}
        />
      </div>
    </>
  );
}
