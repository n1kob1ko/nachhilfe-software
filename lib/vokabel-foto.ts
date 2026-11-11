/**
 * Vokabeln vom Foto (niko, 11.11.2026: „wenn ich selbst über Fotos von Vokabeln hochladen kann und dann der Schüler
 * die Vokabeln üben kann, die er auch braucht“). Der Lehrer fotografiert die Wortliste aus dem Schulbuch, vom
 * Arbeitsblatt oder aus dem Vokabelheft des Schülers; die KI liest Englisch und Deutsch ab, wie es dasteht, und die
 * Zeilen landen im Editor der eigenen Vokabelliste (lib/vokabellisten.ts).
 *
 * - Nur auf Klick und nur nach der Bestätigung „kein echter Name auf den Fotos“. Kein Name aus der App geht mit; die
 *   id des Schülers zählt nur die Kosten (Grenze je Schüler, lib/ai/schueler-kosten.ts).
 * - Die Fotos werden nicht gespeichert. Gespeichert wird erst, wenn der Lehrer die Vorschau geprüft und „Liste
 *   speichern“ getippt hat; eine Zeile mit [?] (nicht lesbar) lässt sich nicht speichern.
 * - Ohne KI (oder im Modus ohne Bilder) gibt es den Knopf nicht: der Lehrer tippt die Wörter wie bisher ein.
 * - Geübt wird danach wie jede eigene Liste, ohne KI (lib/vokabeln-pruefen.ts).
 */
import { budget, costOf, isLocalModel, routeFor } from "./ai/config";
import { leseVokabelFoto, VOKABELFOTO_SYSTEM } from "./ai/features";
import { aiEnabled, aiReadsImages, budgetUsedUp, schuelerGestoppt } from "./ai/router";
import { grenzeErreichtText } from "./ai/schueler-kosten";
import { MAX_ANALYSIS_IMAGE_BYTES, MAX_ANALYSIS_PDF_BYTES, sniffType } from "./materials";
import { MAX_HINWEIS, MAX_VOKABEL_SEITEN, textAusVokabelFoto, type VokabelFotoVorschlag } from "./vokabel-foto-regeln";

export * from "./vokabel-foto-regeln";

export const KEIN_NAME_FEHLT = "Bitte bestätigen, dass auf den Fotos kein echter Name steht.";

/** Ob jetzt gelesen werden kann; sonst der Grund, in Worten für den Lehrer. Ohne KI bleibt das Eintippen. */
export function vokabelFotoLesbar(studentId: number | null = null): { ok: true } | { ok: false; grund: string } {
  if (!aiEnabled("vokabelfoto")) return { ok: false, grund: "Fotos lesen kann nur die KI, und die ist gerade nicht eingerichtet. Tipp die Wörter bitte ein." };
  if (!aiReadsImages("vokabelfoto")) return { ok: false, grund: "Im eingestellten KI-Modus kann die KI keine Fotos lesen. Tipp die Wörter bitte ein." };
  if (budgetUsedUp("vokabelfoto")) return { ok: false, grund: "Das KI-Budget für diesen Monat ist aufgebraucht. Tipp die Wörter bitte ein." };
  if (studentId != null && schuelerGestoppt("vokabelfoto", studentId)) return { ok: false, grund: `${grenzeErreichtText()} Tipp die Wörter bitte ein.` };
  return { ok: true };
}

/** Tokens of one photographed page: a photo of about 1 600 × 1 200 pixels after the KI shrinks it. */
const TOKENS_JE_FOTO = 1_600;
/** Answer per page: about 40 words with a sentence each. */
const ANTWORT_JE_SEITE = 1_500;

/** What reading will cost, before the click, in euro cents: the instructions once and every page (photo and answer). */
export function kostenSchaetzung(): { grundCent: number; seiteCent: number } {
  const route = routeFor("vokabelfoto");
  if (route.provider === "manual" || isLocalModel(route.provider)) return { grundCent: 0, seiteCent: 0 };
  const usd = (input: number, output: number) => costOf(route.model, "standard", { input, output, cacheWrite: 0, cacheRead: 0 });
  const cent = (u: number) => (u / budget().usdPerEur) * 100;
  return { grundCent: cent(usd(Math.round(VOKABELFOTO_SYSTEM.length / 3.2) + 100, 50)), seiteCent: cent(usd(TOKENS_JE_FOTO, ANTWORT_JE_SEITE)) };
}

type Mime = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

/** Liest die Fotos oder PDF-Seiten mit der KI. Nichts wird gespeichert. Wirft einen Fehler mit einem Satz für den Lehrer. */
export async function liesVokabelFoto(o: { dateien: Buffer[]; hinweis?: string; teacherId: number; studentId: number; keinName: boolean }): Promise<VokabelFotoVorschlag> {
  // the tick comes first: without it nothing leaves the app
  if (!o.keinName) throw new Error(KEIN_NAME_FEHLT);
  const geht = vokabelFotoLesbar(o.studentId);
  if (!geht.ok) throw new Error(geht.grund);
  if (!o.dateien.length) throw new Error("Bitte zuerst die Seiten fotografieren.");
  if (o.dateien.length > MAX_VOKABEL_SEITEN) throw new Error(`Höchstens ${MAX_VOKABEL_SEITEN} Seiten auf einmal.`);
  const seiten = o.dateien.map((data) => {
    const type = sniffType(data);
    if (!type) throw new Error("Bitte Fotos (JPG, PNG, WebP) oder ein PDF wählen.");
    const pdf = type.mime === "application/pdf";
    const max = pdf ? MAX_ANALYSIS_PDF_BYTES : MAX_ANALYSIS_IMAGE_BYTES;
    if (data.length > max) throw new Error(`${pdf ? "Ein PDF" : "Ein Foto"} ist zu groß für die KI (höchstens ${max / 1024 / 1024} MB).`);
    return { mime: type.mime as Mime, base64: data.toString("base64") };
  });
  const hinweis = (o.hinweis ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_HINWEIS);
  const gelesen = await leseVokabelFoto(seiten, hinweis, { teacherId: o.teacherId, studentId: o.studentId, trigger: "vokabelfoto" });
  if (!gelesen) throw new Error("Die KI hat die Vokabeln nicht gelesen. Tipp sie bitte ein.");
  return textAusVokabelFoto(gelesen);
}
