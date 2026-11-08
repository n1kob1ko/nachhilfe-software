/**
 * Automatic backups of the database and the uploaded material on the server's own disk.
 *
 *   /data/backups/sicherung-<time>/nachhilfe.db.gz  consistent copy (VACUUM INTO), gzip-compressed (about a fifth)
 *   /data/backups/sicherung-<time>/uploads/...      the material files
 *   /data/backups/sicherung-<time>/manifest.json    time, sizes, checksum, row counts
 *
 * A restore is never done on the running database: it is staged in /data/restore-pending and applied
 * at the next start, before the database is opened. The state before it is kept in
 * /data/vor-wiederherstellung-<time>, so a restore can itself be undone.
 * These copies lie on the same volume as the data: they help against mistakes and broken data,
 * not against losing the volume. That is what Railway's volume backups and the download are for.
 *
 * Space: the volume is small (500 MB on Railway). Older backups held the database uncompressed, 14 of
 * them filled the volume (2026-11-08). So copies are compressed, old uncompressed ones are compressed
 * on the next run, and before a new backup the oldest are removed when the free space would not
 * leave room for the database to keep growing (always keeping the newest BACKUP_MIN_KEEP).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import zlib from "node:zlib";
import Database from "better-sqlite3";

const gzip = promisify(zlib.gzip);

const PREFIX = "sicherung-";
const PENDING = "restore-pending";

export type BackupInfo = { name: string; createdAt: string; dbBytes: number; files: number; uploadBytes: number; counts: Record<string, number> };
export type BackupPaths = { dbFile: string; uploadsDir: string; backupDir: string };

/** Material folder belonging to a database file (or UPLOADS_PATH). */
export function uploadsDirFor(dbFile: string): string {
  return process.env.UPLOADS_PATH || path.join(/*turbopackIgnore: true*/ path.dirname(dbFile), "uploads");
}

export function backupDirFor(dbFile: string): string {
  return process.env.BACKUP_PATH || path.join(/*turbopackIgnore: true*/ path.dirname(dbFile), "backups");
}

export const backupKeep = () => Math.max(1, Number(process.env.BACKUP_KEEP) || 14);
/** Backups that are never removed to make room, however full the volume is. */
export const backupMinKeep = () => Math.max(1, Number(process.env.BACKUP_MIN_KEEP) || 3);
/** Space that must stay free after a backup, on top of room for one more copy of the database. */
export const backupReserveBytes = () => Math.max(0, Number(process.env.BACKUP_RESERVE_MB) || 100) * 1024 * 1024;

const RAW = "nachhilfe.db";
const GZ = "nachhilfe.db.gz";

/** Free bytes on the file system that holds `dir` (Infinity when it cannot be read). */
export function freeBytes(dir: string): number {
  try {
    const s = fs.statfsSync(dir);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return Infinity;
  }
}

/** Compresses `file` to `file.gz` next to it (written under a temporary name first), then removes `file`. */
async function compressFile(file: string): Promise<number> {
  const out = `${file}.gz`;
  const tmp = `${out}.tmp`;
  const data = await gzip(fs.readFileSync(file), { level: 6 });
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, out);
  fs.rmSync(file);
  return data.length;
}

/** The database of a backup, uncompressed, or null when it has none. */
function readBackupDb(dir: string): Buffer | null {
  if (fs.existsSync(path.join(dir, GZ))) return zlib.gunzipSync(fs.readFileSync(path.join(dir, GZ)));
  if (fs.existsSync(path.join(dir, RAW))) return fs.readFileSync(path.join(dir, RAW));
  return null;
}

const stamp = (d: Date) => d.toISOString().replace(/\.\d+Z$/, "Z").replace(/:/g, "-");
const sha256 = (data: Buffer) => crypto.createHash("sha256").update(data).digest("hex");
const COUNTED = ["teachers", "students", "units", "lessons", "worksheets", "tasks", "attempts", "materials"];

/** Copies the material files: hard links where possible (they are never changed after upload), else a copy. */
function copyFiles(from: string, to: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  if (!fs.existsSync(from)) return { files, bytes };
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, e.name);
    const dst = path.join(to, e.name);
    if (e.isDirectory()) {
      const sub = copyFiles(src, dst);
      files += sub.files;
      bytes += sub.bytes;
    } else if (e.isFile()) {
      try {
        fs.linkSync(src, dst);
      } catch {
        fs.copyFileSync(src, dst);
      }
      files += 1;
      bytes += fs.statSync(dst).size;
    }
  }
  return { files, bytes };
}

/**
 * Writes one backup and removes the oldest beyond BACKUP_KEEP. Before that, old uncompressed backups are
 * compressed and, if the volume is still too full, the oldest are removed (see the top of this file).
 */
