/**
 * Builds a presentation from the slide content of lib/ai/praesentation.ts: one self-contained index.html with the
 * skeleton of the lernheft-lernpaket skill (its CSS, its script with the postMessage protocol of
 * docs/praesentation-format.md, `.folie` and `.schritt`, system fonts, nothing loaded from outside, no storage,
 * eval or fetch), and a ZIP with index.html and lernheft-notizen.json, as a teacher would upload it.
 *
 * Every text of the KI is escaped here; the only markup it can cause is **fett** → <strong>, applied after
 * escaping. The Vortragstext never goes into the HTML: it goes into the notes file, which the upload reads
 * into the database and never serves. Pure functions, no database: tests check the output directly.
 */
import zlib from "node:zlib";
import type { Block, Deck } from "./ai/praesentation";

/** &, <, >, " and ' as entities: a KI text can never become a tag or leave an attribute. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** An escaped text with **fett** as <strong>. */
export function inline(s: string): string {
  return escapeHtml(s).replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
}

/** The skill's skeleton (lernheft-lernpaket, section 5) up to the slides. Only the title goes in. */
const KOPF = (titel: string) => `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(titel)}</title>
<style>
  html,body{margin:0;height:100%;background:#10233f;font-family:system-ui,sans-serif}
  .buehne{position:fixed;inset:0;display:grid;place-items:center}
  .folie{display:none;width:min(100vw,177.78vh);height:min(56.25vw,100vh);box-sizing:border-box;padding:6% 7%;background:#fff;color:#1b2430;font-size:calc(min(100vw,177.78vh) / 40)}
  .folie.aktiv{display:flex;flex-direction:column;gap:.6em;animation:ein .35s ease-out}
  .folie h1{font-size:1.8em;margin:0}
  .schritt{opacity:0;transform:translateY(12px);transition:opacity .3s ease-out,transform .3s ease-out}
  .schritt.da{opacity:1;transform:none}
  @keyframes ein{from{opacity:0}to{opacity:1}}
  .folie{overflow:hidden;line-height:1.35}
  .folie h1{color:#10233f}
  .folie p,.folie ul,.folie table{margin:0}
  .folie ul{padding-left:1.2em}
  .folie li{margin:.15em 0}
  .folie .kasten{padding:.45em .8em;border-radius:.35em}
  .folie .beispiel{background:#eaf2fd;border-left:.22em solid #1d63c4}
  .folie .merksatz{background:#fff4d6;border-left:.22em solid #c98a00;font-weight:600}
  .folie .frage{color:#1d4f9c;font-weight:600}
  .folie table{border-collapse:collapse;font-size:.85em}
  .folie th,.folie td{border:.06em solid #b9c8da;padding:.25em .6em;text-align:left;vertical-align:top}
  .folie th{background:#eaf2fd}
  .folie strong{color:#10233f}
</style></head>
<body><div class="buehne">
`;

/** The skill's script, unchanged: slides and steps, the protocol to the app, keys and clicks. */
const SKRIPT = `</div>
<script>
(() => {
  const folien = [...document.querySelectorAll('.folie')];
  let f = 0, s = 0;
  const schritte = (i) => [...folien[i].querySelectorAll('.schritt')];
  function zeige(nf, ns) {
    f = Math.max(0, Math.min(folien.length - 1, nf));
    const st = schritte(f); s = Math.max(0, Math.min(st.length, ns));
    folien.forEach((el, i) => el.classList.toggle('aktiv', i === f));
    st.forEach((el, i) => el.classList.toggle('da', i < s));
    melde();
  }
  function weiter() { if (s < schritte(f).length) zeige(f, s + 1); else if (f < folien.length - 1) zeige(f + 1, 0); }
  function zurueck() { if (s > 0) zeige(f, s - 1); else if (f > 0) zeige(f - 1, schritte(f - 1).length); }
  function melde() { try { parent.postMessage({ quelle: 'lernheft-praesentation', v: 1, typ: 'folie', folie: f + 1, folien: folien.length, schritt: s }, '*'); } catch (e) {} }
  addEventListener('message', (e) => {
    const d = e.data;
    if (e.source !== parent || !d || d.quelle !== 'lernheft' || d.v !== 1) return;
    if (d.typ === 'gehe-zu' && Number.isInteger(d.folie)) zeige(d.folie - 1, Number.isInteger(d.schritt) ? d.schritt : 0);
    if (d.typ === 'weiter') weiter();
    if (d.typ === 'zurueck') zurueck();
  });
  addEventListener('keydown', (e) => {
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); weiter(); }
    if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); zurueck(); }
  });
  addEventListener('click', weiter);
  zeige(0, 0);
  try { parent.postMessage({ quelle: 'lernheft-praesentation', v: 1, typ: 'bereit', folien: folien.length }, '*'); } catch (e) {}
})();
</script></body></html>
`;

