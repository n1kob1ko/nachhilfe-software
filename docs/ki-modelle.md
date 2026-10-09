# KI über OpenRouter: Modelle, Kosten, Test

Stand: 9. Oktober 2026. Preise von openrouter.ai, in US-Dollar je 1 Million Tokens (Eingabe / Ausgabe).

## Einrichtung

In Railway unter Variables reicht `OPENROUTER_API_KEY`. Ist nur dieser Schlüssel gesetzt (kein `ANTHROPIC_API_KEY`), laufen alle KI-Bereiche über OpenRouter mit den Standardmodellen unten. Der Schlüssel bleibt auf dem Server: Er wird nur im Adapter `lib/ai/providers/openai-compatible.ts` als `Authorization`-Kopfzeile gesendet, nie an den Browser, nie ins Protokoll (`ai_calls` speichert nur Zahlen, Fehlertexte enthalten nur die Antwort des Anbieters).

Wer ein anderes Modell will, setzt `AI_<BEREICH>_MODEL` (z. B. `AI_TEXT_MODEL=anthropic/claude-sonnet-5.5`). Keine Code-Änderung nötig.

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

## Budget

`AI_MONTHLY_BUDGET_EUR`, Standard 10 €. Umgerechnet mit `AI_USD_PER_EUR` (Standard 1,12, Kurs vom 8. Oktober 2026), weil die Anbieter in US-Dollar abrechnen. Ab 80 % (`AI_BUDGET_WARN`) zeigt Mehr › KI-Kosten eine Warnung, ab 100 % läuft kein kostenpflichtiger Aufruf mehr; die App arbeitet mit Generatoren und Messwerten weiter. Eine einzelne Anfrage, die kurz vor der Grenze startet, kann sie um wenige Cent überschreiten.

Gegen doppelte Aufrufe: gleiche Anfragen kommen aus dem Speicher, laufende werden nicht doppelt gestellt, nach drei Fehlern pausiert die KI fünf Minuten, Aufgaben nur auf Klick.

## KI testen

Mehr › KI-Kosten › KI testen (nur Administration). Zuerst eine winzige Anfrage; antwortet der Anbieter, folgen drei echte Anfragen mit erfundenen Daten:

1. Deutsch, Wortarten, 3. Klasse Volksschule: Es dürfen nur Nomen, Verb und Adjektiv vorkommen, keine Platzhalter-Lösungen.
2. Mathematik, Gleichungen, 3. Klasse Mittelschule: eine Gleichung mit Rechenweg und eine Sachaufgabe; die App rechnet beide nach.
3. Textkorrektur eines kurzen Volksschultexts mit vier eingebauten Fehlern.

Angezeigt werden Modell, Dauer, Kosten und die Aufgaben selbst. Aufgaben, die die Prüfung der App nicht bestehen, stehen mit dem Grund dabei („Verworfen: …“, bei Rechenwegen mit Angabe, Ergebnis und Lösungsweg der KI). Zusammen meist unter 5 Cent; die Kosten zählen zum Budget. Die Ergebnisse stehen auch im Server-Protokoll (`[KI-Selbsttest]`, ohne Schlüssel und ohne Schülerdaten).
