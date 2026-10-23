/**
 * Text aus einem PDF (Plan 4.2, „Ausgangstext aus PDF“): die App liest den Text, der im PDF gespeichert ist, selbst
 * und ohne KI, Zeile für Zeile wie gedruckt, damit die Zeilennummern zum Blatt passen. Ein eingescanntes PDF (nur
 * ein Bild) hat keinen Text; dafür gibt es „Vom Foto lesen“ mit KI (lib/textinterpretation-foto.ts).
 *
 * Gelesen werden: Objekte und Objektströme, FlateDecode, die Seiten in ihrer Reihenfolge, Schriften mit ToUnicode,
 * WinAnsi-, MacRoman- und Standard-Kodierung mit Differences, Breiten für die Abstände, Text in Formularobjekten.
 * Nicht gelesen werden verschlüsselte PDFs. Zeilen entstehen aus der Lage des Texts; Zahlen am Rand (Zeilennummern
 * des Blatts) und Seitenzahlen fallen weg, die App zählt selbst. Nichts wird gespeichert oder ausgeführt.
 */
import { constants, inflateSync } from "node:zlib";

export class PdfFehler extends Error {}

/** Was das Formular bekommt, wie beim Foto (lib/textinterpretation-foto.ts textAusGelesen). */
export type PdfGelesen = { titel: string; zeilen: string[]; seiten: number; hinweise: string[] };

const MAX_SEITEN = 40;
const MAX_STROM = 20 * 1024 * 1024;
const MAX_GESAMT = 80 * 1024 * 1024;

// ---------- values ----------

class Name {
  constructor(readonly v: string) {}
}
class Str {
  constructor(readonly b: string) {}
}
class Ref {
  constructor(
    readonly n: number,
    readonly g: number,
  ) {}
}
class Op {
  constructor(readonly v: string) {}
}
type Dict = Map<string, Val>;
type Val = number | boolean | null | Name | Str | Ref | Op | Val[] | Dict;
type Obj = { val: Val; strom?: string };

const isDict = (v: Val | undefined): v is Dict => v instanceof Map;
const WS = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIM = new Set("()<>[]{}/%".split("").map((c) => c.charCodeAt(0)));

