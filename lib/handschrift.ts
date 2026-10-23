/**
 * Handgeschriebenen Text einlesen (niko, 23.10.2026): zwei Schüler der 4. Klasse schreiben Lebenslauf und
 * Bewerbungsschreiben für die Schularbeit mit der Hand auf Papier. Der Lehrer fotografiert die Seiten in der
 * Textarbeit („Vom Foto übernehmen“), die KI schreibt den Text wortgetreu ab, mit jedem Rechtschreib-, Grammatik-
 * und Beistrichfehler, und verbessert nichts. Unlesbares steht als [?] da.
 *
 * - Nur auf Klick und nur nach der Bestätigung „kein echter Name auf den Fotos“. Kein Name aus der App geht mit;
 *   die id des Schülers zählt nur die Kosten (Grenze je Schüler, lib/ai/schueler-kosten.ts).
 * - Die Fotos werden nicht gespeichert (wie Text vom Foto, lib/textinterpretation-foto.ts). Die Abschrift kommt in
 *   eine Vorschau neben den Fotos; erst „Als Text übernehmen“ macht sie zum Text, als neue Fassung
 *   (saveFromPaper in lib/texts.ts). Korrektur, Bewertung, Lernverlauf, Druck und Dokumentation bleiben, wie sie sind.
 * - Ohne KI (oder im Modus ohne Bilder) tippt der Lehrer den Text in dieselbe Vorschau ab.
 */
import { budget, costOf, isLocalModel, routeFor } from "./ai/config";
import { HANDSCHRIFT_SYSTEM, leseHandschrift } from "./ai/features";
import { aiEnabled, aiReadsImages, budgetUsedUp, schuelerGestoppt } from "./ai/router";
import { grenzeErreichtText } from "./ai/schueler-kosten";
import { MAX_ANALYSIS_IMAGE_BYTES, MAX_ANALYSIS_PDF_BYTES, sniffType } from "./materials";
import { docFromText, MAX_CHARS } from "./text-doc";
import { saveFromPaper, type SaveResult } from "./texts";
import { MAX_HANDSCHRIFT_SEITEN, textAusHandschrift, type HandschriftVorschlag } from "./handschrift-regeln";

export * from "./handschrift-regeln";

/** Ob jetzt gelesen werden kann; sonst der Grund, in Worten für den Lehrer. Ohne KI bleibt das Abtippen. */
export function handschriftLesbar(studentId: number | null = null): { ok: true } | { ok: false; grund: string } {
  if (!aiEnabled("handschrift")) return { ok: false, grund: "Lesen kann nur die KI, und die ist gerade nicht eingerichtet. Tipp den Text bitte selbst ab." };
  if (!aiReadsImages("handschrift")) return { ok: false, grund: "Im eingestellten KI-Modus kann die KI keine Fotos lesen. Tipp den Text bitte selbst ab." };
  if (budgetUsedUp("handschrift")) return { ok: false, grund: "Das KI-Budget für diesen Monat ist aufgebraucht. Tipp den Text bitte selbst ab." };
  if (studentId != null && schuelerGestoppt("handschrift", studentId)) return { ok: false, grund: `${grenzeErreichtText()} Tipp den Text bitte selbst ab.` };
  return { ok: true };
}

/** Tokens of one photographed page: a photo of about 1 600 × 1 200 pixels after the KI shrinks it. */
const TOKENS_JE_FOTO = 1_600;
/** Answer per page: a handwritten page has about 250 words. */
const ANTWORT_JE_SEITE = 700;

/**
 * What reading will cost, before the click, in euro cents: the instructions once and every page (photo and answer).
 * Plan with Sonnet 5.5: about 1 Cent for one page, about 4 Cent for four.
 */
export function kostenSchaetzung(): { grundCent: number; seiteCent: number } {
  const route = routeFor("handschrift");
  if (route.provider === "manual" || isLocalModel(route.provider)) return { grundCent: 0, seiteCent: 0 };
  const usd = (input: number, output: number) => costOf(route.model, "standard", { input, output, cacheWrite: 0, cacheRead: 0 });
  const cent = (u: number) => (u / budget().usdPerEur) * 100;
  return { grundCent: cent(usd(Math.round(HANDSCHRIFT_SYSTEM.length / 3.2) + 100, 50)), seiteCent: cent(usd(TOKENS_JE_FOTO, ANTWORT_JE_SEITE)) };
}

type Mime = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

export const KEIN_NAME_FEHLT = "Bitte bestätigen, dass auf den Fotos kein echter Name steht.";

/**
 * Liest die Fotos oder PDF-Seiten mit der KI. Nichts wird gespeichert, weder die Fotos noch die Abschrift. Wirft einen
 * Fehler mit einem Satz für den Lehrer.
 */
export async function liesHandschrift(o: { dateien: Buffer[]; teacherId: number; studentId: number; keinName: boolean }): Promise<HandschriftVorschlag> {
  // the tick comes first: without it nothing leaves the app
  if (!o.keinName) throw new Error(KEIN_NAME_FEHLT);
  const geht = handschriftLesbar(o.studentId);
  if (!geht.ok) throw new Error(geht.grund);
  if (!o.dateien.length) throw new Error("Bitte zuerst die Seiten fotografieren.");
  if (o.dateien.length > MAX_HANDSCHRIFT_SEITEN) throw new Error(`Höchstens ${MAX_HANDSCHRIFT_SEITEN} Seiten auf einmal.`);
  const seiten = o.dateien.map((data) => {
    const type = sniffType(data);
    if (!type) throw new Error("Bitte Fotos (JPG, PNG, WebP) oder ein PDF wählen.");
    const pdf = type.mime === "application/pdf";
    const max = pdf ? MAX_ANALYSIS_PDF_BYTES : MAX_ANALYSIS_IMAGE_BYTES;
    if (data.length > max) throw new Error(`${pdf ? "Ein PDF" : "Ein Foto"} ist zu groß für die KI (höchstens ${max / 1024 / 1024} MB).`);
    return { mime: type.mime as Mime, base64: data.toString("base64") };
  });
  const gelesen = await leseHandschrift(seiten, { teacherId: o.teacherId, studentId: o.studentId, trigger: "handschrift" });
  if (!gelesen) throw new Error("Die KI hat den Text nicht gelesen. Tipp ihn bitte selbst ab.");
  return textAusHandschrift(gelesen);
}

/**
 * „Als Text übernehmen“: the checked text (one paragraph per line) becomes the text, as a new version. Empty lines at
 * the start and the end go; nothing else changes.
 */
export function uebernimmVonPapier(textId: number, text: string, at = Date.now()): SaveResult | { ok: false; reason: "leer" | "zu_lang" } {
  const sauber = text.replace(/\r\n?/g, "\n").replace(/^\s*\n|\n\s*$/g, "").replace(/[ \t]+$/gm, "");
  if (!sauber.trim()) return { ok: false, reason: "leer" };
  if (sauber.length > MAX_CHARS) return { ok: false, reason: "zu_lang" };
  return saveFromPaper(textId, docFromText(sauber), at);
}
