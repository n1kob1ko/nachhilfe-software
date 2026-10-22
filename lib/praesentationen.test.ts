import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import zlib from "node:zlib";

process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = fs.mkdtempSync(path.join(os.tmpdir(), "lernheft-praes-"));
test.after(() => fs.rmSync(process.env.UPLOADS_PATH!, { recursive: true, force: true }));

// ---------- a small ZIP writer, with the knobs an attacker would turn ----------

type Eintrag = {
  name: string;
  daten?: Buffer | string;
  /** stored (0) or deflate (8) */
  methode?: 0 | 8;
  /** Unix mode in the upper 16 bits of the external attributes, e.g. 0o120777 for a symlink */
  modus?: number;
  /** a different size than the real one in the directory */
  groesse?: number;
  verschluesselt?: boolean;
  crcFalsch?: boolean;
};

function zip(eintraege: Eintrag[]): Buffer {
  const lokal: Buffer[] = [];
  const zentral: Buffer[] = [];
  let offset = 0;
  for (const e of eintraege) {
    const roh = Buffer.isBuffer(e.daten) ? e.daten : Buffer.from(e.daten ?? "", "utf8");
    const methode = e.methode ?? 8;
    const gepackt = methode === 8 ? zlib.deflateRawSync(roh) : roh;
    const name = Buffer.from(e.name, "utf8");
    const crc = (zlib.crc32(roh) ^ (e.crcFalsch ? 1 : 0)) >>> 0;
    const flags = 0x800 | (e.verschluesselt ? 1 : 0);
    const groesse = e.groesse ?? roh.length;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(flags, 6);
    lh.writeUInt16LE(methode, 8);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(gepackt.length, 18);
    lh.writeUInt32LE(groesse, 22);
    lh.writeUInt16LE(name.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE((3 << 8) | 20, 4); // made by Unix
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(flags, 8);
    cd.writeUInt16LE(methode, 10);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(gepackt.length, 20);
    cd.writeUInt32LE(groesse, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(((e.modus ?? (e.name.endsWith("/") ? 0o040755 : 0o100644)) << 16) >>> 0, 38);
    cd.writeUInt32LE(offset, 42);
    lokal.push(lh, name, gepackt);
    zentral.push(cd, name);
    offset += lh.length + name.length + gepackt.length;
  }
  const cdBuf = Buffer.concat(zentral);
  const ende = Buffer.alloc(22);
  ende.writeUInt32LE(0x06054b50, 0);
  ende.writeUInt16LE(eintraege.length, 8);
  ende.writeUInt16LE(eintraege.length, 10);
  ende.writeUInt32LE(cdBuf.length, 12);
  ende.writeUInt32LE(offset, 16);
  return Buffer.concat([...lokal, cdBuf, ende]);
}

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const REVEAL = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="reveal.css"></head><body><div class="reveal"><div class="slides"><section>Eins</section><section>Zwei</section></div></div><script src="reveal.js"></script></body></html>`;
const NOTIZEN = JSON.stringify({ format: "lernheft-praesentation-notizen", version: 1, folien: [{ folie: 1, notiz: "Begrüßen." }, { folie: 2, notiz: "  " }, { folie: 3, notiz: "Fragen stellen." }] });
const gutesZip = () =>
  zip([
    { name: "Folien/", daten: "" },
    { name: "Folien/index.html", daten: REVEAL },
    { name: "Folien/reveal.css", daten: "body{color:red}" },
    { name: "Folien/reveal.js", daten: "window.Reveal={};" },
    { name: "Folien/bilder/titel.png", daten: PNG, methode: 0 },
    { name: "Folien/lernheft-notizen.json", daten: NOTIZEN },
    { name: "__MACOSX/Folien/._index.html", daten: "x" },
    { name: "Folien/.DS_Store", daten: "x" },
  ]);

// ---------- unzip safety ----------

test("a good ZIP unpacks: start page, files, notes read and kept out of the files, system files skipped", async () => {
  const z = await import("./praesentation-zip");
  const r = z.leseZip(gutesZip());
  assert.ok(r.ok, r.ok ? "" : r.fehler);
  assert.equal(r.wert.start, "Folien/index.html");
  assert.deepEqual(r.wert.dateien.map((d) => d.pfad).sort(), ["Folien/bilder/titel.png", "Folien/index.html", "Folien/reveal.css", "Folien/reveal.js"]);
  assert.ok(r.wert.notizen?.includes("Begrüßen"), "the notes file is read");
  assert.equal(r.wert.dateien.find((d) => d.pfad.endsWith(".png"))!.daten.equals(PNG), true, "stored entries come out unchanged");
  assert.deepEqual(r.wert.extern, []);
});

test("names that leave the folder, links and special files are refused", async () => {
  const z = await import("./praesentation-zip");
  const index = { name: "index.html", daten: "<html></html>" };
  for (const name of ["../boese.html", "Folien/../../boese.js", "/etc/passwd.js", "C:/boese.js", "a\\..\\b.js", "a//b.js", "./a.js", "a/./b.js", "a\u0000.js", "a\nb.js"]) {
    const r = z.leseZip(zip([index, { name, daten: "x" }]));
    assert.equal(r.ok, false, `refused: ${JSON.stringify(name)}`);
  }
  assert.ok(z.pfadProblem("../x"));
  assert.ok(z.pfadProblem("/x"));
  assert.equal(z.pfadProblem("Folien/bilder/titel.png"), null);
  assert.equal(z.pfadProblem("Folien/"), null);

  const link = z.leseZip(zip([index, { name: "bild.png", daten: "/etc/passwd", modus: 0o120777 }]));
  assert.ok(!link.ok && link.fehler.includes("Symlink"), "a symbolic link is refused");
  const fifo = z.leseZip(zip([index, { name: "pipe.js", daten: "", modus: 0o010644 }]));
  assert.ok(!fifo.ok && fifo.fehler.includes("keine normale Datei"));
  const geheim = z.leseZip(zip([index, { name: "a.js", daten: "x", verschluesselt: true }]));
  assert.ok(!geheim.ok && geheim.fehler.includes("verschlüsselt"));
  const doppelt = z.leseZip(zip([index, { name: "Bild.png", daten: PNG }, { name: "bild.png", daten: PNG }]));
  assert.ok(!doppelt.ok && doppelt.fehler.includes("zweimal"), "names that differ only in case would overwrite each other");
});

test("limits: number of files, unpacked size, lying sizes and broken data", async () => {
  const z = await import("./praesentation-zip");
  const viele = zip([{ name: "index.html", daten: "<html></html>" }, ...Array.from({ length: z.GRENZEN.dateien }, (_, i) => ({ name: `b/${i}.png`, daten: PNG }))]);
  const r1 = z.leseZip(viele);
  assert.ok(!r1.ok && r1.fehler.includes("Zu viele Dateien"), r1.ok ? "" : r1.fehler);

  // 61 MB of zeros pack into a few kB: refused from the directory, before anything is inflated
  const bombe = zip([{ name: "index.html", daten: "<html></html>" }, { name: "video.mp4", daten: Buffer.alloc(z.GRENZEN.gesamt + 1024 * 1024) }]);
  assert.ok(bombe.length < 200_000);
  const r2 = z.leseZip(bombe);
  assert.ok(!r2.ok && r2.fehler.includes("Ausgepackt zu groß"), r2.ok ? "" : r2.fehler);

  // the directory claims 1 kB, the data inflates to 2 MB: stopped at the declared size
  const luege = z.leseZip(zip([{ name: "index.html", daten: "<html></html>" }, { name: "a.js", daten: Buffer.alloc(2 * 1024 * 1024), groesse: 1024 }]));
  assert.ok(!luege.ok && luege.fehler.includes("größer als angegeben"));
  const crc = z.leseZip(zip([{ name: "index.html", daten: "<html></html>", crcFalsch: true }]));
  assert.equal(crc.ok, false, "a wrong checksum is refused");

  const kaputt = z.leseZip(gutesZip().subarray(0, 200));
  assert.equal(kaputt.ok, false);
  assert.equal(z.leseZip(Buffer.from("kein zip")).ok, false);
});

test("only allowed file types; start page rules; HTML and other uploads", async () => {
  const z = await import("./praesentation-zip");
  for (const name of ["setup.exe", "server.php", "skript.sh", "daten.xml", "film.swf", "ohne-endung"]) {
    const r = z.leseZip(zip([{ name: "index.html", daten: "<html></html>" }, { name, daten: "x" }]));
    assert.ok(!r.ok && r.fehler.includes("Dateiarten"), `refused: ${name}`);
  }
  for (const name of ["a.css", "a.mjs", "a.json", "a.svg", "a.woff2", "a.mp3", "a.webm", "a.vtt", "a.JPG"]) assert.ok(z.typVon(name), name);

  assert.equal(z.startDatei(["x/index.html", "index.html", "a.html"]), "index.html");
  assert.equal(z.startDatei(["kurs/story.html", "kurs/story_html5.html"]), "kurs/story.html");
  assert.equal(z.startDatei(["praesentation.html", "bild.png"]), "praesentation.html");
  assert.equal(z.startDatei(["a.html", "b.html"]), null);
  const ohne = z.leseZip(zip([{ name: "a.html", daten: "x" }, { name: "b.html", daten: "y" }]));
  assert.ok(!ohne.ok && ohne.fehler.includes("Startseite"));

  assert.equal(z.uploadArt("folien.pptx", zip([{ name: "ppt/presentation.xml", daten: "<p/>" }])), "pptx");
  assert.equal(z.uploadArt("folien.zip", zip([{ name: "ppt/presentation.xml", daten: "<p/>" }])), "pptx", "a renamed PowerPoint file is recognised");
  assert.equal(z.uploadArt("folien.zip", gutesZip()), "zip");
  assert.equal(z.uploadArt("folien.pdf", Buffer.from("%PDF-1.7")), "pdf");
  assert.equal(z.uploadArt("folien.html", Buffer.from("<html>")), "html");
  assert.equal(z.uploadArt("folien.exe", Buffer.from("MZ")), "unbekannt");
  const html = z.leseHtml(Buffer.from(`<html><head><script src="https://cdn.example.org/reveal.js"></script><link rel="stylesheet" href="//fonts.example.com/x.css"></head><body><a href="https://beispiel.at">Link</a><img src="bild.png"></body></html>`));
  assert.ok(html.ok);
  assert.equal(html.wert.start, "index.html");
  assert.deepEqual(html.wert.extern.sort(), ["cdn.example.org", "fonts.example.com"], "loaded resources count, links do not");
  assert.equal(z.leseHtml(Buffer.from([0x3c, 0x00, 0x3e])).ok, false);
});

// ---------- host separation ----------

const ENV = { PRESENTATION_ORIGIN: "http://127.0.0.1:3000" };

test("the presentation host answers only deck files; the app's host never serves them", async () => {
  const h = await import("./praesentation-host");
  const app = (pfad: string, angemeldet = false) => h.proxyEntscheidung({ host: "localhost:3000", pfad, angemeldet }, ENV);
  const deck = (pfad: string, angemeldet = false) => h.proxyEntscheidung({ host: "127.0.0.1:3000", pfad, angemeldet }, ENV);

  for (const p of ["/", "/login", "/lernen/abc", "/geraet", "/geraet/events", "/mitmachen", "/material/1/datei", "/health", "/feedback/senden", "/_next/static/chunk.js", "/brand/logo.png", "/schueler/1"])
    assert.equal(deck(p), "nicht-gefunden", `deck host refuses ${p}`);
  assert.equal(deck("/", true), "nicht-gefunden", "even with a cookie");
  assert.equal(deck("/deck/abc/index.html"), "weiter");

  assert.equal(app("/deck/abc/index.html"), "nicht-gefunden", "the app's host never serves a deck");
  assert.equal(app("/deck/abc/index.html", true), "nicht-gefunden");
  assert.equal(app("/"), "anmelden");
  assert.equal(app("/schueler/1"), "anmelden");
  assert.equal(app("/", true), "weiter");
  for (const p of ["/login", "/lernen/abc", "/geraet", "/mitmachen/status", "/health", "/material/1/datei", "/feedback/senden", "/_next/static/x.js", "/icon.png", "/brand/mark.png"])
    assert.equal(app(p), "weiter", `students and static files still work without a session: ${p}`);

  // a forged X-Forwarded-Host naming the presentation host only makes the app refuse more
  assert.equal(h.proxyEntscheidung({ host: "localhost:3000", forwardedHost: "127.0.0.1:3000", pfad: "/", angemeldet: true }, ENV), "nicht-gefunden");
  // without PRESENTATION_ORIGIN no deck is served anywhere
  assert.equal(h.proxyEntscheidung({ host: "localhost:3000", pfad: "/deck/abc/index.html", angemeldet: true }, {}), "nicht-gefunden");
  assert.equal(h.proxyEntscheidung({ host: "127.0.0.1:3000", pfad: "/deck/abc/index.html", angemeldet: false }, {}), "nicht-gefunden");
});

test("the paths open without a session are the same in proxy.ts and lib/praesentation-host.ts", async () => {
  const h = await import("./praesentation-host");
  const src = fs.readFileSync(path.join(process.cwd(), "proxy.ts"), "utf8");
  assert.ok(src.includes(`"/((?!${h.OFFENE_PFADE.replace(/\\/g, "\\\\")}).*)"`), "proxy.ts matcher and OFFENE_PFADE differ");
  assert.ok(src.includes('missing: [{ type: "cookie", key: "lernheft_session" }]'), "requests without a session reach the proxy on every path");
});

test("the deck route answers only on the presentation host, and the proxy refuses app paths there", async () => {
  const { importierePraesentation } = await import("./praesentationen");
  const out = importierePraesentation({ name: "folien.zip", data: gutesZip() }, meta(), null);
  assert.ok("id" in out, JSON.stringify(out));
  const { getPraesentation } = await import("./praesentationen");
  const p = getPraesentation(out.id)!;
  const { GET } = await import("../app/deck/[token]/[...pfad]/route");
  const { proxy } = await import("../proxy");
  const { NextRequest } = await import("next/server");
  const alt = process.env.PRESENTATION_ORIGIN;
  process.env.PRESENTATION_ORIGIN = ENV.PRESENTATION_ORIGIN;
  try {
    const url = (host: string) => `http://${host}/deck/${p.token}/Folien/index.html`;
    const anApp = await GET(new Request(url("localhost:3000"), { headers: { host: "localhost:3000" } }));
    assert.equal(anApp.status, 404, "the deck route refuses the app's host");
    const gefaelscht = await GET(new Request(url("127.0.0.1:3000"), { headers: { host: "127.0.0.1:3000", "x-forwarded-host": "localhost:3000" } }));
    assert.equal(gefaelscht.status, 404, "a proxy in front naming another host is refused too");

    const ok = await GET(new Request(url("127.0.0.1:3000"), { headers: { host: "127.0.0.1:3000" } }));
    assert.equal(ok.status, 200);
    const csp = ok.headers.get("content-security-policy") ?? "";
    for (const teil of ["sandbox allow-scripts", "connect-src 'none'", "form-action 'none'", `script-src http://127.0.0.1:3000/deck/${p.token}/ 'unsafe-inline'`, "frame-ancestors http://localhost:*"])
      assert.ok(csp.includes(teil), `CSP has ${teil}: ${csp}`);
    assert.equal(ok.headers.get("x-content-type-options"), "nosniff");
    assert.equal(ok.headers.get("x-frame-options"), null, "deck files rely on frame-ancestors alone");
    assert.match(ok.headers.get("content-type") ?? "", /^text\/html/);
    const body = await ok.text();
    assert.ok(body.includes("lernheft-praesentation") && body.indexOf("lernheft-praesentation") < body.lastIndexOf("</body>"), "the bridge goes in before </body>");

    const notiz = await GET(new Request(`http://127.0.0.1:3000/deck/${p.token}/Folien/lernheft-notizen.json`, { headers: { host: "127.0.0.1:3000" } }));
    assert.equal(notiz.status, 404, "the Vortragstext file is never served");
    const raus = await GET(new Request(`http://127.0.0.1:3000/deck/${p.token}/Folien/%2e%2e/%2e%2e/nachhilfe.db`, { headers: { host: "127.0.0.1:3000" } }));
    assert.equal(raus.status, 404);
    const teil = await GET(new Request(`http://127.0.0.1:3000/deck/${p.token}/Folien/bilder/titel.png`, { headers: { host: "127.0.0.1:3000", range: "bytes=0-3" } }));
    assert.equal(teil.status, 206);
    assert.equal(teil.headers.get("content-range"), `bytes 0-3/${PNG.length}`);

    // the main app refuses the deck host: pages, login and student links are 404 there
    for (const pfad of ["/", "/login", "/lernen/abc", "/geraet"]) {
      const r = proxy(new NextRequest(`http://127.0.0.1:3000${pfad}`, { headers: { host: "127.0.0.1:3000" } }));
      assert.equal(r.status, 404, `deck host: ${pfad}`);
    }
    const login = proxy(new NextRequest("http://localhost:3000/schueler", { headers: { host: "localhost:3000" } }));
    assert.equal(login.status, 307, "the app itself still sends to the login");
    const deckAmApp = proxy(new NextRequest(`http://localhost:3000/deck/${p.token}/Folien/index.html`, { headers: { host: "localhost:3000", cookie: "lernheft_session=x" } }));
    assert.equal(deckAmApp.status, 404);
  } finally {
    if (alt === undefined) delete process.env.PRESENTATION_ORIGIN;
    else process.env.PRESENTATION_ORIGIN = alt;
  }
});

