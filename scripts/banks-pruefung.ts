/**
 * Prüfung der Aufgabenbanken (Phase 1 des Merges, Schritt 7 — tommys-merge.md).
 *
 * Die Einträge in `data/banks/` sind importiert und nie gelesen worden (Risiko „Bank quality“ im Plan).
 * Dieser Lauf legt sie Bank für Bank der KI-Prüfung in `lib/ai/qualitaetstest.ts` (`runBankPruefung`)
 * vor und schreibt die beanstandeten Einträge mit ihrem Grund nach `docs/banks-pruefung.md`.
 *
 * Aufrufe:
 *   npm run banks:pruefung                        echter Lauf über alle Einträge
 *   npm run banks:pruefung -- --limit 20          billiger Probelauf: höchstens 20 Einträge je Bank
 *   npm run banks:pruefung -- --bank artikel      nur eine Bank (mehrfach möglich)
 *   npm run banks:pruefung -- --setzen            setzt „review: true“ für die beanstandeten Einträge
 *   npm run banks:pruefung -- --bericht <datei>   anderer Bericht (Standard docs/banks-pruefung.md)
 *
 * Nichts wird ohne `--setzen` geschrieben außer dem Bericht: ob ein beanstandeter Eintrag markiert wird,
 * entscheidet ein Mensch. Ohne Schlüssel (oder mit aufgebrauchtem Budget) läuft nichts, der Bericht wird
 * trotzdem geschrieben und sagt genau das — der Lauf endet dann mit einem Fehlercode.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BANK_FILES, BANK_IDS, bankFile, bankItems, bankStats, type BankId } from "../lib/banks";
import { runBankPruefung } from "../lib/ai/qualitaetstest";
import type { BankPruefungErgebnis } from "../lib/ai/qualitaetstest";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const values = (name: string) => args.flatMap((a, i) => (a === `--${name}` && args[i + 1] ? [args[i + 1]] : []));

const BERIGHT = value("bericht") ?? path.join(process.cwd(), "docs", "banks-pruefung.md");
const kurz = (v: unknown, max = 300) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? `${s.slice(0, max)}…` : s;
};
/** Ein Wert für eine Zeile des Berichts: Zeilenumbrüche und senkrechte Striche entschärft. */
const zellText = (v: unknown) => kurz(v).replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");

async function main() {
  const ids = values("bank") as BankId[];
  for (const id of ids) {
    if (!BANK_IDS.includes(id)) {
      console.error(`Unbekannte Bank „${id}“. Möglich sind: ${BANK_IDS.join(", ")}.`);
      process.exit(2);
    }
  }
  const limit = value("limit") ? Math.max(1, Number(value("limit"))) : undefined;
  const setzen = flag("setzen");
  const stand = new Date().toISOString();

  const stats = bankStats();
  const fehler = stats.filter((s) => s.error);
  for (const s of fehler) console.error(`Achtung: ${s.file} ist nicht lesbar: ${s.error}`);

  const ergebnis = await runBankPruefung({
    banks: ids.length ? ids : undefined,
    limit,
    meta: { trigger: "banken-pruefung" },
  });

  const md = bericht(ergebnis, { stand, limit, ids });
  fs.mkdirSync(path.dirname(BERIGHT), { recursive: true });
  fs.writeFileSync(BERIGHT, md, "utf8");
  console.log(`Bericht geschrieben: ${path.relative(process.cwd(), BERIGHT)}`);
  console.log(ergebnis.message);

  if (!ergebnis.ran) {
    console.error(`\nDie Prüfung der Banken hat NICHT stattgefunden: ${ergebnis.message}`);
    console.error("Sobald ein Schlüssel für den eingestellten Anbieter gesetzt ist:");
    console.error("  ANTHROPIC_API_KEY=… npm run banks:pruefung");
    process.exitCode = 1;
    return;
  }

  const markiert = ergebnis.banks.reduce((n, b) => n + b.flagged.length, 0);
  console.log(`Geprüft: ${ergebnis.banks.reduce((n, b) => n + b.checked, 0)} Einträge, markiert: ${markiert}, Kosten: ${ergebnis.usd.toFixed(3)} $`);

  if (setzen) {
    if (!markiert) {
      console.log("Nichts zu setzen: kein Eintrag wurde beanstandet.");
      return;
    }
    const geaendert = setzenMarkierungen(ergebnis);
    console.log(`review: true gesetzt in ${geaendert.length} Bankdatei(en): ${geaendert.map((f) => `data/banks/${f}`).join(", ")}`);
    console.log("Bitte die Einträge im Bericht ansehen: berichtigen und „review“ entfernen oder löschen.");
  } else if (markiert) {
    console.log(`\n${markiert} Einträge sind beanstandet, aber nichts wurde geändert.`);
    console.log("Markieren („review: true“, dann überspringen die Generatoren sie): npm run banks:pruefung -- --setzen");
  }
}

