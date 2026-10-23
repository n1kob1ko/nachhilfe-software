"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import type { Difficulty } from "@/lib/curriculum";
import { folieAmGeraet, parseView, showOnTablet, type Delivery } from "@/lib/live";
import {
  archivierePraesentation,
  getPraesentation,
  importiereNotizen,
  setzeNotiz,
  stellePraesentationWiederHer,
  updatePraesentation,
  verknuepfeLernpaket,
} from "@/lib/praesentationen";
import { canManageUnit, getUnit } from "@/lib/units";

const PR = "/mehr/praesentationen";
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const mitFehler = (url: string, fehler: string[] | string, anker = "") =>
  `${url}${url.includes("?") ? "&" : "?"}fehler=${encodeURIComponent((Array.isArray(fehler) ? fehler : [fehler]).slice(0, 8).join("\n"))}${anker}`;

export async function updatePraesentationAction(id: number, f: FormData) {
  await requireTeacher();
  const out = updatePraesentation(id, {
    title: str(f, "title"),
    fach: str(f, "fach"),
    schulart: str(f, "schulart"),
    klasse: str(f, "schulart") ? Number(f.get("klasse")) || null : null,
    thema: str(f, "thema"),
    skill_ids: f.getAll("skill_ids").map(String).filter(Boolean),
    schwierigkeit: (str(f, "schwierigkeit") || "mittel") as Difficulty,
    beschreibung: str(f, "beschreibung"),
  });
  if ("fehler" in out) redirect(mitFehler(`${PR}/${id}?bearbeiten=1`, out.fehler, "#angaben"));
  revalidatePath(PR, "layout");
  redirect(`${PR}/${id}?gespeichert=1`);
}

/** The Vortragstext of one slide, from the player (no reload: the presentation keeps its place). */
export async function speichereNotizAction(id: number, folie: number, text: string): Promise<{ ok: true } | { fehler: string }> {
  await requireTeacher();
  const out = setzeNotiz(id, folie, text);
  if ("ok" in out) revalidatePath(`${PR}/${id}`);
  return out;
}

/** A notes file (lernheft-notizen.json) on its own: its slides replace the ones there. */
export async function importNotizenAction(id: number, f: FormData) {
  await requireTeacher();
  const file = f.get("datei");
  if (!file || typeof file !== "object" || !("text" in file) || file.size === 0) redirect(mitFehler(`${PR}/${id}`, "Bitte eine Datei wählen.", "#notizen"));
  if (file.size > 1_000_000) redirect(mitFehler(`${PR}/${id}`, "Die Datei ist zu groß (höchstens 1 MB).", "#notizen"));
  const out = importiereNotizen(id, await file.text());
  if ("fehler" in out) redirect(mitFehler(`${PR}/${id}`, out.fehler, "#notizen"));
  revalidatePath(`${PR}/${id}`);
  redirect(`${PR}/${id}?notizen=${out.anzahl}#notizen`);
}

export async function archivePraesentationAction(id: number) {
  await requireTeacher();
  archivierePraesentation(id);
  revalidatePath(PR, "layout");
  redirect(`${PR}/${id}?archiviert=1`);
}

export async function restorePraesentationAction(id: number) {
  await requireTeacher();
  stellePraesentationWiederHer(id);
  revalidatePath(PR, "layout");
  redirect(`${PR}/${id}?wiederhergestellt=1`);
}

/** On the Lernpaket page: which presentation goes with the package (empty: none). */
export async function verknuepfeLernpaketAction(paketId: number, f: FormData) {
  await requireTeacher();
  const out = verknuepfeLernpaket(paketId, Number(f.get("praesentation_id")) || null);
  revalidatePath(`/mehr/lernpakete/${paketId}`);
  revalidatePath(PR, "layout");
  redirect("fehler" in out ? mitFehler(`/mehr/lernpakete/${paketId}?bearbeiten=1`, out.fehler, "#praesentation") : `/mehr/lernpakete/${paketId}?bearbeiten=1&gespeichert=1#praesentation`);
}

// ---------- the student device ----------

async function laufendeEinheit(unitId: number) {
  const t = await requireTeacher();
  const unit = getUnit(unitId);
  if (!unit || unit.status !== "gestartet" || !canManageUnit(t, unit)) return null;
  return unit;
}

/** Shows the presentation on the student device of a running unit, at this slide. Never with the Vortragstext. */
export async function zeigeAmGeraetAction(praesId: number, unitId: number, folie: number): Promise<Delivery | null> {
  const unit = await laufendeEinheit(unitId);
  const p = getPraesentation(praesId);
  if (!unit || !p) return null;
  const out = showOnTablet(unit, { kind: "praesentation", id: p.id, folie: Number.isInteger(folie) && folie >= 1 ? folie : 1 });
  revalidatePath(`/einheiten/${unit.id}`);
  return out;
}

/** The teacher turned the slide: the student device follows (only while it shows this presentation). */
export async function folieAmGeraetAction(praesId: number, unitId: number, folie: number, schritt: number | null = null): Promise<boolean> {
  const unit = await laufendeEinheit(unitId);
  return unit ? folieAmGeraet(unit, praesId, folie, schritt) : false;
}

/** The student device goes back to the exercises. */
export async function nimmVomGeraetAction(praesId: number, unitId: number): Promise<void> {
  const unit = await laufendeEinheit(unitId);
  if (!unit) return;
  const v = parseView(unit.device_view);
  if (v.kind === "praesentation" && v.id === praesId) showOnTablet(unit, { kind: "start" });
  revalidatePath(`/einheiten/${unit.id}`);
}
