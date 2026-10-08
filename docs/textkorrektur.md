# KI-Textkorrektur (Lernheft Phase 3)

Ein Schüler schreibt eine Erlebniserzählung, einen Bericht, einen Beschwerdebrief oder eine Textinterpretation. Nach der Abgabe korrigiert der Lehrer den Text, wahlweise mit KI-Vorschlägen. Der Originaltext bleibt immer unverändert. Jede Änderung gilt erst, wenn der Lehrer sie übernimmt.

## Ablauf

1. **Öffnen.** Text öffnen (`/texte/<id>`) und auf „Korrigieren“ klicken. Die Korrekturseite liegt unter `/texte/<id>/korrektur`.
2. **Starten.** Es gibt zwei Wege:
   - **„Mit KI korrigieren“** öffnet zuerst die Freigabe. Sie zeigt, was gesendet wird und was nicht, den Empfänger (Anbieter und Modell) und die geschätzten Kosten. Mit „Gesendeten Text ansehen“ sieht man den Text genau so, wie er rausgeht. Gesendet wird erst, wenn der Haken „Ich gebe diesen Text für die KI-Korrektur frei“ gesetzt ist.
   - **„Selbst korrigieren“** braucht keine KI und keinen Schlüssel.
3. **Prüfen.** Die Seite hat drei Ansichten, umschaltbar ohne Seitenwechsel: **Original**, **Korrekturen** und **Endfassung**.
   - In „Korrekturen“ sind Fehler rot unterstrichen, freiwillige Vorschläge lila gepunktet. Neben jeder Stelle steht das Kürzel der Kategorie.
   - Ein Klick auf eine Stelle öffnet eine Karte mit „Geschrieben“, „Besser“, Kategorie, Fehler oder Vorschlag, einer kurzen Erklärung, Regel und Fähigkeit.
   - Die Karte hat „Übernehmen“ und „Ablehnen“ und springt danach zur nächsten offenen Stelle. Mit dem Stift lässt sich die Verbesserung vorher ändern („So übernehmen“).
4. **Eigene Korrekturen.** Text markieren, dann „Korrektur hier“. Mit „+ Hinweis“ entsteht eine Anmerkung zum ganzen Text.
5. **Alle auf einmal.** „Alle übernehmen“ und „Alle ablehnen“ fragen vorher nach. Sie betreffen nur offene Stellen, auf Wunsch gefiltert nach Kategorie.
6. **Zeigen.** „Max zeigen“ gibt die übernommenen Korrekturen frei. Max sieht sie dann am Tablet oder Laptop über dem Editor, mit Erklärung, nur zum Lesen, und verbessert selbst.
7. **Drucken.** Die Seitenleiste bietet „Mit Korrekturen“, „Endfassung“ und „Original“. Im Druckdialog kann man die Fehlerübersicht dazunehmen.

Die Seitenleiste zeigt im **Stand** die offenen, übernommenen und abgelehnten Stellen, die Filter nach Kategorie, „Stilvorschläge zeigen“ und „Nächste offene Stelle“. Darunter steht die **Fehlerübersicht** mit den bestätigten Fehlern je Kategorie, dem häufigsten Problem, einer Empfehlung und „Passende Übung erstellen“.

## Kategorien und Maßstab

| Kürzel | Kategorie | zählt als Fehlertyp |
|---|---|---|
| R | Rechtschreibung | Rechtschreibung |
| G | Grammatik (inkl. Zeitformen, Fälle) | Grammatik |
| Z | Zeichensetzung | Zeichensetzung |
| Sb | Satzbau | Satzbau |
| A | Ausdruck / Wortwahl | Ausdruck |
| Au | Textaufbau | Textaufbau |
| I | Inhalt / Vollständigkeit | Inhalt |
| Ts | Textsorte | Textsorte |
| Af | Aufgabenstellung | Aufgabenstellung |

Der Maßstab kommt aus Schultyp und Klasse (`levelFor`):

