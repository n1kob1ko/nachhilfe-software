/**
 * F0b: ein PDF hält beim OpenAI-kompatiblen Anbieter (und DeepSeek, manuell) nicht mehr alle Dateien auf. Jedes PDF geht als sein
 * gespeicherter Text mit (lib/pdf-text.ts, ohne KI); ein PDF ohne Text (ein Scan) wird mit Grund übersprungen, die anderen Dateien
 * werden weiter gelesen. Nur eine Attrappe statt der KI; das PDF baut der Test selbst, der Text ist erfunden.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

process.env.DATABASE_PATH = ":memory:";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;

/** Ein einseitiges PDF mit gespeichertem Text (Helvetica, WinAnsi). */
function textPdf(zeilen: string[]): Buffer {
  let c = "";
  zeilen.forEach((z, i) => (c += `BT /F1 11 Tf 72 ${720 - i * 14} Td (${z}) Tj ET\n`));
  const objekte = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let out = "%PDF-1.7\n";
  const offsets: number[] = [];
  objekte.forEach((d, i) => {
    offsets[i + 1] = out.length;
    out += d ? `${i + 1} 0 obj\n${d}\nendobj\n` : `${i + 1} 0 obj\n<< /Length ${c.length} >>\nstream\n${c}\nendstream\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objekte.length; i++) out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

const STOFF = ["Stoff der Schularbeit: Potenzen", "Potenzregeln und Wurzeln", "Gleichungen mit Potenzen"];
const MIT_TEXT = textPdf(STOFF).toString("base64");
/** ein Scan: ein PDF ohne gespeicherten Text (hier nur Bytes, die kein lesbares PDF sind) */
const SCAN = Buffer.from("%PDF-1.4\nnur ein Bild\n").toString("base64");
const FOTO = { type: "image" as const, mime: "image/jpeg" as const, base64: "/9j/AAAA" };

test("pdfAlsText: the stored text instead of each PDF, a scan skipped with its reason, photos and numbering kept", async () => {
  const { pdfAlsText } = await import("./ai/providers");
  const prompt = [{ type: "pdf" as const, base64: MIT_TEXT }, { type: "pdf" as const, base64: SCAN }, FOTO, { type: "text" as const, text: "Lies den Stoff." }];

  const r = pdfAlsText("compatible", prompt);
  assert.ok(Array.isArray(r.content));
  const teile = r.content as Exclude<typeof r.content, string>;
  assert.equal(teile.length, 4, "every file keeps its place");
  assert.ok(!teile.some((p) => p.type === "pdf"), "no PDF part goes to a provider that cannot read one");
  assert.equal(teile[0].type, "text");
  assert.match((teile[0] as { text: string }).text, /^Datei 1 \(PDF, nur der darin gespeicherte Text\):\n/);
  for (const z of STOFF) assert.ok((teile[0] as { text: string }).text.includes(z), `the PDF's text is in it: ${z}`);
  assert.deepEqual(teile[1], { type: "text", text: "Datei 2: übersprungen (ein PDF ohne gespeicherten Text)." });
  assert.deepEqual(teile[2], FOTO, "the photo goes along unchanged");
  assert.deepEqual(teile[3], prompt[3]);
  assert.equal(r.nichtsLesbar, false);
  assert.equal(r.hinweise.length, 1);
  assert.match(r.hinweise[0], /^Datei 2 \(PDF\) übersprungen: .*Als Foto hochladen/);
  assert.doesNotMatch(r.hinweise[0], /OpenAI|DeepSeek|Anthropic|Claude/, "no provider name for the teacher");

  // DeepSeek reads no photos either: no advice to upload one
  assert.doesNotMatch(pdfAlsText("deepseek", [{ type: "pdf", base64: SCAN }, { type: "text", text: "x" }]).hinweise[0], /Foto/);
  // only scans: nothing readable is left
  assert.equal(pdfAlsText("compatible", [{ type: "pdf", base64: SCAN }, { type: "text", text: "x" }]).nichtsLesbar, true);
  // providers that read PDFs, and prompts without a PDF, stay as they are
  for (const id of ["anthropic", "openrouter"] as const) assert.equal(pdfAlsText(id, prompt).content, prompt);
  const ohne = [FOTO, { type: "text" as const, text: "x" }];
  assert.equal(pdfAlsText("compatible", ohne).content, ohne);
  assert.equal(pdfAlsText("compatible", "nur Text").content, "nur Text");
});

test("router: one scanned PDF no longer blocks the other files; the skipped file comes back as a hint", async () => {
  const r = await import("./ai/router");
  const { kiGrundVonUrsache, KI_GRUND } = await import("./ai/grund");
  const seen: import("./ai/router").AIRequest[] = [];
  r.resetRouter();
  r.setTransport(async (req) => {
    seen.push(req);
    return { parsed: { ok: true }, refusal: false, model: req.model, usage: { input: 100, output: 20, cacheWrite: 0, cacheRead: 0 } };
  });
  process.env.AI_PROVIDER = "compatible";
  try {
    const out = await r.runAI("analyse", z.object({ ok: z.boolean() }), "Lies.", [{ type: "pdf", base64: MIT_TEXT }, { type: "pdf", base64: SCAN }, FOTO, { type: "text", text: "Lies den Stoff (1)." }]);
    assert.ok(out.ok, "read with the other files");
    assert.equal(seen.length, 1);
    const content = seen[0].content as Exclude<import("./ai/router").Prompt, string>;
    assert.ok(!content.some((p) => p.type === "pdf"));
    assert.ok(content.some((p) => p.type === "text" && p.text.includes("Potenzregeln und Wurzeln")));
    assert.ok(content.some((p) => p.type === "image"));
    assert.ok(out.ok && out.hinweise?.length === 1 && /^Datei 2 \(PDF\) übersprungen/.test(out.hinweise[0]));

    // only a scan: not asked at all, a setting to change, said shortly
    const nur = await r.runAI("analyse", z.object({ ok: z.boolean() }), "Lies.", [{ type: "pdf", base64: SCAN }, { type: "text", text: "Lies den Stoff (2)." }]);
    assert.equal(seen.length, 1, "the KI is not asked");
    assert.equal(nur.ok, false);
    assert.equal(!nur.ok && nur.cause, "einstellung");
    assert.equal(!nur.ok && kiGrundVonUrsache(nur.cause), KI_GRUND.datei);
    assert.equal(r.breakerState().paused, false, "a setting does not pause the KI");

    // a provider that reads PDFs gets them as they are
    process.env.AI_PROVIDER = "anthropic";
    const anth = await r.runAI("analyse", z.object({ ok: z.boolean() }), "Lies.", [{ type: "pdf", base64: SCAN }, { type: "text", text: "Lies den Stoff (3)." }]);
    assert.ok(anth.ok && !anth.hinweise);
    assert.equal((seen[1].content as { type: string }[])[0].type, "pdf");
  } finally {
    delete process.env.AI_PROVIDER;
    r.setTransport(null);
  }
});