/** A small reader of PDF syntax over a latin1 string (one character per byte). */
class Leser {
  pos = 0;
  constructor(readonly s: string) {}
  ws() {
    const s = this.s;
    while (this.pos < s.length) {
      const c = s.charCodeAt(this.pos);
      if (WS.has(c)) this.pos++;
      else if (c === 0x25) {
        while (this.pos < s.length && s[this.pos] !== "\n" && s[this.pos] !== "\r") this.pos++;
      } else break;
    }
  }
  wort(): string {
    const s = this.s;
    const start = this.pos;
    while (this.pos < s.length) {
      const c = s.charCodeAt(this.pos);
      if (WS.has(c) || DELIM.has(c)) break;
      this.pos++;
    }
    return s.slice(start, this.pos);
  }
  /** One value; null at the end. Keywords come back as Op (content streams). */
  wert(): Val | undefined {
    this.ws();
    const s = this.s;
    if (this.pos >= s.length) return undefined;
    const c = s[this.pos];
    if (c === "<" && s[this.pos + 1] === "<") {
      this.pos += 2;
      const d: Dict = new Map();
      for (;;) {
        this.ws();
        if (this.pos >= s.length) return d;
        if (s[this.pos] === ">" && s[this.pos + 1] === ">") {
          this.pos += 2;
          return d;
        }
        const k = this.wert();
        if (k === undefined) return d;
        if (!(k instanceof Name)) continue;
        const v = this.wert();
        if (v === undefined) return d;
        d.set(k.v, v);
      }
    }
    if (c === "<") {
      const end = s.indexOf(">", this.pos);
      const hex = s.slice(this.pos + 1, end < 0 ? s.length : end).replace(/[^0-9a-fA-F]/g, "");
      this.pos = end < 0 ? s.length : end + 1;
      let b = "";
      for (let i = 0; i < hex.length; i += 2) b += String.fromCharCode(parseInt((hex.slice(i, i + 2) + "0").slice(0, 2), 16));
      return new Str(b);
    }
    if (c === "(") return new Str(this.literal());
    if (c === "[") {
      this.pos++;
      const a: Val[] = [];
      for (;;) {
        this.ws();
        if (this.pos >= s.length) return a;
        if (s[this.pos] === "]") {
          this.pos++;
          return a;
        }
        const v = this.wert();
        if (v === undefined) return a;
        a.push(v);
      }
    }
    if (c === "/") {
      this.pos++;
      return new Name(this.wort().replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))));
    }
    if (c === "]" || c === ">" || c === ")" || c === "{" || c === "}") {
      this.pos++;
      return new Op(c);
    }
    const w = this.wort();
    if (!w) {
      this.pos++;
      return new Op(c);
    }
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) {
      const n = Number(w);
      // "12 0 R": a reference
      if (/^\d+$/.test(w)) {
        const keep = this.pos;
        this.ws();
        const g = this.wort();
        if (/^\d+$/.test(g)) {
          this.ws();
          if (s[this.pos] === "R" && (this.pos + 1 >= s.length || WS.has(s.charCodeAt(this.pos + 1)) || DELIM.has(s.charCodeAt(this.pos + 1)))) {
            this.pos++;
            return new Ref(n, Number(g));
          }
        }
        this.pos = keep;
      }
      return n;
    }
    if (w === "true") return true;
    if (w === "false") return false;
    if (w === "null") return null;
    return new Op(w);
  }
  literal(): string {
    const s = this.s;
    this.pos++;
    let depth = 1;
    let out = "";
    while (this.pos < s.length) {
      const c = s[this.pos++];
      if (c === "\\") {
        const n = s[this.pos++];
        if (n === undefined) break;
        if (n === "n") out += "\n";
        else if (n === "r") out += "\r";
        else if (n === "t") out += "\t";
        else if (n === "b") out += "\b";
        else if (n === "f") out += "\f";
        else if (n === "\r") {
          if (s[this.pos] === "\n") this.pos++;
        } else if (n === "\n") {
          /* line continuation */
        } else if (/[0-7]/.test(n)) {
          let oct = n;
          while (oct.length < 3 && /[0-7]/.test(s[this.pos] ?? "")) oct += s[this.pos++];
          out += String.fromCharCode(parseInt(oct, 8) & 0xff);
        } else out += n;
      } else if (c === "(") {
        depth++;
        out += c;
      } else if (c === ")") {
        if (--depth === 0) break;
        out += c;
      } else out += c;
    }
    return out;
  }
}

// ---------- the file ----------

