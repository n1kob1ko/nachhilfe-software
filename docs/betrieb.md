# Betrieb: Lernheft dauerhaft online

Lernheft speichert alles in einer SQLite-Datei und hochgeladenes Material in einem Ordner daneben.
Whiteboard und Tablet-Livestatus laufen über den Serverprozess selbst. Deshalb braucht die App:

- **einen dauerhaft laufenden Server** (genau eine Instanz, nicht mehrere parallel),
- **einen festen Speicher** (Volume), der Neustarts und neue Versionen übersteht.

Vercel passt dafür nicht: Das Dateisystem ist dort schreibgeschützt bzw. wird bei jedem Neustart
geleert, und Anfragen laufen auf wechselnden Instanzen. Ohne `DATABASE_PATH` startet die App auf
Vercel bewusst mit einer klaren Fehlermeldung statt still Daten zu verlieren.

## Mit Docker (empfohlen)

Das `Dockerfile` baut die App und startet sie auf Port 3000 (oder `PORT`). Datenbank und Uploads
liegen im Volume `/data` (`/data/nachhilfe.db`, `/data/uploads`).

```sh
docker build -t lernheft .
docker run -d --name lernheft -p 3000:3000 -v lernheft-daten:/data \
  -e ANTHROPIC_API_KEY=... lernheft
```

### Railway

1. New Project → Deploy from GitHub repo → `nachhilfe-software`. Railway erkennt das `Dockerfile`.
2. Im Dienst: Volume hinzufügen, Mount-Pfad `/data`.
3. Variablen: `RAILWAY_RUN_UID=0` (Railway hängt Volumes als root ein, das Image läuft sonst als Benutzer `node` und dürfte nicht schreiben), optional `ANTHROPIC_API_KEY`.
4. Settings → Networking → Domain erzeugen. Replicas auf 1 lassen, Region am besten in Europa (z. B. Amsterdam).

### Fly.io

```sh
fly launch --no-deploy          # erkennt das Dockerfile, interne Port 3000
fly volumes create daten --size 1
# in fly.toml: [mounts] source = "daten", destination = "/data"
fly secrets set ANTHROPIC_API_KEY=...
fly deploy
fly scale count 1
```

### Render

Neuer Web Service aus dem Repo (Runtime Docker), Disk mit Mount-Pfad `/data` anlegen, eine Instanz.

## Nach dem ersten Start

- Das Demo-Startpasswort `lernheft` steht öffentlich in dieser Doku. Auf dem Server
  (`NODE_ENV=production`) gilt es deshalb immer als falsch.
- Vor dem ersten Start in Railway unter Variables `INITIAL_TEACHER_PASSWORD` setzen (ein langes,
  eigenes Passwort, nirgends sonst verwendet). Damit melden sich `niko` und `thomas` das erste Mal
  an; die App verlangt sofort ein eigenes Passwort. Konten, die noch auf `lernheft` stehen, bekommen
  beim nächsten Start dieses Passwort. Bereits geänderte Passwörter bleiben unberührt.
- Neue Lehrer und „Passwort zurücksetzen“ unter Mehr › Lehrer bekommen ein zufälliges Startpasswort,
  das nur einmal angezeigt wird. Das ist der normale Weg, wenn ein Kollege sein Passwort vergessen hat.
- Hängt noch ein Konto am öffentlichen Startpasswort, steht beim Start eine Warnung im Log (nur die
  Benutzernamen, nie ein Passwort).
- Die Seite läuft über HTTPS, die Anmelde-Cookies sind deshalb nur über HTTPS gültig.
  `INSECURE_COOKIES=1` nur für lokale Tests ohne HTTPS setzen.

## Sicherheit

- Passwörter: scrypt mit zufälligem Salz, Vergleich in konstanter Zeit. Nach dem Ändern melden sich
  alle anderen Geräte des Lehrers ab, das alte Passwort funktioniert nicht mehr.
