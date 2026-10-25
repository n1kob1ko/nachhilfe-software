import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Pill } from "@/components/ui";
import type { Lernpaket } from "@/lib/lernpakete";
import { kiHref, type KiVorgabe } from "@/lib/vorbereitung-auto";

const LP = "/mehr/lernpakete";

/**
 * „Warum“ eines Vorschlags der App (lib/vorbereitung-auto.ts) in einer Zeile, mit dem Hinweis „Vorschlag“. Ein
 * Treffer nur über ein Stichwort steht als unsicher da.
 */
export function VorschlagWarum({ warum, unsicher, className = "" }: { warum: string; unsicher?: boolean; className?: string }) {
  return (
    <p className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[14px] ${className}`}>
      <Pill tone="accent" title="Von der App aus Prüfung, Schulstoff, Wunsch des Schülers, Fehlern, offenen Zielen und Wiederholung gewählt, ohne KI">
        Vorschlag
      </Pill>
      <span className="min-w-0">
        <span className="font-semibold">Warum: </span>
        {warum}
        {unsicher && <span className="text-ink-3"> · nur über ein Stichwort gefunden, bitte prüfen</span>}
      </span>
    </p>
  );
}

/**
 * „Kein Paket für …“ mit „Mit KI entwerfen“: der Link öffnet das ausgefüllte Formular unter Mehr › Lernpakete,
 * mit den geschätzten Kosten am Knopf. Die KI läuft erst, wenn der Lehrer dort „Entwurf erstellen“ tippt.
 * Passende Entwürfe stehen dabei, aber nie vorausgewählt.
 */
export function KeinPaket({ thema, ki, kosten, entwuerfe = [], klein }: { thema: string; ki: KiVorgabe | null; kosten: string; entwuerfe?: Lernpaket[]; klein?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${klein ? "text-[14px]" : "text-[14.5px]"}`} data-testid="kein-paket">
      <span className="min-w-0">
        Kein geprüftes Paket für <span className="font-semibold">{thema || "dieses Thema"}</span>
        {entwuerfe.length > 0 && (
          <span className="text-ink-2">
            {" "}
            · Entwurf:{" "}
            {entwuerfe.slice(0, 2).map((p, i) => (
              <span key={p.id}>
                {i > 0 && ", "}
                <Link href={`${LP}/${p.id}`} className="link">
                  {p.title}
                </Link>
              </span>
            ))}
          </span>
        )}
      </span>
      {ki && (
        <Link href={kiHref(ki)} className="btn btn-secondary btn-sm" title="Öffnet das Formular ausgefüllt. Die KI läuft erst nach „Entwurf erstellen“.">
          <Sparkles size={14} aria-hidden /> Mit KI entwerfen <span className="font-normal opacity-80">· {kosten}</span>
        </Link>
      )}
    </div>
  );
}
