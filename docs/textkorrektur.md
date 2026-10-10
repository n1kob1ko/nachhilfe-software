# KI-Textkorrektur (Lernheft Phase 3)

Ein Schüler schreibt eine Erlebniserzählung, einen Bericht, einen Beschwerdebrief oder eine Textinterpretation. Nach der Abgabe korrigiert der Lehrer den Text, wahlweise mit KI-Vorschlägen. Der Originaltext bleibt immer unverändert. Jede Änderung gilt erst, wenn der Lehrer sie übernimmt.

## Ablauf

1. **Öffnen.** Text öffnen (`/texte/<id>`) und auf „Korrigieren“ klicken. Die Korrekturseite liegt unter `/texte/<id>/korrektur`.
2. **Starten.** Es gibt zwei Wege:
   - **„Mit KI korrigieren“** öffnet zuerst die Freigabe. Sie zeigt, was gesendet wird und was nicht, den Empfänger (Anbieter und Modell) und die geschätzten Kosten. Mit „Gesendeten Text ansehen“ sieht man den Text genau so, wie er rausgeht. Unter „Prüfung“ wählt man **Normal** (eine Anfrage) oder **Gründlich** (Satz für Satz, dann eine zweite Prüfung, siehe unten), jeweils mit geschätzten Kosten. Gesendet wird erst, wenn der Haken „Ich gebe diesen Text für die KI-Korrektur frei“ gesetzt ist.
   - **„Selbst korrigieren“** braucht keine KI und keinen Schlüssel.
3. **Prüfen.** Die Seite hat drei Ansichten, umschaltbar ohne Seitenwechsel: **Original**, **Korrekturen** und **Endfassung**.
   - In „Korrekturen“ sind Fehler rot unterstrichen, freiwillige Vorschläge lila gepunktet. Neben jeder Stelle steht das Kürzel der Kategorie.
   - Ein Klick auf eine Stelle öffnet eine Karte mit „Geschrieben“, „Besser“, Kategorie, Fehler oder Vorschlag, einer kurzen Erklärung, Regel und Fähigkeit.
   - Die Karte hat „Übernehmen“ und „Ablehnen“ und springt danach zur nächsten offenen Stelle. Mit dem Stift lässt sich die Verbesserung vorher ändern („So übernehmen“).
4. **Eigene Korrekturen.** Text markieren, dann „Korrektur hier“. Mit „+ Hinweis“ entsteht eine Anmerkung zum ganzen Text.
5. **Alle auf einmal.** „Alle übernehmen“ und „Alle ablehnen“ fragen vorher nach. Sie betreffen nur offene Stellen, auf Wunsch gefiltert nach Kategorie. Gestrichelt markierte Stellen („genau prüfen“) nimmt „Alle übernehmen“ nie mit.
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
- **Doppelt.** Eine Stelle, die schon entschieden ist, wird übersprungen. Überschneiden sich zwei neue Vorschläge, zählt der zweite als verworfen (früher ging er stillschweigend verloren).

Dazu kommen **Prüfregeln ohne KI** (`lib/text-correction-checks.ts`), bei Normal und Gründlich. Sie entscheiden nichts, sie markieren eine Stelle gestrichelt mit „Genau prüfen“ und dem Grund:

- Kategorie oder Erklärung passen nicht zur Änderung: „Zeichensetzung“, die Wörter ändert; „Rechtschreibung“, die nur einen Beistrich setzt; eine Erklärung über Großschreibung, obwohl nichts großgeschrieben wird; „ß“ ohne ß.
- Die Stelle wurde im Text nicht gefunden.
- Ein deutscher Vorschlag setzt ein neues Subjekt ein („ich“, „du“, „er“, „sie“, „es“, „wir“, „ihr“, „man“), zum Beispiel „Wenn sich … Computerspiele erlauben“ → „Wenn man sich … erlaubt“. Der Satz ist danach richtig, meint aber oft etwas anderes. In den Tests 3 und 4 (2026-10-09, etwa 1.250 Vorschläge) waren alle 10 solchen Vorschläge falsch oder nicht gefragt, kein richtiger sah so aus. Ein getauschtes Fürwort („er“ → „es“) zählt nicht.
- Zwei Vorschläge betreffen dieselben Wörter.
- Im Text nach allen Vorschlägen steht neben einer Änderung ein Wort doppelt, ein Kleinbuchstabe am Satzanfang oder ein doppeltes Satzzeichen.

## Gründlich prüfen

Gewählt in der Freigabe („Gründlich“) oder nachträglich mit „Gründlich nachprüfen“ in der Seitenleiste einer normalen KI-Korrektur (offene KI-Vorschläge werden ersetzt, Entscheidungen bleiben). Zwei Anfragen statt einer, beide über den Router (`lib/ai/textkorrektur-gruendlich.ts`):

