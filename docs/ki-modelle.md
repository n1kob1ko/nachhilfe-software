# KI-Anbieter: Anthropic, OpenRouter, Modelle, Kosten, Test

## Anbieterwahl (seit 18. Oktober 2026)

Auf Mehr › KI-Kosten wählt die Administration, wer die KI-Anfragen beantwortet: **Anthropic** (Claude direkt, Standard), **OpenRouter** oder **Manuell** (`docs/ki-manuell.md`). Die Wahl steht in `app_settings` (`ki_modus`, `lib/ai/modus.ts`) und gilt für alle Bereiche. `AI_PROVIDER` und `AI_<BEREICH>_PROVIDER` haben weiter Vorrang.

- Fehlt dem gewählten Anbieter der Schlüssel, ist die KI aus. Es wird nie von selbst auf einen anderen Anbieter umgeschaltet.
- Anthropic: Schlüssel `ANTHROPIC_API_KEY` in Railway. Alle Bereiche laufen auf `claude-sonnet-5-5` (2 $ / 10 $ je 1 Mio. Tokens). Der Schlüssel bleibt im Adapter `lib/ai/providers/anthropic.ts` (SDK), nie im Browser, nie im Protokoll.
- Ein Modell aus `AI_<BEREICH>_MODEL` oder `AI_MODEL_FAST/STANDARD/DEEP` gilt nur beim Anbieter, zu dem es passt (`fitModel` in `lib/ai/config.ts`): `AI_TEXT_MODEL=anthropic/claude-sonnet-5.5` gilt bei OpenRouter so und wird bei Anthropic zu `claude-sonnet-5-5`.
- Budget: Anthropic hat ein eigenes Monatsbudget von 90 $ (`ANTHROPIC_MONTHLY_BUDGET_USD`), weil die monatlichen 100 $ Anthropic-Credits nicht in den nächsten Monat übergehen; 10 $ bleiben Puffer. OpenRouter und alle anderen Anbieter teilen das allgemeine Budget von 10 € (`AI_MONTHLY_BUDGET_EUR`). Beide beginnen am 1. des Monats neu, warnen ab 80 % und stoppen bei 100 % nur ihre eigenen Anbieter.
- Protokoll: Jede Zeile in `ai_calls` hat den Anbieter, die Tokens, wie der Anbieter sie meldet (Eingabe, Cache schreiben, Cache lesen, Ausgabe und davon Denken), und die Kosten. Bei Anthropic sind das die gemeldeten Tokens mal Preisliste (so rechnet Anthropic ab), bei OpenRouter der gemeldete Preis. Auch eine Antwort, die nicht passt oder abgeschnitten ist, wird mit ihren Tokens gezählt. Mehr › KI-Kosten zeigt je KI-Funktion die Kosten „Ø je Aufruf“.
- Der Anthropic-Adapter behandelt Antworten wie der OpenRouter-Adapter: Ein Antwortformat mit mehr als 16 Feldern, die leer sein dürfen, steht in der Anleitung statt als Structured Output; kleine Abweichungen repariert `parseLenient`; lehnt die API das Format ab (400), fragt er einmal mit dem Format in der Anleitung nach.

## OpenRouter

Stand: 9. Oktober 2026. Preise von openrouter.ai, in US-Dollar je 1 Million Tokens (Eingabe / Ausgabe).

### Einrichtung

In Railway unter Variables `OPENROUTER_API_KEY` setzen und auf Mehr › KI-Kosten „OpenRouter“ wählen. Dann laufen alle KI-Bereiche über OpenRouter mit den Standardmodellen unten. Der Schlüssel bleibt auf dem Server: Er wird nur im Adapter `lib/ai/providers/openai-compatible.ts` als `Authorization`-Kopfzeile gesendet, nie an den Browser, nie ins Protokoll (`ai_calls` speichert nur Zahlen, Fehlertexte enthalten nur die Antwort des Anbieters).

Wer ein anderes Modell will, setzt `AI_<BEREICH>_MODEL` (z. B. `AI_TEXT_MODEL=anthropic/claude-sonnet-5.5`). Keine Code-Änderung nötig.

## Lokale Modelle (Ollama)

Ein Modell auf dem eigenen Rechner braucht keinen Schlüssel und kostet nichts. Ollama spricht unter `http://127.0.0.1:11434/v1` dieselbe Schnittstelle wie ein OpenAI-kompatibler Anbieter, deshalb genügt der vorhandene Anbieter `compatible` (`lib/ai/providers/openai-compatible.ts`) — ein eigener Anbieter oder Adapter ist nicht nötig.

```
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
AI_PROVIDER=compatible
AI_MODEL_FAST=llama3.2
AI_MODEL_STANDARD=llama3.2
AI_MODEL_DEEP=llama3.2
```

