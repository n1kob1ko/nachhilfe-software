# Prüfung der Aufgabenbanken

Stand: 2026-10-20T02:58:23.348Z

**Die Prüfung hat NICHT stattgefunden.** Die KI ist ausgeschaltet oder es ist kein Schlüssel hinterlegt – es wurde kein einziger Eintrag geprüft.

Die Zahlen unten sind nur die Anzahl der Einträge je Bank, so wie sie in `data/banks/` stehen.
Es wurde kein Eintrag geprüft, nichts in `data/banks/` geändert, und kein Eintrag gilt als in Ordnung.

## Anzahl je Bank

| Bank | Datei | Einträge | nutzbar | review |
|---|---|---:|---:|---:|
| Artikel bestimmen | artikel.json | 1914 | 1914 | 0 |
| Adjektivdeklination | adjektivdeklination.json | 282 | 282 | 0 |
| Präposition und Kasus | praepositionen.json | 99 | 99 | 0 |
| Präteritum | praeteritum.json | 102 | 102 | 0 |
| Perfekt | perfekt.json | 65 | 65 | 0 |
| das/dass | das-dass.json | 347 | 347 | 0 |
| Hauptsatz und Gliedsatz | hauptsatz-gliedsatz.json | 301 | 301 | 0 |

## Sobald ein Schlüssel hinterlegt ist

```
# echter Lauf über alle Einträge (schreibt diesen Bericht neu)
ANTHROPIC_API_KEY=… npm run banks:pruefung

# billiger Probelauf: höchstens 20 Einträge je Bank
ANTHROPIC_API_KEY=… npm run banks:pruefung -- --limit 20

# danach die beanstandeten Einträge markieren lassen („review: true“)
npm run banks:pruefung -- --setzen
```

Der Schlüssel ist der des eingestellten Anbieters (`ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`,
`DEEPSEEK_API_KEY` oder `AI_COMPATIBLE_API_KEY` mit `AI_COMPATIBLE_BASE_URL`; siehe docs/ki-modelle.md).
