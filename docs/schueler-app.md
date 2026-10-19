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

- **Nächster Termin** ganz oben: „Jetzt“, „Heute“ oder „Nächster Termin“, die Zeit, der Raum mit
  Gebäude und „online“ oder „vor Ort“. Ohne Raum steht „Raum noch offen“ und kein online/vor Ort.
- **Deine Termine:** diese Woche und, sobald sie veröffentlicht ist, die nächste. Vergangene Termine
  sind grau, ein vergangener ohne Einheit heißt „nicht stattgefunden“.
- Wie bisher (D17/D23) **nur veröffentlichte Plätze** und **ohne Namen**: kein Lehrer, keine anderen
  Schüler. Entwürfe sieht der Schüler nie. Beim Veröffentlichen wird weiterhin niemand
  benachrichtigt (D25).
- Darunter wie bisher die offenen Übungen, der Fortschritt und „Erledigt“.

## Technik

| Datei | Inhalt |
|---|---|
| `lib/planung/schueler-termine.ts` | `termineFuerSchueler(studentId, now?)`: nächster Termin und Wochen, nur veröffentlicht, ohne Namen |
| `app/lernen/[token]/manifest/route.ts` | das Web-App-Manifest **je Schüler**: `start_url` = `scope` = `id` = `/lernen/[token]`, damit die App genau seinen Link öffnet. Unbekannter Token: 404 |
| `app/lernen/[token]/layout.tsx` | verweist auf das Manifest, `appleWebApp` für iOS, `noindex`, Farbe der Statusleiste |
| `components/AppHinweis.tsx` | der Hinweis „Lernheft als App“ mit Install-Knopf, wo der Browser ihn anbietet |
| `components/SchuelerAppLink.tsx` | Link, Öffnen und QR-Code am Schülerprofil |

Es gibt **kein globales Manifest** (`app/manifest.ts`): das würde auch für die Lehrer-Seiten gelten
und als Start nicht den Link des Schülers kennen. Die Lehrer-Seiten bleiben, wie sie sind.