class Datei {
  objs = new Map<number, Obj>();
  dekodiert = 0;
  constructor(readonly s: string) {
    this.lies();
  }
  private lies() {
    const s = this.s;
    const re = /(\d+)\s+(\d+)\s+obj\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      const n = Number(m[1]);
      const l = new Leser(s);
      l.pos = m.index + m[0].length;
      const val = l.wert();
      if (val === undefined) break;
      l.ws();
      let strom: string | undefined;
      if (s.startsWith("stream", l.pos)) {
        let p = l.pos + 6;
        if (s[p] === "\r") p++;
        if (s[p] === "\n") p++;
        const len = isDict(val) ? val.get("Length") : undefined;
        let end = typeof len === "number" && len >= 0 && /^\s*endstream/.test(s.slice(p + len, p + len + 20)) ? p + len : -1;
        if (end < 0) {
          end = s.indexOf("endstream", p);
          if (end < 0) end = s.length;
          let e = end;
          if (s[e - 1] === "\n") e--;
          if (s[e - 1] === "\r") e--;
          end = e;
        }
        strom = s.slice(p, end);
        l.pos = end;
      }
      this.objs.set(n, { val, strom });
      re.lastIndex = Math.max(l.pos, m.index + m[0].length);
    }
    // objects inside object streams (PDF 1.5); a direct object of the same number wins
    for (const o of [...this.objs.values()]) {
      if (!isDict(o.val) || this.name(o.val.get("Type")) !== "ObjStm" || o.strom === undefined) continue;
      const data = this.dekodiere(o);
      if (data === null) continue;
      const anzahl = this.zahl(o.val.get("N"));
      const first = this.zahl(o.val.get("First"));
      const kopf = data.slice(0, first).trim().split(/\s+/).map(Number);
      for (let i = 0; i < anzahl && i * 2 + 1 < kopf.length; i++) {
        const nr = kopf[i * 2];
        if (this.objs.has(nr)) continue;
        const l = new Leser(data);
        l.pos = first + kopf[i * 2 + 1];
        const v = l.wert();
        if (v !== undefined) this.objs.set(nr, { val: v });
      }
    }
  }
  get(v: Val | undefined, tiefe = 0): Val | undefined {
    if (v instanceof Ref) return tiefe > 20 ? undefined : this.get(this.objs.get(v.n)?.val, tiefe + 1);
    return v;
  }
  obj(v: Val | undefined): Obj | undefined {
    return v instanceof Ref ? this.objs.get(v.n) : undefined;
  }
  dict(v: Val | undefined): Dict | undefined {
    const d = this.get(v);
    return isDict(d) ? d : undefined;
  }
  name(v: Val | undefined): string {
    const n = this.get(v);
    return n instanceof Name ? n.v : "";
  }
  zahl(v: Val | undefined, sonst = 0): number {
    const n = this.get(v);
    return typeof n === "number" ? n : sonst;
  }
  array(v: Val | undefined): Val[] {
    const a = this.get(v);
    return Array.isArray(a) ? a : [];
  }
  /** The decoded data of a stream; null for a filter the app does not read (an image). */
  dekodiere(o: Obj): string | null {
    if (o.strom === undefined || !isDict(o.val)) return null;
    const f = this.get(o.val.get("Filter"));
    const filter = (Array.isArray(f) ? f : f ? [f] : []).map((x) => this.name(x));
    let data = o.strom;
    for (const fl of filter) {
      if (fl === "FlateDecode" || fl === "Fl") {
        const rest = MAX_GESAMT - this.dekodiert;
        if (rest <= 0) throw new PdfFehler("Das PDF ist zu groß zum Lesen.");
        const buf = Buffer.from(data, "latin1");
        const max = Math.min(MAX_STROM, rest);
        try {
          data = inflateSync(buf, { maxOutputLength: max }).toString("latin1");
        } catch {
          try {
            data = inflateSync(buf, { maxOutputLength: max, finishFlush: constants.Z_SYNC_FLUSH }).toString("latin1");
          } catch {
            return null;
          }
        }
        this.dekodiert += data.length;
      } else if (fl === "ASCIIHexDecode" || fl === "AHx") {
        const hex = data.replace(/>.*$/s, "").replace(/[^0-9a-fA-F]/g, "");
        let b = "";
        for (let i = 0; i < hex.length; i += 2) b += String.fromCharCode(parseInt((hex.slice(i, i + 2) + "0").slice(0, 2), 16));
        data = b;
      } else return null;
    }
    return data;
  }
  /** The pages in order, each with its Resources (inherited from the page tree). */
  seiten(): { page: Dict; res: Dict | undefined }[] {
    const out: { page: Dict; res: Dict | undefined }[] = [];
    const seen = new Set<Dict>();
    const walk = (node: Dict | undefined, res: Dict | undefined, tiefe: number) => {
      if (!node || seen.has(node) || tiefe > 30 || out.length >= MAX_SEITEN + 1) return;
      seen.add(node);
      const r = this.dict(node.get("Resources")) ?? res;
      const type = this.name(node.get("Type"));
      if (type === "Pages" || (!type && node.has("Kids"))) for (const k of this.array(node.get("Kids"))) walk(this.dict(k), r, tiefe + 1);
      else if (type === "Page" || node.has("Contents")) out.push({ page: node, res: r });
    };
    const katalog = [...this.objs.values()].reverse().find((o) => isDict(o.val) && this.name(o.val.get("Type")) === "Catalog");
    if (katalog && isDict(katalog.val)) walk(this.dict(katalog.val.get("Pages")), undefined, 0);
    if (!out.length)
      for (const [, o] of [...this.objs.entries()].sort((a, b) => a[0] - b[0]))
        if (isDict(o.val) && this.name(o.val.get("Type")) === "Page") out.push({ page: o.val, res: this.dict(o.val.get("Resources")) });
    return out;
  }
}

