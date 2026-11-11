import Link from "next/link";
import { ChevronRight, Languages } from "lucide-react";
import { alleListenStand } from "@/lib/vokabel-training";

/**
 * Auf dem Start der Schüler-App: die Vokabeln aus den eigenen Listen (lib/vokabel-training.ts), mit dem, was heute dran
 * ist. Mit einer Liste geht es gleich zum Üben, mit mehreren zur Auswahl. Ohne Liste steht hier nichts.
 */
export function VokabelTeaser({
  studentId,
  token,
}: {
  studentId: number;
  token: string;
}) {
  const listen = alleListenStand(studentId);
  if (!listen.length) return null;
  const dran = listen.reduce((s, l) => s + l.dran, 0);
  const href =
    listen.length === 1
      ? `/lernen/${token}/vokabeln/${listen[0].id}`
      : `/lernen/${token}/vokabeln`;
  const titel =
    listen.length === 1 ? listen[0].title : `${listen.length} Listen`;
  return (
    <Link
      href={href}
      className="panel mt-8 flex items-center gap-4 px-5 py-4 transition-colors hover:border-accent"
      data-testid="vokabel-teaser"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--englisch-soft)] text-[var(--englisch-fg)]">
        <Languages size={24} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold tracking-wide text-ink-3 uppercase">
          Vokabeln
        </span>
        <span className="block text-[17px] font-semibold [overflow-wrap:anywhere]">
          {titel}
        </span>
        <span className="mt-0.5 block text-[14px] text-ink-2">
          {dran === 0
            ? "Heute ist nichts dran. Üben geht trotzdem."
            : dran === 1
              ? "1 Wort ist heute dran"
              : `${dran} Wörter sind heute dran`}
        </span>
      </span>
      <span className="btn btn-primary">
        Üben <ChevronRight size={16} aria-hidden />
      </span>
    </Link>
  );
}
