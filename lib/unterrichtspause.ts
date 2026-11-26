import { db } from "./db";

/**
 * Läuft gerade Unterricht? Für das Warten vor einem Update (scripts/warte-auf-pause.mjs): ein Update startet den
 * Server neu, die Seiten sind dann gut eine Minute weg (502), und offene Tablets zeigen die alte Version.
 *
 * Unterricht = eine gestartete Einheit, in der in den letzten `aktivMin` Minuten etwas passiert ist. Eine vergessene
 * Einheit ohne Aktivität hält ein Update also nicht auf.
 */
export function unterrichtLaeuft(jetzt = Date.now(), aktivMin = 20): boolean {
  const seit = new Date(jetzt - aktivMin * 60_000).toISOString();
  const r = db()
    .prepare("SELECT COUNT(*) AS n FROM units WHERE status = 'gestartet' AND last_activity_at >= ?")
    .get(seit) as { n: number };
  return r.n > 0;
}
