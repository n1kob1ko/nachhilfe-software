import { Archive, ArchiveRestore, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/components/ui";

type Action = () => Promise<void>;

/** „Archivieren“: the normal way to take something out of the lists (lib/archiv.ts). */
export function ArchivKnopf({ action, label = "Archivieren", className = "btn btn-secondary" }: { action: Action; label?: string; className?: string }) {
  return (
    <form action={action}>
      <button className={className}>
        <Archive size={15} aria-hidden /> {label}
      </button>
    </form>
  );
}

export function WiederherstellenKnopf({ action, className = "btn btn-secondary" }: { action: Action; className?: string }) {
  return (
    <form action={action}>
      <button className={className}>
        <ArchiveRestore size={15} aria-hidden /> Wiederherstellen
      </button>
    </form>
  );
}

/** On the page of an archived item: since when, what that means, and the way back. */
export function ArchivBanner({ seit, text, restore }: { seit: string; text: string; restore?: Action }) {
  return (
    <div className="no-print mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-panel px-4 py-3" role="status" data-testid="archiv-banner">
      <Archive size={18} className="shrink-0 text-ink-2" aria-hidden />
      <p className="min-w-0 flex-1 basis-56 text-[14px] text-ink-2">
        <span className="font-semibold text-ink">Archiviert am {formatDate(seit, { day: "numeric", month: "long", year: "numeric" })}.</span> {text}
      </p>
      {restore && <WiederherstellenKnopf action={restore} />}
    </div>
  );
}

/** The outcome after the redirect of an archive action (`?archiv=…` or `?fehler=…`). */
export function ArchivMeldung({ archiv, fehler, archiviert, wiederhergestellt = "Wiederhergestellt." }: { archiv?: string; fehler?: string; archiviert: string; wiederhergestellt?: string }) {
  if (fehler)
    return (
      <p className="no-print mb-4 rounded-lg bg-red-wash px-4 py-2.5 text-[14px] text-red" role="alert">
        {fehler}
      </p>
    );
  if (archiv !== "archiviert" && archiv !== "wiederhergestellt") return null;
  return (
    <p className="no-print mb-4 flex items-center gap-1.5 text-[14px] font-semibold text-green" role="status">
      <CheckCircle2 size={16} className="shrink-0" aria-hidden /> {archiv === "archiviert" ? archiviert : wiederhergestellt}
    </p>
  );
}
