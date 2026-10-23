/**
 * Text aus einem PDF (lib/pdf-text.ts, Plan 4.2): die App liest den gespeicherten Text selbst, ohne KI, Zeile für Zeile.
 * Die PDFs baut der Test selbst (einfache Schrift mit WinAnsi, komprimiert mit Objektstrom und ToUnicode, Formular-
 * objekt, nur ein Bild, geschützt); der Text ist für den Test geschrieben, alle Namen erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { deflateSync } from "node:zlib";
import { liesPdfText, PdfFehler } from "./pdf-text";

type Teil = { dict: string; strom?: Buffer; inObjStm?: boolean };

/** Ein PDF aus Objekten (1, 2, …); mit `objStm` landen die so markierten Dictionaries in einem Objektstrom. */
function pdf(objekte: Teil[], o: { objStm?: boolean; trailerExtra?: string } = {}): Buffer {
  const teile: Buffer[] = [Buffer.from("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  const offsets: number[] = [];
  let pos = teile[0].length;
  const push = (b: Buffer) => {
    teile.push(b);
    pos += b.length;
  };
  const direkt = objekte.map((x, i) => ({ ...x, n: i + 1 })).filter((x) => !(o.objStm && x.inObjStm));
  const imStrom = objekte.map((x, i) => ({ ...x, n: i + 1 })).filter((x) => o.objStm && x.inObjStm);
  let nr = objekte.length;
  if (imStrom.length) {
    let kopf = "";
    let body = "";
    for (const x of imStrom) {
      kopf += `${x.n} ${body.length} `;
      body += `${x.dict}\n`;
    }
    const data = deflateSync(Buffer.from(kopf + body, "latin1"));
    nr++;
    direkt.push({ n: nr, dict: `<< /Type /ObjStm /N ${imStrom.length} /First ${kopf.length} /Filter /FlateDecode /Length ${data.length} >>`, strom: data });
  }
  for (const x of direkt) {
    offsets[x.n] = pos;
    push(Buffer.from(`${x.n} 0 obj\n${x.dict}\n`, "latin1"));
    if (x.strom) {
      push(Buffer.from("stream\n", "latin1"));
      push(x.strom);
      push(Buffer.from("\nendstream\n", "latin1"));
    }
    push(Buffer.from("endobj\n", "latin1"));
  }
  const xref = pos;
  let x = `xref\n0 ${nr + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= nr; i++) x += `${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`;
  push(Buffer.from(`${x}trailer\n<< /Size ${nr + 1} /Root 1 0 R ${o.trailerExtra ?? ""}>>\nstartxref\n${xref}\n%%EOF\n`, "latin1"));
  return Buffer.concat(teile);
}

const strom = (inhalt: string, komprimiert = false): { dict: string; strom: Buffer } => {
  const roh = Buffer.from(inhalt, "latin1");
  const data = komprimiert ? deflateSync(roh) : roh;
  return { dict: `<< /Length ${data.length}${komprimiert ? " /Filter /FlateDecode" : ""} >>`, strom: data };
};

/** WinAnsi: Umlaute wie Latin-1, „ “ – an ihren Plätzen; ( ) \ maskiert. */
function winAnsi(s: string): string {
  const sonder: Record<string, number> = { "„": 0x84, "“": 0x93, "”": 0x94, "–": 0x96, "’": 0x92, "…": 0x85 };
  let out = "";
  for (const c of s) {
    const b = sonder[c] ?? c.charCodeAt(0);
    const ch = String.fromCharCode(b);
    out += ch === "(" || ch === ")" || ch === "\\" ? `\\${ch}` : ch;
  }
  return out;
}

const GESCHICHTE = [
  "Am Bahnhof von Grünwald gibt es seit vierzig Jahren einen Kiosk.",
  "Frau Halbedl verkauft dort Zeitungen, Kaugummi und Fahrkarten.",
  "Jeden Morgen um sechs Uhr schiebt sie die Rollläden hoch",
  "und stellt die Körbe mit den Äpfeln vor die Tür.",
  "„Die Leute brauchen etwas Frisches“, sagt sie (und lacht).",
  "Seit dem Sommer fahren aber weniger Züge, und der Bahnhof",
  "wird leiser. Viele Pendler nehmen jetzt das Auto oder den",
  "Schnellbus, der an der Umfahrung hält. Die Gemeinde über-",
  "legt, den Kiosk zu schließen und dort Fahrradboxen aufzu-",
  "stellen. Frau Halbedl will kämpfen: „Ein Bahnhof ohne",
  "Menschen ist nur noch eine Haltestelle“, schreibt sie",
  "in einem Brief an den Bürgermeister.",
];

/** Eine Seite mit Überschrift (16 pt) und Text (11 pt), jede fünfte Zeilennummer links am Rand wie auf einem Arbeitsblatt. */
function einfachesPdf(o: { komprimiert?: boolean; ohneNummern?: boolean } = {}) {
  let c = "BT /F1 16 Tf 72 760 Td (Der Kiosk bleibt) Tj ET\n";
  GESCHICHTE.forEach((z, i) => {
    const y = 720 - i * 14;
    if (!o.ohneNummern && (i + 1) % 5 === 0) c += `BT /F1 9 Tf 40 ${y} Td (${i + 1}) Tj ET\n`;
    c += `BT /F1 11 Tf 72 ${y} Td (${winAnsi(z)}) Tj ET\n`;
  });
  c += "BT /F1 9 Tf 300 40 Td (1) Tj ET\n"; // Seitenzahl
  return pdf([
    { dict: "<< /Type /Catalog /Pages 2 0 R >>" },
    { dict: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    { dict: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>" },
    strom(c, o.komprimiert),
    { dict: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>" },
  ]);
}

test("PDF mit einfacher Schrift: Zeilen wie gedruckt, Umlaute und Anführungszeichen, ohne Zeilennummern und Seitenzahl", () => {
  for (const komprimiert of [false, true]) {
    const g = liesPdfText(einfachesPdf({ komprimiert }));
    assert.equal(g.titel, "Der Kiosk bleibt", "die größere erste Zeile ist die Überschrift");
    assert.equal(g.seiten, 1);
    const ohne = g.zeilen.filter((z) => z && !/^\d+$/.test(z));
    assert.deepEqual(ohne, ["Der Kiosk bleibt", ...GESCHICHTE], "Nummern am Rand fallen weg, getrennte Wörter bleiben getrennt");
    assert.ok(g.hinweise.some((h) => h.startsWith("Zeilennummern am Rand")));
  }
  const ohneNummern = liesPdfText(einfachesPdf({ ohneNummern: true }));
  assert.ok(!ohneNummern.hinweise.length, "nichts weggelassen, nichts zu sagen");
  assert.equal(ohneNummern.zeilen[1], "", "nach der Überschrift ein Abstand");
  assert.equal(ohneNummern.zeilen[6], "„Die Leute brauchen etwas Frisches“, sagt sie (und lacht).");
});

test("Formular für die Lehrkraft: Seitenzahl und doppelte Überschrift weg, Zeilen gezählt (textAusGelesen)", async () => {
  const { textAusGelesen } = await import("./textinterpretation-foto");
  const g = liesPdfText(einfachesPdf());
  const v = textAusGelesen({ titel: g.titel, zeilen: g.zeilen, unsicher: [] });
  assert.equal(v.titel, "Der Kiosk bleibt");
  assert.equal(v.text, GESCHICHTE.join("\n"));
  assert.equal(v.zeilen, 12);
});

/** Type0-Schrift (Identity-H) mit ToUnicode (bfchar und bfrange), Wörter als TJ mit Abstand, zwei Seiten, Objektstrom, Formularobjekt. */
function cidPdf() {
  const codes = new Map<string, number>();
  const code = (ch: string) => {
    if (ch >= "a" && ch <= "z") return 0x100 + ch.charCodeAt(0) - 97;
    if (!codes.has(ch)) codes.set(ch, 3 + codes.size);
    return codes.get(ch)!;
  };
  const hex = (s: string) => `<${[...s].map((ch) => code(ch).toString(16).padStart(4, "0")).join("")}>`;
  const zeile = (z: string, y: number) => `BT /F1 10 Tf 1 0 0 1 72 ${y} Tm [${z.split(" ").map(hex).join(" -350 ")}] TJ ET\n`;
  const s1 = ["Der Wind kam über den See.", "Ömer zog die Mütze tiefer."];
  const s2 = ["Später, im Hafen, war es still.", "Nur die Möwen schrien."];
  // zwischen den Absätzen auf Seite 1 ein großer Abstand
  const c1 = zeile(s1[0], 700) + zeile(s1[1], 688) + zeile("Dann fuhr das Boot hinaus.", 650) + "q 1 0 0 1 0 -100 cm /Fm1 Do Q\n";
  const form = zeile("Am Ufer stand niemand.", 650 - 12 + 100);
  const c2 = zeile(s2[0], 700) + zeile(s2[1], 688);
  // erst den Text bauen, dann kennt codes alle Zeichen
  const cmapZeichen = [...codes.entries()].map(([ch, c]) => `<${c.toString(16).padStart(4, "0")}> <${[...Buffer.from(ch, "utf16le").swap16()].map((b) => b.toString(16).padStart(2, "0")).join("")}>`);
  const cmap = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap
1 begincodespacerange <0000> <FFFF> endcodespacerange
${cmapZeichen.length} beginbfchar
${cmapZeichen.join("\n")}
endbfchar
1 beginbfrange
<0100> <0119> <0061>
endbfrange
endcmap CMapName currentdict /CMap defineresource pop end end`;
  return pdf(
    [
      { dict: "<< /Type /Catalog /Pages 2 0 R >>", inObjStm: true },
      { dict: "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 /Resources << /Font << /F1 7 0 R >> /XObject << /Fm1 10 0 R >> >> >>", inObjStm: true },
      { dict: "<< /Type /Page /Parent 2 0 R /Contents 5 0 R >>", inObjStm: true },
      { dict: "<< /Type /Page /Parent 2 0 R /Contents 6 0 R >>", inObjStm: true },
      strom(c1, true),
      strom(c2, true),
      { dict: "<< /Type /Font /Subtype /Type0 /BaseFont /ABCDEF+Erfunden /Encoding /Identity-H /DescendantFonts [8 0 R] /ToUnicode 9 0 R >>", inObjStm: true },
      { dict: "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /ABCDEF+Erfunden /DW 500 /W [3 [600 600]] >>", inObjStm: true },
      strom(cmap, true),
      (() => {
        const f = strom(form, true);
        return { dict: f.dict.replace(">>", " /Type /XObject /Subtype /Form /BBox [0 0 595 842] /Resources << /Font << /F1 7 0 R >> >> >>"), strom: f.strom };
      })(),
    ],
    { objStm: true },
  );
}

test("Komprimiert, Objektstrom, Type0 mit ToUnicode, Wortabstände aus TJ, zwei Seiten, Absatz, Formularobjekt", () => {
  const g = liesPdfText(cidPdf());
  assert.equal(g.seiten, 2);
  assert.equal(g.titel, "", "keine größere Überschrift");
  assert.deepEqual(g.zeilen, ["Der Wind kam über den See.", "Ömer zog die Mütze tiefer.", "", "Dann fuhr das Boot hinaus.", "Am Ufer stand niemand.", "Später, im Hafen, war es still.", "Nur die Möwen schrien."]);
});

test("Kein Text, kein PDF, geschützt: ein Satz für die Lehrkraft", () => {
  const bild = pdf([
    { dict: "<< /Type /Catalog /Pages 2 0 R >>" },
    { dict: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    { dict: "<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>" },
    strom("q 500 0 0 700 40 60 cm /Im1 Do Q"),
    { dict: "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode /Length 3 >>", strom: Buffer.from([0xff, 0xd8, 0xff]) },
  ]);
  assert.throws(() => liesPdfText(bild), (e: unknown) => e instanceof PdfFehler && /kein Text gespeichert/.test(e.message));
  assert.throws(() => liesPdfText(Buffer.from("Hallo, kein PDF")), (e: unknown) => e instanceof PdfFehler && /keine PDF-Datei/.test(e.message));
  const geschuetzt = Buffer.concat([einfachesPdf().subarray(0, -40), Buffer.from("trailer\n<< /Encrypt 9 0 R >>\n%%EOF\n", "latin1")]);
  assert.throws(() => liesPdfText(geschuetzt), (e: unknown) => e instanceof PdfFehler && /geschützt/.test(e.message));
  assert.throws(() => liesPdfText(Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n", "latin1")), (e: unknown) => e instanceof PdfFehler && /keine Seite/.test(e.message));
});

test("Die Kodierungstabellen haben die richtige Länge", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("./pdf-text.ts", import.meta.url), "utf8");
  const tab = (name: string) => {
    const m = new RegExp(`const ${name} = "([^"]*)"`).exec(src)!;
    return [...JSON.parse(`"${m[1]}"`)].length;
  };
  assert.equal(tab("WIN_ANSI_80"), 32);
  assert.equal(tab("MAC_ROMAN_80"), 128);
});
