"use server";

/**
 * Server Actions des CSV-Imports (Phase 7 des Merges). Sie sind bewusst dünn: die angemeldete
 * **Verwaltung** holen (`requireAdmin`, D23), die Datei lesen und alles Weitere an
 * `lib/csv-import.ts` weitergeben — dort stehen Zeilenprüfung (zod), Dubletten und das Schreiben,
 * und dort wird das Recht ein zweites Mal geprüft. Nichts aus dem Formular wird geglaubt.
 *
 * Zwei Schritte: `previewImportAction` liest und prüft nur, `confirmImportAction` schreibt.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { artAus, importiere, vorschauImport, type ImportArt, type ImportErgebnis, type ImportVorschau } from "@/lib/csv-import";

/** Next nimmt für eine Server Action höchstens 1 MB entgegen — mehr wird gar nicht erst gelesen. */
const MAX_BYTES = 1_000_000;

const leereVorschau = (art: ImportArt, fehler: string): ImportVorschau => ({ art, spalten: [], zeilen: [], gesamt: 0, gueltig: 0, stufeOffen: 0, fehlerhaft: 0, dubletten: 0, fehler });

async function lies(formData: FormData): Promise<{ art: ImportArt; text: string } | { art: ImportArt; fehler: string }> {
  const art = artAus(formData.get("art"));
  const datei = formData.get("datei");
  if (!(datei instanceof File) || !datei.size) return { art, fehler: "Bitte eine CSV-Datei auswählen." };
  if (datei.size > MAX_BYTES) return { art, fehler: `Die Datei ist zu groß (höchstens ${Math.round(MAX_BYTES / 1000)} KB).` };
  return { art, text: await datei.text() };
}

export async function previewImportAction(formData: FormData): Promise<ImportVorschau> {
  const me = await requireAdmin();
  const gelesen = await lies(formData);
  if ("fehler" in gelesen) return leereVorschau(gelesen.art, gelesen.fehler);
  return vorschauImport(me, gelesen.art, gelesen.text);
}

export async function confirmImportAction(formData: FormData): Promise<ImportErgebnis> {
  const me = await requireAdmin();
  const gelesen = await lies(formData);
  if ("fehler" in gelesen) return { ok: false, fehler: gelesen.fehler };
  const ergebnis = importiere(me, gelesen.art, gelesen.text);
  // die Dokumentation landet in Profilen, Lernverlauf, Abrechnung und Briefing: alles neu laden
  if (ergebnis.ok) revalidatePath("/", "layout");
  return ergebnis;
}
