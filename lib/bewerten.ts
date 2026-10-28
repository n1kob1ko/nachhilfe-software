/**
 * Die Lehrerbewertung einer offenen Antwort (Gemeinsame Bewertung, C3): Richtig, Teilweise oder Falsch, gleich ob in „Zu bewerten“
 * (lib/zu-bewerten.ts) oder auf der Ergebnis-Seite getippt. Sie schreibt genau, was die Bewertung immer schreibt (lib/service.ts
 * `reviewAnswer`: die Antwort zählt ab jetzt für den Lernstand, die Selbstständig-Dokumentation wird neu geschrieben), und in einer
 * beendeten Einheit dazu Bericht und Abschluss neu (lib/abschluss.ts `bewertungInDoku`), damit „Bewertung offen“ stimmt; bei einer
 * Hausübung den Abschluss der Einheit, in die sie gehört (`hausuebungInDoku`).
 */
import { bewertungInDoku, hausuebungInDoku } from "./abschluss";
import type * as repo from "./repo";
import { reviewAnswer } from "./service";

export function bewerteAntwort(attemptId: number, review: string, teacherId: number): { ok: true; attempt: repo.Attempt } | { error: string } {
  const res = reviewAnswer(attemptId, review, teacherId);
  if ("error" in res) return res;
  if (res.attempt.unit_id) bewertungInDoku(res.attempt.unit_id);
  // an answer of a homework (no unit): the Abschluss that names this homework (lib/hausuebung-zurueck.ts)
  else hausuebungInDoku(res.attempt.assignment_id);
  return res;
}