/**
 * Setzt `review: true` in genau den beanstandeten Einträgen. Nur auf ausdrücklichen Wunsch (`--setzen`),
 * nie automatisch: ein beanstandeter Eintrag ist ein Vorschlag der KI, keine Entscheidung.
 */
function setzenMarkierungen(ergebnis: BankPruefungErgebnis): string[] {
  const geaendert: string[] = [];
  for (const bank of ergebnis.banks) {
    if (!bank.flagged.length) continue;
    const items = bankItems(bank.id) as Record<string, unknown>[];
    let n = 0;
    for (const f of bank.flagged) {
      const i = f.nr - 1;
      // Sicherheitsnetz: nur setzen, wenn dort wirklich der beanstandete Eintrag steht
      if (!items[i] || JSON.stringify(items[i]) !== JSON.stringify(f.item)) {
        console.error(`Übersprungen: ${BANK_FILES[bank.id]} Nr. ${f.nr} hat sich seit der Prüfung geändert.`);
        continue;
      }
      if (items[i].review === true) continue;
      items[i] = { ...items[i], review: true };
      n++;
    }
    if (!n) continue;
    fs.writeFileSync(bankFile(bank.id), `${JSON.stringify(items, null, 2)}\n`, "utf8");
    geaendert.push(BANK_FILES[bank.id]);
  }
  return geaendert;
}

