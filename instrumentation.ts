/**
 * Runs once when the server starts. Ends forgotten units in the background, so this does not
 * depend on a teacher or student opening the app (pages and answers also check on every request).
 * On the production server it also warns about accounts on the public start password and starts
 * the daily backup.
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

  if (process.env.NODE_ENV !== "production") return;
  const { accountsOnPublicDefault } = await import("./lib/db");
  const { defaultPasswordBlocked } = await import("./lib/password");
  const waiting = accountsOnPublicDefault();
  if (waiting.length && defaultPasswordBlocked())
    console.warn(
      `${waiting.length} Lehrer-Konto(en) haben noch das öffentliche Startpasswort und können sich nicht anmelden (${waiting.map((t) => t.username).join(", ")}). ` +
        "Unter Mehr › Lehrer ein neues Startpasswort vergeben oder INITIAL_TEACHER_PASSWORD setzen (siehe docs/betrieb.md).",
    );
  if (process.env.BACKUP_DISABLED !== "1") (await import("./lib/sicherungen-app")).scheduleBackups();
}