// ---------- fonts ----------

const WIN_ANSI_80 = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ";
const MAC_ROMAN_80 = "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ";

function winAnsi(code: number): string {
  if (code >= 0x80 && code <= 0x9f) return WIN_ANSI_80[code - 0x80];
  return String.fromCharCode(code);
}
function macRoman(code: number): string {
  return code >= 0x80 ? MAC_ROMAN_80[code - 0x80] : String.fromCharCode(code);
}
/** StandardEncoding: like ASCII, with typographic quotes at 0x27 and 0x60; the upper half as WinAnsi is close enough. */
function standard(code: number): string {
  if (code === 0x27) return "’";
  if (code === 0x60) return "‘";
  return winAnsi(code);
}

/** Glyph names a Differences array uses most in German texts (Adobe Glyph List). */
const GLYPHEN: Record<string, string> = {
  space: " ", exclam: "!", quotedbl: '"', numbersign: "#", dollar: "$", percent: "%", ampersand: "&", quotesingle: "'", parenleft: "(", parenright: ")",
  asterisk: "*", plus: "+", comma: ",", hyphen: "-", minus: "−", period: ".", slash: "/", colon: ":", semicolon: ";", less: "<", equal: "=", greater: ">",
  question: "?", at: "@", bracketleft: "[", backslash: "\\", bracketright: "]", underscore: "_", braceleft: "{", bar: "|", braceright: "}", asciitilde: "~",
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  Adieresis: "Ä", Odieresis: "Ö", Udieresis: "Ü", adieresis: "ä", odieresis: "ö", udieresis: "ü", germandbls: "ß", eacute: "é", egrave: "è", agrave: "à",
  aacute: "á", ecircumflex: "ê", ccedilla: "ç", Eacute: "É", oacute: "ó", uacute: "ú", iacute: "í", ntilde: "ñ",
  quotedblbase: "„", quotedblleft: "“", quotedblright: "”", quoteleft: "‘", quoteright: "’", quotesinglbase: "‚", guillemotleft: "«", guillemotright: "»",
  guilsinglleft: "‹", guilsinglright: "›", endash: "–", emdash: "—", ellipsis: "…", bullet: "•", degree: "°", section: "§", copyright: "©", registered: "®",
  fi: "fi", fl: "fl", ff: "ff", ffi: "ffi", ffl: "ffl", periodcentered: "·", exclamdown: "¡", questiondown: "¿", Euro: "€", euro: "€", nbspace: " ", sfthyphen: "",
};
function glyph(name: string): string | null {
  if (Object.hasOwn(GLYPHEN, name)) return GLYPHEN[name];
  if (/^[A-Za-z]$/.test(name)) return name;
  const uni = /^uni([0-9A-Fa-f]{4})/.exec(name) ?? /^u([0-9A-Fa-f]{4,6})$/.exec(name);
  if (uni) return String.fromCodePoint(parseInt(uni[1], 16));
  const base = name.split(".")[0];
  return base !== name ? glyph(base) : null;
}

const utf16 = (b: string) => {
  let out = "";
  for (let i = 0; i + 1 < b.length; i += 2) out += String.fromCharCode((b.charCodeAt(i) << 8) | b.charCodeAt(i + 1));
  return out;
};
const hexBytes = (h: string) => {
  let b = "";
  for (let i = 0; i < h.length; i += 2) b += String.fromCharCode(parseInt(h.slice(i, i + 2), 16));
  return b;
};

