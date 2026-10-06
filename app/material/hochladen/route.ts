import { currentTeacher } from "@/lib/auth";
import { MATERIAL_KINDS, MAX_UPLOAD_BYTES, saveUpload, type MaterialKind } from "@/lib/materials";

export const dynamic = "force-dynamic";

const back = (path: string) => new Response(null, { status: 303, headers: { Location: path } });

/**
 * Upload of a photo or PDF. A route handler instead of a server action, because files can be larger
 * than an action's body limit; not covered by the (tutor) layout or proxy.ts, so it checks the
 * session itself.
 */
export async function POST(request: Request) {
  const teacher = await currentTeacher();
  if (!teacher || teacher.must_change_password) return new Response("Nicht angemeldet.", { status: 401 });
  // only form posts from this site (the session cookie is SameSite=Lax as well); with the app's
  // no-referrer policy browsers send "Origin: null" on form posts, so Sec-Fetch-Site decides then
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
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 1024 * 1024) {
    return back(`/mehr/material?fehler=${encodeURIComponent(`Die Datei ist zu groß (höchstens ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).`)}`);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return back(`/mehr/material?fehler=${encodeURIComponent("Die Datei kam nicht vollständig an. Bitte noch einmal versuchen.")}`);
  }
  const file = form.get("datei");
  if (!(file instanceof File) || !file.size) return back(`/mehr/material?fehler=${encodeURIComponent("Bitte eine Datei auswählen.")}`);
  const kind = String(form.get("art") ?? "");
  try {
    const r = saveUpload(
      { name: file.name, data: Buffer.from(await file.arrayBuffer()) },
      {
        title: String(form.get("titel") ?? ""),
        kind: kind in MATERIAL_KINDS ? (kind as MaterialKind) : undefined,
        subject: String(form.get("fach") ?? ""),
        studentId: Number(form.get("schueler")) || null,
        teacherId: teacher.id,
      },
    );
    return back(`/mehr/material/${r.id}${r.existing ? "?vorhanden=1" : ""}`);
  } catch (e) {
    return back(`/mehr/material?fehler=${encodeURIComponent(e instanceof Error ? e.message : "Hochladen ging nicht.")}`);
  }
}
