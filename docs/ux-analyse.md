# Lernheft: UX-Analyse und Umbau (5. Okt. 2026)

## Was heute im Weg steht

### Unnötige Menüpunkte
- **Fähigkeiten** ist ein Katalog, den ein Lehrer im Alltag fast nie braucht. Trotzdem steht er gleichrangig neben Schüler und Übungen.
- **Einheiten** ist ein Protokoll aller Einheiten. Im Alltag reicht der Lernverlauf beim Schüler, das Protokoll ist eher für die Verwaltung.
- **Passwort, Lehrer, Export** und ein KI-Hinweis stehen dauerhaft unten in der Seitenleiste.

### Doppelte Funktionen
- Eine laufende Einheit hat drei Bedienfelder mit fast denselben Knöpfen: die Leiste oben auf jeder Seite, den Kopf der Startseite und den Kopf des Schülerprofils. Jedes davon hat Whiteboard, Öffnen und Beenden.
- **Lernverlauf** gibt es als Tab, als Button und als Link „Letzte Stunde → Lernverlauf“.
- **Fortschritt** und **Analyse & Empfehlungen** zeigen beide den Lernstand pro Fähigkeit.
- Auf der Übungsseite liegen „Freigeben und senden“, „Weiterem Schüler zuweisen“, „Für anderen Schüler kopieren“, „Anpassen (Kopie)“, „Als Vorlage speichern“, „Aufs Whiteboard“ und „Drucken“ alle gleichzeitig offen.
- Das „Übungsmodus öffnen“ im Einheiten-Kopf und in „Laufende Übungen“ meint beide Male dasselbe, nämlich den Link des Schülers.

### Unklare Begriffe
- Für dieselbe Sache gibt es mehrere Wörter: **Stunde / Einheit**, **Freigeben / Zuweisen / Senden**, **Übungsmodus / Schüler-Link**, **Basis-Dokumentation / Lern-Dokumentation**.
- Weitere unklare Begriffe: **Live-Daten**, **Tafel** (beim Schüler) neben **Whiteboard** (beim Lehrer), „Analyse & Empfehlungen“ und „Entwurf freigeben“.

### Seiten mit zu vielen Informationen
- **Startseite:**
  - Hero, vier Kennzahl-Kacheln, „Stunden heute“, „Deine Schüler“ mit Balken, Empfehlungen, Kalender, Tagesplan, „Zuletzt bearbeitet“ und fällige Hausübungen.
  - Das sind neun Bereiche, und kein Bereich sagt, was jetzt zu tun ist.
- **Schülerprofil:**
  - Sechs Tabs.
  - Der Überblick zeigt zusätzlich eine Seitenleiste mit acht Feldern.
  - Dazu kommen der Zugangslink und die ganze letzte Einheit.
- **Einheitsseite:** Acht Basisdaten-Felder, Status-Pills, Übungen, Whiteboard-Vorschauen, die gesamte Auswertung und das lange Ergänzungsformular stehen alle auf einer Seite.
- **Ergänzungsformular nach der Einheit:** 4 Skalen, 10 Textfelder und eine Fähigkeitenauswahl.

### Zu tief verschachtelt
- **Einheit starten:** Weg über Schüler → Schülerprofil → Einheit starten. Danach bleibt man im Profil, und das Whiteboard erreicht man erst über einen weiteren Knopf.
- **Ergebnis einer Übung:** Weg über Schüler → Tab Übungen → Übung → Ergebnis, oder über die Übungsliste.
- **Einheit beenden:** Danach landet man auf einer langen Seite, das Formular liegt ganz unten.

### Unklar, was als Nächstes kommt
- Nach „Einheit starten“ passiert sichtbar fast nichts, nur der Knopf wird zu „läuft seit …“.
- Nach „Freigeben und senden“ gibt es keinen Hinweis, wie es weitergeht, zum Beispiel zurück zur Einheit oder zum Ergebnis.
- Nach „Einheit beenden“ ist nicht klar, dass noch etwas auszufüllen ist.
- Auf der Startseite ohne laufende Einheit gibt es keinen großen nächsten Schritt.

## Was geändert wurde
1. **Navigation:** Start, Schüler, Übungen, Abrechnung, Mehr.
   - Fähigkeiten, das Einheiten-Protokoll, Lehrer, Datenexport und Passwort liegen unter „Mehr“.
   - Auf Handy und Tablet sitzt die Navigation als Leiste unten, gut mit dem Daumen erreichbar.
2. **Startseite:** Eine laufende Einheit oder der große Knopf „Einheit starten“ mit Schülerauswahl. Dazu „Heute“, „Zuletzt verwendet“ und „Zu erledigen“.
3. **Laufende Einheit:**
   - Starten führt direkt in die Einheitsansicht.
   - Oben steht dauerhaft „Einheit mit Max – seit 15:04“.
   - Darunter liegen vier große Bereiche: Übungen, Whiteboard, Fortschritt, Einheit beenden.
   - Der Link für das Gerät des Schülers liegt in der Einheit selbst.
4. **Einheit beenden** zeigt einen Abschlussbildschirm.
   - Oben stehen die automatisch erfassten Werte: Dauer, Aufgaben, Ergebnis, Schwierigkeiten, Hilfen, Fortschritt.
   - Darunter folgen fünf Felder: Beobachtungen, Konzentration, Motivation, nächstes Lernziel, Hausübung.
   - Zum Schluss kommt „Dokumentation speichern“.
   - Alles Weitere ist aufklappbar.
5. **Schülerprofil:**
   - Name, Klasse, Fach und Themen, Stärken, Schwierigkeiten, letzte Einheit, nächstes Lernziel.
   - Drei große Aktionen: Einheit starten, Übung erstellen, Lernverlauf ansehen.
   - Statt sechs gibt es fünf Tabs; Fortschritt und Analyse sind zusammengelegt.
   - Weitere Angaben sind aufklappbar.
6. **Übung:** Pro Phase gibt es einen Hauptknopf.
   - Entwurf: „An Max senden“.
   - Gesendet: „Ergebnis ansehen“ bzw. „Zurück zur Einheit“.
   - Fertig: „Nächste Übung erstellen“.
   - Kopieren, Vorlage, Drucken, Whiteboard und Löschen liegen unter „Weitere Aktionen“.
7. **Whiteboard:**
   - Stift, Marker, Radierer, Text, Verschieben und Rückgängig bleiben dauerhaft sichtbar.
   - Formen, Auswählen, Zeigen, Wiederholen und „Alles zeigen“ liegen unter „Mehr“.
   - Alle Knöpfe haben Icon, Text und Tooltip.
   - „Zur Einheit“ ist ein beschrifteter Knopf.
8. **Begriffe:**
   - Immer **Einheit**, **Übung**, **Lernverlauf**, **Schüler**.
   - **Senden** statt Freigeben/Zuweisen.
   - **Dokumentation** statt Basis-/Lern-Dokumentation.
   - **Link für das Gerät des Schülers** statt Übungsmodus.
   - **Whiteboard** auch beim Schüler.
