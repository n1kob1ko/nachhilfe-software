/**
 * Gespeicherte Antworten der KI (Tabelle `ai_cache`): dieselbe Anfrage wird nicht zweimal bezahlt, auch nicht nach
 * einem Neustart. Der Router (lib/ai/router.ts) fragt hier nach, wo er eine Antwort ohnehin wiederverwendet
 * (`reuseMs` der Funktion > 0), und legt jede neue Antwort solcher Funktionen hier ab.
 *
 * Der Schlüssel ist der Fingerabdruck des Routers: sha256 über Funktion, Anbieter, Modell, Systemprompt (mit den
 * KI-Hinweisen), den vollständigen Prompt und den Schüler der Anfrage. Eine Antwort für einen Schüler kommt so nie
 * bei einem anderen an, auch wenn der Prompt gleich wäre. Jede Zeile läuft nach dem Fenster der Funktion ab
 * (`reuseMs`, höchstens 24 Stunden); Abgelaufenes wird beim nächsten Speichern gelöscht.
 *
 * Ein Fehler der Datenbank stoppt nie eine KI-Anfrage: dann wird eben gefragt (oder nichts gespeichert).
 */
import { db } from "../db";

export type Gespeichert = { at: number; data: unknown };

/** Die gespeicherte Antwort zu `key`, wenn sie nach `seit` entstand und noch nicht abgelaufen ist. */
export function ladeAntwort(key: string, seit: number, jetzt: number): Gespeichert | null {
  try {
    const r = db().prepare("SELECT data, created_at FROM ai_cache WHERE key = ? AND created_at > ? AND expires_at > ?").get(key, seit, jetzt) as { data: string; created_at: number } | undefined;
    return r ? { at: r.created_at, data: JSON.parse(r.data) } : null;
  } catch {
    return null;
  }
}

export function speichereAntwort(e: { key: string; fn: string; model: string; studentId: number | null; data: unknown; at: number; gueltigMs: number }) {
  try {
    const conn = db();
    conn.prepare("DELETE FROM ai_cache WHERE expires_at <= ?").run(e.at);
    conn
      .prepare(
        `INSERT INTO ai_cache (key, fn, model, student_id, data, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET data = excluded.data, created_at = excluded.created_at, expires_at = excluded.expires_at`,
      )
      .run(e.key, e.fn, e.model, e.studentId, JSON.stringify(e.data), e.at, e.at + e.gueltigMs);
  } catch {
    // ohne Speicher gilt nur der im Arbeitsspeicher
  }
}

/** Eine Antwort, die der Aufrufer unbrauchbar fand: die nächste gleiche Anfrage fragt die KI neu. */
export function vergiss(key: string) {
  try {
    db().prepare("DELETE FROM ai_cache WHERE key = ?").run(key);
  } catch {
    // nichts zu tun
  }
}

/** Alles weg (Tests, 60-Minuten-Simulation). */
export function leereSpeicher() {
  try {
    db().prepare("DELETE FROM ai_cache").run();
  } catch {
    // nichts zu tun
  }
}
