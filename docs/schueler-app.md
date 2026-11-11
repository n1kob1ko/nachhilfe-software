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

Seit 2026-11-08 mehrere Seiten statt einer langen (niko: „ein One-Pager ist zu unübersichtlich“), seit 2026-11-11
**fünf**: „Spiele“ kam dazu (niko: „es sollte übersichtlicher sein, wo Spiele sind, und besser getrennt“; alle
Lernspiele und die Duelle, docs/lernspiele.md). Am Handy wechselt man mit der Leiste unten
(Start · Termine · Spiele · Prüfungen · Fortschritt, `components/lernen/SchuelerNav.tsx`), am Laptop mit
der Reihe unter dem Kopf. Unterseiten (eine Übung, Prüfung eintragen, eine Präsentation) behalten die Leiste.

1. **Start** (`/lernen/[token]`): nur, was jetzt zu tun ist.
   - **Nächster Termin** gleich unter der Begrüßung (niko, 2026-11-08: die Zeit ist für den Schüler das Wichtigste): „Jetzt“, „Heute“, „Morgen“ oder „Nächster Termin“, dann **Wochentag, Uhrzeit, Ort und
     Lehrer** (niko, 2026-11-03: „Der Raum selbst ist nicht wichtig nur Uhrzeit Ort Lehrer“). Ort ist das Gebäude des
     Raums, online „Online“; ohne Raum „Ort noch offen“. Darunter „Alle Termine und Termin ändern“ (Seite Termine).
   - **Offene Übungen** mit „Starten“ / „Weitermachen“ und **Hausübungen** (die offenen zuerst, überfällig, heute,
     morgen markiert; mit Übung führt die Zeile zu ihr; erledigte unter „Erledigt“; ohne Hausübung kein Abschnitt).
   - **„Was war heute schwer?“** nur am Tag der Einheit und am Tag danach (Antworten zum Antippen, freier Text,
     „Überspringen“); danach steht die Notiz unter Fortschritt und bleibt bis zur nächsten Einheit änderbar.
   - Läuft gerade eine Einheit, steht „Whiteboard öffnen“ direkt unter dem Termin. Unten der Hinweis „DreamStudy als App“.
2. **Termine** (`/termine`): der nächste Termin groß; passt ein **Tauschangebot** eines anderen Schülers, steht hier
   „Jemand möchte mit dir tauschen“ mit „Ja, tauschen“. Dann **Alle Termine**: diese Woche und, sobald sie
   veröffentlicht ist, die nächste. Vergangene Termine sind grau; ein vergangener ohne Einheit bekommt keinen Vermerk
   (Eltern lesen mit, die App weiß nicht, warum). Nur veröffentlichte Plätze (D17/D23), keine anderen Schüler, der
   eigene Lehrer dabei. Unter jedem kommenden Termin **ein** Eingang **„Termin ändern“** mit zwei Wegen: **Tauschen**
   (Tauschbörse, [planung.md](planung.md#tauschbörse-niko-2026-11-07): passende Zeiten anhaken, „Zum Tauschen
   anbieten“, getauscht wird sofort) und **Andere Zeit anfragen** (freie Zeiten oder eine eigene Zeit, Notiz; die
   Verwaltung bestätigt, [planung.md](planung.md#terminanfragen-plan-33)). Ist ein Termin angeboten, steht das dort
   mit „Zurücknehmen“. Darunter „Deine Anfragen“ mit Zustand und **Für nächstes Mal** (was drankommen soll, änderbar
   bis zur nächsten Einheit, `lib/schueler-notiz.ts`). Nach einer Anfrage oder einem Tausch leitet die App hierher
   zurück (`?anfrage_ok=` / `?anfrage_fehler=`).
3. **Prüfungen** (`/pruefungen`): **Kommende Prüfungen** (nur geplante ab heute, die nächste zuerst, mit Art, Fach und
   dem Stoff kurz), **Von dir eingetragen** mit „Prüfung eintragen“ (Foto vom Stoffzettel) und **Deine Unterlagen**
   (Präsentationen aus seinen Einheiten, ohne Vortragstext, und Übungen mit freigegebener Lösung).
4. **Fortschritt** (`/fortschritt`): **Deine Fähigkeiten** (zuletzt geübt, Stand und Trend), die eigene Notiz „Was war
   heute schwer?“, **Vergangene Einheiten** (Datum, Fach, Thema, geübte Fähigkeiten, gelöste Aufgaben; keine Notizen
   des Lehrers) und **Erledigt**.

Beim Veröffentlichen wird weiterhin niemand benachrichtigt (D25).

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
| `app/lernen/[token]/page.tsx`, `termine/`, `spiele/`, `pruefungen/`, `fortschritt/` | die fünf Seiten |
| `components/lernen/SchuelerNav.tsx` | die Leiste unten (Handy) und die Reihe oben (Laptop) |
| `components/lernen/` | die Abschnitte der Seiten |
| `app/lernen/[token]/praesentation/[id]/page.tsx` | eine Präsentation aus „Deine Unterlagen“; jede andere id ist 404 |

Es gibt **kein globales Manifest** (`app/manifest.ts`): das würde auch für die Lehrer-Seiten gelten
und als Start nicht den Link des Schülers kennen. Die Lehrer-Seiten bleiben, wie sie sind.
