# Prüfung der Aufgabenbanken

Stand: 20. Oktober 2026

Die Aufgabenbanken in `data/banks/` kommen aus dem Artikel Trainer. Beim Üben haben sie richtige Antworten als falsch angestrichen: „en“ statt „-en“ bei der Adjektivendung, „den Park“ und „dem Park“ nach „rennt in“, „Sie öffneten“ und „sie öffnete“, „das Keks“. Jetzt ist jeder Eintrag fachlich geprüft, ohne KI. Die Regel dabei: **lieber eine Aufgabe weniger als eine, die Richtiges als falsch anstreicht.**

Den Bericht des KI-Qualitätstests (`npm run banks:pruefung`) gibt es weiter, getrennt davon: [banks-pruefung-ki.md](banks-pruefung-ki.md).

## Wie geprüft wird

- `eintragFehler()` in `lib/banken-regeln.ts` sagt für einen Eintrag, was nicht stimmt. Die Regeln je Bank stehen unten.
- `lib/banken.test.ts` läuft bei jedem `npm test` über **jeden** Eintrag jeder Bank. Ein beanstandeter Eintrag lässt den Test scheitern. Es gibt keine Liste von Fehlern, die bleiben dürfen; `ADJEKTIV_EINDEUTIG` und `EINDEUTIG` enthalten nur Sätze, die von Hand geprüft und richtig sind.
- Derselbe Test erzeugt Aufgaben und gibt sie dem echten Prüfer (`checkAnswer`): jede richtige Schreibweise wird angenommen, jede falsche Option abgelehnt, mit passendem Fehlertext. Das gilt auch für „Fehler korrigieren“.
- Einträge, die die KI in Bankform liefert, laufen durch dieselben Regeln (`lib/ai/banken.ts`). Ein beanstandeter Eintrag wird abgelehnt.
- Ein Satz, der sich nicht sicher reparieren ließ, ist entfernt. Kein Eintrag steht mit `review: true` in der Datei.

## Regeln je Bank

### Artikel bestimmen

- **Mehrere Artikel richtig** (der Keks, das Keks): alle richtigen Artikel werden angenommen, der zweite steht in `alsoArticle`. Die Liste der erlaubten Wörter ist `MEHRERE_ARTIKEL`. Solche Wörter kommen nie als Multiple Choice und nie in „Fehler korrigieren“, nur als Lückentext. Dort gilt jeder richtige Artikel, die Lösung nennt beide: „der Keks, auch richtig: das Keks“.
- **Drei Artikel richtig** (Joghurt: der, das, österreichisch auch die): keine Aufgabe.
- **Gleich geschrieben, andere Bedeutung** (der See, die See): das Wort braucht `meaning`, die Aufgabe zeigt sie: „Welchen Artikel hat das Nomen „Kiefer“ (Nadelbaum)?“. Diese Wörter kommen nicht in „Fehler korrigieren“, dort hätte der Hinweis keinen Platz.
- **Kein Plural** (Finanzen, Schulden): „die“ ist dort kein Genus.
- **Keine Personen aus Adjektiven** (der Bekannte, die Bekannte): beide Artikel sind richtig.

### Adjektivdeklination

- Der Schüler schreibt nur die Endungen. „en“ und „-en“ gelten gleich. Braucht ein Wort keine Endung, darf die Lücke leer bleiben oder „-“ enthalten. Die Aufgabe sagt das in einer zweiten Zeile: „Schreib nur die Endungen. Braucht ein Wort keine Endung, lass die Lücke leer oder schreib „-“.“
- Im Satz und in der Lösung stehen keine Bindestriche mehr mitten im Wort („ein bekannter Architekt“, nicht „bekannt-er Architekt-“).
- Satz aus seinen Teilen und den richtigen Endungen ergibt genau die Lösung. Die Lücken sitzen am Adjektiv und am Nomen, ohne Auslassungspunkte.
- Optionen sind nur Endungen, die richtige steht genau einmal darin, keine richtige Endung steht als falsche Option.
- **Nur Sätze mit genau einer richtigen Kombination.** Beide Lücken werden einzeln bewertet, darum fliegen Sätze raus, in denen mehrere Kombinationen passen:
  - ohne Begleiter (kaltes Wasser, kalten Wassers): nur von Hand geprüfte Sätze (`ADJEKTIV_EINDEUTIG`);
  - nach alle, beide, viele …: die Endung schwankt;
  - „die“ und „der“ (Genitiv), die zu Einzahl und Mehrzahl passen (die rote Rose, die roten Rosen);
  - Nomen mit zwei Deklinationen (des Nachbarn, des Nachbars; Bauer, Bär).