- `OLLAMA_BASE_URL` ist die Adresse des Servers (mit `/v1`); die App ruft `<Adresse>/chat/completions` auf.
- `AI_PROVIDER=compatible` gehört dazu: ohne diese Angabe wählt die App weiter Anthropic bzw. OpenRouter.
- `AI_MODEL_*` nennt einen Modellnamen aus `ollama list` (z. B. `llama3.2`, `qwen2.5:7b`); für `compatible` gibt es keinen Standardnamen. Statt der drei Tarife geht auch `AI_<BEREICH>_MODEL`, z. B. `AI_EXERCISE_MODEL`.
- Ein Schlüssel wird nicht verlangt: `hasKey("compatible")` gilt als erfüllt, sobald `OLLAMA_BASE_URL` gesetzt ist (`isLocalModel` in `lib/ai/config.ts`).
- **Kosten:** Der Aufruf wird mit 0 $ verbucht und zählt nicht gegen das Budget; ein aufgebrauchtes Budget hält ein lokales Modell nicht auf. Ein Modell, das `ollama/…` heißt, steht mit Nullpreis auch in der Preistabelle (`AI_PRICES_JSON`-Vorgabe in `lib/ai/config.ts`).
- Sagt ein älteres Ollama bei `response_format` einen Fehler, hilft `AI_COMPATIBLE_JSON_SCHEMA=0`: die App stellt die Antwortform dann in die Anleitung statt in die Anfrage.
- Was ein lokales Modell kann, sagt der Qualitätstest (Mehr › KI-Kosten › Qualitätstest): kleine Modelle liefern das JSON-Schema der App oft nicht zuverlässig. Die App prüft jede Antwort weiterhin selbst und fällt ohne brauchbare Antwort auf die eingebauten Generatoren zurück.

## Standardmodelle

| Bereich | Modell | Preis | Warum |
| --- | --- | --- | --- |
| Aufgaben (einfache Übungen, Mathematik, Leseverständnis) | `anthropic/claude-haiku-5.5` | 0,10 / 0,50 | Günstigstes Modell mit Anthropic-Qualität, liefert das JSON-Schema der App zuverlässig, denkt bei Aufgaben mit (`reasoning`). Mathematik prüft die App selbst nach (jede Rechenzeile, `checkOwnSolution`), Wortarten ebenso (`checkWortartTask`). |
| Auswertung, Fehler erklären, Freitext bewerten, Echtzeit | `anthropic/claude-haiku-5.5` | 0,10 / 0,50 | Kurze Antworten, schnell; die Echtzeit-Analyse braucht Antworten unter 8 s. |
| Textkorrektur | `anthropic/claude-haiku-5.5` | 0,10 / 0,50 | Die Lehrkraft prüft jeden Vorschlag einzeln. Zeigt der Test Schwächen (übersehene Fehler, falsche Regeln), auf `anthropic/claude-sonnet-5.5` umstellen: etwa 20-mal teurer, pro Text rund 3 Cent. |
| Material (Fotos, PDFs) | `anthropic/claude-haiku-5.5` | 0,10 / 0,50 | Liest Bilder und PDFs; viele günstige Modelle lesen keine PDFs. |
| Tiefenanalyse (nur auf Klick) | `anthropic/claude-sonnet-5.5` | 2 / 10 | Selten, braucht gründliches Abwägen; etwa 5 Cent pro Analyse. |

Antwortformat: Die App schickt die erwartete JSON-Form als `json_schema` mit. Anthropic-Modelle lehnen Formen mit mehr als 16 Feldern ab, die leer sein dürfen (das Aufgabenformat hat 23). Diese Form steht dann in der Anleitung; die App prüft jede Antwort trotzdem gegen die Form und ergänzt fehlende leere Felder. Lehnt ein anderes Modell die Form ab, fragt die App einmal mit der Form in der Anleitung nach.

Verglichen, nicht gewählt:

| Modell | Preis | Grund |
| --- | --- | --- |
| `openai/gpt-6-luna` | 0,10 / 0,50 | Gleicher Preis, liest auch PDFs; kein Vorteil, die Prompts der App sind mit Claude erprobt. Gute Ausweichmöglichkeit. |
| `deepseek/deepseek-v4.1-flash` | 0,15 / 0,60 beim Hersteller | Billiger nur bei Anbietern mit stark verkleinerten Modellen (fp4/fp8), Qualität schwankt je nach Anbieter; liest keine PDFs. |
| `qwen/qwen3.8-omni-flash` | 0,15 / 0,47 | Liest keine PDFs, nicht billiger. |
| `google/gemini-2.5-flash` | 0,30 / 2,50 | Teurer und älter. |

## Was es ungefähr kostet (Haiku 5.5)

| Vorgang | Tokens etwa | Kosten etwa |
| --- | --- | --- |
| Übung mit 6 Aufgaben | 3 000 ein / 6 000 aus | 0,3 Cent |
| Textkorrektur, 300 Wörter | 2 000 ein / 2 000 aus | 0,1 Cent |
| Einheit von 60 Minuten mit Echtzeit-Hinweisen | 35 000 ein / 6 000 aus | 0,7 Cent |
| Tiefenanalyse (Sonnet 5.5) | 5 000 ein / 4 000 aus | 5 Cent |

