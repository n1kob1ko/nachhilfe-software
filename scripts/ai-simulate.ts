/**
 * 60-minute test mode for the KI (lib/ai/simulation.ts). Uses its own throw-away database.
 *
 *   npm run ai:simulate                      probe run without key, costs nothing
 *   npm run ai:simulate -- --echt            real requests with ANTHROPIC_API_KEY (about 0.30 $ per run)
 *   npm run ai:simulate -- --minuten 30 --seed 3 --bericht docs/ki-simulation.md
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

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-sim-"));
  process.env.DATABASE_PATH = path.join(dir, "sim.db");
  const real = flag("echt");
  if (real && !process.env.ANTHROPIC_API_KEY) {
    console.error("Für --echt muss ANTHROPIC_API_KEY gesetzt sein.");
    process.exit(1);
  }
  const { simulateLesson, reportMarkdown } = await import("../lib/ai/simulation");
  const minutes = Number(value("minuten") ?? 60);
  const seed = Number(value("seed") ?? 7);
  const run = await simulateLesson({ minutes, seed, real });
  const outage = await simulateLesson({ minutes, seed, outage: true });
  const md = reportMarkdown(run, outage);
  const out = value("bericht");
  if (out) fs.writeFileSync(out, md);
  console.log(md);
  if (out) console.log(`Bericht gespeichert: ${out}`);
  fs.rmSync(dir, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
