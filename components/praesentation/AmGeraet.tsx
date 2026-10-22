import { Presentation } from "lucide-react";
import { dateienDa, getPraesentation } from "@/lib/praesentationen";
import { deckUrl, praesentationsOrigin } from "@/lib/praesentation-host";
import { SchuelerDeck } from "./SchuelerDeck";

/**
 * A presentation on the student device (tablet or own laptop). Only the title and the address of the
 * slides reach this page; the Vortragstext stays on the server.
 */
export function PraesentationAmGeraet({ id, folie }: { id: number; folie: number }) {
  const p = getPraesentation(id);
  const src = p && dateienDa(p) ? deckUrl(p.token, p.start_pfad) : null;
  if (!p || !src) {
    return (
      <div className="panel flex flex-col items-center px-6 py-12 text-center">
        <Presentation size={34} strokeWidth={1.75} className="text-accent" aria-hidden />
        <p className="mt-4 text-[18px] font-semibold">Die Präsentation kann hier gerade nicht angezeigt werden.</p>
      </div>
    );
  }
  return (
    <section aria-label="Präsentation">
      <h2 className="mb-3 flex items-center gap-2 text-[18px] font-semibold">
        <Presentation size={20} className="text-accent" aria-hidden /> {p.title}
      </h2>
      <SchuelerDeck praesId={p.id} title={p.title} src={src} deckOrigin={praesentationsOrigin()} folie={folie} />
    </section>
  );
}
