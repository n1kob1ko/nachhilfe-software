/**
 * Unpacking an uploaded presentation (a ZIP or one HTML file) without trusting it. The ZIP is read from
 * its central directory by hand and each file inflated with Node's zlib, so every rule is checked before
 * anything is written:
 * - names: no absolute paths, no „..“ or „.“, no backslashes, colons or control characters, no two names
 *   that differ only in case,
 * - no symbolic links or other special files, no encrypted entries, only „stored“ and „deflate“,
 * - at most GRENZEN.dateien files and GRENZEN.gesamt bytes unpacked (checked before inflating, and every
 *   file is inflated with that size as hard limit and its CRC checked),
 * - only the file types of TYPEN (web pages, styles, scripts, data, pictures, fonts, audio and video).
 * Nothing here touches the disk; lib/praesentationen.ts writes the result.
 */
import zlib from "node:zlib";

export const GRENZEN = {
  /** the uploaded file */
  upload: 60 * 1024 * 1024,
  /** all files together, unpacked */
  gesamt: 60 * 1024 * 1024,
  dateien: 300,
  /** entries in the ZIP's directory, folders and skipped system files included */
  eintraege: 2000,
  pfad: 240,
  tiefe: 12,
} as const;

/** Allowed file types by extension, with the Content-Type they are served with. */
export const TYPEN: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  aac: "audio/aac",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  vtt: "text/vtt; charset=utf-8",
};

/** The notes file inside a ZIP (docs/praesentation-format.md); read into the database, never served. */
export const NOTIZEN_DATEI = "lernheft-notizen.json";

export const endung = (pfad: string) => /\.([a-z0-9]+)$/i.exec(pfad)?.[1]?.toLowerCase() ?? "";
export const typVon = (pfad: string): string | null => TYPEN[endung(pfad)] ?? null;
export const istHtml = (pfad: string) => ["html", "htm"].includes(endung(pfad));

export type Datei = { pfad: string; daten: Buffer };
export type Entpackt = {
  dateien: Datei[];
  /** the page that opens first, e.g. „index.html“ or „Folien/index.html“ */
  start: string;
  /** content of lernheft-notizen.json, when there is one */
  notizen: string | null;
  /** hosts the deck tries to load from outside (blocked when playing); a warning for the teacher */
  extern: string[];
};
export type Ergebnis = { ok: true; wert: Entpackt } | { ok: false; fehler: string };

const MB = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;
const fehler = (f: string): Ergebnis => ({ ok: false, fehler: f });

/** System files that zip programs add; they are left out without a word. */
const istBeiwerk = (pfad: string) => {
  const name = pfad.split("/").at(-1) ?? "";
  return pfad.startsWith("__MACOSX/") || name.startsWith(".") || /^(thumbs\.db|desktop\.ini)$/i.test(name);
};

/**
 * Checks one name from the archive. Returns why it is refused, or null when it is a safe relative path.
 * Folders end with „/“.
 */
export function pfadProblem(name: string): string | null {
  if (!name) return "leerer Name";
  if (name.length > GRENZEN.pfad) return "Name zu lang";
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(name)) return "Steuerzeichen im Namen";
  if (name.includes("\\")) return "Backslash im Namen";
  if (name.includes(":")) return "Doppelpunkt im Namen (Laufwerk?)";
  if (name.startsWith("/")) return "absoluter Pfad";
  const teile = name.replace(/\/$/, "").split("/");
  if (teile.some((t) => t === "" || t === "." || t === "..")) return "„..“, „.“ oder leerer Ordner im Pfad";
  if (teile.length > GRENZEN.tiefe) return "zu viele Ordner ineinander";
  return null;
}

/** Names without the UTF-8 flag are usually UTF-8 anyway; otherwise read them as Latin-1. */
function name(bytes: Buffer, utf8: boolean): string {
  if (utf8) return bytes.toString("utf8");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return bytes.toString("latin1");
  }
}

