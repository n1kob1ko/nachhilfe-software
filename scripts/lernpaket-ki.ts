/**
 * „Lernpaket mit KI entwerfen“ (lib/lernpaket-ki.ts) für eine Fähigkeit, ohne die App. Eigene Wegwerf-Datenbank,
 * keine Schülerdaten. Zeigt Tokens, Kosten, Schritte und welche Aufgaben aus dem Bestand und von der KI kommen.
 *
 *   npm run ai:lernpaket -- --skill deutsch.grammatik.faelle              Probelauf ohne Schlüssel, kostet nichts
 *   npm run ai:lernpaket -- --skill deutsch.grammatik.faelle --echt       echte Anfrage an den eingestellten Anbieter (etwa 15–25 Cent)
 *   … --schulart Mittelschule --klasse 2 --dauer 50 --schwierigkeit mittel --hinweise "verwechseln Dativ und Akkusativ" --datei paket.json
 *
 * Im Probelauf antwortet ein Platzhalter mit einem kleinen, gültigen Paket; die Tokens sind aus den echten
 * Prompts geschätzt (etwa 3,2 Zeichen pro Token, Denken +80 %). Erst --echt misst sie.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const usd = (x: number) => `${x.toLocaleString("de-AT", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} $`;
const zahl = (n: number) => n.toLocaleString("de-AT");

async function main() {
  const skillId = value("skill");
  if (!skillId) {
    console.error("Bitte eine Fähigkeit angeben: --skill <Kennung>, z. B. --skill deutsch.grammatik.faelle (die Kennung steht in der Adresse der Fähigkeitsseite).");
    process.exitCode = 1;
    return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-lernpaket-"));
  process.env.DATABASE_PATH = path.join(dir, "probe.db");
  try {
    const real = flag("echt");
    const router = await import("../lib/ai/router");
    const ki = await import("../lib/lernpaket-ki");
    const { getLernpaket, exportiereLernpaket } = await import("../lib/lernpakete");
    const eingabe = {
      skillId,
      schulart: value("schulart") ?? "",
      klasse: Number(value("klasse")) || null,
      dauer: Number(value("dauer")) || ki.KI_DAUER.vorgabe,
      schwierigkeit: value("schwierigkeit") ?? "mittel",
      hinweise: value("hinweise") ?? "",
    };
    const geprueft = ki.pruefeEingabe(eingabe);
    if ("fehler" in geprueft) {
      console.error(geprueft.fehler.join("\n"));
      process.exitCode = 1;
      return;
    }
    if (real) {
      if (!router.aiEnabled("lernpaket")) {
        console.error("Für --echt braucht es einen Schlüssel für den eingestellten Anbieter (z. B. ANTHROPIC_API_KEY oder OPENROUTER_API_KEY).");
        process.exitCode = 1;
        return;
      }
    } else {
      router.setTransport(probeTransport(geprueft.auftrag.dauer));
    }
    const bestand = ki.bestandFuer(geprueft.auftrag);
    const route = (await import("../lib/ai/config")).routeFor("lernpaket");
    console.log(`${real ? "Echte Anfrage" : "Probelauf ohne Schlüssel (geschätzte Tokens)"} · ${route.provider}: ${route.model}`);
    console.log(`Fähigkeit ${skillId} · ${geprueft.auftrag.stufe || "jede Schulart"} · ${geprueft.auftrag.dauer} min · ${bestand.length} Aufgaben im Bestand (${bestand.filter((b) => b.herkunft === "bibliothek").length} Bibliothek, ${bestand.filter((b) => b.herkunft === "generator").length} Generator)`);
    console.log(`Geschätzt vor dem Klick: ${ki.kostenSchaetzung().text}`);

    const res = await ki.entwerfeLernpaket(eingabe, null);
    if (!res.ok) {
      console.error(`Kein Entwurf: ${res.error}`);
      const k = ki.kiKosten((await import("../lib/ai/log")).lastCallOf("lernpaket")?.id ?? null);
      if (k) console.error(`Tokens ${zahl(k.tokensEin)} ein, ${zahl(k.tokensAus)} aus · Kosten ${usd(k.usd)} (${k.cent} Cent)`);
      process.exitCode = 1;
      return;
    }
    const p = getLernpaket(res.id)!;
    const k = ki.kiKosten(res.callId);
    if (k) {
      console.log(`Modell ${k.modell} · ${k.sekunden} s`);
      console.log(`Tokens ${zahl(k.tokensEin)} ein, ${zahl(k.tokensAus)} aus${k.denken ? ` (davon ${zahl(k.denken)} Denken)` : ""}`);
      console.log(`Kosten ${usd(k.usd)} (${k.cent} Cent)`);
    }
    const aufgaben = p.schritte.flatMap((s) => s.aufgaben);
    const ausBestand = new Set(bestand.map((b) => b.aufgabe.prompt));
    console.log(`\n„${p.title}“ · ${p.schritte.length} Schritte · ${p.minuten_summe} min · ${aufgaben.length} Aufgaben (${aufgaben.filter((a) => ausBestand.has(a.prompt)).length} aus dem Bestand, ${aufgaben.filter((a) => !ausBestand.has(a.prompt)).length} von der KI)`);
    for (const [i, s] of p.schritte.entries()) console.log(`  ${i + 1}. ${s.titel} (${s.art}, ${s.minuten} min)${s.aufgaben.length ? ` · ${s.aufgaben.length} Aufgaben` : ""}${s.pruefen.length ? ` · ${s.pruefen.length} zu prüfen` : ""}`);
    const offen = p.schritte.flatMap((s) => s.pruefen.map((x) => `${s.titel}: ${x}`));
    if (offen.length) console.log(`\nNoch zu prüfen:\n${offen.map((x) => `  - ${x}`).join("\n")}`);
    if (res.weggelassen.length) console.log(`\nWeggelassen:\n${res.weggelassen.map((x) => `  - ${x}`).join("\n")}`);
    const datei = value("datei");
    if (datei) {
      fs.writeFileSync(datei, `${JSON.stringify(exportiereLernpaket(res.id), null, 2)}\n`);
      console.log(`\nPaket gespeichert: ${datei} (Format lernheft-lernpaket, lässt sich unter Mehr › Lernpakete importieren)`);
    }
  } finally {
    // db() keeps its connection open until the process ends; on Windows that blocks removing the folder
    const { closeDatabase } = await import("../lib/db");
    closeDatabase();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Der Platzhalter des Probelaufs: ein kleines, gültiges Paket mit den ersten Aufgaben des Bestands, die Tokens
 * aus Prompt und Antwort geschätzt. Er kostet nichts und fragt niemanden.
 */
