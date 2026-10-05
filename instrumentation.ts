/**
 * Runs once when the server starts. Ends forgotten units in the background, so this does not
 * depend on a teacher or student opening the app (pages and answers also check on every request).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DATABASE_PATH === ":memory:") return;
  const { sweepIdleUnits } = await import("./lib/learning");
  const sweep = () => {
    try {
      sweepIdleUnits();
    } catch (e) {
      console.error("Automatisches Beenden von Einheiten fehlgeschlagen:", e);
    }
  };
  sweep();
  setInterval(sweep, 5 * 60_000).unref();
}
