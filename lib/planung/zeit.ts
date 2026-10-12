/**
 * Die einzige Stelle, an der Wochentage und Zeitzone umgerechnet werden.
 *
 * Zwei Regeln aus tommys-merge.md §6 gelten für die ganze Planung:
 *
 * 1. **Wochentag:** Die Quell-Repos zählen 0 = Sonntag … 6 = Samstag. Hier gilt überall ISO:
 *    **1 = Montag … 7 = Sonntag.** Die Umrechnung passiert ausschließlich hier
 *    (`ausQuellWochentag` / `alsQuellWochentag`); kein anderer Code darf `getDay()` rechnen.
 * 2. **Zeitzone:** Wochenstart und „heute“ werden in **Europe/Vienna** gerechnet. Geplante Zeiten
 *    werden als **lokales Datum + Minuten ab Mitternacht** gespeichert, nie als UTC-Zeitstempel.
 *
 * Datumsangaben sind hier immer Zeichenketten `YYYY-MM-DD` (lokales Kalenderdatum). Gerechnet wird
 * damit über UTC-Mittag, damit Sommer-/Winterzeit keine Rolle spielt.
 */

/** ISO-Wochentag: 1 = Montag … 7 = Sonntag. Die einzige Wochentagsskala dieses Repos. */
export type Wochentag = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WOCHENTAGE: readonly Wochentag[] = [1, 2, 3, 4, 5, 6, 7];

/** Dieselben Tage als Schlüssel der Verfügbarkeitsspalten: "1" … "7". */
export const TAG_SCHLUESSEL = ["1", "2", "3", "4", "5", "6", "7"] as const;
export type TagSchluessel = (typeof TAG_SCHLUESSEL)[number];

export const WOCHENTAG_KURZ: Record<Wochentag, string> = { 1: "Mo", 2: "Di", 3: "Mi", 4: "Do", 5: "Fr", 6: "Sa", 7: "So" };
export const WOCHENTAG_LANG: Record<Wochentag, string> = {
  1: "Montag",
  2: "Dienstag",
  3: "Mittwoch",
  4: "Donnerstag",
  5: "Freitag",
  6: "Samstag",
  7: "Sonntag",
};

/** Alle Zeiten der Planung gelten in dieser Zeitzone. */
export const ZEITZONE = "Europe/Vienna";

const TAG_MS = 86_400_000;
const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------- Wochentag: Quelle (0 = Sonntag) ↔ ISO (1 = Montag) ----------

/** 0 = Sonntag … 6 = Samstag (Quell-Repos) → ISO 1 = Montag … 7 = Sonntag. */
export function ausQuellWochentag(quellTag: number): Wochentag {
  if (!Number.isInteger(quellTag) || quellTag < 0 || quellTag > 6)
    throw new Error(`Quell-Wochentag außerhalb 0–6: ${quellTag}`);
  return (quellTag === 0 ? 7 : quellTag) as Wochentag;
}

/** ISO 1 = Montag … 7 = Sonntag → 0 = Sonntag … 6 = Samstag (Quell-Repos). */
export function alsQuellWochentag(tag: Wochentag): number {
  if (!Number.isInteger(tag) || tag < 1 || tag > 7) throw new Error(`Wochentag außerhalb 1–7: ${tag}`);
  return tag === 7 ? 0 : tag;
}

export function istWochentag(wert: unknown): wert is Wochentag {
  return Number.isInteger(wert) && (wert as number) >= 1 && (wert as number) <= 7;
}

// ---------- Datum (lokales Kalenderdatum, YYYY-MM-DD) ----------

export function istDatum(wert: unknown): wert is string {
  if (typeof wert !== "string" || !DATUM_RE.test(wert)) return false;
  const ms = datumMs(wert);
  // Date.parse rollt ungültige Tage weiter (30. Februar → 2. März); der Rückweg entlarvt das.
  return !Number.isNaN(ms) && alsDatum(ms) === wert;
}

function datumMs(datum: string): number {
  return Date.parse(`${datum}T12:00:00Z`);
}