- Sitzungs-Cookie `lernheft_session`: `HttpOnly`, `Secure`, `SameSite=Lax`, 30 Tage. Tablet-Cookie
  `lernheft_geraet`: `HttpOnly`, `Secure`, `SameSite=Lax`, nur für `/geraet`.
- Anmeldesperre (im Speicher, ein Neustart setzt sie zurück): 5 falsche Passwörter sperren einen
  Benutzernamen 10 Minuten, egal ob es ihn gibt; 20 Fehlversuche einer Adresse innerhalb von
  15 Minuten sperren die Adresse 15 Minuten. Die Fehlermeldung ist immer dieselbe.
  Die Adresse kommt aus `X-Real-IP`, das der Railway-Proxy setzt.
- Pairing-Codes für Tablets: 6 Ziffern, 10 Minuten gültig, einmal verwendbar, 8 Fehlversuche pro
  Adresse in 10 Minuten.
- `ANTHROPIC_API_KEY` wird nur auf dem Server gelesen und geht nie an den Browser.
- `/health` prüft Datenbank und Schreibrecht und antwortet nur `{"ok":true}` oder 503. In Railway
  unter Settings › Deploy › Healthcheck Path `/health` eintragen.
- Live-Verbindungen (Whiteboard, Tablet) schließt der Server nach 10 Minuten selbst, der Browser
  verbindet sich nach 2 Sekunden neu. Railway beendet sonst jede Anfrage nach 15 Minuten.

## Was nach einem Neustart erhalten bleibt

| Was | Wo | Nach Neustart |
| --- | --- | --- |
| Datenbank | `/data/nachhilfe.db` (+ `-wal`, `-shm`) | bleibt |
| Material | `/data/uploads` | bleibt |
| Anmeldungen | Tabelle `teacher_sessions` | bleiben, niemand muss sich neu anmelden |
| Tablets | Tabelle `student_devices`, Cookie am Tablet | bleiben verbunden |
| Was das Tablet zeigt | `units.device_view` | bleibt |
| Whiteboard | Tabelle `whiteboard_pages`, gespeichert 0,4 s nach dem Zeichnen | bleibt bis auf die letzten Striche vor dem Neustart |
| Anmeldesperren, Pairing-Fehlversuche | Speicher | werden zurückgesetzt |
| Live-Verbindungen | Speicher | Browser verbinden sich selbst neu |

## Sicherung

Drei Ebenen, alle drei nutzen:

1. **Railway Volume-Backups** (gegen Fehler am Server, ganzer Speicher): im Dienst
   `nachhilfe-software` › Backups-Tab die Zeitpläne **Daily** (6 Tage aufbewahrt) und **Weekly**
   (27 Tage) einschalten, optional **Monthly** (89 Tage). Vor riskanten Änderungen dort zusätzlich
   „Backup now“. Wiederherstellen: beim gewünschten Backup „Restore“, Railway hängt eine Kopie als
   neues Volume an `/data` und legt das als Staged Change an; über „Details“ prüfen und „Deploy“.
   Das alte Volume bleibt abgehängt im Projekt. Achtung: Wird das Volume gelöscht, sind auch diese
   Backups weg.
2. **App-Sicherungen** (gegen versehentlich gelöschte Daten): die App sichert einmal am Tag
   Datenbank und Material nach `/data/backups/sicherung-<Zeit>/` (konsistente Kopie per
   `VACUUM INTO`, Material als Hardlinks, `manifest.json` mit Prüfsumme und Anzahlen). Die letzten 14
   bleiben (`BACKUP_KEEP`). Mehr › Datenexport zeigt die Liste und hat „Jetzt sichern“.
3. **Kopie außerhalb von Railway**: ab und zu unter Mehr › Datenexport die JSON-Sicherung
   herunterladen (alle Daten ohne Passwörter, ohne Material-Dateien).

### App-Sicherung wiederherstellen