/** A ToUnicode CMap: code → text (bfchar and bfrange). */
function leseCMap(data: string): { map: Map<number, string>; bytes: number } {
  const map = new Map<number, string>();
  let bytes = 1;
  const cs = /begincodespacerange([\s\S]*?)endcodespacerange/.exec(data);
  if (cs) {
    const h = /<([0-9a-fA-F]+)>/.exec(cs[1]);
    if (h) bytes = Math.max(1, Math.ceil(h[1].length / 2));
  }
  for (const blk of data.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
    for (const m of blk[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) {
      map.set(parseInt(m[1], 16), utf16(hexBytes(m[2])));
      if (m[1].length > 2) bytes = Math.max(bytes, Math.ceil(m[1].length / 2));
    }
  for (const blk of data.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))
    for (const m of blk[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]*)>|\[([^\]]*)\])/g)) {
      const lo = parseInt(m[1], 16);
      const hi = Math.min(parseInt(m[2], 16), lo + 65535);
      if (m[1].length > 2) bytes = Math.max(bytes, Math.ceil(m[1].length / 2));
      if (m[3] !== undefined) {
        const dst = hexBytes(m[3]);
        for (let c = lo; c <= hi; c++) {
          const last = dst.length >= 2 ? ((dst.charCodeAt(dst.length - 2) << 8) | dst.charCodeAt(dst.length - 1)) + (c - lo) : 0;
          map.set(c, utf16(dst.slice(0, -2) + String.fromCharCode((last >> 8) & 0xff, last & 0xff)));
        }
      } else {
        const list = [...(m[4] ?? "").matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => utf16(hexBytes(x[1])));
        for (let c = lo; c <= hi && c - lo < list.length; c++) map.set(c, list[c - lo]);
      }
    }
  return { map, bytes };
}

type Schrift = { bytes: number; text: (code: number) => string; breite: (code: number) => number };

function schrift(f: Datei, d: Dict | undefined): Schrift {
  const fallback: Schrift = { bytes: 1, text: winAnsi, breite: () => 500 };
  if (!d) return fallback;
  const sub = f.name(d.get("Subtype"));
  const typ0 = sub === "Type0";
  let toU: Map<number, string> | null = null;
  let bytes = typ0 ? 2 : 1;
  const tu = f.obj(d.get("ToUnicode"));
  if (tu) {
    const data = f.dekodiere(tu);
    if (data) {
      const c = leseCMap(data);
      toU = c.map;
      if (typ0) bytes = c.bytes;
    }
  }
  // widths: simple fonts /FirstChar /Widths; Type0 /W of the descendant
  const w = new Map<number, number>();
  let dw = typ0 ? 1000 : 0;
  if (typ0) {
    const desc = f.dict(f.array(d.get("DescendantFonts"))[0]);
    if (desc) {
      dw = f.zahl(desc.get("DW"), 1000);
      const arr = f.array(desc.get("W"));
      for (let i = 0; i < arr.length; ) {
        const a = f.zahl(arr[i]);
        const next = f.get(arr[i + 1]);
        if (Array.isArray(next)) {
          next.forEach((x, k) => w.set(a + k, f.zahl(x)));
          i += 2;
        } else {
          const b = f.zahl(arr[i + 1]);
          const v = f.zahl(arr[i + 2]);
          for (let c = a; c <= b && c - a < 65536; c++) w.set(c, v);
          i += 3;
        }
      }
    }
  } else {
    const first = f.zahl(d.get("FirstChar"));
    f.array(d.get("Widths")).forEach((x, k) => w.set(first + k, f.zahl(x)));
  }
  const breite = (c: number) => w.get(c) ?? (dw || 500);
  // simple fonts: an encoding with Differences
  let basis = winAnsi;
  const diff = new Map<number, string>();
  const enc = f.get(d.get("Encoding"));
  const encName = enc instanceof Name ? enc.v : isDict(enc) ? f.name(enc.get("BaseEncoding")) : "";
  if (encName === "MacRomanEncoding") basis = macRoman;
  else if (encName === "StandardEncoding") basis = standard;
  if (isDict(enc)) {
    let code = 0;
    for (const x of f.array(enc.get("Differences"))) {
      const v = f.get(x);
      if (typeof v === "number") code = v;
      else if (v instanceof Name) {
        const g = glyph(v.v);
        if (g !== null) diff.set(code, g);
        code++;
      }
    }
  }
  const text = (c: number) => toU?.get(c) ?? (typ0 ? "" : (diff.get(c) ?? basis(c)));
  return { bytes, text, breite };
}

