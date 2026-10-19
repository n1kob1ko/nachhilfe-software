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
