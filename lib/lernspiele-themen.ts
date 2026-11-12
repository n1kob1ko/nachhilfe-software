/**
 * Themenspiele: Lernspiele mit Kisten, die je Runde **ein Thema** (eine Fähigkeit) spielen. „English Tenses“ und
 * „English Grammar“ (lib/lernspiele-englisch.ts), „Kopfrechnen“ (lib/lernspiele-mathe.ts), „Zahlenstrahl“ (lib/lernspiele-strahl.ts) und
 * „Wortschatz“ (lib/lernspiele-wortfelder.ts). Welches Thema dran ist,
 * entscheidet `themenPlan` in lib/lernspiele.ts: das aus dem Stoff des Schülers, sonst das nächste seiner Schulstufe.
 * Hier stehen die Themenlisten aller Spiele und was für alle gleich ist. Nur Reines (keine Datenbank).
 */
import { englischKandidaten, GRAMMATIK_THEMEN, ZEITEN_THEMEN } from "./lernspiele-englisch";
import type { Kandidat } from "./lernspiele-karten";
import { matheKandidaten, RECHNEN_THEMEN } from "./lernspiele-mathe";
import { istStrahlThema, STRAHL_THEMEN, strahlKandidaten } from "./lernspiele-strahl";
import type { SpielArt, SpielThema } from "./lernspiele-typen";
import { wortfeld, WORTSCHATZ_THEMEN, wortschatzKandidaten } from "./lernspiele-wortfelder";

/** Die Spiele mit Themen und ihre Themenlisten, jede in der Reihenfolge des Unterrichts. */
export const SPIEL_THEMEN: Partial<Record<SpielArt, SpielThema[]>> = { zeiten: ZEITEN_THEMEN, grammatik: GRAMMATIK_THEMEN, rechnen: RECHNEN_THEMEN, strahl: STRAHL_THEMEN, wortschatz: WORTSCHATZ_THEMEN };

/**
 * Alle Karten eines Themas, aus dem Speicher (Englisch aus den Englisch-Generatoren, Mathe aus den Mathe-Aufgaben, der
 * Zahlenstrahl aus den Aufgaben mit Bild, „Wortschatz“ aus den Wortfeldern).
 */
export const themenKandidaten = (skill: string): Kandidat[] =>
  wortfeld(skill) ? wortschatzKandidaten(skill) : istStrahlThema(skill) ? strahlKandidaten(skill) : skill.startsWith("mathe.") ? matheKandidaten(skill) : englischKandidaten(skill);

/** Ob eine Fähigkeit aus dem Stoff zu einem Thema gehört (auch ihre Unterfähigkeiten). */
export const themaPasst = (t: SpielThema, skillId: string) => [t.skill, ...(t.auch ?? [])].some((s) => skillId === s || skillId.startsWith(`${s}.`));

/** Ein Thema ist erst mit so vielen Karten spielbar. */
export const THEMA_KARTEN_MIN = 8;

/** Die Themen eines Spiels, die genug Karten haben. */
export const spielbareThemen = (art: SpielArt): SpielThema[] => (SPIEL_THEMEN[art] ?? []).filter((t) => themenKandidaten(t.skill).length >= THEMA_KARTEN_MIN);

/**
 * Die Themen, die für eine Schulstufe dran sind; das Neueste zuerst (wer in der 4. Klasse ist, übt nicht zuerst „am,
 * is, are“). Themen mit `bis` fallen danach weg (in der 3. Klasse Gymnasium kein „Plus und Minus bis 20“ mehr).
 */
export function themenFuerStufe(art: SpielArt, schulstufe: number): SpielThema[] {
  const alle = spielbareThemen(art);
  const dran = alle.filter((t) => t.ab <= schulstufe && (t.bis ?? Infinity) >= schulstufe);
  if (dran.length) return dran.map((t, i) => ({ t, i })).sort((a, b) => b.t.ab - a.t.ab || a.i - b.i).map((x) => x.t);
  // jünger als das erste Thema: trotzdem eines (der Stoff kann das Spiel früher bringen); älter als alle: die letzten
  const frueher = alle.filter((t) => t.ab <= schulstufe);
  if (!frueher.length) return alle.slice(0, 1);
  const zuletzt = Math.max(...frueher.map((t) => t.ab));
  return frueher.filter((t) => t.ab === zuletzt);
}