/** Der Bericht für die Hand. Er sagt immer genau, was geprüft wurde — und was nicht. */
export function bericht(ergebnis: BankPruefungErgebnis, o: { stand: string; limit?: number; ids: BankId[] }): string {
  const grenze = o.limit ? `\nProbelauf: höchstens ${o.limit} Einträge je Bank.` : "";
  const banken = ergebnis.banks;
  const kopf = [
    "# Prüfung der Aufgabenbanken",
    "",
    `Stand: ${o.stand}${grenze}`,
    "",
  ];

  if (!ergebnis.ran) {
    return [
      ...kopf,
      `**Die Prüfung hat NICHT stattgefunden.** ${ergebnis.message}`,
      "",
      "Die Zahlen unten sind nur die Anzahl der Einträge je Bank, so wie sie in `data/banks/` stehen.",
      "Es wurde kein Eintrag geprüft, nichts in `data/banks/` geändert, und kein Eintrag gilt als in Ordnung.",
      "",
      "## Anzahl je Bank",
      "",
      "| Bank | Datei | Einträge | nutzbar | review |",
      "|---|---|---:|---:|---:|",
      ...statsZeilen(banken),
      "",
      "## Sobald ein Schlüssel hinterlegt ist",
      "",
      "```",
      "# echter Lauf über alle Einträge (schreibt diesen Bericht neu)",
      "ANTHROPIC_API_KEY=… npm run banks:pruefung",
      "",
      "# billiger Probelauf: höchstens 20 Einträge je Bank",
      "ANTHROPIC_API_KEY=… npm run banks:pruefung -- --limit 20",
      "",
      "# danach die beanstandeten Einträge markieren lassen („review: true“)",
      "npm run banks:pruefung -- --setzen",
      "```",
      "",
      "Der Schlüssel ist der des eingestellten Anbieters (`ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`,",
      "`DEEPSEEK_API_KEY` oder `AI_COMPATIBLE_API_KEY` mit `AI_COMPATIBLE_BASE_URL`; siehe docs/ki-modelle.md).",
      "",
    ].join("\n");
  }

  const markiert = banken.reduce((n, b) => n + b.flagged.length, 0);
  const geprueft = banken.reduce((n, b) => n + b.checked, 0);
  const ohneAntwort = banken.reduce((n, b) => n + b.unanswered, 0);
  return [
    ...kopf,
    `Modell: ${ergebnis.model} (KI-Bereich „Aufgaben“) · geprüft: ${geprueft} Einträge · beanstandet: ${markiert} · Kosten: ${ergebnis.usd.toFixed(3)} $`,
    "",
    "Geprüft wurden die vorhandenen Einträge in `data/banks/`, Bank für Bank, mit derselben Anweisung,",
    "nach der neue Einträge entstehen (`lib/ai/banken.ts`), und derselben Kostengrenze wie der",
    "KI-Qualitätstest. Die Einträge bleiben dabei unverändert und weiterhin übbar: dieser Bericht ist ein",
    "Vorschlag für einen Menschen, keine Änderung an den Banken.",
    ...(ohneAntwort ? ["", `${ohneAntwort} Einträge bekamen keine Beurteilung und gelten nicht als geprüft.`] : []),
    "",
    "## Anzahl je Bank",
    "",
    "| Bank | Datei | Einträge | nutzbar | review | geprüft | beanstandet |",
    "|---|---|---:|---:|---:|---:|---:|",
    ...banken.map((b) => `| ${zellText(b.label)} | ${b.file} | ${b.total} | ${b.usable} | ${b.review} | ${b.checked} | ${b.flagged.length} |`),
    "",
    "## Beanstandete Einträge",
    "",
    ...(markiert ? banken.flatMap((b) => flaggedAbschnitt(b)) : ["Keine Beanstandungen."]),
    "",
    "## Was jetzt zu tun ist",
    "",
    "Ein beanstandeter Eintrag wird in der Bankdatei mit `\"review\": true` markiert. `lib/banks.ts`",
    "überspringt ihn dann in `bankUsable` — die Generatoren üben ihn nicht mehr, er bleibt aber in der",
    "Datei stehen, bis ihn jemand ansieht.",
    "",
    "```",
    "# genau die oben gelisteten Einträge markieren (nichts anderes wird geändert)",
    "npm run banks:pruefung -- --setzen",
    "```",
    "",
    "Danach den Eintrag berichtigen und `review` wieder entfernen oder den Eintrag löschen. Der",
    "Genus-Abgleich der Artikel-Einträge läuft über `lib/german-nouns.ts` und nur, wenn ein Geschlecht",
    "dasteht — geraten wird nie.",
    "",
  ].join("\n");
}

function statsZeilen(banken: BankPruefungErgebnis["banks"]): string[] {
  return banken.map((b) => `| ${zellText(b.label)} | ${b.file} | ${b.total} | ${b.usable} | ${b.review} |`);
}

function flaggedAbschnitt(bank: BankPruefungErgebnis["banks"][number]): string[] {
  if (!bank.flagged.length) return [];
  return [
    `### ${bank.label} (\`${bank.file}\`) — ${bank.flagged.length}`,
    "",
    ...bank.flagged.flatMap((f) => [
      `- **Nr. ${f.nr}** (Eintrag ${f.nr} in der Datei) — Grund: ${zellText(f.reason)}`,
      `  - Eintrag: \`${kurz(f.item, 400)}\``,
      ...(f.fix ? [`  - Vorschlag (gegen das Bankschema geprüft): \`${kurz(f.fix, 400)}\``] : []),
      ...(f.fixProblem ? [`  - ${zellText(f.fixProblem)}`] : []),
    ]),
    "",
  ];
}

// Nur beim direkten Aufruf (`npm run banks:pruefung`) loslaufen — die Tests lesen `bericht` hier.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