test("X-Frame-Options DENY is on every path except deck files; the other global headers stay everywhere", async () => {
  const { default: config } = await import("../next.config");
  const { getPathMatch } = await import("next/dist/shared/lib/router/utils/path-match");
  const regeln = await config.headers!();
  const kopfzeilen = (pfad: string) => {
    const k = new Map<string, string>();
    for (const r of regeln)
      if (getPathMatch(r.source, { strict: true, removeUnnamedParams: true })(pfad) !== false)
        for (const h of r.headers) k.set(h.key.toLowerCase(), h.value);
    return k;
  };
  const deck = kopfzeilen("/deck/abcdefghijklmnopqrstuvwx/Folien/index.html");
  assert.equal(deck.get("x-frame-options"), undefined);
  assert.equal(deck.get("referrer-policy"), "no-referrer");
  assert.equal(deck.get("x-content-type-options"), "nosniff");
  for (const pfad of ["/", "/login", "/lernen/abc", "/geraet", "/mehr/praesentationen", "/decks"])
    assert.equal(kopfzeilen(pfad).get("x-frame-options"), "DENY", pfad);
  assert.equal(kopfzeilen("/material/7/datei").get("x-frame-options"), "SAMEORIGIN", "the PDF preview still frames itself");
});

test("deck host checks: other host name required, frame-ancestors from PUBLIC_URL, setup hints", async () => {
  const h = await import("./praesentation-host");
  assert.equal(h.deckAuslieferbar({ host: "127.0.0.1:3000" }, ENV), true);
  assert.equal(h.deckAuslieferbar({ host: "localhost:3000" }, ENV), false);
  assert.equal(h.deckAuslieferbar({ host: "127.0.0.1:3000" }, {}), false);
  assert.equal(h.deckAuslieferbar({ host: "FOLIEN.example.at:443" }, { PRESENTATION_ORIGIN: "https://folien.example.at/" }), true, "case and default port do not matter");
  // the same host name as the app with another port would share the cookies: never a deck host
  const gleich = { PRESENTATION_ORIGIN: "https://lernheft.example.at:8443", PUBLIC_URL: "https://lernheft.example.at" };
  assert.equal(h.deckAuslieferbar({ host: "lernheft.example.at:8443" }, gleich), false);
  assert.match(h.deckEinrichtungsProblem("lernheft.example.at", "https", gleich) ?? "", /anderer Rechnername/);

  const prod = { PRESENTATION_ORIGIN: "https://folien.example.at", PUBLIC_URL: "https://lernheft.example.at" };
  assert.equal(h.deckEinrichtungsProblem("lernheft.example.at", "https", prod), null);
  assert.match(h.deckEinrichtungsProblem("andere.example.at", "https", prod) ?? "", /PUBLIC_URL/);
  assert.match(h.deckEinrichtungsProblem("localhost:3000", "http", {}) ?? "", /PRESENTATION_ORIGIN/);
  assert.equal(h.deckEinrichtungsProblem("localhost:3000", "http", ENV), null);
  assert.ok(h.deckCsp("t".repeat(24), prod).includes("frame-ancestors https://lernheft.example.at"));
  assert.ok(!h.deckCsp("t".repeat(24), prod).includes("localhost"));
  assert.equal(h.deckUrl("abc", "Folien/Mein Deck.html", prod), "https://folien.example.at/deck/abc/Folien/Mein%20Deck.html");
  assert.equal(h.deckUrl("abc", "index.html", {}), null, "without presentation address there is no deck address");
  assert.equal(h.originAus("javascript:alert(1)"), null);
  assert.equal(h.originAus("ftp://x"), null);
});

