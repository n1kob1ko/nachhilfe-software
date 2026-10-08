import assert from "node:assert/strict";
import test from "node:test";
import { countChars, countWords, docFromText, docKey, docToHtml, normalizeDoc, parseDoc, validateDoc, type TextDoc } from "./text-doc";
import { readTextPrintOptions, textPrintQuery } from "./text-print";

test("words and characters are counted as a teacher would count them", () => {
  assert.equal(countWords(""), 0);
  assert.equal(countWords("Mein aufregender Ausflug"), 3);
  assert.equal(countWords("Der Schul-Ausflug war z.B. toll, oder?"), 6, "hyphenated words and abbreviations are one word");
  assert.equal(countWords("Wir fuhren um 8.30 Uhr los – 3 Stunden lang!"), 9, "numbers count, dashes do not");
  assert.equal(countWords("Äpfel, Öl und Übermut"), 4);
  assert.equal(countWords("It's Tom's book."), 3);
  const doc: TextDoc = [
    { t: "h", r: [{ x: "Einleitung" }] },
    { t: "p", r: [{ x: "Es war " }, { x: "kalt", b: 1 }, { x: ".\nSehr kalt." }] },
  ];
  assert.equal(countWords(doc), 6);
  assert.equal(countChars(doc), "Einleitung".length + "Es war kalt.Sehr kalt.".length, "line breaks are no characters");
  assert.equal(countChars("Grüße 👋"), 7, "an emoji is one character");
});

test("documents are normalized: merged runs, known marks, no control characters, no trailing empty blocks", () => {
  const doc = normalizeDoc([
    { t: "p", r: [{ x: "a", b: 1 }, { x: "b", b: 1 }, { x: "" }, { x: "c\r\nd\u0007" }] },
    { t: "x" as "p", r: [{ x: "e" }] },
    { t: "p", r: [{ x: "  " }] },
    { t: "p", r: [] },
  ]);
  assert.deepEqual(doc, [
    { t: "p", r: [{ x: "ab", b: 1 }, { x: "c\nd" }] },
    { t: "p", r: [{ x: "e" }] },
  ]);
  assert.equal(docKey(doc), docKey(normalizeDoc(doc)), "normalizing twice changes nothing");
  // an empty paragraph in the middle stays (the writer wanted the gap)
  assert.equal(normalizeDoc(docFromText("a\n\nb")).length, 3);
});

test("HTML for the editor escapes everything a student wrote", () => {
  const html = docToHtml([
    { t: "h", r: [{ x: "<script>alert(1)</script>" }] },
    { t: "p", r: [{ x: "fett", b: 1, i: 1, u: 1 }, { x: " & \"so\"\nweiter" }] },
  ]);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("<h2>&lt;script&gt;alert(1)&lt;/script&gt;</h2>"));
  assert.ok(html.includes("<b><i><u>fett</u></i></b> &amp; &quot;so&quot;<br>weiter</p>"));
  assert.equal(docToHtml([]), "<p><br></p>");
});

test("only well-formed documents of sensible size are accepted", () => {
  assert.ok("error" in validateDoc("text"));
  assert.ok("error" in validateDoc([{ t: "div", r: [] }]));
  assert.ok("error" in validateDoc([{ t: "p", r: [{ x: 1 }] }]));
  assert.ok("error" in validateDoc([{ t: "p", r: [{ x: "a", href: "javascript:x" }] }]), "unknown formatting is refused");
  assert.ok("error" in validateDoc([{ t: "p", r: [{ x: "a".repeat(200_001) }] }]), "too long");
  assert.ok("error" in validateDoc(Array.from({ length: 5001 }, () => ({ t: "p", r: [{ x: "a" }] }))), "too many paragraphs");
  const ok = validateDoc([{ t: "p", r: [{ x: "Hallo", b: true }] }]);
  assert.ok("doc" in ok);
  assert.deepEqual(ok.doc, [{ t: "p", r: [{ x: "Hallo", b: 1 }] }]);
  assert.deepEqual(parseDoc("kaputt"), [], "unreadable stored JSON becomes an empty text");
  assert.deepEqual(parseDoc(null), []);
});

test("print settings live in the URL and only differences are written", () => {
  const o = readTextPrintOptions({}, "Mein Ausflug");
  assert.deepEqual(o, { title: "Mein Ausflug", name: true, date: true, subject: true, prompt: true, words: false, pages: true, spacing: "normal" });
  assert.equal(textPrintQuery(o, "Mein Ausflug"), "");
  const changed = { ...o, name: false, words: true, spacing: "weit" as const, title: "Ausflug" };
  const q = textPrintQuery(changed, "Mein Ausflug");
  assert.equal(q, "titel=Ausflug&name=0&woerter=1&abstand=weit");
  assert.deepEqual(readTextPrintOptions(Object.fromEntries(new URLSearchParams(q)), "Mein Ausflug"), changed);
  assert.equal(readTextPrintOptions({ abstand: "riesig", seiten: "vielleicht" }, "T").spacing, "normal");
});

test("a line break at the end of a paragraph stays visible in the editor", () => {
  assert.equal(docToHtml([{ t: "p", r: [{ x: "a\n" }] }]), "<p>a<br><br></p>");
  assert.equal(docToHtml([{ t: "p", r: [] }, { t: "p", r: [{ x: "b" }] }]), "<p><br></p><p>b</p>");
});
