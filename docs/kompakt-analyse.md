# Kompaktere Oberfläche: Analyse und Plan

Stand: 6. Oktober 2026. Grundlage: Screenshots mit den Beispiel-Schülern (Max Huber hat 13 Einträge im Lernverlauf, die Übungsliste hat 52 Zeilen).

Grundsatz: Es wird nichts gelöscht. Jede Information bleibt erreichbar, nur auf einer anderen Ebene.

- **Ebene 1 (immer sichtbar):** Kerninfo, Status, Kennzahlen, nächster Schritt
- **Ebene 2 (ein Klick):** Details, Beobachtungen, weitere Fehler
- **Ebene 3 (selten):** Rohdaten, volle Tabellen

---

## 1. Übungen-Liste

**Befund**
- Eine Tabelle mit 6 Spalten.
- „Gemischt“ steht in fast jeder Zeile.
- „an 1 gesendet“ sagt nicht, an wen.
- Fach und Klasse sind auf zwei Zeilen verteilt.
- Eine Zeile braucht 3–4 Sekunden.

| Was | Bisher | Neu |
|---|---|---|
| Untertitel | „Alle Übungen mit Lösungen. Entwürfe sehen Schüler erst, wenn du sie sendest.“ | entfällt, ⓘ-Info neben dem Titel |
| Zeile | 6 Spalten Tabelle | Titel + **eine** Chip-Zeile |
| Fach | farbiger Chip + Klasse darunter | Chip „Mathematik · 2. Kl. MS“ |
| Typ | eigene Spalte, meist „Gemischt“ | Chip nur, wenn nicht gemischt |
| Schwierigkeit | eigene Spalte | kleiner Chip „leicht“ |
| Aufgaben | eigene Spalte | „18 Aufg.“ |
| Status | „an 1 gesendet“ | „an Max“ (grün) / „Entwurf“ (gelb) |
| Datum | „6. Okt.“ in eigener Spalte | rechts, kurz „6.10.“ |
| Viele Übungen | eine lange Liste | Filter-Chips oben: Alle · Entwürfe · Mathematik · Deutsch · Englisch (mit Anzahl) |
| Leerzustand | zwei Sätze | ein Satz |

Außerdem heißen die Beispiel-Übungen jetzt „Einheit: …“ statt „Stunde: …“ (Begriffsregel).

## 2. Fähigkeiten

**Befund**
- Der Klassenbereich steht bei jeder Fähigkeit voll ausgeschrieben, z. B. „MS 1–4 · AHS 1–5 · HTL/HAK 1“ sechsmal in einer Karte.
- Das Formular rechts nimmt dauerhaft ein Viertel der Breite ein.
- Die Baumstriche „├─“ erzeugen Unruhe.

| Was | Bisher | Neu |
|---|---|---|
| Untertitel | zwei Sätze Erklärung | „Fach › Thema › Fähigkeit“ + ⓘ-Info mit der Erklärung |
| Klassenbereich | bei jeder Fähigkeit | **einmal** pro Thema im Kartenkopf; bei einer Fähigkeit nur, wenn er abweicht |
| „nur KI“ | Text hinter dem Bereich | kleines ✦-Symbol mit Tooltip |
| Teilfähigkeiten | eingerückte Zeilen mit Strichen | kleine Chips unter der Fähigkeit |
| Formular „Fähigkeit hinzufügen“ | feste rechte Spalte, 7 Felder, 2 Hinweistexte | Button „Fähigkeit hinzufügen“ oben; klappt ein kompaktes Formular auf (Klassen nebeneinander, Hinweise als ⓘ) |
| Orientierung | langes Scrollen | Sprung-Chips: Mathematik · Deutsch · Englisch (mit Anzahl) |

## 3. Lernverlauf: Einheiten-Karten

**Befund**
- Jede Karte zeigt bis zu 6 Textblöcke.
- Die „Zusammenfassung“ allein hat 4–5 Zeilen Fließtext.
- Selbstständig geübte Einträge listen jeden Fehler einzeln.
- Max’ Lernverlauf ist dadurch 5.500 px lang.

**Neu, Ebene 1 (eine Karte = 3 Zeilen)**
- **Zeile 1:**
  - Datum „Di 29.9.“
  - Uhrzeit und Dauer „14:00–15:00 · 60 min“
  - Lehrer
  - Fach / Thema
  - Status: „dokumentiert“ ✓ oder „noch ergänzen“