// ---------- content streams ----------

type M = [number, number, number, number, number, number];
const ID: M = [1, 0, 0, 1, 0, 0];
const mul = (a: M, b: M): M => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];

type Lauf = { x: number; y: number; ende: number; groesse: number; text: string };

function inhalt(f: Datei, data: string, res: Dict | undefined, ctm0: M, laeufe: Lauf[], tiefe: number) {
  const l = new Leser(data);
  const fonts = new Map<string, Schrift>();
  const fontDicts = f.dict(res?.get("Font"));
  const xobj = f.dict(res?.get("XObject"));
  let ctm = ctm0;
  const stapel: M[] = [];
  let tm: M = ID;
  let tlm: M = ID;
  let font: Schrift = schrift(f, undefined);
  let fs = 12;
  let tc = 0;
  let tw = 0;
  let th = 1;
  let tl = 0;
  let ops: Val[] = [];
  const num = (i: number) => (typeof ops[i] === "number" ? (ops[i] as number) : 0);
  const zeige = (b: string) => {
    const trm = mul(tm, ctm);
    const x = trm[4];
    const y = trm[5];
    const groesse = Math.abs(fs * Math.hypot(trm[2], trm[3])) || Math.abs(fs);
    let text = "";
    for (let i = 0; i + font.bytes <= b.length; i += font.bytes) {
      let code = 0;
      for (let k = 0; k < font.bytes; k++) code = (code << 8) | b.charCodeAt(i + k);
      text += font.text(code);
      const tx = ((font.breite(code) / 1000) * fs + tc + (font.bytes === 1 && code === 32 ? tw : 0)) * th;
      tm = mul([1, 0, 0, 1, tx, 0], tm);
    }
    const ende = mul(tm, ctm)[4];
    if (text) laeufe.push({ x, y, ende, groesse, text });
  };
  const td = (x: number, y: number) => {
    tlm = mul([1, 0, 0, 1, x, y], tlm);
    tm = tlm;
  };
  for (let schritte = 0; schritte < 2_000_000; schritte++) {
    const v = l.wert();
    if (v === undefined) break;
    if (!(v instanceof Op)) {
      ops.push(v);
      continue;
    }
    switch (v.v) {
      case "q":
        stapel.push(ctm);
        break;
      case "Q":
        ctm = stapel.pop() ?? ctm0;
        break;
      case "cm":
        ctm = mul([num(0), num(1), num(2), num(3), num(4), num(5)], ctm);
        break;
      case "BT":
        tm = tlm = ID;
        break;
      case "Tf": {
        const name = ops[0] instanceof Name ? ops[0].v : "";
        if (!fonts.has(name)) fonts.set(name, schrift(f, f.dict(fontDicts?.get(name))));
        font = fonts.get(name)!;
        fs = num(1);
        break;
      }
      case "Tc":
        tc = num(0);
        break;
      case "Tw":
        tw = num(0);
        break;
      case "Tz":
        th = num(0) / 100;
        break;
      case "TL":
        tl = num(0);
        break;
      case "Td":
        td(num(0), num(1));
        break;
      case "TD":
        tl = -num(1);
        td(num(0), num(1));
        break;
      case "Tm":
        tm = tlm = [num(0), num(1), num(2), num(3), num(4), num(5)];
        break;
      case "T*":
        td(0, -tl);
        break;
      case "Tj":
        if (ops[0] instanceof Str) zeige(ops[0].b);
        break;
      case "'":
        td(0, -tl);
        if (ops[0] instanceof Str) zeige(ops[0].b);
        break;
      case '"':
        tw = num(0);
        tc = num(1);
        td(0, -tl);
        if (ops[2] instanceof Str) zeige(ops[2].b);
        break;
      case "TJ":
        for (const x of Array.isArray(ops[0]) ? ops[0] : []) {
          if (x instanceof Str) zeige(x.b);
          else if (typeof x === "number") {
            // a big gap in a TJ array is a space between words
            if (x < -200 && laeufe.length) laeufe.push({ ...laeufe[laeufe.length - 1], text: " ", x: laeufe[laeufe.length - 1].ende });
            tm = mul([1, 0, 0, 1, (-x / 1000) * fs * th, 0], tm);
            if (x < -200) laeufe[laeufe.length - 1].ende = mul(tm, ctm)[4];
          }
        }
        break;
      case "BI": {
        // an inline image: skip its data up to EI
        const id = data.indexOf("ID", l.pos);
        const ei = id < 0 ? -1 : data.slice(id + 2).search(/\sEI(?=\s|$)/);
        l.pos = id < 0 || ei < 0 ? data.length : id + 2 + ei + 3;
        break;
      }
      case "Do": {
        const name = ops[0] instanceof Name ? ops[0].v : "";
        const o = f.obj(xobj?.get(name));
        if (o && isDict(o.val) && f.name(o.val.get("Subtype")) === "Form" && tiefe < 6) {
          const data2 = f.dekodiere(o);
          const mat = f.array(o.val.get("Matrix")).map((x) => f.zahl(x));
          const m: M = mat.length === 6 ? (mat as M) : ID;
          if (data2) inhalt(f, data2, f.dict(o.val.get("Resources")) ?? res, mul(m, ctm), laeufe, tiefe + 1);
        }
        break;
      }
    }
    ops = [];
  }
}

