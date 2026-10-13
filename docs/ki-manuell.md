# Manueller KI-Modus

Phase 6, Schritt 1 des Merges ([tommys-merge.md](../tommys-merge.md) §2 D8, ADR 0009). Der Begriff
steht in [CONTEXT.md](../CONTEXT.md): **manueller KI-Modus**. Der Vorgang geht auf `ManualExchange.tsx`
und `manual-prompt.ts` der Quelle zurück; hier ist daraus ein Anbieter im Router geworden
(`lib/ai/providers/manual.ts`), damit jede KI-Funktion der App ihn ohne zweiten Codepfad benutzen kann.

Ein Betrieb **ohne Anfrage nach außen**: Die App zeigt den vollständigen Prompt zum Kopieren, die
Lehrkraft fügt den Prompt in ein Modell ihrer Wahl ein und die Antwort zurück in die App. Es geht
nichts hinaus und es entstehen keine Kosten. Die Antwort durchläuft dieselbe Reparatur und Prüfung wie
eine Antwort über die API — für den Rest der App ist sie von einer echten nicht zu unterscheiden.

| Bereich | Ort |
| --- | --- |
| Anbieter (Register, Prompt, Prüfung der Antwort) | `lib/ai/providers/manual.ts` |
| Auswahl und Frist | `lib/ai/config.ts` (`MANUAL_MODEL`, `MANUAL_TIMEOUT_MS`, `routeFor`) |
| Ausschluss von Budget und Notschalter | `lib/ai/router.ts` (`runAI`) |
| Einstellung `ki_modus` | `lib/ai/modus.ts`, `app_settings` |
| Bedienung | `components/ai/ManualAustausch.tsx`, `components/ai/KiModusSchalter.tsx` |
| Kleine Schnittstelle zum Nachfragen | `app/api/ki-manuell/route.ts` (GET, POST, DELETE) |
| Prüfung | `lib/ai-manuell.test.ts` |

## Einschalten

Drei Wege, in dieser Reihenfolge gilt der erste, der etwas sagt:

| Weg | Geltung |
| --- | --- |
| `AI_PROVIDER=manual` (Railway, Variables) | alle Bereiche ohne eigenen Eintrag |
| `AI_<BEREICH>_PROVIDER=manual`, z. B. `AI_EXERCISE_PROVIDER=manual` | nur dieser Bereich (REALTIME, EXERCISE, ANALYSIS, DEEP, MATERIAL, TEXT) |
| Schalter „Manueller KI-Modus“ auf **Mehr › KI-Kosten** | alle Bereiche ohne Vorgabe in den Umgebungsvariablen |

Der Schalter schreibt `ki_modus` in `app_settings` (Wert `manual` oder `api`) und ist nur für die
Administration sichtbar und bedienbar. Umgebungsvariablen haben immer Vorrang: Steht
`AI_EXERCISE_PROVIDER=anthropic`, bleibt der Bereich „Aufgaben“ bei Anthropic, auch wenn der Schalter an
ist. `AI_DISABLED` schaltet die KI weiterhin ganz ab, auch den manuellen Modus.

Ein Schlüssel ist nicht nötig: `providerReady("manual")` ist ohne jeden Schlüssel `true`, als Modell
steht `manuell` im Protokoll. Die Seite Mehr › KI-Kosten zeigt dann „an (manueller Modus: Prompt
kopieren, Antwort einfügen)“ statt „aus: kein Schlüssel hinterlegt“.

## Der Ablauf

1. Eine Aktion der Lehrkraft ruft wie immer `runAI` auf. Der Router wählt den Anbieter `manual`.
2. **Statt zu senden wird die Anfrage geparkt.** Der Transport legt sie in ein prozessweites Register
   und gibt ein Versprechen zurück, das offen bleibt. Die aufrufende Server-Aktion wartet weiter — der
   Builder, das Druckblatt oder das Leseverständnis brauchen keinen zweiten Weg für die Antwort.
3. Die Oberfläche (über dem laufenden Vorgang) holt die offenen Anfragen im Sekundentakt über
   `GET /api/ki-manuell` und zeigt den **vollständigen Prompt** mit Knopf zum Kopieren. Ein
   Routen-Handler und keine Server-Aktion ist hier Absicht: Die auslösende Aktion ist noch offen,
   während kopiert und eingefügt wird, also muss der Browser daneben abfragen und die Anfrage
   nachträglich abschließen können.
4. Der Prompt enthält die Systemanweisung, das verlangte JSON-Schema und den Aufgabentext. Er ist
   **namensgeschützt**: `detectNames` findet die Namen, `namePattern`/`maskText` ersetzen sie durch
   `[Name]` — dieselben Funktionen, die den Text auch beim Senden maskieren. Angezeigt wird genau das,
   was sonst hinausgehen würde.
