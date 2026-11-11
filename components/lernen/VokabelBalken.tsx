import type { ListenStand } from "@/lib/vokabel-training";

/** Ein Balken: grün sitzt, blau wird geübt, grau neu. Für Schüler und Lehrer gleich. */
export function VokabelBalken({
  stand,
  className = "mt-2",
}: {
  stand: Pick<ListenStand, "woerter" | "sitzt" | "ueben" | "neu">;
  className?: string;
}) {
  const pct = (n: number) =>
    `${stand.woerter ? (n / stand.woerter) * 100 : 0}%`;
  return (
    <span
      className={`flex h-2 overflow-hidden rounded-full bg-[var(--bar-track)] ${className}`}
      role="img"
      aria-label={`${stand.sitzt} sitzen, ${stand.ueben} am Üben, ${stand.neu} neu`}
    >
      <span className="h-full bg-green" style={{ width: pct(stand.sitzt) }} />
      <span className="h-full bg-accent" style={{ width: pct(stand.ueben) }} />
    </span>
  );
}
