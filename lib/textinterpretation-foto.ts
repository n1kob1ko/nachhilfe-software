/**
 * Text vom Foto (Textinterpretation, optional): der Lehrer fotografiert die gedruckte Geschichte (oder wählt das
 * PDF) und die KI schreibt sie Zeile für Zeile ab. Nur auf Klick und nur nach der Bestätigung „kein Name darauf“.
 *
 * - Die KI schreibt nur gedruckten Text ab, nichts Handgeschriebenes und keine Namen außerhalb der Geschichte,
 *   auch nicht den Namen des Autors (den tippt der Lehrer). Unsichere Stellen stehen als […] da.
 * - Das Foto wird nicht gespeichert. Die Abschrift landet nur im Formular; gespeichert wird erst, wenn der Lehrer
 *   den Text geprüft und auf „Speichern“ getippt hat.
 * - Ohne KI (oder im Modus ohne Bilder) gibt es den Knopf nicht: der Lehrer fügt den Text wie bisher ein.
 */
import { aiEnabled, aiReadsImages, leseTextFoto, type TextFotoGelesen } from "./ai";
import { MAX_ANALYSIS_IMAGE_BYTES, MAX_ANALYSIS_PDF_BYTES, sniffType } from "./materials";
import { MAX_STORY_CHARS, MAX_STORY_LINES } from "./textinterpretation";

/** Was das Formular bekommt: die Abschrift (Zeilen mit \n) und was der Lehrer prüfen soll. */
export type TextFotoVorschlag = { titel: string; text: string; zeilen: number; hinweise: string[] };

/** Ob ein Foto jetzt gelesen werden kann; sonst der Grund, in Worten für den Lehrer. */
export function textFotoLesbar(): { ok: true } | { ok: false; grund: string } {
  if (!aiEnabled("textfoto")) return { ok: false, grund: "Lesen kann nur die KI, und die ist gerade nicht eingerichtet. Füg den Text bitte selbst ein." };
  if (!aiReadsImages("textfoto")) return { ok: false, grund: "Im eingestellten KI-Modus kann die KI keine Fotos lesen. Füg den Text bitte selbst ein." };
  return { ok: true };
}

const eineZeile = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);
/** Zeilennummern am Rand und Seitenzahlen: eine Zeile, die nur aus einer Zahl besteht. */
const nurZahl = (s: string) => /^\s*[([]?\d{1,4}[)\].]?\s*$/.test(s);

/**
 * Macht aus der Abschrift den Text fürs Formular: Zeilen ohne Zahlen am Rand, keine Leerzeilen am Anfang und Ende,
 * höchstens eine Leerzeile hintereinander. Die Überschrift wird nicht doppelt abgeschrieben. Nichts am Wortlaut ändert sich.
 */
export function textAusGelesen(g: TextFotoGelesen): TextFotoVorschlag {
  const hinweise: string[] = [];
  const titel = eineZeile(g.titel ?? "", 160).replace(/^[„“"»«]+|[„“"»«]+$/g, "");
  const zeilen: string[] = [];
  let zahlen = 0;
  for (const roh of g.zeilen) {
    for (const teil of String(roh ?? "").split(/\r?\n/)) {
      const z = teil.replace(/\s+/g, " ").trim();
      if (z && nurZahl(z)) {
        zahlen++;
        continue;
      }
      if (!z && (!zeilen.length || zeilen[zeilen.length - 1] === "")) continue;
      zeilen.push(z);
    }
  }
  while (zeilen.length && zeilen[zeilen.length - 1] === "") zeilen.pop();
  // die Überschrift steht oft auch als erste Zeile da
  if (titel && zeilen.length && eineZeile(zeilen[0], 160).toLowerCase() === titel.toLowerCase()) {
    zeilen.shift();
    while (zeilen.length && zeilen[0] === "") zeilen.shift();
  }
  let kurz = zeilen;
  if (kurz.length > MAX_STORY_LINES) {
    kurz = kurz.slice(0, MAX_STORY_LINES);
    hinweise.push(`Nur die ersten ${MAX_STORY_LINES} Zeilen übernommen.`);
  }
  let text = kurz.join("\n");
  if (text.length > MAX_STORY_CHARS) {
    text = text.slice(0, MAX_STORY_CHARS).replace(/\n[^\n]*$/, "");
    hinweise.push("Der Text war zu lang und wurde gekürzt.");
  }
  if (!text.trim()) hinweise.push("Auf dem Foto wurde kein gedruckter Text gefunden.");
  const luecken = (text.match(/\[…\]|\[\.\.\.\]/g) ?? []).length;
  if (luecken) hinweise.push(luecken === 1 ? "Eine Stelle war nicht lesbar und steht als […] da. Bitte ergänzen." : `${luecken} Stellen waren nicht lesbar und stehen als […] da. Bitte ergänzen.`);
  for (const u of g.unsicher.slice(0, 4)) {
    const t = eineZeile(u, 140);
    if (t) hinweise.push(`Unsicher: ${t}`);
  }
  if (zahlen) hinweise.push("Zahlen am Rand wurden weggelassen; die App zählt die Zeilen selbst.");
  return { titel, text, zeilen: text ? text.split("\n").length : 0, hinweise };
}

/**
 * Liest ein Foto oder PDF der Geschichte mit der KI. Die Datei wird nicht gespeichert. Wirft einen Fehler mit
 * einem Satz für den Lehrer.
 */
export async function liesTextFoto(o: { data: Buffer; teacherId: number; studentId?: number | null }): Promise<TextFotoVorschlag> {
  const geht = textFotoLesbar();
  if (!geht.ok) throw new Error(geht.grund);
  const type = sniffType(o.data);
  if (!type) throw new Error("Bitte ein Foto (JPG, PNG, WebP) oder ein PDF wählen.");
  const pdf = type.mime === "application/pdf";
  const max = pdf ? MAX_ANALYSIS_PDF_BYTES : MAX_ANALYSIS_IMAGE_BYTES;
  if (o.data.length > max) throw new Error(`${pdf ? "Das PDF" : "Das Foto"} ist zu groß für die KI (höchstens ${max / 1024 / 1024} MB).`);
  const gelesen = await leseTextFoto(
    { mime: type.mime as "application/pdf" | "image/jpeg" | "image/png" | "image/webp", base64: o.data.toString("base64") },
    { teacherId: o.teacherId, studentId: o.studentId ?? null, trigger: "textfoto" },
  );
  if (!gelesen) throw new Error("Die KI hat den Text nicht gelesen. Füg ihn bitte selbst ein.");
  return textAusGelesen(gelesen);
}