Gerechnet wird mit dem Preis, den OpenRouter für jede Anfrage meldet (`usage.cost`), nicht mit einer Schätzung.

Gemessen im Live-Test am 9. Oktober 2026 (KI testen):

| Anfrage | Modell | Dauer | Kosten |
| --- | --- | --- | --- |
| Verbindungstest | Haiku 5.5 | 1 s | unter 0,01 Cent |
| Deutsch, 2 Aufgaben | Haiku 5.5 | 31 s | 0,4 Cent |
| Mathematik, 2 Aufgaben | Haiku 5.5 | 21 s | 0,3 Cent |
| Textkorrektur, 3 Sätze | Sonnet 5.5 (`AI_TEXT_MODEL`) | 7 s | 1,4 Cent, 4 von 4 Fehlern |
| Textkorrektur, 3 Sätze (alter Testsatz mit „Hunt“) | Haiku 5.5 | 11 s | 0,1 Cent, 3 von 4 Fehlern wie Sonnet |

## Budget

Anthropic: eigenes Budget `ANTHROPIC_MONTHLY_BUDGET_USD`, Standard 90 $ (siehe Anbieterwahl oben). OpenRouter und die anderen Anbieter: `AI_MONTHLY_BUDGET_EUR`, Standard 10 €. Umgerechnet mit `AI_USD_PER_EUR` (Standard 1,12, Kurs vom 8. Oktober 2026), weil die Anbieter in US-Dollar abrechnen. Ab 80 % (`AI_BUDGET_WARN`) zeigt Mehr › KI-Kosten eine Warnung, ab 100 % läuft kein kostenpflichtiger Aufruf mehr; die App arbeitet mit Generatoren und Messwerten weiter. Eine einzelne Anfrage, die kurz vor der Grenze startet, kann sie um wenige Cent überschreiten.

Gegen doppelte Aufrufe: gleiche Anfragen kommen aus dem Speicher, laufende werden nicht doppelt gestellt, nach drei Fehlern pausiert die KI fünf Minuten, Aufgaben nur auf Klick.

## KI testen

Mehr › KI-Kosten › KI testen (nur Administration). Zuerst eine winzige Anfrage; antwortet der Anbieter, folgen drei echte Anfragen mit erfundenen Daten:

1. Deutsch, Wortarten, 3. Klasse Volksschule: Es dürfen nur Nomen, Verb und Adjektiv vorkommen, keine Platzhalter-Lösungen.
2. Mathematik, Gleichungen, 3. Klasse Mittelschule: eine Gleichung mit Rechenweg und eine Sachaufgabe; die App rechnet beide nach.
3. Textkorrektur eines kurzen Volksschultexts mit vier eingebauten Fehlern.

Angezeigt werden Modell, Dauer, Kosten und die Aufgaben selbst. Aufgaben, die die Prüfung der App nicht bestehen, stehen mit dem Grund dabei („Verworfen: …“, bei Rechenwegen mit Angabe, Ergebnis und Lösungsweg der KI). Zusammen meist unter 5 Cent; die Kosten zählen zum Budget. Die Ergebnisse stehen auch im Server-Protokoll (`[KI-Selbsttest]`, ohne Schlüssel und ohne Schülerdaten).

## KI-Qualitätstest

Mehr › KI-Kosten › Qualitätstest starten (nur Administration). Prüft, wie gut die KI für den Unterricht ist, nicht nur, ob sie antwortet: 20 Unterrichtssituationen von der Volksschule bis zur Oberstufe (Fälle in `lib/ai/qualitaetstest-faelle.ts`), jede über dieselben Funktionen und Prüfungen wie in der App, nur mit erfundenen Daten. Dazu Vergleiche für Tempo (ohne Nachdenken, weniger Nachdenken, eine Anfrage je Aufgabe, „Passende Aufgabe senden“, 10 Aufgaben) und Modell (Sonnet statt Haiku bei schwierigen Mathe-Aufgaben, Haiku statt Sonnet bei der Textkorrektur). Diese Einstellungen gelten nur innerhalb des Tests (`withAIOverride` im Router); die App selbst ändert sich nicht.

Für die Textkorrektur sind die eingebauten Fehler und richtige österreichische Formen (Jause, heuer, Jänner, Paradeiser …) hinterlegt; der Test zählt gefundene Fehler und fälschlich markierte richtige Stellen.

Läuft im Hintergrund, meist 5 bis 10 Minuten. Höchstens 1 €: Vor jedem Fall rechnet der Test aus, was er im schlimmsten Fall kosten könnte, und überspringt ihn, wenn die Grenze sonst überschritten werden könnte. Die Kosten zählen zum Budget (Auslöser `qualitaet-<Nr>` in `ai_calls`). Jede Aufgabe, Frage und Markierung steht im Server-Protokoll als `[KI-Qualitaetstest] <Nr> <Teil> {json}`, lange Zeilen in nummerierten Teilen; dazu Modell, Dauer, Tokens, Denk-Tokens und Kosten jedes Aufrufs.
