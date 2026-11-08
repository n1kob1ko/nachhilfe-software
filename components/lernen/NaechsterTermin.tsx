import Link from "next/link";
import { CalendarDays, MapPin, UserRound } from "lucide-react";
import type { termineFuerSchueler } from "@/lib/planung/schueler-termine";

type Naechster = NonNullable<ReturnType<typeof termineFuerSchueler>["naechster"]>;

/**
 * Der nächste Termin als Karte: „Jetzt“, „Heute“, „Morgen“ oder „Nächster Termin“, dann Wochentag, groß die Uhrzeit,
 * Ort und Lehrer (niko 2026-11-03). Auf Start mit dem Weg zur Seite Termine, dort ohne.
 */
export function NaechsterTermin({ naechster, token, alleLink = false }: { naechster: Naechster; token: string; alleLink?: boolean }) {
  return (
    <section className="panel mt-8 px-5 py-5 md:px-6" aria-label="Nächster Termin" data-testid="naechster-termin">
      <p className="flex items-center gap-2 text-[14px] font-semibold text-accent">
        <CalendarDays size={17} aria-hidden /> {naechster.jetzt ? "Jetzt" : naechster.heute ? "Heute" : naechster.morgen ? "Morgen" : "Nächster Termin"}
      </p>
      <p className="mt-2 text-[18px] font-semibold text-ink-2" data-testid="naechster-tag">
        {naechster.tagLang}
      </p>
      <p className="num mt-0.5 text-[32px] leading-tight font-semibold tracking-[-0.01em]" data-testid="naechster-zeit">
        {naechster.zeit.replace("–", " – ")}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px]" data-testid="naechster-ort">
        <MapPin size={17} className="shrink-0 text-ink-3" aria-hidden />
        <span>{naechster.standort}</span>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px]" data-testid="naechster-lehrer">
        <UserRound size={17} className="shrink-0 text-ink-3" aria-hidden />
        <span>{naechster.lehrer}</span>
      </p>
      {alleLink && (
        <p className="mt-3 text-[14px]">
          <Link href={`/lernen/${token}/termine`} className="inline-flex min-h-[44px] items-center font-semibold text-accent hover:underline">
            Alle Termine und Termin ändern
          </Link>
        </p>
      )}
    </section>
  );
}