1. **Analyse** (Funktion `textanalyse`). Der Text geht Satz für Satz hinaus, nummeriert „Absatz.Satz“. Die KI muss zu jedem Satz antworten, schreibt den ganzen Satz richtig und listet jede Änderung einzeln, mit „sicher/unsicher“. Ein Satz ohne Antwort wird der Lehrkraft gemeldet („Die KI hat einen Satz nicht beantwortet“). Eine unsichere Änderung wird markiert, ebenso eine, die nicht zur Fassung des ganzen Satzes passt: Das Programm wendet alle Änderungen des Satzes an und prüft, ob jede mit ihren Nachbarwörtern im ganzen Satz der KI steht („Pokal“ → „der Siegerklasse den Pokal“ ließe „die Siegerklasse einen“ davor stehen). Die Notiz zeigt dann die Fassung der KI, damit die Lehrkraft vergleichen kann.
2. **Regelfunde.** Das Programm ergänzt, was es selbst sieht: fehlender Beistrich vor dass/weil/wenn/ob …, Kleinbuchstabe am Satzanfang, englisches „i“, doppeltes Wort, derselbe Rechtschreibfehler an anderer Stelle mit demselben Nachbarwort.
3. **Prüfung** (Funktion `textpruefung`). Jeder Vorschlag aus 1 und 2 wird einzeln geprüft: der ganze Satz vorher und nachher und die Erklärung. Danach liest die Prüfung den Text mit allen Vorschlägen (geänderte Stellen in ⟦ ⟧) und nennt, was noch falsch ist. Die Anweisung nennt eigens die Beistrich-Pflicht vor Infinitivgruppen mit „um“, „ohne“, „statt“, „anstatt“, „außer“ und „als“ (§ 75): Im zweiten Test hielt die Prüfung sie zweimal für freiwillig.

Was mit dem Urteil der Prüfung passiert:

| Prüfung sagt | Vorschlag |
|---|---|
| richtig | bleibt; ein Regelfund verliert seine Markierung, ein unsicherer aus der Analyse behält sie |
| richtig, Erklärung falsch | neue Erklärung, markiert |
| unsicher | markiert, mit Grund |
| falsch, mit besserer Verbesserung | neue Verbesserung, markiert |
| falsch, die Stelle ist so richtig (Verbesserung gleich dem Original oder nur die Nachbarwörter wiederholt) | aussortiert: zählt nicht, erscheint nirgends, steht unter „Von der zweiten Prüfung aussortiert“ und lässt sich zurückholen (dann markiert) |
| falsch, ohne Verbesserung | markiert, mit Grund. Im ersten echten Test (2026-10-09) waren 2 von 3 solchen Urteilen selbst falsch, deshalb wird nichts ausgeblendet |
| noch ein Fehler im Text | neuer Vorschlag, markiert („von der zweiten Prüfung gefunden“) |
| Prüfung fällt aus | alle Vorschläge markiert |

Eine zweite KI-Prüfung ist kein Beweis. Deshalb bleibt jede Änderung ein Vorschlag, den die Lehrkraft übernimmt; was die Prüfung bezweifelt oder umschreibt, ist sichtbar markiert, und nichts davon zählt, bevor die Lehrkraft es übernimmt.

### Gründlich neu: Satzprüfung mit Fassungsvergleich

Gründlich gibt es in zwei Fassungen. `AI_TEXT_GRUENDLICH` wählt sie (`bisher` oder `neu`, Standard `bisher`); der Textkorrektur-Test misst immer beide. Anlass war die Ursachenanalyse vom 2026-10-09: In vier Läufen blieben 20 der 118 Musterfehler immer unentdeckt, 12 davon Fehler, bei denen jedes Wort für sich ein echtes Wort ist („bei meine“, „ein Fehler macht“, „Spiele eine Zeitverschwendung ist“, „wird über dem Thema erörtert“).