function alsDatum(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Datum plus Tage (auch negativ). Reine Kalenderrechnung, ohne Zeitzone. */
export function tagAddieren(datum: string, tage: number): string {
  return alsDatum(datumMs(datum) + Math.round(tage) * TAG_MS);
}

/** ISO-Wochentag eines lokalen Datums. */
export function wochentagVon(datum: string): Wochentag {
  return ausQuellWochentag(new Date(datumMs(datum)).getUTCDay());
}

/** Montag der Woche, in der das Datum liegt. */
export function wochenstartVon(datum: string): string {
  return tagAddieren(datum, 1 - wochentagVon(datum));
}

/** Die sieben Tage einer Woche, Montag zuerst. */
export function wochentageDerWoche(weekStart: string): { datum: string; tag: Wochentag }[] {
  const start = wochenstartVon(weekStart);
  return WOCHENTAGE.map((tag) => ({ tag, datum: tagAddieren(start, tag - 1) }));
}

// ---------- „Jetzt“ in Europe/Vienna ----------

function wienerTeile(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZEITZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const wert = (typ: string) => parts.find((p) => p.type === typ)?.value ?? "";
  return { jahr: wert("year"), monat: wert("month"), tag: wert("day"), stunde: wert("hour"), minute: wert("minute") };
}

/** Heutiges Datum in Europe/Vienna als YYYY-MM-DD. */
export function wienerDatum(now: Date = new Date()): string {
  const { jahr, monat, tag } = wienerTeile(now);
  return `${jahr}-${monat}-${tag}`;
}

/** Uhrzeit in Europe/Vienna als Minuten ab Mitternacht (0–1439). */
export function wienerMinuten(now: Date = new Date()): number {
  const { stunde, minute } = wienerTeile(now);
  // Intl liefert für Mitternacht je nach Umgebung "24"; das ist derselbe Tag, 00:00.
  return (Number(stunde) % 24) * 60 + Number(minute);
}

/** Montag der laufenden Woche in Europe/Vienna. */
export function wienerWochenstart(now: Date = new Date()): string {
  return wochenstartVon(wienerDatum(now));
}

// ---------- Minuten ab Mitternacht ----------

export const MINUTEN_PRO_TAG = 24 * 60;

/** 540 → "09:00" */
export function minutenLabel(minuten: number): string {
  const m = Math.max(0, Math.min(MINUTEN_PRO_TAG, Math.round(minuten)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "09:00" → 540; null bei allem, was keine Uhrzeit ist. */
export function labelMinuten(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const stunde = Number(m[1]);
  const minute = Number(m[2]);
  if (stunde > 23 || minute > 59) return null;
  return stunde * 60 + minute;
}

/** Startzeiten rasten auf das 10-Minuten-Raster ein (D19). */
export function auf10(minuten: number): number {
  return Math.round(minuten / 10) * 10;
}

// ---------- Beschriftungen ----------

/** "Mo, 12. Okt." */
export function datumLabel(datum: string): string {
  const d = new Date(datumMs(datum));
  return `${WOCHENTAG_KURZ[wochentagVon(datum)]}, ${d.toLocaleDateString("de-AT", { day: "numeric", month: "short", timeZone: "UTC" })}`;
}

/** "12. – 18. Oktober 2026" */
export function wochenLabel(weekStart: string): string {
  const start = wochenstartVon(weekStart);
  const ende = tagAddieren(start, 6);
  const a = new Date(datumMs(start));
  const b = new Date(datumMs(ende));
  const monat = (d: Date) => d.toLocaleDateString("de-AT", { month: "long", timeZone: "UTC" });
  const tag = (d: Date) => d.toLocaleDateString("de-AT", { day: "numeric", timeZone: "UTC" });
  if (a.getUTCMonth() === b.getUTCMonth())
    return `${tag(a)}. – ${tag(b)}. ${monat(b)} ${b.getUTCFullYear()}`;
  if (a.getUTCFullYear() === b.getUTCFullYear()) return `${tag(a)}. ${monat(a)} – ${tag(b)}. ${monat(b)} ${b.getUTCFullYear()}`;
  return `${tag(a)}. ${monat(a)} ${a.getUTCFullYear()} – ${tag(b)}. ${monat(b)} ${b.getUTCFullYear()}`;
}
