import Link from "next/link";
import { Presentation } from "lucide-react";
import { boardForUnit, listPages } from "@/lib/whiteboard";

/** Whiteboard of a unit as small page previews with a link to open it; nothing if the board stayed empty. */
export function BoardThumbs({ unitId, max = 4, alwaysLink }: { unitId: number; max?: number; alwaysLink?: boolean }) {
  const board = boardForUnit(unitId);
  if (!board) return null;
  const pages = listPages(board.id);
  const used = pages.filter((p) => p.element_count > 0);
  if (!used.length && !alwaysLink) return null;
  const shown = used.filter((p) => p.has_preview).slice(0, max);
  return (
    <div className="mt-3 grid gap-2">
      <Link href={`/tafel/${unitId}`} className="inline-flex w-fit items-center gap-1.5 text-[14px] font-medium text-accent hover:underline">
        <Presentation size={14} aria-hidden /> Whiteboard ({pages.length} {pages.length === 1 ? "Seite" : "Seiten"})
      </Link>
      {shown.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {shown.map((p) => (
            <Link key={p.id} href={`/tafel/${unitId}?seite=${p.id}`} className="group block w-[150px] overflow-hidden rounded-lg border border-line bg-white hover:border-accent" title={p.title}>
              {/* eslint-disable-next-line @next/next/no-img-element -- generated SVG, served by our own route */}
              <img src={`/tafel/${unitId}/vorschau/${p.id}?v=${encodeURIComponent(p.updated_at)}`} alt={`Vorschau ${p.title}`} loading="lazy" className="aspect-[4/3] w-full object-contain p-1" />
              <span className="block truncate border-t border-line px-2 py-1 text-[12px] text-ink-2 group-hover:text-accent">{p.title}</span>
            </Link>
          ))}
          {used.length > shown.length && <span className="self-center text-[13px] text-ink-3">+{used.length - shown.length} weitere</span>}
        </div>
      )}
    </div>
  );
}
