"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import type { Difficulty } from "@/lib/curriculum";
import {
  addSchritt,
  archiviereLernpaket,
  aufgabeAusBibliothek,
  createLernpaket,
  entferneAufgabe,
  entferneSchritt,
  getSchritt,
  importiereLernpaket,
  markiereGeprueft,
  stelleWiederHer,
  updateLernpaket,
  updateSchritt,
  verschiebeSchritt,
  zurueckZuEntwurf,
  type Meta,
  type SchrittInput,
} from "@/lib/lernpakete";
import * as repo from "@/lib/repo";

const LP = "/mehr/lernpakete";
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
/** Errors go back to the page in the address, one per line. */
const mitFehler = (url: string, fehler: string[] | string, anker = "") =>
  `${url}${url.includes("?") ? "&" : "?"}fehler=${encodeURIComponent((Array.isArray(fehler) ? fehler : [fehler]).slice(0, 12).join("\n"))}${anker}`;

function metaAus(f: FormData): Meta {
  const skillIds = f.getAll("skill_ids").map(String).filter(Boolean);
  // the new-package form has one main skill; its subject is the Fach when none is typed
  const haupt = str(f, "skill_id");
  const skill = haupt ? repo.getSkill(haupt) : null;
  return {
    title: str(f, "title"),
    fach: str(f, "fach") || skill?.subject || "",
    schulart: str(f, "schulart"),
    klasse: str(f, "schulart") ? Number(f.get("klasse")) || null : null,
    thema: str(f, "thema") || skill?.area || "",
    skill_ids: haupt ? [haupt, ...skillIds] : skillIds,
    schwierigkeit: (str(f, "schwierigkeit") || "mittel") as Difficulty,
    dauer_minuten: Number(f.get("dauer_minuten")) || 0,
    ziel: str(f, "ziel"),
  };
}

function schrittAus(f: FormData): SchrittInput {
  return {
    art: str(f, "art"),
    titel: str(f, "titel"),
    minuten: Number(f.get("minuten")),
    lehrer_sagt: str(f, "lehrer_sagt"),
    folie: Number(f.get("folie")) || null,
    lehrer_fragt: str(f, "lehrer_fragt"),
    erwartete_antwort: str(f, "erwartete_antwort"),
    bei_fehler: str(f, "bei_fehler"),
    notiz: str(f, "notiz"),
    pruefen: str(f, "pruefen").split("\n"),
  };
}

/** A new package written by hand: it opens in the editor to add the steps. */
export async function createLernpaketAction(f: FormData) {
  const teacher = await requireTeacher();
  const out = createLernpaket(metaAus(f), teacher.id);
  if ("fehler" in out) redirect(mitFehler(`${LP}?neu=1`, out.fehler));
  revalidatePath(LP);
  redirect(`${LP}/${out.id}?bearbeiten=1`);
}

/** One JSON file in the format lernheft-lernpaket; stored as Entwurf, „ungeprüft“ until a teacher checks it. */
export async function importLernpaketAction(f: FormData) {
  const teacher = await requireTeacher();
  const file = f.get("datei");
  if (!file || typeof file !== "object" || !("text" in file) || file.size === 0) redirect(mitFehler(`${LP}?import=1`, "Bitte eine Datei wählen."));
  if (file.size > 1_000_000) redirect(mitFehler(`${LP}?import=1`, "Die Datei ist zu groß (höchstens 1 MB)."));
  const out = importiereLernpaket(await file.text(), teacher.id);
  if ("fehler" in out) redirect(mitFehler(`${LP}?import=1`, out.fehler));
  revalidatePath(LP);
  redirect(`${LP}/${out.id}?importiert=1`);
}

export async function updateLernpaketAction(id: number, f: FormData) {
  await requireTeacher();
  const out = updateLernpaket(id, metaAus(f));
  if ("fehler" in out) redirect(mitFehler(`${LP}/${id}?bearbeiten=1`, out.fehler, "#angaben"));
  revalidatePath(LP, "layout");
  redirect(`${LP}/${id}?bearbeiten=1&gespeichert=1`);
}