const S_IFMT = 0o170000;
const S_IFREG = 0o100000;
const S_IFDIR = 0o040000;
const S_IFLNK = 0o120000;

type Eintrag = { name: string; methode: number; crc: number; gepackt: number; groesse: number; offset: number };

/** Reads the ZIP's central directory. Every entry is checked here; no data is inflated yet. */
function verzeichnis(buf: Buffer): { ok: true; eintraege: Eintrag[] } | { ok: false; fehler: string } {
  // end of central directory: 22 bytes plus a comment of up to 65535 bytes, at the very end
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return { ok: false, fehler: "Die ZIP-Datei ist beschädigt (kein Inhaltsverzeichnis)." };
  const disk = buf.readUInt16LE(eocd + 4);
  const cdDisk = buf.readUInt16LE(eocd + 6);
  const anzahl = buf.readUInt16LE(eocd + 10);
  const cdGroesse = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (disk !== 0 || cdDisk !== 0) return { ok: false, fehler: "Mehrteilige ZIP-Dateien gehen nicht." };
  if (anzahl === 0xffff || cdOffset === 0xffffffff || cdGroesse === 0xffffffff) return { ok: false, fehler: "Die ZIP-Datei ist zu groß (ZIP64)." };
  if (anzahl > GRENZEN.eintraege) return { ok: false, fehler: `Zu viele Einträge in der ZIP-Datei (höchstens ${GRENZEN.dateien} Dateien).` };
  if (cdOffset + cdGroesse > eocd) return { ok: false, fehler: "Die ZIP-Datei ist beschädigt (Inhaltsverzeichnis)." };

  const eintraege: Eintrag[] = [];
  let p = cdOffset;
  for (let i = 0; i < anzahl; i++) {
    if (p + 46 > eocd || buf.readUInt32LE(p) !== 0x02014b50) return { ok: false, fehler: "Die ZIP-Datei ist beschädigt (Eintrag)." };
    const erstelltMit = buf.readUInt16LE(p + 4) >> 8;
    const flags = buf.readUInt16LE(p + 8);
    const methode = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const gepackt = buf.readUInt32LE(p + 20);
    const groesse = buf.readUInt32LE(p + 24);
    const nLen = buf.readUInt16LE(p + 28);
    const xLen = buf.readUInt16LE(p + 30);
    const kLen = buf.readUInt16LE(p + 32);
    const extern = buf.readUInt32LE(p + 38);
    const offset = buf.readUInt32LE(p + 42);
    if (p + 46 + nLen > eocd) return { ok: false, fehler: "Die ZIP-Datei ist beschädigt (Name)." };
    const n = name(buf.subarray(p + 46, p + 46 + nLen), (flags & 0x800) !== 0);
    p += 46 + nLen + xLen + kLen;

    const problem = pfadProblem(n);
    if (problem) return { ok: false, fehler: `„${n.slice(0, 80)}“: ${problem}. So eine ZIP-Datei nimmt DreamStudy nicht an.` };
    // Unix (3) and macOS (19) keep the file type in the upper 16 bits: no links, devices or pipes
    if (erstelltMit === 3 || erstelltMit === 19) {
      const typ = (extern >>> 16) & S_IFMT;
      if (typ === S_IFLNK) return { ok: false, fehler: `„${n}“ ist eine Verknüpfung (Symlink). Bitte die echte Datei in die ZIP packen.` };
      if (typ !== 0 && typ !== S_IFREG && typ !== S_IFDIR) return { ok: false, fehler: `„${n}“ ist keine normale Datei.` };
    }
    if (n.endsWith("/")) continue;
    if (flags & 0x1) return { ok: false, fehler: `„${n}“ ist verschlüsselt. Bitte ohne Passwort packen.` };
    if (methode !== 0 && methode !== 8) return { ok: false, fehler: `„${n}“ ist mit einem unbekannten Verfahren gepackt. Bitte als normale ZIP-Datei packen.` };
    if (gepackt === 0xffffffff || groesse === 0xffffffff || offset === 0xffffffff) return { ok: false, fehler: "Die ZIP-Datei ist zu groß (ZIP64)." };
    eintraege.push({ name: n, methode, crc, gepackt, groesse, offset });
  }
  return { ok: true, eintraege };
}