function probeTransport(dauer: number): import("../lib/ai/router").Transport {
  const tokens = (s: string) => Math.ceil(s.length / 3.2);
  return async (req) => {
    const prompt = typeof req.content === "string" ? req.content : JSON.stringify(req.content);
    const ids = [...prompt.matchAll(/^- ([BG]\d+) \[/gm)].map((m) => m[1]);
    const teile = [Math.round(dauer * 0.1), Math.round(dauer * 0.2), Math.round(dauer * 0.1)];
    const rest = dauer - teile.reduce((a, b) => a + b, 0);
    const schritt = (art: string, titel: string, minuten: number, aus: string[] = []) => ({
      art,
      titel,
      minuten,
      lehrer_sagt: `${titel}: was die Lehrkraft sagt (Probelauf).`,
      lehrer_fragt: "",
      erwartete_antwort: "",
      bei_fehler: "",
      notiz: "",
      pruefen: art === "erklaerung" ? ["Probelauf: Erklärung prüfen."] : [],
      aufgaben_aus_bestand: aus,
      neue_aufgaben: [],
    });
    const parsed = {
      titel: "Probelauf",
      ziel: "Probelauf ohne KI.",
      schritte: [schritt("einstieg", "Einstieg", teile[0]), schritt("erklaerung", "Erklärung", teile[1]), schritt("uebung", "Übung", Math.ceil(rest / 2), ids.slice(0, 3)), schritt("kontrolle", "Kontrolle", Math.floor(rest / 2), ids.slice(3, 5)), schritt("abschluss", "Abschluss", teile[2])],
    };
    const schema = JSON.stringify((await import("../lib/ai/providers/schema")).jsonSchemaOf(req.schema));
    const output = Math.min(req.maxTokens, Math.round(tokens(JSON.stringify(parsed)) * 1.8));
    return { parsed, refusal: false, model: req.model, usage: { input: tokens(req.system) + tokens(schema) + tokens(prompt), output, cacheWrite: 0, cacheRead: 0 }, simulatedMs: 1200 + output * 12 };
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