5. Die Lehrkraft fügt die ganze Antwort des Modells ein (Vorrede, Codezaun und Nachsatz sind
   erlaubt). `POST /api/ki-manuell` nimmt sie entgegen und prüft sie mit **derselben** Kette wie eine
   API-Antwort: erst das JSON aus dem Text holen (`extractJsonText`; entfernt auch die Denkspur, die
   manche Modelle in `think`-Blöcke schreiben), dann reparieren (`parseLenient`: Zahl als Text, fehlende
   leere Felder, Groß- und Kleinschreibung bei Auswahlwerten), dann gegen das Schema der Anfrage
   prüfen. Ist sie gültig, wird die geparkte Anfrage aufgelöst und die wartende Aktion läuft mit dem
   Ergebnis weiter.
6. Passt die Antwort nicht, kommt ein deutscher Grund zurück und die Anfrage **bleibt offen** — die
   Lehrkraft kann es noch einmal versuchen. Der Grund steht bis zur nächsten Annahme an der Anfrage.

## Nichts geht hinaus, nichts wird verrechnet

- **Keine Anfrage**: Der Transport sendet nichts. Es gibt keinen Anbieter-Aufruf, keinen Schlüssel und
  keine Verbindung nach außen — nur das Register im Serverprozess.
- **Keine Kosten**: Die Antwort wird mit `usage: 0` und `costUsd: 0` verbucht. Im Protokoll `ai_calls`
  steht die Zeile mit `cost_usd = 0`, Modell `manuell`, Status `ok`; die Monatssumme auf Mehr ›
  KI-Kosten wächst nicht.
- **Budget und Notschalter gelten nicht**: `runAI` überspringt für `manual` sowohl den Notschalter
  (drei Fehlschläge in Folge) als auch die Budgetprüfung. Ein aufgebrauchtes Monatsbudget oder ein
  pausierter Anbieter hält den manuellen Modus also nicht auf; umgekehrt zählt eine verworfene oder
  abgelaufene manuelle Anfrage **nicht** als Ausfall des Anbieters.
- **Wiederholungen wie sonst**: Eine identische Anfrage innerhalb der Merkzeit der Funktion wird aus
  dem Gedächtnis beantwortet und gar nicht erst geparkt.

## Frist, Abbruch, Seite verlassen

Die Frist ist `MANUAL_TIMEOUT_MS` = **30 Minuten**, nicht die Zeit der Funktion (8 s bis 180 s): Ein
Kopier- und Einfüge-Weg dauert Minuten, keine Sekunden. `runAI` setzt diese Frist an die Stelle der
eigenen Zeitvorgabe, und die geparkte Anfrage kennt ihr Ende (`expiresAt`).

| Fall | Was passiert |
| --- | --- |
| Die Lehrkraft fügt rechtzeitig eine gültige Antwort ein | Die Aktion läuft mit dem Ergebnis weiter. |
| Die Lehrkraft geht weg, die Zeit läuft ab | Die Anfrage wird beim nächsten Abruf als abgelaufen verworfen; die wartende Aktion endet mit „keine verwertbare Antwort“ (kein Hängen). |
| Die Lehrkraft verwirft die Anfrage von Hand | Die wartende Aktion endet sofort mit demselben Ergebnis. |
| Die Seite wird verlassen | Die Oberfläche schickt beim `pagehide` ein `DELETE /api/ki-manuell?id=…`, damit keine Server-Aktion offen bleibt. |

Ein zweiter Abbruch oder eine Antwort nach dem Schluss sind wirkungslos: Jede Anfrage wird genau
einmal beendet und dabei aus dem Register entfernt.

## Grenzen

- **Keine Bilder, keine PDFs.** Ein Chatfenster hat hier keinen Anhang: Die Lehrkraft kann Text
  kopieren und Text zurückgeben. Eine Anfrage mit Bild oder PDF wird gar nicht erst geparkt, sondern
  mit „Manuell (Prompt kopieren) kann keine Bilder lesen.“ abgelehnt (ein Einstellungsfehler, kein
  Ausfall).
- **Eine Anfrage zur Zeit.** Die Oberfläche zeigt die älteste offene Anfrage und arbeitet sie ab,
  bevor die nächste erscheint; zu jeder wartenden Aktion gehört genau eine geparkte Anfrage.
- **Die eingefügte Antwort muss zur Form passen.** Toleriert werden Vorrede, Codezaun, Denkspur und
  die üblichen kleinen Abweichungen; fehlt das JSON ganz oder widerspricht es dem Schema, wird nichts
  übernommen. Ein Modell, das nur Prosa antwortet, ist unbrauchbar — deshalb steht das Schema im
  kopierten Prompt.
- **Der Text wird so kopiert, wie die App ihn senden würde.** Kürzen oder Umschreiben des Prompts ist
  möglich, kostet aber die Zusicherungen der App (Namensschutz, Feldnamen, Schema).

## Prüfen

`lib/ai-manuell.test.ts` fährt den ganzen Weg ohne Netz und ohne Schlüssel: Parken, vollständiger
Prompt, gültige, unbrauchbare und reparierbare Antworten, Abbruch, 30-Minuten-Frist, Namensmaske,
Auswahl über Umgebungsvariablen und `ki_modus`, Nullkosten im Protokoll, das Verhalten bei
aufgebrauchtem Budget und pausiertem Anbieter sowie `extractJsonText`. Jede Antwort darin ist ein
selbst geschriebenes Beispiel.
