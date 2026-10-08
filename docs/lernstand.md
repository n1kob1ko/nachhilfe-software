# Lernstand einer Fähigkeit

Eine zentrale Funktion: `masteryAt()` in `lib/mastery.ts`. Keine KI.

1. **Jede erledigte Aufgabe ergibt einen Wert zwischen 0 und 1**
   - beim 1. Versuch richtig, ohne Hilfe: 1,0
   - beim 2. Versuch: 0,7
   - ab dem 3. Versuch: 0,5
   - je geöffnete Hilfe −0,15 (richtig bleibt mindestens 0,35)
   - am Ende falsch oder Lösung angesehen: 0
   - vom Lehrer „teilweise richtig“ bewertet (freie Antwort, Korrektur): 0,5, je Hilfe −0,15, mindestens 0,25
   - freie Antworten zählen erst, wenn der Lehrer sie bewertet hat; ebenso Rechenwege und Sachaufgaben,
     die die App nicht sicher prüfen kann ([rechenwege.md](rechenwege.md))
   - automatisch „teilweise richtig“ (Rechenweg mit fehlender Einheit, Sachaufgabe mit einem Teil richtig): 0,5 wie oben
   - eine dokumentierte Einheit zählt mit dem Verständnis 1–5 (→ 0…1), ein Test mit Punkten oder Note
2. **Gewicht**
   - Aufgabe nach Schwierigkeit 1–5: 0,6 / 0,8 / 1,0 / 1,25 / 1,5
   - Einheit 1,5, Test 2
   - das Gewicht halbiert sich alle 45 Tage (Aktualität)
3. **Lernstand** = gewichteter Schnitt plus eine neutrale „virtuelle Aufgabe“ mit 50 %, damit eine
   einzelne richtige Antwort nicht 100 % zeigt (eine richtige Aufgabe → 75 %).
4. **Arbeitszeit zählt nicht**: langsam kann auch sorgfältig heißen. Sie wird getrennt angezeigt
   (Kennzahlen) und fließt in die empirische Schwierigkeit einer Aufgabe ein.
5. **Statuswörter**: ab 85 % sicher · ab 70 % gut · ab 50 % üben · darunter kritisch · ohne Daten
   nicht getestet.

Beispiel im Profil: „Kürzen 91 % · sicher / Erweitern 82 % · gut / Dividieren 58 % · üben /
Sachaufgaben 43 % · kritisch“. Thema und Fach sind der Schnitt ihrer Fähigkeiten.
