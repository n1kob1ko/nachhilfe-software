/**
 * **Datum in der Lehrer-Oberfläche** (F0b, Phase-E-Bericht: „fällig 28. Okt.“ im Profil, „Mi 28.10.“ sonst): eine Schreibweise,
 * österreichisch und kurz. Kurz „Mi 28.10.“ (ohne Wochentag „28.10.“), lang „28.10.2026“. Der Tag ist immer der Kalendertag in
 * Wien (lib/planung/zeit.ts). Ohne Server-Import, auch im Browser nutzbar.
 *
 * Eingabe: ein Kalenderdatum „2026-10-28“, eine lokale Zeit ohne Zone „2026-10-28T14:00“ (so speichert die Planung), ein
 * SQLite-Zeitstempel „2026-10-28 13:00:00“ (UTC), eine ISO-Zeit mit Zone, eine Zahl (ms) oder ein Date.
 */
import { wienerDatum, wochentagVon, WOCHENTAG_KURZ, WOCHENTAG_LANG } from "./planung/zeit";

export type DatumEingabe = string | number | Date;

/** Der Kalendertag in Wien als „YYYY-MM-DD“; null, wenn die Eingabe kein Datum ist. */
export function kalendertag(d: DatumEingabe): string | null {
  if (typeof d === "string") {
    const s = d.trim();
    // a calendar day, or a local time without zone (the planning stores these): its day as written
    if (/^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/.test(s) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) return s.slice(0, 10);
    // SQLite datetime('now'): UTC without zone
    const ms = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s) ? Date.parse(`${s.replace(" ", "T")}Z`) : Date.parse(s);
    return Number.isNaN(ms) ? null : wienerDatum(new Date(ms));
  }
  const ms = typeof d === "number" ? d : d.getTime();
  return Number.isNaN(ms) ? null : wienerDatum(new Date(ms));
}

/** „28.10.“ */
export function tagMonat(d: DatumEingabe): string {
  const t = kalendertag(d);
  return t ? `${Number(t.slice(8, 10))}.${Number(t.slice(5, 7))}.` : "";
}

/** „Mi 28.10.“; `lang`: „Mittwoch, 28.10.“ */
export function datumKurz(d: DatumEingabe, o: { wochentag?: "kurz" | "lang" | false } = {}): string {
  const t = kalendertag(d);
  if (!t) return "";
  const w = o.wochentag ?? "kurz";
  if (!w) return tagMonat(t);
  return w === "lang" ? `${WOCHENTAG_LANG[wochentagVon(t)]}, ${tagMonat(t)}` : `${WOCHENTAG_KURZ[wochentagVon(t)]} ${tagMonat(t)}`;
}

/** „28.10.2026“; mit Wochentag „Mi 28.10.2026“ */
export function datumLang(d: DatumEingabe, o: { wochentag?: "kurz" | "lang" | false } = {}): string {
  const t = kalendertag(d);
  if (!t) return "";
  const tag = `${tagMonat(t)}${t.slice(0, 4)}`;
  if (!o.wochentag) return tag;
  return o.wochentag === "lang" ? `${WOCHENTAG_LANG[wochentagVon(t)]}, ${tag}` : `${WOCHENTAG_KURZ[wochentagVon(t)]} ${tag}`;
}

/**
 * Für `formatDate` (components/ui.tsx): dieselben Optionen wie bisher, aber immer in Zahlen. Mit Jahr lang („28.10.2026“), sonst kurz
 * („28.10.“); mit Wochentag davor („Mi 28.10.“, „Mittwoch, 28.10.“). Nur Monat und Jahr („Oktober 2026“) bleibt ausgeschrieben.
 */
export function datumWieOptionen(d: DatumEingabe, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  const wochentag = opts.weekday === "long" ? "lang" : opts.weekday ? "kurz" : false;
  if (!opts.day) {
    const t = kalendertag(d);
    if (!t) return "";
    return new Date(`${t}T12:00:00Z`).toLocaleDateString("de-AT", { month: opts.month ?? "long", ...(opts.year ? { year: opts.year } : {}), timeZone: "UTC" });
  }
  const tag = opts.year ? datumLang(d, { wochentag }) : datumKurz(d, { wochentag });
  return opts.hour && tag ? `${tag}, ${uhrzeit(d)}` : tag;
}

/** „14:05“ in Wien; leer für ein Kalenderdatum ohne Uhrzeit. Eine lokale Zeit ohne Zone (die Planung) gilt, wie sie dasteht. */
export function uhrzeit(d: DatumEingabe): string {
  if (typeof d === "string") {
    const s = d.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
    const lokal = /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})(:\d{2}(\.\d+)?)?$/.exec(s) ?? /^\d{4}-\d{2}-\d{2} (\d{2}:\d{2})$/.exec(s);
    if (lokal) return lokal[1];
    const ms = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s) ? Date.parse(`${s.replace(" ", "T")}Z`) : Date.parse(s);
    return Number.isNaN(ms) ? "" : new Date(ms).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" });
  }
  const ms = typeof d === "number" ? d : d.getTime();
  return Number.isNaN(ms) ? "" : new Date(ms).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" });
}