// ---------- lines ----------

const LIGATUREN: Record<string, string> = { "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st" };

type Zeile = { y: number; groesse: number; text: string };

/** Runs in the order of the content stream become lines: a new line where the text moves to another height. */
function zeilenAus(laeufe: Lauf[]): Zeile[] {
  const out: (Zeile & { ende: number })[] = [];
  for (const r of laeufe) {
    const cur = out[out.length - 1];
    const h = Math.max(r.groesse, cur?.groesse ?? 0) || 10;
    if (cur && Math.abs(r.y - cur.y) <= h * 0.5 && r.x >= cur.ende - h * 2) {
      const luecke = r.x - cur.ende;
      if (luecke > r.groesse * 0.15 && !/\s$/.test(cur.text) && !/^\s/.test(r.text)) cur.text += " ";
      cur.text += r.text;
      cur.ende = Math.max(cur.ende, r.ende);
      cur.groesse = Math.max(cur.groesse, r.groesse);
    } else out.push({ y: r.y, groesse: r.groesse, text: r.text, ende: r.ende });
  }
  return out
    .map((z) => ({ y: z.y, groesse: z.groesse, text: z.text.replace(/[ﬀ-ﬆ]/g, (c) => LIGATUREN[c] ?? c).replace(/[ \t]/g, " ").replace(/ {2,}/g, " ").trim().normalize("NFC") }))
    .filter((z) => z.text);
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * Liest den Text eines PDFs: Zeilen wie gedruckt, eine Leerzeile bei einem großen Abstand (Absatz), ohne Zahlen am
 * Rand. Wirft PdfFehler mit einem Satz für die Lehrkraft.
 */
export function liesPdfText(buf: Buffer): PdfGelesen {
  if (buf.subarray(0, 1024).toString("latin1").indexOf("%PDF-") < 0) throw new PdfFehler("Das ist keine PDF-Datei.");
  const s = buf.toString("latin1");
  if (/\/Encrypt\s/.test(s.slice(-4096)) || /trailer[\s\S]{0,400}\/Encrypt/.test(s)) throw new PdfFehler("Das PDF ist geschützt und lässt sich nicht lesen. Kopier den Text heraus und füg ihn ein.");
  const f = new Datei(s);
  const seiten = f.seiten();
  if (!seiten.length) throw new PdfFehler("Im PDF wurde keine Seite gefunden.");
  const hinweise: string[] = [];
  if (seiten.length > MAX_SEITEN) hinweise.push(`Nur die ersten ${MAX_SEITEN} Seiten gelesen.`);
  const alle: Zeile[][] = [];
  for (const { page, res } of seiten.slice(0, MAX_SEITEN)) {
    const c = f.get(page.get("Contents"));
    const teile = (Array.isArray(c) ? c : [page.get("Contents")]).map((x) => f.obj(x)).filter((o): o is Obj => Boolean(o));
    const data = teile.map((o) => f.dekodiere(o) ?? "").join("\n");
    const laeufe: Lauf[] = [];
    if (data) inhalt(f, data, res, ID, laeufe, 0);
    alle.push(zeilenAus(laeufe));
  }
  const flach = alle.flat();
  const buchstaben = flach.reduce((n, z) => n + (z.text.match(/\p{L}/gu)?.length ?? 0), 0);
  const zeichen = flach.reduce((n, z) => n + z.text.replace(/\s/g, "").length, 0);
  if (buchstaben < 20) throw new PdfFehler("Im PDF ist kein Text gespeichert, nur ein Bild (zum Beispiel eingescannt). Füg den Text bitte selbst ein.");
  if (buchstaben / Math.max(1, zeichen) < 0.5) throw new PdfFehler("Die Schrift im PDF lässt sich nicht lesen. Kopier den Text heraus und füg ihn ein.");

  // the title: the first line, clearly larger than the text
  const gr = median(flach.map((z) => z.groesse));
  const erste = flach[0];
  const titel = erste && gr > 0 && erste.groesse >= gr * 1.2 && erste.text.length <= 160 ? erste.text : "";

  const zeilen: string[] = [];
  for (const seite of alle) {
    const abstaende = seite.slice(1).map((z, i) => seite[i].y - z.y).filter((d) => d > 0);
    const normal = median(abstaende);
    seite.forEach((z, i) => {
      const d = i > 0 ? seite[i - 1].y - z.y : 0;
      if (i > 0 && normal > 0 && d > normal * 1.7 && zeilen.length && zeilen[zeilen.length - 1] !== "") zeilen.push("");
      zeilen.push(z.text);
    });
  }
  // printed line numbers in the same line as the text: "5 Er wartete …" where 5 is the line's own number; the title,
  // empty lines and lines with only a number (a margin number of its own, a page number) are not counted
  const gezaehlt = (z: string, i: number) => Boolean(z) && !/^\d{1,4}$/.test(z) && !(i === 0 && titel && z === titel);
  const nummern = (rand: "vorne" | "hinten") => {
    let n = 0;
    let treffer = 0;
    zeilen.forEach((z, i) => {
      if (!gezaehlt(z, i)) return;
      n++;
      const m = rand === "vorne" ? /^(\d{1,3})\s+\S/.exec(z) : /\S\s+(\d{1,3})$/.exec(z);
      if (m && Number(m[1]) === n) treffer++;
    });
    return treffer;
  };
  for (const rand of ["vorne", "hinten"] as const) {
    if (nummern(rand) < 2) continue;
    let n = 0;
    zeilen.forEach((z, i) => {
      if (!gezaehlt(z, i)) return;
      n++;
      zeilen[i] = rand === "vorne" ? z.replace(new RegExp(`^${n}\\s+`), "") : z.replace(new RegExp(`\\s+${n}$`), "");
    });
    hinweise.push("Zeilennummern am Rand wurden weggelassen; die App zählt die Zeilen selbst.");
  }
  return { titel, zeilen, seiten: Math.min(seiten.length, MAX_SEITEN), hinweise };
}
