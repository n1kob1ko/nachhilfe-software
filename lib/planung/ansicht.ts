/**
 * Was die Wochenansicht zeigt (`components/planung/WochenplanGitter.tsx`): welcher Zeitbereich und
 * welche Tage. Reine Funktionen ohne Datenbank, damit sie sich testen lassen.
 */
import type { Verfuegbarkeit } from "./verfuegbarkeit";
import type { Wochentag } from "./zeit";

/**
 * Der sichtbare Zeitbereich: von der frühesten bis zur spätesten Verfügbarkeit oder Einheit, auf volle
 * Stunden, mindestens vier Stunden. Ohne beides 08:00–18:00. Leere Vormittage kosten so keinen Platz.
 */
export function anzeigeBereich(plaetze: { startMin: number; dauer: number }[], lehrer: { verfuegbarkeit: Verfuegbarkeit }[]): { von: number; bis: number } {
  let von = Infinity;
  let bis = -Infinity;
  const merken = (start: number, ende: number) => {
    von = Math.min(von, start);
    bis = Math.max(bis, ende);
  };
  for (const p of plaetze) merken(p.startMin, p.startMin + p.dauer);
  for (const l of lehrer)
    for (const spannen of Object.values(l.verfuegbarkeit)) for (const spanne of spannen ?? []) merken(spanne.start, spanne.end);
  if (von === Infinity) return { von: 8 * 60, bis: 18 * 60 };
  von = Math.max(0, Math.floor(von / 60) * 60);
  bis = Math.min(1440, Math.ceil(bis / 60) * 60);
  if (bis - von < 240) {
    bis = Math.min(1440, von + 240);
    von = Math.max(0, bis - 240);
  }
  return { von, bis };
}

/** Montag bis Freitag immer, Samstag und Sonntag nur mit einem Platz oder einer Verfügbarkeit. */
export function sichtbareTage<T extends { tag: Wochentag }>(tage: T[], plaetze: { weekday: Wochentag }[], lehrer: { verfuegbarkeit: Verfuegbarkeit }[]): T[] {
  return tage.filter(
    (t) => t.tag <= 5 || plaetze.some((p) => p.weekday === t.tag) || lehrer.some((l) => (l.verfuegbarkeit[String(t.tag) as keyof Verfuegbarkeit] ?? []).length > 0),
  );
}

/**
 * Welcher Tag in der Tagesansicht (Telefon, Tablet) zuerst offen ist: heute, wenn die Woche läuft
 * und der Tag sichtbar ist, sonst der erste Tag mit einem Platz, sonst der erste sichtbare Tag.
 */
export function startTag(tage: { tag: Wochentag }[], plaetze: { weekday: Wochentag }[], heute: Wochentag | null): Wochentag {
  if (heute && tage.some((t) => t.tag === heute)) return heute;
  return tage.find((t) => plaetze.some((p) => p.weekday === t.tag))?.tag ?? tage[0]?.tag ?? 1;
}

/**
 * Ein Tag als Liste: die Plätze eines Lehrers und seine unnützen Lücken, nach Startzeit sortiert.
 * Bei gleicher Zeit kommt der Platz vor der Lücke, zwei Plätze ordnet die Id.
 */
export function tagesListe<P extends { id: number; startMin: number }, L extends { start: number; end: number }>(
  plaetze: P[],
  luecken: L[],
): ({ art: "platz"; platz: P; start: number } | { art: "luecke"; luecke: L; start: number })[] {
  return [
    ...plaetze.map((platz) => ({ art: "platz" as const, platz, start: platz.startMin })),
    ...luecken.map((luecke) => ({ art: "luecke" as const, luecke, start: luecke.start })),
  ].sort((a, b) => a.start - b.start || (a.art === b.art ? (a.art === "platz" && b.art === "platz" ? a.platz.id - b.platz.id : 0) : a.art === "platz" ? -1 : 1));
}