// ---------- the protocol ----------

test("messages from the deck are accepted only in their exact shape and from the own frame", async () => {
  const pr = await import("./praesentation-protokoll");
  assert.deepEqual(pr.leseDeckNachricht({ quelle: "lernheft-praesentation", v: 1, typ: "folie", folie: 3, folien: 12, schritt: 0 }), { typ: "folie", folie: 3, folien: 12, schritt: 0 });
  assert.deepEqual(pr.leseDeckNachricht({ quelle: "lernheft-praesentation", v: 1, typ: "bereit", folien: "viele" }), { typ: "bereit", folien: null });
  for (const bad of [null, "folie", [], { quelle: "andere", v: 1, typ: "folie", folie: 1 }, { quelle: "lernheft-praesentation", v: 2, typ: "folie", folie: 1 }, { quelle: "lernheft-praesentation", v: 1, typ: "folie", folie: 0 }, { quelle: "lernheft-praesentation", v: 1, typ: "folie", folie: 1.5 }, { quelle: "lernheft-praesentation", v: 1, typ: "gehe-zu", folie: 1 }])
    assert.equal(pr.leseDeckNachricht(bad), null, JSON.stringify(bad));
  const frame = {} as Window;
  assert.equal(pr.vonDeck({ origin: "null", source: frame }, frame, null), true);
  assert.equal(pr.vonDeck({ origin: "http://127.0.0.1:3000", source: frame }, frame, "http://127.0.0.1:3000"), true);
  assert.equal(pr.vonDeck({ origin: "https://boese.example", source: frame }, frame, "http://127.0.0.1:3000"), false);
  assert.equal(pr.vonDeck({ origin: "null", source: {} as Window }, frame, null), false, "another window's message is ignored");
  assert.deepEqual(pr.geheZu({ folie: 4, schritt: null }), { quelle: "lernheft", v: 1, typ: "gehe-zu", folie: 4, schritt: null });
});

