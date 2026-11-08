/** The app's own backup paths and the daily automatic backup (started in instrumentation.ts). */
import { db, dbPath } from "./db";
import { uploadsDir } from "./materials";
import { backupDirFor, backupDue, createBackup, type BackupInfo, type BackupPaths } from "./sicherungen";
import { flushBoard } from "./whiteboard";

export function appBackupPaths(): BackupPaths {
  const dbFile = dbPath();
  return { dbFile, uploadsDir: uploadsDir(), backupDir: backupDirFor(dbFile) };
}

let running: Promise<BackupInfo> | null = null;

/** Writes the whiteboard buffer first, so the copy has the latest strokes. One backup at a time. */
export function backupNow(): Promise<BackupInfo> {
  if (running) return running;
  flushBoard();
  running = createBackup(db(), appBackupPaths()).finally(() => {
    running = null;
  });
  return running;
}

/** Every hour: a backup if the newest one is older than BACKUP_INTERVAL_HOURS (default 24). */
export function scheduleBackups() {
  const hours = Math.max(1, Number(process.env.BACKUP_INTERVAL_HOURS) || 24);
  const run = async () => {
    try {
      if (backupDue(appBackupPaths().backupDir, hours)) await backupNow();
    } catch (e) {
      console.error("Automatische Sicherung fehlgeschlagen:", e instanceof Error ? e.message : e);
    }
  };
  setTimeout(run, 60_000).unref();
  setInterval(run, 60 * 60_000).unref();
}