| Stufe | Gilt für | höchstens Stilvorschläge | höchstens Stellen |
|---|---|---|---|
| Volksschule | Volksschule 1–4 | 3 | 40 |
| Unterstufe | Mittelschule, Gymnasium 1–4 | 8 | 80 |
| Oberstufe | Gymnasium 5–8, HTL, HAK | 15 | 120 |

Die KI bekommt die Stufe, die Kriterien der Textsorte und die Aufgabenstellung. Ihre Regeln:

- nur echte Fehler nach dem Maßstab der Stufe markieren
- korrekte Formulierungen und den Stil des Schülers nicht ändern
- jede Stelle wörtlich zitieren und kurz in du-Form erklären

Die Fähigkeiten der Fehler kommen nur aus der Fähigkeitenliste des Fachs.

## Wie der Server KI-Antworten prüft

Die KI liefert JSON nach einem festen Schema. Der Server prüft jede Stelle einzeln:

- **Verankern.** Das Zitat muss im angegebenen Absatz wörtlich vorkommen. Der Server sucht die Position selbst und rät nie.
- **Verwerfen.** Eine Stelle fällt weg, wenn:
  - Kategorie, Zitat oder Erklärung fehlen,
  - das Zitat länger als 30 Wörter ist,
  - die Verbesserung gleich dem Original ist,
  - die Höchstzahl erreicht ist.
- **Nicht gefunden.** Ein Zitat, das der Server nicht findet, wird zu einem Hinweis ohne Ort.
- **Doppelt.** Eine Stelle, die schon korrigiert ist, wird übersprungen.

Unbrauchbare Antworten speichern nichts. Die Seite meldet dann „Die KI-Korrektur hat nicht geklappt“ und bietet einen neuen Versuch an.

## Fassungen

- **Gebunden.** Eine Korrektur gehört zu genau einer Fassung des Textes. Sie speichert eine Kopie dieser Fassung.
- **Weitergeschrieben.** Schreibt der Schüler weiter, bleiben die alten Markierungen bei ihrer Fassung. Die Seite sagt das und bietet „Neue Fassung korrigieren“ an.
- **Übertragen.** In der neuen Korrektur werden Entscheidungen zu unveränderten Absätzen übernommen. Nur geänderte Absätze müssen neu geprüft werden.
- **Kosten.** Ansichtswechsel und Neuladen kosten nichts. Pro Fassung gibt es höchstens eine KI-Anfrage, außer nach einem Fehler.

## Lernverlauf und Lernstand

- **Lernverlauf.** Unter Profil › Fortschritt › Häufige Fehler steht „In Texten:“ mit den übernommenen Fehlern je Kategorie. Unter Lernverlauf › Texte steht je Text z. B. „Korrektur: 5 Fehler, 1 Vorschlag, 4 offen“.
- **Was zählt.** Nur übernommene Fehler zählen. Offene oder abgelehnte Vorschläge zählen nie, Stilvorschläge zählen nicht als Fehler.
- **Lernstand.** Der Lernstand in Prozent ändert sich durch Textkorrekturen nicht.

## A4-Druck

Der Druck nutzt dieselbe Druckseite wie Arbeitsblätter und Textarbeit (`/arbeitsblatt/text/<id>`), ohne gespeicherte PDFs.

| Ausgabe | Inhalt |
|---|---|
| Original | der Text wie abgegeben |
| Endfassung | der Text mit allen übernommenen Korrekturen |
| Mit Korrekturen | durchgestrichen und verbessert, nummeriert, darunter die Liste der Korrekturen mit Erklärung |
| Fehlerübersicht (Zusatz) | bestätigte Fehler je Kategorie, häufigstes Problem, Empfehlung |

Schülername, Fach, Datum und Titel sind wie bei der Textarbeit abwählbar.

## KI-Modell und Kosten