1. Mehr › Datenexport › bei der gewünschten Sicherung „Wiederherstellen“ › „Diese Sicherung
   wiederherstellen“. Die App prüft die Prüfsumme und legt die Kopie nach `/data/restore-pending`.
2. In Railway den Dienst neu starten (Deployments › ⋮ › Restart).
3. Beim Start prüft die App die Kopie (`PRAGMA integrity_check`), verschiebt den bisherigen Stand nach
   `/data/vor-wiederherstellung-<Zeit>/` und setzt die Sicherung ein. Im Log steht
   „Sicherung … wiederhergestellt“. Ist die Kopie beschädigt, bleibt alles wie es war und die Kopie
   landet in `/data/restore-fehlgeschlagen-<Zeit>`. Anmeldungen, die jünger als die Sicherung sind,
   gibt es danach nicht mehr: einfach neu anmelden (mit dem Passwort, das zur Zeit der Sicherung galt).
4. Rückgängig machen: genauso, nur mit dem Ordner `vor-wiederherstellung-…` (per `railway ssh`:
   `mkdir /data/restore-pending && cp -a /data/vor-wiederherstellung-<Zeit>/. /data/restore-pending/ &&
   echo zurueck > /data/restore-pending/quelle.txt`, danach Restart).

Ohne Admin-Zugang geht Schritt 1 auch per `railway ssh`:
`cp -a /data/backups/sicherung-<Zeit> /data/restore-pending && echo sicherung-<Zeit> > /data/restore-pending/quelle.txt`.

## Umgebungsvariablen

| Variable | Bedeutung |
| --- | --- |
| `DATABASE_PATH` | Datenbankdatei, im Docker-Image `/data/nachhilfe.db` |
| `UPLOADS_PATH` | Ordner für Material, sonst `uploads/` neben der Datenbank |
| `ANTHROPIC_API_KEY` | optional: Claude für neue Aufgaben, Echtzeit-Hinweise, Material-Erkennung, formulierte Notizen |
| `AI_MODEL_FAST` | Modell für die Echtzeit-Analyse, Standard `claude-haiku-4-5` |
| `AI_MODEL_STANDARD` | Modell für Aufgaben, Freitext, Auswertungen, Material, Standard `claude-sonnet-5-5` |
| `AI_MODEL_DEEP` | Modell für die Tiefenanalyse (nur auf Klick), Standard `claude-opus-5-5` |
| `AI_MONTHLY_BUDGET_USD` | Monatsbudget für KI in US-Dollar, Standard 10. Ab 100 % keine Echtzeit-Analyse, ab 120 % gar kein KI-Aufruf |
| `AI_BUDGET_WARN` | Warnschwelle als Anteil, Standard 0.8 |
| `AI_REALTIME_MAX_PER_HOUR` | höchstens so viele Echtzeit-Analysen pro Einheit und Stunde, Standard 40 |
| `AI_PRICES_JSON` | Preise überschreiben, z. B. `{"claude-neu":{"in":2,"out":10}}` (US-Dollar je 1 Mio. Tokens) |
| `AI_DISABLED` | `1` schaltet alle KI-Aufrufe ab, die App läuft ohne KI weiter |
| `PORT` | Port des Servers, Standard 3000 |
| `INSECURE_COOKIES` | `1` erlaubt Anmeldung ohne HTTPS (nur lokal) |
| `INITIAL_TEACHER_PASSWORD` | Startpasswort für die ersten Konten auf dem Server (geheim halten) |
| `ALLOW_DEFAULT_PASSWORD` | `1` erlaubt `lernheft` auch mit `NODE_ENV=production` (nur lokale Tests) |
| `BACKUP_PATH` | Ordner der App-Sicherungen, sonst `backups/` neben der Datenbank |
| `BACKUP_KEEP` | Anzahl App-Sicherungen, die bleiben, Standard 14 |
| `BACKUP_INTERVAL_HOURS` | Abstand der App-Sicherungen, Standard 24 |
| `BACKUP_DISABLED` | `1` schaltet die automatische App-Sicherung ab |