- **Genitiv:** wo „-s“ und „-es“ beide richtig sind (des Tags, des Tages), werden beide angenommen (`alsoCorrect2`). Nach s, ß, x, z, sch nur „-es“, nach Vokal und unbetontem -el, -er, -en nur „-s“.
- Das alte Dativ-e (dem Kinde) ist keine falsche Option.

### Präposition und Kasus

- **Nur ein Fall darf passen.** Mit, nach, bei … verlangen den Dativ, durch, für, gegen … den Akkusativ.
- Wechselpräpositionen (an, auf, in …):
  - kein Verb der Bewegung ohne Richtungswort: „Der Hund rennt in den Park“ und „im Park“ sind beide richtig;
  - kein Akkusativ bei einem Verb der Lage (stehen, liegen, sitzen), kein Dativ bei einem Verb der Richtung (stellen, legen, setzen);
  - Verben, bei denen beide Fälle üblich sind (passen, parken, schreiben, verstecken), nur in von Hand geprüften Sätzen (`EINDEUTIG`).
- Der richtige Artikel ist die Form zu Genus und Fall.
- Der Fehlertext nennt den Fall: „die → Akkusativ statt Dativ“, „Falsches Genus: der Tisch“.

### Präteritum und Perfekt

- Die Grundform steht in Klammern am Satzende: „(fahren)“, bei trennbaren Verben die ganze Grundform: „(anrufen)“, nicht „(rufen)“.
- **Kein „sie“ oder „Sie“ als Subjekt an der Lücke:** „Sie öffnete“ und „Sie öffneten“ sind beide richtig. Die Sätze haben jetzt ein klares Subjekt („Die Kinder ___ das Paket …“).
- Keine richtige Form steht als Fehler. Alte, aber richtige Formen (sangest, standst, buktet) sind keine Fehler mehr; „standst“ und „buktet“ werden angenommen.
- Der Fehlertext nennt das Verb aus der Klammer.
- **Perfekt:** genau zwei Lücken, die erste ist ein Hilfsverb. Verben, die das Perfekt in Österreich mit „sein“ und in Deutschland mit „haben“ bilden (sitzen, liegen, stehen, schwimmen …), nur, wenn beide Hilfsverben angenommen werden. Die Fehlertexte heißen „Falsches Hilfsverb“, „Hilfsverb im Präteritum: das ist Plusquamperfekt“, „Das Hilfsverb passt nicht zur Person“, „Falsches Partizip II“.

### das/dass

- Die Anweisung steht vorne („Setze „das“ oder „dass“ ein: “), die Lösung ist der ganze Satz, jede Lösung ist „das“ oder „dass“.

### Hauptsatz und Gliedsatz

- Der Gliedsatz beginnt mit einem Einleitewort, zwischen den Teilen steht der Beistrich, am Ende ein Satzzeichen.
- Die Lösung zitiert die Teile ohne Satzzeichen, zum Beispiel: „Der Gliedsatz ist „weil es regnet“. Er kann nicht allein stehen und hängt vom Hauptsatz ab.“

## Vorher und nachher