- **Bereich.** `TEXT`, Funktion `textkorrektur`, Stufe „standard“. Sie läuft nur auf Klick, mit 180 s Zeitlimit und höchstens 16 000 Ausgabe-Tokens.
- **Modell.** Standard ist `claude-sonnet-5-5` bei Anthropic. Anbieter und Modell lassen sich mit `AI_TEXT_PROVIDER` und `AI_TEXT_MODEL` umstellen, auf jeden Anbieter des Routers: Anthropic, OpenRouter, DeepSeek oder eine kompatible API.
- **Grenzen.** Monatsbudget, Kostenlog (Mehr › KI-Kosten), Zeitlimit und Ausfallschutz gelten wie für alle KI-Aufrufe.
- **Größe.** Ein Text braucht 10–2500 Wörter.

Geschätzte Kosten pro Text, mit Sonnet 5.5 bei 2 $ / 10 $ je Mio. Tokens:

| Länge | Eingabe | Ausgabe | Kosten |
|---|---|---|---|
| 300 Wörter | ca. 1 900 Tokens | ca. 1 800 Tokens | ca. 2 Cent |
| 700 Wörter | ca. 2 600 Tokens | ca. 3 000 Tokens | ca. 3,5 Cent |
| 1000 Wörter | ca. 3 100 Tokens | ca. 4 000 Tokens | ca. 5 Cent |

Mit Denkzeit („adaptiv“, Aufwand niedrig) können es bis etwa 8 Cent werden. DeepSeek kostet weniger als 1 Cent pro Text, die Qualität ist dort aber ungeprüft. Die genaue Schätzung zeigt die Freigabe vor dem Senden.

## Datenschutz

- **Was rausgeht.** Nur der Text, die Aufgabenstellung, Fach, Textsorte, Stufe und die Fähigkeitenliste. Kein Schülerprofil, keine Notizen, keine Noten.
- **Namen.** Vor- und Nachname des Schülers und die Namen aller Lehrer werden vor dem Senden zu „[Name]“. In den Verbesserungen setzt der Server sie wieder ein.
- **Andere Namen.** Namen von Freunden, Orten oder Schulen im Text werden **nicht** erkannt. Die Freigabe warnt davor und zeigt den gesendeten Text.
- **Kein Automatismus.** Beim Schreiben wird nie etwas gesendet. Jede Anfrage braucht einen Klick und den Freigabe-Haken. Wer freigegeben hat und wann, wird gespeichert.
- **Ohne KI.** Ohne Schlüssel oder mit `AI_DISABLED=1` funktioniert alles außer dem KI-Knopf. Der Knopf zeigt dann den Grund.
- **Vor dem Einsatz mit echten Texten klären:**
  - Auftragsverarbeitungsvertrag (AVV/DPA) mit dem gewählten Anbieter
  - Speicherdauer beim Anbieter und ob die Daten zum Training verwendet werden
  - Einwilligung der Eltern bzw. die Rechtsgrundlage
  - Hinweis in der Datenschutzerklärung

## Zugriff

- **Lehrer.** Die Korrekturseite und alle Aktionen sind nur angemeldet erreichbar. Lehrer teilen sich die Schüler.
- **Schüler.** Schülergeräte sehen nur freigegebene, übernommene Korrekturen. Sie sehen nur ihren eigenen Text, über die Zuweisung des Geräts oder den Laptop-Zugang der Einheit.
- **Andere Lehrer.** Entscheidungen eines anderen Lehrers bleiben in dessen Korrektur. Alle Aktionen prüfen, dass die Stelle zur geöffneten Korrektur gehört.

## Technik

- Tabellen `text_corrections` (eine Zeile pro Text und Fassung, mit Kopie des Textes) und `text_correction_items` (Stellen mit Absatz, Position, Zitat, Verbesserung, Kategorie, Art, Status, Quelle).
- Prüflogik, ohne Server: `lib/text-correction-core.ts`. Datenbank und KI-Ablauf: `lib/text-correction.ts`. Prompt und Schema: `lib/ai/textkorrektur.ts`. Regeln und Stufen: `lib/text-correction-rules.ts`.
- Oberfläche: `app/(tutor)/texte/[id]/korrektur/page.tsx`, `components/text/correction/*`.
- Tests: `lib/textkorrektur.test.ts`, 12 Tests für die 17 Prüffälle.