export async function createBackup(conn: Database.Database, p: BackupPaths, now = new Date()): Promise<BackupInfo> {
  fs.mkdirSync(p.backupDir, { recursive: true });
  rotateBackups(p.backupDir);
  await compressOldBackups(p.backupDir);
  makeRoom(p.backupDir, fileSize(p.dbFile));
  let name = `${PREFIX}${stamp(now)}`;
  for (let i = 2; fs.existsSync(path.join(p.backupDir, name)); i++) name = `${PREFIX}${stamp(now)}-${i}`;
  const tmp = path.join(p.backupDir, `.tmp-${name}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp);
  try {
    const dbCopy = path.join(tmp, RAW);
    conn.prepare("VACUUM INTO ?").run(dbCopy);
    const dbBytes = fs.statSync(dbCopy).size;
    const dbSha256 = sha256(fs.readFileSync(dbCopy));
    const gzBytes = await compressFile(dbCopy);
    const up = copyFiles(p.uploadsDir, path.join(tmp, "uploads"));
    const counts: Record<string, number> = {};
    for (const t of COUNTED) {
      try {
        counts[t] = (conn.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
      } catch {
        // table missing in an old database
      }
    }
    const info: BackupInfo = { name, createdAt: now.toISOString(), dbBytes, files: up.files, uploadBytes: up.bytes, counts };
    fs.writeFileSync(path.join(tmp, "manifest.json"), JSON.stringify({ ...info, gzBytes, dbSha256 }, null, 2));
    fs.renameSync(tmp, path.join(p.backupDir, name));
    rotateBackups(p.backupDir);
    return info;
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
}

const fileSize = (f: string) => {
  try {
    return fs.statSync(f).size;
  } catch {
    return 0;
  }
};

const backupNames = (backupDir: string) =>
  fs.existsSync(backupDir) ? fs.readdirSync(backupDir).filter((n) => n.startsWith(PREFIX)).sort() : [];

/** Compresses the database of backups written before compression existed, oldest first. */
export async function compressOldBackups(backupDir: string): Promise<{ count: number; freed: number }> {
  let count = 0;
  let freed = 0;
  for (const n of backupNames(backupDir)) {
    const raw = path.join(backupDir, n, RAW);
    if (!fs.existsSync(raw)) continue;
    if (fs.existsSync(path.join(backupDir, n, GZ))) {
      fs.rmSync(raw); // compressed earlier, only the removal was missing
      continue;
    }
    const before = fs.statSync(raw).size;
    try {
      freed += before - (await compressFile(raw));
      count += 1;
    } catch (e) {
      fs.rmSync(`${raw}.gz.tmp`, { force: true });
      console.error(`Sicherung ${n} konnte nicht komprimiert werden:`, e instanceof Error ? e.message : e);
    }
  }
  if (count) console.warn(`${count} alte Sicherung(en) komprimiert, ${Math.round(freed / 1024 / 1024)} MB frei geworden.`);
  return { count, freed };
}

/**
 * Removes the oldest backups until there is room for one more copy of the database plus the reserve,
 * but never the newest BACKUP_MIN_KEEP. Returns the names it removed.
 */
export function makeRoom(backupDir: string, dbBytes: number, free = freeBytes, minKeep = backupMinKeep()): string[] {
  const need = dbBytes * 2 + backupReserveBytes();
  const names = backupNames(backupDir);
  const removed: string[] = [];
  while (free(backupDir) < need && names.length > minKeep) {
    const n = names.shift()!;
    fs.rmSync(path.join(backupDir, n), { recursive: true, force: true });
    removed.push(n);
  }
  if (removed.length) console.warn(`Speicher knapp: ${removed.length} älteste Sicherung(en) entfernt (${removed.join(", ")}).`);
  if (free(backupDir) < need) console.error(`Speicher knapp: nur ${Math.round(free(backupDir) / 1024 / 1024)} MB frei. Volume vergrößern oder Daten aufräumen.`);
  return removed;
}

export function listBackups(backupDir: string): BackupInfo[] {
  if (!fs.existsSync(backupDir)) return [];
  return fs
    .readdirSync(backupDir)
    .filter((n) => n.startsWith(PREFIX))
    .sort()
    .reverse()
    .flatMap((n) => {
      try {
        const m = JSON.parse(fs.readFileSync(path.join(backupDir, n, "manifest.json"), "utf8")) as BackupInfo;
        return [{ ...m, name: n }];
      } catch {
        return [];
      }
    });
}

/** Keeps the newest `keep` backups; also clears copies that were left half-written. */
export function rotateBackups(backupDir: string, keep = backupKeep()) {
  const all = fs.readdirSync(backupDir);
  for (const n of all.filter((x) => x.startsWith(".tmp-"))) {
    const age = Date.now() - fs.statSync(path.join(backupDir, n)).mtimeMs;
    if (age > 60 * 60_000) fs.rmSync(path.join(backupDir, n), { recursive: true, force: true });
  }
  const names = all.filter((n) => n.startsWith(PREFIX)).sort().reverse();
  for (const n of names.slice(keep)) fs.rmSync(path.join(backupDir, n), { recursive: true, force: true });
}

/** True when the newest backup is older than `hours` (or there is none). */
export function backupDue(backupDir: string, hours: number, now = Date.now()) {
  const newest = listBackups(backupDir)[0];
  return !newest || now - Date.parse(newest.createdAt) >= hours * 3_600_000;
}

const pendingDir = (dbFile: string) => path.join(path.dirname(dbFile), PENDING);

/** Checks a backup and prepares it to replace the data at the next start. */
export function stageRestore(name: string, p: BackupPaths): { ok: true } | { error: string } {
  if (!name.startsWith(PREFIX) || name !== path.basename(name)) return { error: "Diese Sicherung gibt es nicht." };
  const src = path.join(p.backupDir, name);
  const manifestFile = path.join(src, "manifest.json");
  if (!fs.existsSync(manifestFile)) return { error: "Diese Sicherung gibt es nicht." };
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as { dbSha256?: string };
  let data: Buffer | null;
  try {
    data = readBackupDb(src);
  } catch {
    data = null;
  }
  if (!data || sha256(data) !== manifest.dbSha256) return { error: "Die Sicherung ist beschädigt (Prüfsumme stimmt nicht)." };
  const target = pendingDir(p.dbFile);
  fs.rmSync(target, { recursive: true, force: true });
  const tmp = `${target}.tmp`;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  fs.writeFileSync(path.join(tmp, RAW), data);
  copyFiles(path.join(src, "uploads"), path.join(tmp, "uploads"));
  fs.writeFileSync(path.join(tmp, "quelle.txt"), name);
  fs.renameSync(tmp, target);
  return { ok: true };
}

/** Name of the backup waiting to be applied at the next start, if any. */
export function pendingRestore(dbFile: string): string | null {
  try {
    return fs.readFileSync(path.join(pendingDir(dbFile), "quelle.txt"), "utf8").trim() || null;
  } catch {
    return null;
  }
}

export function cancelRestore(dbFile: string) {
  fs.rmSync(pendingDir(dbFile), { recursive: true, force: true });
}

const move = (from: string, to: string) => {
  if (fs.existsSync(from)) fs.renameSync(from, to);
};

/**
 * Runs before the database is opened. Swaps in a staged backup; the previous files are moved to
 * vor-wiederherstellung-<time>. A copy that fails the integrity check is set aside, the data stay as they are.
 */
export function applyPendingRestore(dbFile: string, uploadsDir = uploadsDirFor(dbFile), now = new Date()): string | null {
  if (dbFile === ":memory:") return null;
  const pending = pendingDir(dbFile);
  const candidate = path.join(pending, RAW);
  // a backup folder copied in by hand (railway ssh) holds the compressed copy
  const packed = path.join(pending, GZ);
  if (!fs.existsSync(candidate) && fs.existsSync(packed)) {
    try {
      fs.writeFileSync(candidate, zlib.gunzipSync(fs.readFileSync(packed)));
      fs.rmSync(packed);
    } catch (e) {
      fs.rmSync(candidate, { force: true });
      move(pending, path.join(path.dirname(dbFile), `restore-fehlgeschlagen-${stamp(now)}`));
      console.error("Wiederherstellung abgebrochen, die komprimierte Kopie ist beschädigt:", e instanceof Error ? e.message : e);
      return null;
    }
  }
  if (!fs.existsSync(candidate)) return null;
  const source = pendingRestore(dbFile) ?? "unbekannt";
  const dataDir = path.dirname(dbFile);
  try {
    const check = new Database(candidate, { readonly: true });
    // The connection must be closed even when the check throws (not a database at all): an open
    // handle keeps nachhilfe.db locked, and on Windows that blocks renaming and deleting the
    // folder it lies in (EPERM) — the copy could then never be set aside or cleaned up.
    try {
      const result = check.pragma("integrity_check", { simple: true });
      if (result !== "ok") throw new Error(`integrity_check: ${String(result)}`);
    } finally {
      check.close();
    }
  } catch (e) {
    move(pending, path.join(dataDir, `restore-fehlgeschlagen-${stamp(now)}`));
    console.error(`Wiederherstellung von ${source} abgebrochen, die Daten bleiben unverändert:`, e instanceof Error ? e.message : e);
    return null;
  }
  const before = path.join(dataDir, `vor-wiederherstellung-${stamp(now)}`);
  fs.mkdirSync(before, { recursive: true });
  for (const suffix of ["", "-wal", "-shm"]) move(dbFile + suffix, path.join(before, path.basename(dbFile) + suffix));
  move(uploadsDir, path.join(before, "uploads"));
  move(candidate, dbFile);
  move(path.join(pending, "uploads"), uploadsDir);
  fs.rmSync(pending, { recursive: true, force: true });
  console.warn(`Sicherung ${source} wiederhergestellt. Der vorherige Stand liegt in ${before}.`);
  return source;
}
