"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEFAULT_SENTENCE_BOX } from "@/lib/druckblatt/definition/sentence-box-defaults";
import { DEFAULT_WORKSHEET } from "@/lib/druckblatt/definition/defaults";
import { BLATTARTEN, pruefeLesetabelle, pruefeSatzbaukasten, type Blattart } from "@/lib/druckblatt/definition/schemas";
import type { SentenceBoxDefinition } from "@/lib/druckblatt/definition/sentence-box-types";
import type { WorksheetDefinition } from "@/lib/druckblatt/definition/types";
import { aiEnabled, vorschlagSpaltenMitKI, vorschlagWoerterMitKI } from "@/lib/ai";
import { requireTeacher } from "@/lib/auth";
import { deleteMaterial, speichereDruckblatt } from "@/lib/materials";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const blattSeite = (art: Blattart) => `/blaetter/${art}`;
const mitFehler = (art: Blattart, msg: string): never => redirect(`${blattSeite(art)}?fehler=${encodeURIComponent(msg)}`);

/** Ist die Blattart eine der drei, die es gibt? */
const istBlattart = (wert: string): wert is Blattart => (BLATTARTEN as readonly string[]).includes(wert);

/**
 * „Als Vorlage speichern" (ohne Schüler) und „Einem Schüler zuweisen" (eine **Kopie** mit
 * `student_id`, D21). In beiden Fällen entsteht eine neue Zeile in `materials` mit
 * `kind = 'druckblatt'`; die Definition kommt als JSON aus dem Generator und wird in
 * `speichereDruckblatt` mit `pruefeJson(art, json)` geprüft.
 */
export async function speichereDruckblattAction(f: FormData) {
  const teacher = await requireTeacher();
  const blattart = str(f, "blattart");
  if (!istBlattart(blattart)) redirect("/blaetter");
  const modus = str(f, "modus") === "zuweisen" ? "zuweisen" : "vorlage";
  const studentId = Number(f.get("student_id")) || null;
  if (modus === "zuweisen" && !studentId) mitFehler(blattart, "Bitte einen Schüler auswählen oder „Als Vorlage speichern“ wählen.");

  const json = String(f.get("definition") ?? "");
  if (!json) mitFehler(blattart, "Das Blatt hat noch keinen Inhalt.");
  const out = speichereDruckblatt({
    blattart,
    json,
    title: str(f, "title"),
    studentId: modus === "zuweisen" ? studentId : null,
    teacherId: teacher.id,
  });
  if ("error" in out) {
    mitFehler(blattart, out.error);
    return;
  }

  revalidatePath("/mehr/material");
  revalidatePath("/blaetter");
  redirect(`${blattSeite(blattart)}?blatt=${out.id}&gespeichert=${modus}`);
}

/** Löscht ein gespeichertes Druckblatt. Eine Datei gibt es dabei nicht (siehe `deleteMaterial`). */
export async function loescheDruckblattAction(id: number) {
  await requireTeacher();
  deleteMaterial(id);
  revalidatePath("/mehr/material");
  revalidatePath("/blaetter");
  redirect("/blaetter?geloescht=1");
}

export type WoerterVorschlagAntwort =
  | { readonly ok: true; readonly woerter: string[]; readonly definition: WorksheetDefinition }
  | { readonly ok: false; readonly fehler: string };

/**
 * Lässt die Wortliste der Lesetabelle von der KI vorschlagen.
 *
 * Der Server prüft den Vorschlag **gegen das Blattschema**, bevor er ihn zurückgibt: Nur ein Blatt,
 * das `pruefeLesetabelle` annimmt, erreicht den Reducer. Ohne KI kommt eine deutsche Meldung zurück,
 * und der Generator bleibt unverändert bedienbar.
 */
export async function vorschlagWoerterAction(definition: unknown, eingabe: { anzahl: number; thema: string }): Promise<WoerterVorschlagAntwort> {
  const teacher = await requireTeacher();
  if (!aiEnabled("druckblatt")) return { ok: false, fehler: "Es ist kein KI-Schlüssel hinterlegt — die Wörter gibst du von Hand ein." };
  // der eigene Stand des Generators ist die Grundlage; ist er unbrauchbar, gelten die Vorgaben
  const geprueft = pruefeLesetabelle(definition);
  const grundlage = geprueft.ok ? geprueft.definition : DEFAULT_WORKSHEET;
  const anzahl = Math.min(120, Math.max(1, Math.round(eingabe.anzahl)));
  const vorhandene = grundlage.content.kind === "wordList" ? [...grundlage.content.words] : [];
  const ergebnis = await vorschlagWoerterMitKI({
    grundlage,
    anzahl,
    thema: eingabe.thema,
    vorhandene,
    meta: { teacherId: teacher.id, trigger: "druckblatt" },
  });
  return ergebnis.ok ? { ok: true, woerter: ergebnis.woerter ?? [], definition: ergebnis.definition } : ergebnis;
}

export type SpaltenVorschlagAntwort =
  | { readonly ok: true; readonly eingetragen: number; readonly definition: SentenceBoxDefinition }
  | { readonly ok: false; readonly fehler: string };

/** Dasselbe für die Spalten des Satzbaukastens; geprüft mit `pruefeSatzbaukasten`. */
export async function vorschlagSpaltenAction(definition: unknown, eingabe: { verben: number; objekte: number; thema: string }): Promise<SpaltenVorschlagAntwort> {
  const teacher = await requireTeacher();
  if (!aiEnabled("druckblatt")) return { ok: false, fehler: "Es ist kein KI-Schlüssel hinterlegt — die Einträge gibst du von Hand ein." };
  const geprueft = pruefeSatzbaukasten(definition);
  const grundlage = geprueft.ok ? geprueft.definition : DEFAULT_SENTENCE_BOX;
  const vorhandene = grundlage.columns.flatMap((spalte) => spalte.entries);
  const ergebnis = await vorschlagSpaltenMitKI({
    grundlage,
    verben: Math.min(12, Math.max(1, Math.round(eingabe.verben))),
    objekte: Math.min(20, Math.max(1, Math.round(eingabe.objekte))),
    thema: eingabe.thema,
    vorhandene,
    meta: { teacherId: teacher.id, trigger: "druckblatt" },
  });
  return ergebnis.ok ? { ok: true, eingetragen: ergebnis.eingetragen ?? 0, definition: ergebnis.definition } : ergebnis;
}
