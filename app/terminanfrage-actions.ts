"use server";

/**
 * Server Actions der Terminanfragen (lib/planung/terminanfragen.ts, Plan 3.3). Dünne Hüllen: wer handelt (Schüler
 * über seinen Link oder angemeldeter Lehrer), weitergeben, Pfade neu auswerten, mit Rückmeldung zurückleiten.
 * Rechte und Prüfungen stehen in lib/planung/terminanfragen.ts.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import * as ta from "@/lib/planung/terminanfragen";
import { labelMinuten } from "@/lib/planung/zeit";
import { getStudentByToken } from "@/lib/repo";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Nur Pfade innerhalb der App, damit die Rückleitung nicht nach außen führt. */
function sichererPfad(raw: string, fallback: string): string {
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}

function mitMeldung(pfad: string, e: ta.Ergebnis): string {
  const [ohneAnker] = pfad.split("#");
  const trenner = ohneAnker.includes("?") ? "&" : "?";
  const meldung = e.ok ? `anfrage_ok=${encodeURIComponent(e.hinweis ?? "Gespeichert.")}` : `anfrage_fehler=${encodeURIComponent(e.fehler)}`;
  return `${ohneAnker}${trenner}${meldung}#terminanfragen`;
}

/** Was das Formular „Verschieben“ oder „Tauschen“ schickt. */
function eingabe(f: FormData): ta.AnfrageEingabe {
  const wahl = str(f, "wahl");
  const eigene = wahl === "" || wahl === "eigene";
  const zeit = labelMinuten(str(f, "zeit"));
  return {
    art: str(f, "art"),
    platzId: Number(str(f, "platz_id")),
    partnerPlatzId: Number(str(f, "partner_platz_id")),
    wahl: eigene ? undefined : wahl,
    datum: eigene ? str(f, "datum") : undefined,
    startMin: eigene ? (zeit ?? "") : undefined,
    notiz: str(f, "notiz"),
  };
}

function aktualisiere() {
  revalidatePath("/", "layout");
}

// ---------- Schüler (geheimer Link) ----------

function schuelerAus(token: string): { schuelerId: number } {
  const s = getStudentByToken(token);
  if (!s) redirect("/");
  return { schuelerId: s.id };
}

export async function stelleSchuelerAnfrageAction(token: string, formData: FormData) {
  const wer = schuelerAus(token);
  const e = ta.stelleAnfrage(wer, eingabe(formData));
  aktualisiere();
  redirect(mitMeldung(`/lernen/${encodeURIComponent(token)}`, e));
}

export async function antwortSchuelerAction(token: string, id: number, was: "zustimmen" | "ablehnen" | "zurueckziehen") {
  const wer = schuelerAus(token);
  const e = was === "zustimmen" ? ta.stimmeZu(wer, id) : was === "ablehnen" ? ta.lehneAb(wer, id, "") : ta.zieheZurueck(wer, id);
  aktualisiere();
  redirect(mitMeldung(`/lernen/${encodeURIComponent(token)}`, e));
}

// ---------- Lehrer und Verwaltung ----------

export async function stelleLehrerAnfrageAction(formData: FormData) {
  const me = await requireTeacher();
  const e = ta.stelleAnfrage({ lehrer: me }, eingabe(formData));
  aktualisiere();
  redirect(mitMeldung(sichererPfad(str(formData, "zurueck"), "/?tab=woche"), e));
}

/** Zustimmen, ablehnen (mit Grund) oder zurückziehen; `was` kommt vom gedrückten Knopf. */
export async function antwortLehrerAction(id: number, formData: FormData) {
  const me = await requireTeacher();
  const was = str(formData, "was");
  const wer = { lehrer: me };
  const e = was === "zustimmen" ? ta.stimmeZu(wer, id) : was === "ablehnen" ? ta.lehneAb(wer, id, str(formData, "grund")) : ta.zieheZurueck(wer, id);
  aktualisiere();
  redirect(mitMeldung(sichererPfad(str(formData, "zurueck"), "/?tab=woche"), e));
}

/** Die Verwaltung bestätigt; beim Verschieben optional ein anderer Raum. */
export async function bestaetigeAnfrageAction(id: number, formData: FormData) {
  const me = await requireTeacher();
  const raum = Number(str(formData, "room_id"));
  const e = ta.bestaetige(me, id, { roomId: Number.isInteger(raum) && raum > 0 ? raum : undefined });
  aktualisiere();
  redirect(mitMeldung(sichererPfad(str(formData, "zurueck"), "/planung"), e));
}
