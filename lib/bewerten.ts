/**
 * Die Lehrerbewertung einer offenen Antwort (Gemeinsame Bewertung, C3): Richtig, Teilweise oder Falsch, gleich ob in „Zu bewerten“
 * (lib/zu-bewerten.ts) oder auf der Ergebnis-Seite getippt. Sie schreibt genau, was die Bewertung immer schreibt (lib/service.ts
 * `reviewAnswer`: die Antwort zählt ab jetzt für den Lernstand, die Selbstständig-Dokumentation wird neu geschrieben), und in einer
 * beendeten Einheit dazu Bericht und Abschluss neu (lib/abschluss.ts `bewertungInDoku`), damit „Bewertung offen“ stimmt.
 */
import { bewertungInDoku } from "./abschluss";
import type * as repo from "./repo";
import { reviewAnswer } from "./service";

export function bewerteAntwort(attemptId: number, review: string, teacherId: number): { ok: true; attempt: repo.Attempt } | { error: string } {
  const res = reviewAnswer(attemptId, review, teacherId);
  if ("error" in res) return res;
  if (res.attempt.unit_id) bewertungInDoku(res.attempt.unit_id);
  return res;
}