- **Zeile 2, Kennzahlen als Chips:**
  - **6/8 richtig** (Farbe nach Quote)
  - **Hilfe 3**
  - **Fehler 2**
  - **Fortschritt +9 %**
  - Beobachtung als Kurzstatus: „Konz. 3/5 · Motiv. 4/5“
- **Zeile 3:**
  - bis zu **3 Schwierigkeiten** als rote Chips (z. B. „Dividieren“, „Kehrwert vergessen 6×“)
  - **„Nächstes: Division wiederholen“** in einer Zeile
- **Whiteboard:** kleine Vorschaubilder (96 px statt 150 px)
- **Button „Details anzeigen“:** klappt auf zu Zusammenfassung, allen Schwierigkeiten und Fehlern, Fortschritt je Fähigkeit, vollständigen Beobachtungen, Lernzielen, Wiederholen und Hausübung (Ebene 2)

**Selbstständig geübt**
- Gleiches Muster: „Selbstständig“-Chip, „16/18 richtig“, Anzahl Fehler, die 3 häufigsten Fehler.
- „Gemacht“, alle Fehler und die übrigen Angaben stehen unter „Details anzeigen“.

**Liste**
- Die 8 neuesten Einträge sind sichtbar.
- Ältere stehen unter „Ältere Einträge (n)“.
- Der Erklärsatz unter „Dokumentation“ wird ein ⓘ.

## 4. Gesamtauswertung, langfristige Entwicklung, Fortschritt

**Gesamtauswertung**
- 6 Blöcke mit je bis zu 4 Zeilen werden kompakte Kacheln: **höchstens 3 Punkte** als „Name 83 %“, der Rest unter „+2 mehr“.
- Leere Blöcke zeigen nur „–“ statt eines Satzes.

**Langfristige Entwicklung**
- Bisher: Tabelle mit allen geübten Fähigkeiten und allen Einheiten.
- Neu sichtbar:
  - nur die **5 wichtigsten Fähigkeiten** (zuletzt geübt / größte Änderung)
  - die **letzten 4 Einheiten**
  - Pfeil + Zahl („↗ +20“) statt „verbessert (+20)“
- Die volle Tabelle steht unter „Alle n Fähigkeiten und Einheiten“ (Ebene 3).
- Die Erklärung wird ein ⓘ.

**Fortschritt-Tab**
- Die Kennzahlen-Spalte je Fähigkeit („28 Aufg. · 79 % im 1. Versuch · Ø 1 min 34 s · Hilfe 4 %“) wandert in eine aufklappbare Tabelle „Kennzahlen“ pro Thema.
- Noch nicht geübte Fähigkeiten (bei Max 6 von 12) stehen gesammelt unter „6 noch nicht geübt“.
- Der Absatz zur Berechnung der Beherrschung wird ein ⓘ.

**Empfehlungen**
- Ebene 1: Chip „Schwäche“, Fähigkeit, „31 %“, „10 Aufg. · leicht“, Button.
- Unter „Warum?“: Begründung und „Danach …“.

**Häufige Fehler und Wiederholen**
- Die Top 3 sind sichtbar.
- Der Rest steht unter „Alle 8 anzeigen“.

**Einschätzung**
- Die Sätze wiederholen die Kacheln oben.
- Sie wandern unter „Einschätzung in Sätzen“.
- Der KI-Hinweis wird ein ⓘ.

## 5. Ganze App: Erklärtexte

93 Erklärsätze in grauer Schrift gefunden.

**Regel**
- Ein Satz bleibt nur sichtbar, wenn ohne ihn der nächste Schritt unklar wäre.
- Sonst wird er
  - gekürzt (höchstens eine Zeile),
  - ein ⓘ-Info-Symbol oder
  - zieht in „Details“.

**Betroffen u. a.**
- Untertitel von Übung erstellen, Lehrer, Export, Abrechnung
- Leerzustände
- Formular-Hinweise
- Hinweise im Schülerprofil („Auf diesem Link sieht …“, „Zugang für …“)

## Neue Bausteine

**ⓘ Info**
- Kleines Symbol, das bei Tipp/Klick einen kurzen Text zeigt.
- Funktioniert auch auf dem Tablet, weil Tooltips dort nicht erscheinen.

**Chip**
- Kurze Kennzahl oder Stichwort.
- Neutral, grün, gelb oder rot. Farben gibt es nur für Bedeutung, nicht zur Deko.

**„Mehr anzeigen“**
- Gleicher Klappmechanismus überall: die Top 3 sichtbar, der Rest auf Klick.
