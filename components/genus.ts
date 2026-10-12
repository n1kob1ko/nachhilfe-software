/**
 * Genus-Färbung für Deutsch-Aufgaben (Entscheidung D10 in tommys-merge.md).
 *
 * Das Geschlecht eines Nomens bekommt eine feste Farbe aus den Kachel-Tönen der Gestaltung:
 * maskulin flieder, feminin pfirsich, neutral mint. Die Farbe ist **nie das einzige Signal** —
 * jede Stelle zeigt zusätzlich den Buchstaben m/f/n. Rot bleibt Fehlern vorbehalten und kommt
 * hier deshalb nicht vor (auch der Rückfallwert nicht).
 *
 * Bewusst neben `subjectTone` (components/Calendar.tsx), aber in einer eigenen Datei, damit
 * Aufgaben- und Kalender-Oberfläche dieselbe Funktion ohne Umweg über eine Komponente teilen.
 */
export type Genus = "m" | "f" | "n";

export type GenusTone = { bg: string; fg: string; soft: string };

export const GENUS_LABEL: Record<Genus, string> = { m: "maskulin", f: "feminin", n: "neutral" };

/** Die drei Töne aus app/globals.css; `fg` ist die lesbare Schriftfarbe dazu (wie bei subjectTone). */
const TONES: Record<Genus, GenusTone> = {
  m: { bg: "var(--tile-lilac)", fg: "#4b3aa8", soft: "#efecfd" },
  f: { bg: "var(--tile-peach)", fg: "#9b4520", soft: "#fdf0e5" },
  n: { bg: "var(--tile-mint)", fg: "#1b6f3d", soft: "#e9f7ef" },
};

/** Unbekanntes oder fehlendes Genus: neutraler Beige-Ton. Er sagt nichts über das Wort und ist nie rot. */
export const UNKNOWN_GENUS_TONE: GenusTone = { bg: "var(--line)", fg: "var(--ink-3)", soft: "var(--paper)" };

/**
 * Auch die Artikelform wird angenommen (`der`/`die`/`das`), weil das Genus in den Banken als Artikel
 * gespeichert ist; die Anzeige und die Färbung brauchen aber m/f/n.
 */
const ALIASES: Record<string, Genus> = {
  m: "m", maskulin: "m", männlich: "m", der: "m",
  f: "f", feminin: "f", weiblich: "f", die: "f",
  n: "n", neutral: "n", neutrum: "n", sächlich: "n", das: "n",
};

export function isGenus(x: unknown): x is Genus {
  return x === "m" || x === "f" || x === "n";
}

/** Der Buchstabe und das deutsche Wort zu einem Genus; null, wenn keines gesetzt ist. */
export function genusBadge(x: unknown): { letter: Genus; label: string } | null {
  const g = asGenus(x);
  return g ? { letter: g, label: GENUS_LABEL[g] } : null;
}

/** m/f/n oder ein bekannter Artikel dazu; alles andere ergibt null. */
export function asGenus(x: unknown): Genus | null {
  if (typeof x !== "string") return null;
  return ALIASES[x.trim().toLowerCase()] ?? null;
}

/** Die Farbe zu einem Genus; unbekannte Werte fallen auf den neutralen Ton zurück (nie rot). */
export function genderTone(x: unknown): GenusTone {
  const g = asGenus(x);
  return g ? TONES[g] : UNKNOWN_GENUS_TONE;
}