| Bank | vorher | nachher | was geändert ist |
|---|---:|---:|---|
| Artikel | 1927 | 1914 | 13 Wörter entfernt (Personen aus Adjektiven: Abgeordnete, Ahne, Angeklagte, Bekannte, Fremde, Gefangene, Verdächtige; Plural: Finanzen, Schulden; mehrere Artikel ohne sichere Aufgabe: Krake, Joghurt, Service; zweiter Artikel unsicher: Radiergummi); 2 Artikel berichtigt (die Großmut, das Vitamin statt die Vitamine); 22 Einträge mit Bedeutung; 13 Wörter mit zweitem Artikel |
| Adjektivdeklination | 300 | 282 | alle 250 behaltenen Einträge neu aufgebaut (Optionen, Teile, zweite Genitivendung), 54 davon mit neuem Satz; 50 entfernt (Genitiv ohne Begleiter, der/die mit Einzahl und Mehrzahl, Nachbar und Bauer, doppelte und schiefe Sätze); 32 neue Sätze |
| Präposition und Kasus | 100 | 99 | 26 entfernt (Bewegung ohne Richtungswort, Verben mit beiden Fällen); 3 neu geschrieben; 25 neue Sätze mit festem Fall |
| Präteritum | 102 | 102 | 28 Sätze geändert (klares Subjekt statt „sie“, ganze Grundform bei trennbaren Verben, österreichische Wörter), 7 Fehlertexte berichtigt |
| Perfekt | 22 | 65 | 16 alte Sätze repariert (Grundform, Fehlertexte), 4 entfernt, 47 neue Sätze aus vielen Themen (Schule, Freizeit, Reisen, Familie) |
| das/dass | 347 | 347 | unverändert, alle Regeln erfüllt |
| Hauptsatz und Gliedsatz | 301 | 301 | unverändert, nur die Lösung zitiert die Teile ohne Satzzeichen |

Die 4 entfernten Perfekt-Sätze: „Das Restaurant ___ … ___.“ (auch „war geschlossen“ ist richtig), „Das Wasser ___ … ___.“ (sieden: „gesotten“ stand als Fehler), „Der Kuchen ___ … ___.“ (ein Zustand, kein Perfekt), „Haben Sie die Zwiebeln …“ (eine Lücke erwartete „-“).

Beispiele:

| vorher | nachher |
|---|---|
| „An einem regnerisch___ Nachmittag___“: nur „-em“ war richtig, „en“ galt als falsch | „Das ist ein bekannt ___ Architekt ___.“: „er“ und „-er“ richtig, die zweite Lücke leer oder „-“ |
| „Der Hund rennt in ___ Park.“: nur „den“ richtig | entfernt; neu z. B. „Seit ___ Pause habe ich Kopfweh.“ mit „die → Akkusativ statt Dativ“ |
| „Sie ___ das Paket voller Vorfreude. (öffnen)“: nur „öffneten“ richtig | „Die Kinder ___ das Paket voller Vorfreude. (öffnen)“ |
| „Kiefer“: nur „die“ richtig | „Welchen Artikel hat das Nomen „Kiefer“ (Nadelbaum)?“ |
| „Das Wasser ___ … ___.“ ohne Grundform, „gesotten“ galt als Fehler | „Wir ___ mit dem Zug nach Salzburg ___. (fahren)“ |

## Österreichische Varianten

Nur Varianten, die im Duden stehen. Österreichisch heißt: der Duden vermerkt sie als österreichisch, oder es ist in Österreich der übliche Artikel.

Zweiter Artikel (`alsoArticle`), österreichisch:

- **das Keks** neben der Keks
- **der Paprika** (das Gemüse) neben die Paprika
- **das Haargummi**: in Österreich der übliche Artikel, der Haargummi wird auch angenommen
- **das Bonbon**: in Österreich nur so, der Bonbon (Duden) wird auch angenommen

Zweiter Artikel nach Duden, nicht österreichisch: Abscheu (der, die), App (die, das), Blog (der, das), Burnout (das, der), Dschungel (der, das), Laptop (der, das), Teil (der, das), Thermostat (das, der), Virus (das, der).

`MEHRERE_ARTIKEL` nennt außerdem österreichische Doppelformen, die nicht in der Bank stehen (Polster, Sakko, Gulasch, Vokabel, E-Mail, SMS, Cola, Prospekt, Pyjama). Liefert die KI eines davon mit nur einem Artikel, wird der Eintrag abgelehnt.