/** The data of one entry, inflated with its declared size as hard limit and checked against its CRC. */
function auspacken(buf: Buffer, e: Eintrag): Buffer | null {
  if (e.offset + 30 > buf.length || buf.readUInt32LE(e.offset) !== 0x04034b50) return null;
  const start = e.offset + 30 + buf.readUInt16LE(e.offset + 26) + buf.readUInt16LE(e.offset + 28);
  if (start + e.gepackt > buf.length) return null;
  const roh = buf.subarray(start, start + e.gepackt);
  let daten: Buffer;
  if (e.methode === 0) {
    if (e.gepackt !== e.groesse) return null;
    daten = Buffer.from(roh);
  } else {
    try {
      daten = zlib.inflateRawSync(roh, { maxOutputLength: Math.max(1, e.groesse) });
    } catch {
      // more data than declared (a ZIP bomb) or broken data
      return null;
    }
  }
  if (daten.length !== e.groesse || zlib.crc32(daten) !== e.crc) return null;
  return daten;
}

/** Hosts an HTML or CSS file loads things from (scripts, styles, pictures, media, fonts). Links are not counted. */
export function externeQuellen(text: string): string[] {
  const hosts = new Set<string>();
  const muster = [
    /<(?:script|img|source|video|audio|iframe|embed|track)\b[^>]*?\ssrc\s*=\s*["']?\s*(?:https?:)?\/\/([^/"'\s>]+)/gi,
    /<link\b[^>]*?\shref\s*=\s*["']?\s*(?:https?:)?\/\/([^/"'\s>]+)/gi,
    /url\(\s*["']?\s*(?:https?:)?\/\/([^/"')\s]+)/gi,
    /@import\s+(?:url\()?\s*["']\s*(?:https?:)?\/\/([^/"'\s]+)/gi,
  ];
  for (const m of muster) for (const x of text.matchAll(m)) hosts.add(x[1].toLowerCase());
  return [...hosts];
}

/** The page that opens first: index.html nearest to the top, else story.html (Articulate), else the only page. */
export function startDatei(pfade: string[]): string | null {
  const tiefe = (p: string) => p.split("/").length;
  const nachTiefe = (xs: string[]) => [...xs].sort((a, b) => tiefe(a) - tiefe(b) || a.localeCompare(b));
  const name = (p: string) => p.split("/").at(-1)!.toLowerCase();
  const index = nachTiefe(pfade.filter((p) => name(p) === "index.html" || name(p) === "index.htm"));
  if (index.length) return index[0];
  const story = nachTiefe(pfade.filter((p) => name(p) === "story.html"));
  if (story.length) return story[0];
  const seiten = pfade.filter(istHtml);
  return seiten.length === 1 ? seiten[0] : null;
}

const istZip = (b: Buffer) => b.length >= 4 && b.readUInt32LE(0) === 0x04034b50;
const istLeereZip = (b: Buffer) => b.length >= 4 && b.readUInt32LE(0) === 0x06054b50;

/** What kind of upload this is, from its bytes (the name only for the hint about PowerPoint). */
export function uploadArt(dateiname: string, b: Buffer): "zip" | "html" | "pdf" | "pptx" | "unbekannt" {
  if (b.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (istZip(b) || istLeereZip(b)) return /\.(pptx|ppsx|potx|key|odp)$/i.test(dateiname) || b.includes("ppt/presentation.xml") ? "pptx" : "zip";
  if (/\.(pptx?|ppsx?|potx|key|odp)$/i.test(dateiname)) return "pptx";
  if (/\.html?$/i.test(dateiname)) return "html";
  return "unbekannt";
}

/** One HTML file: becomes index.html. */
export function leseHtml(b: Buffer): Ergebnis {
  if (b.length > GRENZEN.gesamt) return fehler(`Die Datei ist zu groß (höchstens ${MB(GRENZEN.gesamt)}).`);
  if (b.includes(0)) return fehler("Das ist keine HTML-Datei (enthält Binärdaten).");
  return { ok: true, wert: { dateien: [{ pfad: "index.html", daten: b }], start: "index.html", notizen: null, extern: externeQuellen(b.toString("utf8")).slice(0, 12) } };
}

/** A ZIP with an HTML presentation (claude.ai, reveal.js, iSpring, Articulate …), checked as described above. */
export function leseZip(b: Buffer): Ergebnis {
  if (b.length > GRENZEN.upload) return fehler(`Die Datei ist zu groß (höchstens ${MB(GRENZEN.upload)}).`);
  if (!istZip(b) && !istLeereZip(b)) return fehler("Das ist keine ZIP-Datei.");
  const v = verzeichnis(b);
  if (!v.ok) return fehler(v.fehler);
  const eintraege = v.eintraege.filter((e) => !istBeiwerk(e.name));
  const notizEintraege = eintraege.filter((e) => e.name.split("/").at(-1)!.toLowerCase() === NOTIZEN_DATEI);
  const inhalt = eintraege.filter((e) => !notizEintraege.includes(e));
  if (!inhalt.length) return fehler("Die ZIP-Datei ist leer.");
  if (inhalt.length > GRENZEN.dateien) return fehler(`Zu viele Dateien: ${inhalt.length}, höchstens ${GRENZEN.dateien}.`);
  const gesamt = eintraege.reduce((n, e) => n + e.groesse, 0);
  if (gesamt > GRENZEN.gesamt) return fehler(`Ausgepackt zu groß: ${MB(gesamt)}, höchstens ${MB(GRENZEN.gesamt)}.`);
  const fremd = inhalt.filter((e) => !typVon(e.name));
  if (fremd.length)
    return fehler(
      `Diese Dateiarten nimmt DreamStudy nicht an: ${fremd
        .slice(0, 5)
        .map((e) => `„${e.name}“`)
        .join(", ")}${fremd.length > 5 ? ` und ${fremd.length - 5} weitere` : ""}. Erlaubt sind Webseiten, Styles, Skripte, JSON, Bilder, Schriften, Audio und Video.`,
    );
  const gesehen = new Set<string>();
  for (const e of eintraege) {
    const k = e.name.toLowerCase();
    if (gesehen.has(k)) return fehler(`„${e.name}“ steht zweimal in der ZIP-Datei.`);
    gesehen.add(k);
  }
  const start = startDatei(inhalt.map((e) => e.name));
  if (!start) return fehler("Keine Startseite gefunden. Bitte eine index.html in die ZIP-Datei legen.");

  const dateien: Datei[] = [];
  for (const e of inhalt) {
    const daten = auspacken(b, e);
    if (!daten) return fehler(`„${e.name}“ ist beschädigt oder größer als angegeben.`);
    dateien.push({ pfad: e.name, daten });
  }
  // the notes file nearest to the start page (or the top)
  const notiz = notizEintraege.sort((x, y) => x.name.split("/").length - y.name.split("/").length)[0];
  let notizen: string | null = null;
  if (notiz) {
    const daten = auspacken(b, notiz);
    if (!daten) return fehler(`„${notiz.name}“ ist beschädigt.`);
    notizen = daten.toString("utf8");
  }
  const extern = new Set<string>();
  for (const d of dateien) if (istHtml(d.pfad) || endung(d.pfad) === "css") for (const h of externeQuellen(d.daten.toString("utf8"))) extern.add(h);
  return { ok: true, wert: { dateien, start, notizen, extern: [...extern].slice(0, 12) } };
}
