import { revalidatePath } from "next/cache";
import { currentTeacher } from "@/lib/auth";
import type { Difficulty } from "@/lib/curriculum";
import { saveUpload } from "@/lib/materials";
import { importierePraesentation } from "@/lib/praesentationen";
import { GRENZEN } from "@/lib/praesentation-zip";
import * as repo from "@/lib/repo";

export const dynamic = "force-dynamic";

const PR = "/mehr/praesentationen";
const back = (path: string) => new Response(null, { status: 303, headers: { Location: path } });
const mitFehler = (fehler: string[] | string) => back(`${PR}?neu=1&fehler=${encodeURIComponent((Array.isArray(fehler) ? fehler : [fehler]).slice(0, 8).join("\n"))}`);
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/**
 * Upload of a presentation (one HTML file or a ZIP, up to 60 MB). A route handler instead of a server
 * action, because the file can be larger than an action's body limit; not covered by proxy.ts (it buffers
 * bodies), so it checks the session and the sender itself, like the material upload. A PDF goes to Material.
 */
export async function POST(request: Request) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return new Response("Nicht angemeldet.", { status: 401 });
  // only form posts from this site (see app/material/hochladen/route.ts)
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let foreign = Boolean(site && site !== "same-origin");
  try {
    if (origin && origin !== "null" && host && new URL(origin).host !== host) foreign = true;
  } catch {
    foreign = true;
  }
  if (foreign) return new Response("Nicht erlaubt.", { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > GRENZEN.upload + 1024 * 1024) return mitFehler(`Die Datei ist zu groß (höchstens ${GRENZEN.upload / 1024 / 1024} MB).`);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return mitFehler("Die Datei kam nicht vollständig an. Bitte noch einmal versuchen.");
  }
  const file = form.get("datei");
  if (!(file instanceof File) || !file.size) return mitFehler("Bitte eine Datei auswählen.");
  const haupt = str(form, "skill_id");
  const skill = haupt ? repo.getSkill(haupt) : null;
  const meta = {
    title: str(form, "title"),
    fach: str(form, "fach") || skill?.subject || "",
    schulart: str(form, "schulart"),
    klasse: str(form, "schulart") ? Number(form.get("klasse")) || null : null,
    thema: str(form, "thema") || skill?.area || "",
    skill_ids: haupt ? [haupt] : [],
    schwierigkeit: (str(form, "schwierigkeit") || "mittel") as Difficulty,
    beschreibung: str(form, "beschreibung"),
  };
  const data = Buffer.from(await file.arrayBuffer());
  let out: ReturnType<typeof importierePraesentation>;
  try {
    out = importierePraesentation({ name: file.name, data }, meta, teacher.id);
  } catch {
    return mitFehler("Speichern ging nicht. Bitte noch einmal versuchen.");
  }
  if ("pdf" in out) {
    // a PDF has no animations: it is kept as Material, where PDFs are shown already
    try {
      const m = saveUpload({ name: file.name, data }, { title: meta.title, kind: "pdf", subject: meta.fach, teacherId: teacher.id });
      return back(`/mehr/material/${m.id}${m.existing ? "?vorhanden=1" : ""}`);
    } catch (e) {
      return mitFehler(e instanceof Error ? e.message : "Hochladen ging nicht.");
    }
  }
  if ("fehler" in out) return mitFehler(out.fehler);
  revalidatePath(PR);
  return back(`${PR}/${out.id}?neu=1`);
}
