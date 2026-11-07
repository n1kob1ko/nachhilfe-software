# Schüler-App: der eigene Link als App am Handy

niko, 2026-10-19: „ich möchte aber auch das schüler die webapp verwenden können damit sie sehen wo
und wann sie unterricht haben“.

Die Schüler-App ist **kein eigenes Programm**, sondern der bestehende geheime Link `/lernen/[token]`
eines Schülers. Am Handy legt der Schüler ihn auf den Home-Bildschirm; danach öffnet er sich wie
eine App (ohne Adressleiste) und zeigt die gesendeten Übungen und seine Termine. Es gibt kein Konto
und kein Passwort; wer den Link hat, sieht diese Seite (wie bisher).

## Ablauf

1. **Lehrer zeigt den Link.** Am Schülerprofil (Übungen und Überblick › Weitere Angaben) steht
   „Schüler-App von Max“: Link kopieren, öffnen oder „QR-Code zum Scannen“ aufklappen.
2. **Schüler scannt** den Code mit der Handy-Kamera und öffnet die Seite.
3. **Als App ablegen.** Die Seite sagt, wie es geht:
   - iPhone/iPad: „Tippe in Safari unten auf Teilen und dann auf „Zum Home-Bildschirm“.“
   - Android mit Chrome: ein Knopf „Installieren“, wenn der Browser ihn anbietet,
     sonst „Tippe im Browser-Menü auf „Zum Startbildschirm hinzufügen“.“
   - Der Hinweis verschwindet in der installierten App und nach einem Tipp auf ✕ (merkt sich das
     Gerät in `localStorage`, Schlüssel `lernheft-app-hinweis`).

## Was der Schüler sieht

Reihenfolge seit dem Audit 2026-11-07 (vorher 4300 px lang, die Start-Knöpfe ganz unten): zuerst, was zu tun ist, dann
wann und wo, der Rest zugeklappt unter **Mehr**.

1. **Offene Übungen** mit „Starten“ / „Weitermachen“ und **Hausübungen** (die offenen zuerst, überfällig, heute, morgen
   markiert; mit Übung führt die Zeile zu ihr; erledigte unter „Erledigt“; ohne Hausübung kein Abschnitt).
2. **Nächster Termin**: „Jetzt“, „Heute“, „Morgen“ oder „Nächster Termin“, dann **Wochentag, Uhrzeit, Ort und Lehrer**
   (niko, 2026-11-03: „Der Raum selbst ist nicht wichtig nur Uhrzeit Ort Lehrer“). Ort ist das Gebäude des Raums, online
   „Online“; ohne Raum „Ort noch offen“. Darunter der Link „Alle Termine und Termin ändern“ (öffnet „Mehr“).
   Passt ein **Tauschangebot** eines anderen Schülers, steht hier „Jemand möchte mit dir tauschen“ mit „Ja, tauschen“.
3. **„Was war heute schwer?“** nur am Tag der Einheit und am Tag danach (Antworten zum Antippen, freier Text,
   „Überspringen“); danach steht die eigene Notiz unter „Mehr“ und bleibt bis zur nächsten Einheit änderbar.
4. **Kommende Prüfungen**: nur geplante ab heute, die nächste zuerst, mit Art, Fach und dem Stoff kurz.
5. **Für nächstes Mal**: was drankommen soll, jederzeit, änderbar bis zur nächsten Einheit (`lib/schueler-notiz.ts`).
6. **Mehr** (zugeklappt; offen nach einer Terminanfrage oder einem Tausch, `?mehr=1`):
   - **Deine Termine:** diese Woche und, sobald sie veröffentlicht ist, die nächste. Vergangene Termine sind grau; ein
     vergangener ohne Einheit bekommt keinen Vermerk (Eltern lesen mit, die App weiß nicht, warum). Nur veröffentlichte
     Plätze (D17/D23), keine anderen Schüler, der eigene Lehrer dabei. Unter jedem kommenden Termin **ein** Eingang
     **„Termin ändern“** mit zwei Wegen: **Tauschen** (Tauschbörse, [planung.md](planung.md#tauschbörse-niko-2026-11-07):
     passende Zeiten anhaken, „Zum Tauschen anbieten“, getauscht wird sofort) und **Andere Zeit anfragen** (freie Zeiten
     oder eine eigene Zeit, Notiz; die Verwaltung bestätigt, [planung.md](planung.md#terminanfragen-plan-33)). Ist ein
     Termin angeboten, steht das dort mit „Zurücknehmen“. Darunter „Deine Anfragen“ mit Zustand.
   - **Von dir eingetragen** mit „Prüfung eintragen“ (Foto vom Stoffzettel).
   - **Deine Unterlagen:** Präsentationen aus seinen Einheiten, ohne Vortragstext, und Übungen mit freigegebener Lösung.
   - **Vergangene Einheiten:** Datum, Fach, Thema, geübte Fähigkeiten, gelöste Aufgaben. Keine Notizen des Lehrers.
   - **Dein Fortschritt** und **Erledigt**.

Läuft gerade eine Einheit, steht ganz oben „Whiteboard öffnen“. Beim Veröffentlichen wird weiterhin niemand
benachrichtigt (D25).

## Technik

| Datei | Inhalt |
|---|---|
| `lib/planung/schueler-termine.ts` | `termineFuerSchueler(studentId, now?)`: nächster Termin und Wochen, nur veröffentlicht, ohne Namen |
| `lib/planung/terminanfragen.ts`, `components/planung/Terminanfragen.tsx`, `app/terminanfrage-actions.ts` | Terminanfragen: freie Zeiten, Anfragen ohne Namen anderer Schüler |
| `app/lernen/[token]/manifest/route.ts` | das Web-App-Manifest **je Schüler**: `start_url` = `scope` = `id` = `/lernen/[token]`, damit die App genau seinen Link öffnet. Unbekannter Token: 404 |
| `app/lernen/[token]/layout.tsx` | verweist auf das Manifest, `appleWebApp` für iOS, `noindex`, Farbe der Statusleiste |
| `components/AppHinweis.tsx` | der Hinweis „DreamStudy als App“ mit Install-Knopf, wo der Browser ihn anbietet |
| `components/SchuelerAppLink.tsx` | Link, Öffnen und QR-Code am Schülerprofil |
| `lib/schuelerportal.ts` | die Übersicht: Prüfungen, Hausübungen, Unterlagen, vergangene Einheiten; nur seine Zeilen, nur freigegebene Felder |
| `components/lernen/` | die Abschnitte der Übersicht |
| `app/lernen/[token]/praesentation/[id]/page.tsx` | eine Präsentation aus „Deine Unterlagen“; jede andere id ist 404 |

Es gibt **kein globales Manifest** (`app/manifest.ts`): das würde auch für die Lehrer-Seiten gelten
und als Start nicht den Link des Schülers kennen. Die Lehrer-Seiten bleiben, wie sie sind.