export async function markGeprueftAction(id: number, f: FormData) {
  const teacher = await requireTeacher();
  const out = markiereGeprueft(id, teacher.id, { hinweiseGeprueft: f.get("hinweise_geprueft") === "1" });
  revalidatePath(LP, "layout");
  redirect("fehler" in out ? mitFehler(`${LP}/${id}`, out.fehler, "#pruefen") : `${LP}/${id}?geprueft=1`);
}

export async function zurueckZuEntwurfAction(id: number) {
  await requireTeacher();
  zurueckZuEntwurf(id);
  revalidatePath(LP, "layout");
  redirect(`${LP}/${id}?bearbeiten=1`);
}

/** Instead of deleting: the package leaves the list and stays under „Archiviert“. */
export async function archiveLernpaketAction(id: number) {
  await requireTeacher();
  archiviereLernpaket(id);
  revalidatePath(LP, "layout");
  redirect(`${LP}/${id}?archiviert=1`);
}

export async function restoreLernpaketAction(id: number) {
  await requireTeacher();
  stelleWiederHer(id);
  revalidatePath(LP, "layout");
  redirect(`${LP}/${id}?wiederhergestellt=1`);
}

// ---------- steps ----------

export async function addSchrittAction(paketId: number, f: FormData) {
  await requireTeacher();
  const out = addSchritt(paketId, schrittAus(f), { nach: Number(f.get("nach")) || null });
  if ("fehler" in out) redirect(mitFehler(`${LP}/${paketId}?bearbeiten=1&neuerSchritt=1`, out.fehler, "#neuer-schritt"));
  revalidatePath(`${LP}/${paketId}`);
  redirect(`${LP}/${paketId}?bearbeiten=1#schritt-${out.id}`);
}

export async function updateSchrittAction(schrittId: number, f: FormData) {
  await requireTeacher();
  const s = getSchritt(schrittId);
  if (!s) redirect(LP);
  const out = updateSchritt(schrittId, schrittAus(f));
  if ("fehler" in out) redirect(mitFehler(`${LP}/${s.paket_id}?bearbeiten=1&schritt=${schrittId}`, out.fehler, `#schritt-${schrittId}`));
  revalidatePath(`${LP}/${s.paket_id}`);
  redirect(`${LP}/${s.paket_id}?bearbeiten=1#schritt-${schrittId}`);
}

export async function moveSchrittAction(schrittId: number, richtung: -1 | 1) {
  await requireTeacher();
  const s = getSchritt(schrittId);
  if (!s) redirect(LP);
  verschiebeSchritt(schrittId, richtung);
  revalidatePath(`${LP}/${s.paket_id}`);
  redirect(`${LP}/${s.paket_id}?bearbeiten=1#schritt-${schrittId}`);
}

export async function removeSchrittAction(schrittId: number) {
  await requireTeacher();
  const s = getSchritt(schrittId);
  if (!s) redirect(LP);
  entferneSchritt(schrittId);
  revalidatePath(`${LP}/${s.paket_id}`);
  redirect(`${LP}/${s.paket_id}?bearbeiten=1`);
}

/** A task of the Aufgabenbibliothek, copied into the step. */
export async function addAufgabeAction(schrittId: number, f: FormData) {
  await requireTeacher();
  const s = getSchritt(schrittId);
  if (!s) redirect(LP);
  const out = aufgabeAusBibliothek(schrittId, Number(f.get("eintrag")) || 0);
  const url = `${LP}/${s.paket_id}?bearbeiten=1&schritt=${schrittId}`;
  revalidatePath(`${LP}/${s.paket_id}`);
  redirect("fehler" in out ? mitFehler(url, out.fehler, `#schritt-${schrittId}`) : `${url}#schritt-${schrittId}`);
}

export async function removeAufgabeAction(schrittId: number, index: number) {
  await requireTeacher();
  const s = getSchritt(schrittId);
  if (!s) redirect(LP);
  entferneAufgabe(schrittId, index);
  revalidatePath(`${LP}/${s.paket_id}`);
  redirect(`${LP}/${s.paket_id}?bearbeiten=1&schritt=${schrittId}#schritt-${schrittId}`);
}