const klasse = (...k: (string | false)[]) => {
  const c = k.filter(Boolean).join(" ");
  return c ? ` class="${c}"` : "";
};

/** One block as HTML. A list on click shows one point per click. */
export function blockHtml(b: Block): string {
  const s = b.schritt && "schritt";
  switch (b.art) {
    case "liste":
      return `<ul>${b.punkte.map((p) => `<li${klasse(s)}>${inline(p)}</li>`).join("")}</ul>`;
    case "tabelle": {
      const [kopf, ...rest] = b.zeilen;
      const th = `<tr>${kopf.map((c) => `<th>${inline(c)}</th>`).join("")}</tr>`;
      const td = rest.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("");
      return `<table${klasse(s)}><thead>${th}</thead>${td ? `<tbody>${td}</tbody>` : ""}</table>`;
    }
    case "beispiel":
    case "merksatz":
      return `<p${klasse("kasten", b.art, s)}>${inline(b.text)}</p>`;
    case "frage":
      return `<p${klasse("frage", s)}>${inline(b.text)}</p>`;
    default:
      return `<p${klasse(s)}>${inline(b.text)}</p>`;
  }
}

/** The whole deck as one HTML page. Never with the Vortragstext. */
export function deckHtml(d: Pick<Deck, "titel" | "folien">): string {
  const folien = d.folien.map((f, i) => `  <section class="folie" aria-label="Folie ${i + 1}"><h1>${inline(f.titel)}</h1>${f.bloecke.map(blockHtml).join("")}</section>\n`).join("");
  return KOPF(d.titel) + folien + SKRIPT;
}

/**
 * A ZIP of the given files, „stored“ (not packed: the files are small), names in UTF-8, made on Unix as regular
 * files, so it passes lib/praesentation-zip.ts like an upload.
 */
export function zipDatei(dateien: { pfad: string; daten: Buffer }[]): Buffer {
  const lokal: Buffer[] = [];
  const zentral: Buffer[] = [];
  let offset = 0;
  for (const d of dateien) {
    const name = Buffer.from(d.pfad, "utf8");
    const crc = zlib.crc32(d.daten) >>> 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x800, 6);
    lh.writeUInt16LE(0, 8);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(d.daten.length, 18);
    lh.writeUInt32LE(d.daten.length, 22);
    lh.writeUInt16LE(name.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE((3 << 8) | 20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(d.daten.length, 20);
    cd.writeUInt32LE(d.daten.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    cd.writeUInt32LE(offset, 42);
    lokal.push(lh, name, d.daten);
    zentral.push(cd, name);
    offset += lh.length + name.length + d.daten.length;
  }
  const verzeichnis = Buffer.concat(zentral);
  const ende = Buffer.alloc(22);
  ende.writeUInt32LE(0x06054b50, 0);
  ende.writeUInt16LE(dateien.length, 8);
  ende.writeUInt16LE(dateien.length, 10);
  ende.writeUInt32LE(verzeichnis.length, 12);
  ende.writeUInt32LE(offset, 16);
  return Buffer.concat([...lokal, verzeichnis, ende]);
}