In Sätzen und Hinweisen: Bub (Bedeutung von „der Junge“), Schlagobers, Kaiserschmarrn, Vorzimmer, Sessel, Hausübung, Schularbeit, Orte wie Wien, Graz, Linz und Salzburg.

## Schwierigkeit

Die Banken haben kein Feld für die Schwierigkeit. `bankStufe()` in `lib/banken-regeln.ts` schätzt sie aus den Daten (0 sehr leicht bis 3 schwer):

| Bank | Stufe 0 | Stufe 1 | Stufe 2 | Stufe 3 |
|---|---|---|---|---|
| Artikel | kurze Alltagswörter („Einfach“) | weitere einfache Wörter, Wörter mit Bedeutung | übrige Wörter | abstrakte Wörter (-heit, -ung …), Charakter |
| Adjektiv | | Nominativ und Akkusativ mit Begleiter | Dativ, ohne Begleiter | Genitiv, n-Deklination, Dativ Plural |
| Präposition | | Dativ- oder Akkusativpräposition | Wechselpräposition | |
| Präteritum | | schwache Verben | starke und gemischte Verben | du und ihr |
| Perfekt | | regelmäßig mit haben | unregelmäßig oder mit sein | trennbar, untrennbar, -ieren |
| Hauptsatz | | weil, wenn, dass | andere Einleitewörter | |

Die Schwierigkeit im Übungs-Builder wählt die Stufen: sehr leicht 0, leicht 0 und 1, leicht bis mittel und mittel 1 und 2, schwer 2 und 3, sehr schwer 3. Passen weniger als 12 Einträge, kommen die Nachbarstufen dazu, damit sich Aufgaben nicht dauernd wiederholen. das/dass hat keine Stufen, dort kommt immer die ganze Bank.

Einträge je Schwierigkeit:

| Bank | sehr leicht | leicht | leicht bis mittel, mittel | schwer | sehr schwer |
|---|---:|---:|---:|---:|---:|
| Artikel | 423 | 738 | 1004 | 1176 | 487 |
| Adjektiv | 59 | 59 | 100 | 223 | 182 |
| Präposition | 29 | 29 | 99 | 70 | 70 |
| Präteritum | 32 | 32 | 67 | 70 | 35 |
| Perfekt | 17 | 17 | 46 | 48 | 19 |
| Hauptsatz | 115 | 115 | 301 | 186 | 186 |

## KI-Einträge

Die Anweisungen an die KI (`lib/ai/banken.ts`) nennen jetzt dieselben Regeln: kein Wort mit zwei Artikeln ohne `alsoArticle`, keine Person aus einem Adjektiv, immer ein Begleiter vor dem Adjektiv, nur ein passender Fall, Grundform in Klammern, kein „sie“ an der Lücke. Kleine Formfehler gleicht die App selbst an (fehlende das/dass-Anweisung, fehlender Beistrich nach dem Hauptsatz). Alles andere prüft `eintragFehler()`; ein beanstandeter Eintrag wird nicht übernommen.

## Offen, bitte prüfen

- Alte Formen werden nicht angenommen, aber auch nicht als Fehler bezeichnet: Dativ-e (dem Hause), Präteritum mit -est (sangest, sahest), „ladeten“.
- das/dass hat keine Schwierigkeitsstufen.
- Ein paar deutsche Wörter sind geblieben (Abitur, Brötchen, Geldbeutel, Englischarbeit).
- Radiergummi ist entfernt: „das Radiergummi“ ist regional üblich, steht aber nicht sicher im Wörterbuch. Steht es dort, kann das Wort mit `alsoArticle: ["das"]` und einem Eintrag in `MEHRERE_ARTIKEL` zurück.
- Butter und Radio bleiben mit einem Artikel (die Butter, das Radio). „der Butter“ und „der Radio“ sind Mundart und werden als falsch bewertet.
- Perfekt hat keine „Fehler korrigieren“-Aufgaben: dafür nimmt die App nur Sätze mit einer Lücke.
- „Die Lampe steht über dem Schreibtisch.“ ist entfernt (eine Lampe steht nicht über etwas).
