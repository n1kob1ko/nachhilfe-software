/**
 * Full JSON backup of the database, and the matching restore.
 *
 * The backup takes every table that exists in the database (also tables added in later versions),
 * with every column and row, so nothing is lost. Two things are deliberately left out:
 * login sessions (they only make sense on the running server) and password hashes (a backup file
 * that gets passed around must not contain anything that could be cracked). After a restore every
 * teacher logs in with the start password and has to choose a new one.
 */
import type Database from "better-sqlite3";
import { db } from "./db";
import { INITIAL_PASSWORD, hashPassword } from "./password";

export const BACKUP_FORMAT = "lernheft-backup";
export const BACKUP_VERSION = 1;

/** Tables whose rows are never exported. */
const SKIP_TABLES = new Set(["teacher_sessions"]);
/** Columns emptied in the export: [table, column]. */
const REDACTED: [string, string][] = [["teachers", "password_hash"]];

/** Parents before children, so a restore never points at a row that is not there yet. Unknown tables follow. */
const ORDER = ["teachers", "students", "skills", "worksheets", "tasks", "assignments", "units", "lessons", "attempts", "homework", "tests", "skill_snapshots", "whiteboards", "whiteboard_pages", "whiteboard_inserts", "ai_calls", "ai_insights"];

type Row = Record<string, unknown>;
export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exported_at: string;
  app: string;
  note: string;
  tables: Record<string, { columns: string[]; rows: Row[] }>;
};

function tableNames(conn: Database.Database): string[] {
  const all = (conn.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[])
    .map((r) => r.name)
    .filter((n) => !SKIP_TABLES.has(n));
  const rank = (n: string) => (ORDER.includes(n) ? ORDER.indexOf(n) : ORDER.length);
  return all.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function columnsOf(conn: Database.Database, table: string): string[] {
  return (conn.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map((c) => c.name);
}

export function exportBackup(conn: Database.Database = db(), now = new Date()): Backup {
  const tables: Backup["tables"] = {};
  const read = conn.transaction(() => {
    for (const name of tableNames(conn)) {
      const columns = columnsOf(conn, name);
      const pk = columns.includes("id") ? "id" : "rowid";
      const rows = conn.prepare(`SELECT * FROM "${name}" ORDER BY ${pk}`).all() as Row[];
      for (const [t, c] of REDACTED) if (t === name) for (const r of rows) r[c] = null;
      tables[name] = { columns, rows };
    }
  });
  read(); // one transaction: a consistent snapshot even while someone is working
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: now.toISOString(),
    app: "Lernheft",
    note: "Vollständige Sicherung aller Tabellen. Ohne Passwörter und Anmeldesitzungen: nach einer Wiederherstellung gilt für alle Lehrer das Startpasswort.",
    tables,
  };
}

export function backupCounts(b: Backup): Record<string, number> {
  return Object.fromEntries(Object.entries(b.tables).map(([k, v]) => [k, v.rows.length]));
}

/**
 * Restores a backup into `conn`, replacing what is there. Columns the target does not know are
 * ignored and missing ones get their defaults, so a backup also fits a newer database version.
 */
export function restoreBackup(conn: Database.Database, data: unknown): Record<string, number> {
  const b = data as Backup;
  if (!b || b.format !== BACKUP_FORMAT || typeof b.tables !== "object") throw new Error("Das ist keine Lernheft-Sicherung.");
  if (b.version > BACKUP_VERSION) throw new Error(`Sicherung aus einer neueren Version (${b.version}).`);
  const target = new Set(tableNames(conn));
  const names = Object.keys(b.tables).filter((n) => target.has(n));
  const rank = (n: string) => (ORDER.includes(n) ? ORDER.indexOf(n) : ORDER.length);
  names.sort((x, y) => rank(x) - rank(y));
  const counts: Record<string, number> = {};
  conn.pragma("foreign_keys = OFF");
  try {
    conn.transaction(() => {
      conn.prepare("DELETE FROM teacher_sessions").run();
      for (const n of [...names].reverse()) conn.prepare(`DELETE FROM "${n}"`).run();
      for (const n of names) {
        const cols = new Set(columnsOf(conn, n));
        let count = 0;
        for (const row of b.tables[n].rows) {
          const keys = Object.keys(row).filter((k) => cols.has(k));
          conn.prepare(`INSERT INTO "${n}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`).run(...keys.map((k) => row[k] as never));
          count++;
        }
        counts[n] = count;
      }
      if (target.has("teachers")) {
        conn.prepare("UPDATE teachers SET password_hash = ?, must_change_password = 1 WHERE password_hash IS NULL").run(hashPassword(INITIAL_PASSWORD));
      }
      const broken = conn.prepare("PRAGMA foreign_key_check").all();
      if (broken.length) throw new Error(`Sicherung unvollständig: ${broken.length} Verweise zeigen ins Leere.`);
    })();
  } finally {
    conn.pragma("foreign_keys = ON");
  }
  return counts;
}