- **Satzprüfung.** Die Analyse geht jeden Satz in fester Reihenfolge durch: Satzkern (Subjekt und Prädikat stimmen überein, auch bei „sein/werden/bleiben“ mit einem Nomen; Verbstellung), Ergänzungen (welchen Fall und welche Präposition Verb, Adjektiv oder Präposition verlangen; eine falsche Präposition macht die ganze Fügung falsch), Sinn (wer tut was, Aktiv/Passiv, „sich“), Rechtschreibung Wort für Wort, Zeichensetzung, Ausdruck. Sie schreibt jeden Satz ganz hin, einen fehlerfreien unverändert.
- **Fassungsvergleich** (`lib/text-correction-diff.ts`). Das Programm vergleicht den Satz des Kindes Wort für Wort mit der Fassung der KI. Jeder Unterschied wird ein Vorschlag, auch einer, den die KI nicht in ihre Liste geschrieben hat. Ob die Liste solche Änderungen auslässt, war nach dem zweiten Test nur eine Vermutung (die Fassungen wurden nicht protokolliert); der Test schreibt sie jetzt ins Log. Ein Wort, das nur den Platz wechselt, ergibt eine einzige Änderung; ein Beistrich kommt mit dem Wort davor. Steht der Unterschied auch in der Liste, kommt die Erklärung von dort. Sonst steht da „Die KI hat das in ihrer Fassung des Satzes geändert, ohne es zu erklären“, der Vorschlag ist markiert, und die zweite Prüfung schreibt die Erklärung (gelingt das, fällt die Markierung). Widersprechen sich Liste und Fassung, ist der Vorschlag markiert und die Notiz nennt beide Lösungen. Hat die KI den Satz umgeschrieben, wird daraus eine einzige Änderung; passt ihre Fassung gar nicht zum Satz, zählt nur die Liste.
- **Zweite Prüfung neu.** Sie nennt zuerst die Regel, ohne die Erklärung des ersten Schritts zu lesen, prüft, was Verb oder Präposition verlangen, und liest den ganzen Satz nach der Änderung. Findet sie keine Regel, ist der Vorschlag nicht falsch, aber markiert.

**Kosten.** Beide Schritte denken mit Aufwand „medium“ (Normal: „low“). Dafür geht das Antwortschema in die Anweisungen statt als `json_schema` (`schemaInPrompt` in `lib/ai/config.ts`): Mit `json_schema` hat Sonnet 5.5 über OpenRouter in keinem einzigen Aufruf nachgedacht (0 Denk-Tokens im Test am 2026-10-09), mit dem Schema in den Anweisungen schon (gemessen bei den Aufgaben). Die Freigabe zeigt die Schätzung beider Verfahren. Gemessen wird der Unterschied mit dem Textkorrektur-Test (Mehr › KI-Kosten, nur Administration): erfundene Texte mit eingebauten Fehlern und unabhängig geprüfter Musterkorrektur (`lib/ai/textkorrektur-test-faelle.ts`), jeder Text normal, gründlich bisher und gründlich neu, mit echten Anfragen, höchstens 2 €. Reicht die Grenze nur ohne die noch laufenden Texte, wartet der nächste Text, statt übersprungen zu werden. Verglichen werden sechs Wege, darunter die Zwischenstände von Gründlich (nur die Liste von Schritt 1, Schritt 1 mit Fassungsvergleich), damit sich zeigt, was jeder Schritt bringt. Jeder Vorschlag steht mit Erklärung und Urteil im Server-Log (`[KI-Textkorrektur-Test]`), dazu die Satzfassungen der KI und die ausgeblendeten Wörter.

