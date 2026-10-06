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
3. Variablen: optional `ANTHROPIC_API_KEY`.
4. Settings → Networking → Domain erzeugen. Replicas auf 1 lassen.

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

- Anmelden mit `niko` bzw. `thomas` und dem Startpasswort `lernheft`; die App verlangt sofort ein
  neues Passwort. Das also direkt nach dem Deploy erledigen.
- Die Seite läuft über HTTPS, die Anmelde-Cookies sind deshalb nur über HTTPS gültig.
  `INSECURE_COOKIES=1` nur für lokale Tests ohne HTTPS setzen.

## Sicherung

- Mehr › Datenexport (Admin) erzeugt ein JSON-Backup aller Daten ohne Passwörter.
- Hochgeladenes Material ist nicht im Backup: den Ordner `/data/uploads` zusätzlich sichern, am
  einfachsten über Snapshots des Volumes beim Hoster.

## Umgebungsvariablen

| Variable | Bedeutung |
| --- | --- |
| `DATABASE_PATH` | Datenbankdatei, im Docker-Image `/data/nachhilfe.db` |
| `UPLOADS_PATH` | Ordner für Material, sonst `uploads/` neben der Datenbank |
| `ANTHROPIC_API_KEY` | optional: Claude für neue Aufgaben, Material-Erkennung, formulierte Notizen |
| `PORT` | Port des Servers, Standard 3000 |
| `INSECURE_COOKIES` | `1` erlaubt Anmeldung ohne HTTPS (nur lokal) |
