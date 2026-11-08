"use server";

/**
 * Server Actions der Tauschbörse (lib/planung/tauschboerse.ts) und der Verwaltung dazu (tauscheZurueck in
 * lib/planung/terminanfragen.ts). Dünne Hüllen: wer handelt, weitergeben, mit Rückmeldung zurück.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import * as tb from "@/lib/planung/tauschboerse";
import * as ta from "@/lib/planung/terminanfragen";
import { getStudentByToken } from "@/lib/repo";

type Ergebnis = { ok: true; hinweis?: string } | { ok: false; fehler: string };

function zurueckZu(pfad: string, e: Ergebnis, anker: string): string {
  const [ohneAnker] = pfad.split("#");
  const trenner = ohneAnker.includes("?") ? "&" : "?";
  const meldung = e.ok ? `anfrage_ok=${encodeURIComponent(e.hinweis ?? "Gespeichert.")}` : `anfrage_fehler=${encodeURIComponent(e.fehler)}`;
  return `${ohneAnker}${trenner}${meldung}#${anker}`;
}

function schuelerAus(token: string): number {
  const s = getStudentByToken(token);
  if (!s) redirect("/");
  return s.id;
}

const app = (token: string) => `/lernen/${encodeURIComponent(token)}/termine`;

// ---------- Schüler (geheimer Link) ----------

export async function bieteAnAction(token: string, platzId: number, formData: FormData) {
  const id = schuelerAus(token);
  const e = tb.bieteAn(id, { platzId, passende: formData.getAll("passende").map(String) });
  revalidatePath("/", "layout");
  redirect(zurueckZu(app(token), e, "terminanfragen"));
}

export async function zieheAngebotZurueckAction(token: string, angebotId: number) {
  const id = schuelerAus(token);
  const e = tb.zieheAngebotZurueck(id, angebotId);
  revalidatePath("/", "layout");
  redirect(zurueckZu(app(token), e, "terminanfragen"));
}

export async function nimmAngebotAction(token: string, angebotId: number, platzId: number) {
  const id = schuelerAus(token);
  const e = tb.nimmAngebot(id, angebotId, platzId);
  revalidatePath("/", "layout");
  redirect(zurueckZu(app(token), e, "terminanfragen"));
}

// ---------- Verwaltung ----------

function sichererPfad(raw: string, fallback: string): string {
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}

export async function tauscheZurueckAction(id: number, formData: FormData) {
  const me = await requireTeacher();
  const e = ta.tauscheZurueck(me, id);
  revalidatePath("/", "layout");
  redirect(zurueckZu(sichererPfad(String(formData.get("zurueck") ?? ""), "/planung"), e, "terminanfragen"));
}