**Standard.** Ohne Wahl gilt `AI_TEXT_METHOD` (`einfach` oder `gruendlich`, Standard `einfach`; live seit 2026-10-09 `gruendlich`). Welche Fassung von Gründlich läuft, sagt `AI_TEXT_GRUENDLICH`.

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
- **Weitere Namen** (`lib/name-detection.ts`). Die App sucht im Text, in der Aufgabenstellung und in den Bildbeschreibungen selbst nach Namen, mit drei Regeln: ein Vorname aus einer Liste häufiger Vornamen (auch „Lenas“), das Wort nach einer Anrede („Frau Novak“, „Mrs Berger“, „Herr Dr. Huber“, nicht „eine Frau“, nicht „Frau Lehrerin“), ein Nachname direkt nach einem Vornamen („Lena Hofer“, nicht „Lukas Mutter“). Ein so gefundener Nachname wird im ganzen Text ersetzt. Ein Wort, das anderswo nach „ein“, „mein“, „das“ … steht, ist ein Nomen und kein Name. Pronomen, Artikel und Bindewörter („Sie“, „dass“) werden nie ersetzt. Die Freigabe zeigt die gefundenen Namen mit Häkchen: Die Lehrkraft nimmt das Häkchen weg, wenn ein Wort kein Name ist, und trägt fehlende Namen ein; der gesendete Text darunter ändert sich sofort mit. Ihre Auswahl wird in `text_corrections.masked_names` gespeichert und gilt auch für „Gründlich nachprüfen“. Orte, Adressen und Schulen erkennt die App nicht, die Freigabe sagt das. Auf den 9 Testtexten findet sie alle 36 Namensstellen und ersetzt kein anderes Wort (36 von 2.925 Wörtern, 1,2 %); der Datenschutzfilter von OpenRouter hatte im dritten Test 16 % verdeckt. Der Textkorrektur-Test ersetzt die Namen genauso und schreibt sie ins Log (`namen`). Ein Genitiv-s bleibt außerhalb des Platzhalters („Leas Gedanken“ → „[Name]s Gedanken“): Im vierten Test hatte die KI bei „[Name] Gedanken“ das fehlende s ergänzt, und nach dem Zurücksetzen stand „Leass“ im Vorschlag.
- **Datenschutzfilter beim Anbieter.** Seit dem 2026-10-09 sind die Guardrails bei OpenRouter ausgeschaltet; die eigene Namenserkennung oben ersetzt den Namensfilter. Wird er wieder eingeschaltet, gilt: Ein Guardrail bei OpenRouter (Workspaces › Guardrails, „Person name“) ersetzt erkannte Namen durch „[PERSON_NAME]“, bevor die KI den Text sieht. Er erkennt deutsche Wörter oft falsch („das Sie“, „sie nicht weiß“) und verändert so den Schülertext. Ein Vorschlag mit einem solchen fremden Platzhalter passt nicht zum Text und wird verworfen (gezählt, nie angezeigt). Steht der Platzhalter nur in der Fassung des ganzen Satzes, gilt er beim Vergleich als der Name aus dem Text; sonst würden richtige Vorschläge neben Namen markiert. Gründlich merkt sich, welche Wörter der Filter ausgeblendet hat (Spalte `hidden_words`, erkannt am Platzhalter in der Satzfassung der KI), und die Korrektur zeigt sie oben im gelben Hinweis („Der Datenschutzfilter von OpenRouter hat Wörter ausgeblendet …“), damit die Lehrkraft diese Stellen selbst prüft. Gründlich bisher sieht das nur in Sätzen mit Fehlern, Gründlich neu in jedem Satz, weil es jeden Satz ganz zurückbekommt. War ein ausgeblendetes Wort kein Name, sondern ein Grammatikwort wie „Sie“, ist bei Gründlich neu jeder Vorschlag in diesem Satz markiert: Die KI hat den Satz nicht ganz gesehen. Ein Platzhalter steht oft für eine ganze Wortgruppe („Wirtshaus das Licht“, „Schule Computerspiele“); der Fassungsvergleich zählt die Wörter daneben bis zu sechs je Platzhalter mit zur ausgeblendeten Gruppe, statt sie als Streichung der KI vorzuschlagen, und ein Vorschlag direkt neben ausgeblendeten Wörtern ist markiert. Im dritten Test (2026-10-09) hat der Filter 16 % aller Wörter verborgen (305 von 1.947), aber nur 9 echte Namen; 23 der 80 Fehler lagen in verborgenen Wörtern, darunter alle vier Stellen der Erörterung aus der Ursachenanalyse. Der Filter lässt sich nicht pro Anfrage oder mit einer Liste erlaubter Wörter einstellen, nur ein- oder ausschalten; er läuft bei OpenRouter, die Namen erreichen OpenRouter also trotzdem.
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

- Tabellen `text_corrections` (eine Zeile pro Text und Fassung, mit Kopie des Textes, Verfahren `method`, unbeantworteten Sätzen `unchecked`, `verify_status` und den vom Datenschutzfilter ausgeblendeten Wörtern `hidden_words`) und `text_correction_items` (Stellen mit Absatz, Position, Zitat, Verbesserung, Kategorie, Art, Status, Quelle, Herkunft `origin`, Markierung `review` und Grund `review_note`).
- Prüflogik, ohne Server: `lib/text-correction-core.ts`. Datenbank und KI-Ablauf: `lib/text-correction.ts`. Prompt und Schema: `lib/ai/textkorrektur.ts`, gründlich: `lib/ai/textkorrektur-gruendlich.ts`. Prüfregeln: `lib/text-correction-checks.ts`. Fassungsvergleich: `lib/text-correction-diff.ts`. Regeln und Stufen: `lib/text-correction-rules.ts`. Textkorrektur-Test: `lib/ai/textkorrektur-test.ts`.
- Oberfläche: `app/(tutor)/texte/[id]/korrektur/page.tsx`, `components/text/correction/*`.
- Tests: `lib/textkorrektur.test.ts` (12 Tests für die 17 Prüffälle), `lib/text-correction-checks.test.ts`, `lib/textkorrektur-gruendlich.test.ts`, `lib/text-correction-diff.test.ts`, `lib/textkorrektur-test.test.ts`.