// ---------- notes ----------

/** The example of docs/praesentation-format.md: the documentation must stay a valid file. */
function beispiel(): string {
  const md = fs.readFileSync(path.join(process.cwd(), "docs", "praesentation-format.md"), "utf8");
  const block = md.match(/## Beispiel[\s\S]*?```json\n([\s\S]*?)```/);
  assert.ok(block, "Beispiel in docs/praesentation-format.md fehlt");
  return block[1];
}

test("notes files: the documented example, empty notes dropped, clear errors", async () => {
  const { leseNotizen, notizenDatei } = await import("./praesentationen");
  const r = leseNotizen(beispiel());
  assert.ok(r.ok, r.ok ? "" : r.fehler.join("\n"));
  assert.deepEqual(Object.keys(r.notizen), ["1", "2", "4"]);
  assert.deepEqual(leseNotizen(JSON.stringify(notizenDatei(r.notizen))), r, "the export reads back the same");
  const leer = leseNotizen(NOTIZEN);
  assert.ok(leer.ok && !(2 in leer.notizen) && leer.notizen[3] === "Fragen stellen.");
  const fehler = (roh: unknown) => {
    const x = leseNotizen(typeof roh === "string" ? roh : JSON.stringify(roh));
    assert.equal(x.ok, false);
    return x.ok ? "" : x.fehler.join("\n");
  };
  assert.match(fehler("{kein json"), /kein gültiges JSON/);
  assert.match(fehler({ format: "anderes", version: 1, folien: [] }), /format/);
  assert.match(fehler({ format: "lernheft-praesentation-notizen", version: 2, folien: [] }), /version/);
  assert.match(fehler({ format: "lernheft-praesentation-notizen", version: 1, folien: [{ folie: 0, notiz: "x" }] }), /Foliennummer/);
  assert.match(fehler({ format: "lernheft-praesentation-notizen", version: 1, folien: [{ folie: 1, notiz: "x" }, { folie: 1, notiz: "y" }] }), /zweimal/);
  assert.match(fehler({ format: "lernheft-praesentation-notizen", version: 1, folien: [{ folie: 1, notiz: "x", geheim: 1 }] }), /unbekanntes Feld/);
  assert.match(fehler({ format: "lernheft-praesentation-notizen", version: 1, folien: [{ folie: 1, notiz: "x".repeat(4001) }] }), /4000/);
});

// ---------- storing, serving, Lernpakete, student device ----------

const meta = (o: Record<string, unknown> = {}) => ({
  title: "Die vier Fälle",
  fach: "Deutsch",
  schulart: "Volksschule",
  klasse: 4,
  thema: "Grammatik",
  skill_ids: [] as string[],
  schwierigkeit: "mittel" as const,
  beschreibung: "",
  ...o,
});

test("an upload is stored with its notes; only listed files are served, HTML with the bridge", async () => {
  const pr = await import("./praesentationen");
  const out = pr.importierePraesentation({ name: "vier-faelle.zip", data: gutesZip() }, meta(), null);
  assert.ok("id" in out, JSON.stringify(out));
  const p = pr.getPraesentation(out.id)!;
  assert.match(p.token, /^[A-Za-z0-9_-]{24}$/);
  assert.equal(p.start_pfad, "Folien/index.html");
  assert.equal(p.schulstufe, 4);
  assert.deepEqual(p.notizen, { 1: "Begrüßen.", 3: "Fragen stellen." });
  assert.equal(pr.dateienDa(p), true);
  const ordner = path.join(pr.praesentationsOrdner(), p.token);
  assert.equal(fs.existsSync(path.join(ordner, "Folien", "lernheft-notizen.json")), false, "the notes are not written next to the deck");
  assert.equal(fs.existsSync(path.join(ordner, "__MACOSX")), false);

  const seite = pr.deckDatei(p.token, ["Folien", "index.html"])!;
  assert.equal(seite.typ, "text/html", "a page naming its charset keeps it");
  assert.ok(seite.daten.toString("utf8").includes("window.parent.postMessage"));
  assert.equal(pr.deckDatei(p.token, ["Folien", "reveal.css"])!.typ, "text/css; charset=utf-8");
  assert.equal(pr.deckDatei(p.token, ["Folien", "lernheft-notizen.json"]), null);
  assert.equal(pr.deckDatei(p.token, ["..", "..", "nachhilfe.db"]), null);
  assert.equal(pr.deckDatei("x".repeat(24), ["Folien", "index.html"]), null);
  assert.equal(pr.deckDatei("../../etc", ["passwd"]), null);
  assert.equal(pr.mitBruecke(Buffer.from("<p>ohne body</p>")).toString().startsWith("<p>ohne body</p>\n<script>"), true);

  // one HTML file becomes index.html; the title comes from the file name when none is given
  const html = pr.importierePraesentation({ name: "Bruchrechnen.html", data: Buffer.from("<html><body>Folie</body></html>") }, meta({ title: "", fach: "Mathematik", schulart: "", klasse: null }), null);
  assert.ok("id" in html);
  assert.equal(pr.getPraesentation(html.id)!.title, "Bruchrechnen");
  assert.equal(pr.getPraesentation(html.id)!.start_pfad, "index.html");

  assert.deepEqual(pr.importierePraesentation({ name: "skript.pdf", data: Buffer.from("%PDF-1.4 …") }, meta(), null), { pdf: true });
  const pptx = pr.importierePraesentation({ name: "folien.pptx", data: zip([{ name: "ppt/presentation.xml", daten: "<p/>" }]) }, meta(), null);
  assert.ok("fehler" in pptx && pptx.fehler[0].includes("PowerPoint"));
  const ohneFach = pr.importierePraesentation({ name: "a.html", data: Buffer.from("<html></html>") }, meta({ fach: "" }), null);
  assert.ok("fehler" in ohneFach && ohneFach.fehler[0].includes("Fach"));
  const boese = pr.importierePraesentation({ name: "a.zip", data: zip([{ name: "index.html", daten: "x" }, { name: "../../x.js", daten: "x" }]) }, meta(), null);
  assert.ok("fehler" in boese);
  assert.equal(fs.readdirSync(pr.praesentationsOrdner()).filter((n) => n.startsWith(".neu-")).length, 0, "nothing half-written is left");
});

test("library filters, notes editing, archive, Lernpaket link and the student device", async () => {
  const pr = await import("./praesentationen");
  const lp = await import("./lernpakete");
  const live = await import("./live");
  const units = await import("./units");
  const repo = await import("./repo");
  const a = pr.importierePraesentation({ name: "a.html", data: Buffer.from("<html></html>") }, meta({ title: "Satzglieder", schwierigkeit: "schwer", thema: "Satzbau" }), null);
  const b = pr.importierePraesentation({ name: "b.html", data: Buffer.from("<html></html>") }, meta({ title: "Brüche", fach: "Mathematik", schulart: "Mittelschule", klasse: 1, thema: "Bruchrechnung" }), null);
  assert.ok("id" in a && "id" in b);
  assert.deepEqual(pr.listPraesentationen({ schwierigkeit: "schwer" }).map((x) => x.id), [a.id]);
  assert.ok(pr.listPraesentationen({ fach: "Mathematik", schulart: "Mittelschule", klasse: 1 }).every((x) => x.fach === "Mathematik"));
  assert.deepEqual(pr.listPraesentationen({ q: "Satzbau" }).map((x) => x.id), [a.id]);
  assert.ok(pr.praesentationFacetten().schwierigkeiten.includes("schwer"));

  assert.ok("ok" in pr.setzeNotiz(a.id, 2, "  Zuerst das Prädikat suchen.  "));
  assert.equal(pr.getPraesentation(a.id)!.notizen[2], "Zuerst das Prädikat suchen.");
  assert.ok("ok" in pr.setzeNotiz(a.id, 2, ""));
  assert.equal(2 in pr.getPraesentation(a.id)!.notizen, false, "an empty text removes the note");
  assert.ok("fehler" in pr.setzeNotiz(a.id, 0, "x"));
  assert.ok("fehler" in pr.setzeNotiz(a.id, 1, "x".repeat(4001)));
  pr.setzeNotiz(a.id, 5, "bleibt");
  const imp = pr.importiereNotizen(a.id, NOTIZEN);
  assert.ok("ok" in imp && imp.anzahl === 2);
  assert.deepEqual(pr.getPraesentation(a.id)!.notizen, { 1: "Begrüßen.", 3: "Fragen stellen.", 5: "bleibt" });

  assert.equal(pr.archivierePraesentation(a.id), true);
  assert.equal(pr.listPraesentationen().some((x) => x.id === a.id), false);
  assert.equal(pr.listPraesentationen({ status: "archiviert" })[0].id, a.id);
  assert.equal(pr.stellePraesentationWiederHer(a.id), true);

  // a Lernpaket whose steps name slides: their „Lehrer sagt“ shows up at those slides
  const paket = lp.createLernpaket({ title: "Satzglieder", fach: "Deutsch", schulart: "", klasse: null, thema: "", skill_ids: [], schwierigkeit: "mittel", dauer_minuten: 20, ziel: "" }, null);
  assert.ok("id" in paket);
  lp.addSchritt(paket.id, { art: "erklaerung", titel: "Subjekt", minuten: 10, folie: 3, lehrer_sagt: "Wer oder was?", lehrer_fragt: "Wo ist das Subjekt?" });
  lp.addSchritt(paket.id, { art: "uebung", titel: "Üben", minuten: 10, folie: null, lehrer_sagt: "ohne Folie" });
  assert.ok("ok" in pr.verknuepfeLernpaket(paket.id, a.id));
  assert.equal(lp.getLernpaket(paket.id)!.praesentation_id, a.id);
  assert.deepEqual(pr.lernpaketeMit(a.id), [{ id: paket.id, title: "Satzglieder" }]);
  assert.deepEqual(
    pr.schritteZuFolien(a.id).map((s) => [s.folie, s.schritt, s.lehrer_sagt]),
    [[3, "Subjekt", "Wer oder was?"]],
  );
  assert.ok("fehler" in pr.verknuepfeLernpaket(paket.id, 99999));
  assert.ok("ok" in pr.verknuepfeLernpaket(paket.id, null));
  assert.equal(lp.getLernpaket(paket.id)!.praesentation_id, null);

  // the student device: shown at a slide, follows the teacher, other presentations do not move it
  const niko = repo.listTeachers().find((t) => t.name === "Niko")!;
  const sid = repo.createStudent({ name: "Mia Folie", grade: 4, klasse: 4, teacher_id: niko.id, school: "", school_type: "Volksschule", subjects: ["Deutsch"], current_topics: "", strengths_note: "", weaknesses_note: "", goals: "", notes: "" });
  const { unit } = units.startUnit(niko.id, sid, { subject: "Deutsch" });
  live.showOnTablet(units.getUnit(unit.id)!, { kind: "praesentation", id: a.id, folie: 2 });
  assert.equal(units.getUnit(unit.id)!.device_view, `praesentation:${a.id}:2`);
  assert.deepEqual(live.parseView(`praesentation:${a.id}:2`), { kind: "praesentation", id: a.id, folie: 2 });
  assert.equal(live.folieAmGeraet(units.getUnit(unit.id)!, a.id, 4, 1), true);
  assert.equal(units.getUnit(unit.id)!.device_view, `praesentation:${a.id}:4`);
  assert.equal(live.folieAmGeraet(units.getUnit(unit.id)!, b.id, 7), false, "another presentation does not move the device");
  assert.deepEqual(live.liveSnapshot(unit.id)!.praesentation, { id: a.id, title: "Satzglieder", folie: 4 });
  live.showOnTablet(units.getUnit(unit.id)!, { kind: "start" });
  assert.equal(live.folieAmGeraet(units.getUnit(unit.id)!, a.id, 5), false, "after „Zurück zu den Aufgaben“ the slides no longer move it");
});
