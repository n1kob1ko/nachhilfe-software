// Vor einem Update auf Railway (Pre-Deploy-Befehl): warten, bis gerade kein Unterricht läuft.
//
// Ein Update startet den Server neu. Gut eine Minute antwortet die Seite dann nicht (502), und offene Tablets
// zeigen noch die alte Version. Darum fragt dieser Schritt den laufenden (alten) Server unter /health/pause und
// wartet, solange eine Einheit läuft, höchstens DEPLOY_WARTEN_MAX_MIN Minuten (Standard 50, unter der
// Pre-Deploy-Grenze von 60 Minuten). Danach geht das Update trotzdem live.
//
// Sofort live: „[sofort]“ in der Commit-Nachricht oder DEPLOY_SOFORT=1. Antwortet der alte Server nicht oder
// kennt er /health/pause noch nicht, geht es auch sofort weiter. Der Schritt scheitert nie.
const basis = (process.env.PUBLIC_URL || "https://dreamstudy.at").replace(/\/+$/, "");
const maxMin = Number(process.env.DEPLOY_WARTEN_MAX_MIN || 50);
const takt = Number(process.env.DEPLOY_WARTEN_TAKT_S || 60) * 1000;
const commit = process.env.RAILWAY_GIT_COMMIT_MESSAGE || "";

const log = (t) => console.log(`[Update] ${t}`);

async function pause() {
  try {
    const r = await fetch(`${basis}/health/pause`, { signal: AbortSignal.timeout(10_000), headers: { "Cache-Control": "no-store" } });
    if (!r.ok) return { pause: true, grund: `Antwort ${r.status}` };
    const j = await r.json();
    return { pause: j?.pause !== false, grund: "" };
  } catch (e) {
    return { pause: true, grund: `nicht erreichbar (${e?.name || "Fehler"})` };
  }
}

async function main() {
  if (process.env.DEPLOY_SOFORT === "1" || commit.includes("[sofort]")) return log("sofort, ohne Warten");
  const bis = Date.now() + maxMin * 60_000;
  for (let runde = 0; ; runde++) {
    const p = await pause();
    if (p.pause) return log(runde === 0 ? `kein Unterricht${p.grund ? `, ${p.grund}` : ""}: gleich live` : `Unterricht vorbei: jetzt live (nach ${runde} min)`);
    if (Date.now() + takt > bis) return log(`nach ${maxMin} min Warten trotzdem live`);
    if (runde === 0) log(`Unterricht läuft: warte, bis keine Einheit mehr läuft (höchstens ${maxMin} min)`);
    await new Promise((r) => setTimeout(r, takt));
  }
}

main().finally(() => process.exit(0));
