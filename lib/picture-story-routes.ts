/**
 * HTTP side of Bildgeschichten, shared by the route handlers: the origin check for uploads, reading the
 * upload form, and sending a picture to whoever may see it (teacher, tablet, the student's laptop).
 */
import fs from "node:fs";
import { sniffType } from "./materials";
import { cleanSettings, imageFile, MAX_IMAGES, type OrderEntry, type StorySettings, type StoryImage, type UploadedImage } from "./picture-story";

/** Only requests from this site's own pages (the app's no-referrer policy makes browsers send "Origin: null"). */
export function foreignRequest(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (site && site !== "same-origin") return true;
  try {
    if (origin && origin !== "null" && host && new URL(origin).host !== host) return true;
  } catch {
    return true;
  }
  return false;
}

export type StoryForm = {
  title: string;
  subject: string;
  prompt: string;
  settings: StorySettings;
  order: OrderEntry[];
  uploads: UploadedImage[];
  /** open it on the student's device right away */
  show: boolean;
};

const str = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);

/**
 * The form of the Bildgeschichte editor: fields, the new files ("bild0", "bild1", …) and "reihenfolge",
 * a JSON list such as [{"id":3,"caption":"…"},{"upload":0,"caption":"…"}].
 */
export async function readStoryForm(form: FormData): Promise<StoryForm> {
  const uploads: UploadedImage[] = [];
  for (let i = 0; i < MAX_IMAGES; i++) {
    const f = form.get(`bild${i}`);
    if (f instanceof File && f.size) uploads[i] = { name: f.name, data: Buffer.from(await f.arrayBuffer()) };
  }
  let order: OrderEntry[] = [];
  try {
    const raw = JSON.parse(String(form.get("reihenfolge") ?? "[]"));
    if (Array.isArray(raw))
      order = raw.slice(0, MAX_IMAGES + 1).flatMap((e): OrderEntry[] => {
        const caption = typeof e?.caption === "string" ? e.caption : undefined;
        if (Number.isInteger(e?.id)) return [{ id: e.id, caption }];
        if (Number.isInteger(e?.upload) && e.upload >= 0 && e.upload < MAX_IMAGES) return [{ upload: e.upload, caption }];
        return [];
      });
  } catch {
    order = [];
  }
  return {
    title: str(form, "title", 140),
    subject: str(form, "subject", 60),
    prompt: str(form, "prompt", 4000),
    settings: cleanSettings({
      schoolType: form.get("school_type"),
      klasse: form.get("klasse"),
      targetWords: form.get("target_words"),
      starters: String(form.get("starters") ?? ""),
      hints: form.get("hints"),
      lines: form.get("lines"),
      sourceKind: form.get("source_kind"),
      sourceNote: form.get("source_note"),
    }),
    order,
    uploads,
    show: form.get("tablet") === "1",
  };
}

/** A picture, sent with the type its content has, never as anything a browser would run. */
export function sendImage(img: StoryImage): Response {
  let data: Buffer;
  try {
    data = fs.readFileSync(imageFile(img));
  } catch {
    return new Response("Das Bild fehlt.", { status: 404 });
  }
  const type = sniffType(data);
  if (!type || type.mime !== img.mime) return new Response("Das Bild passt nicht.", { status: 409 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": type.mime,
      "Content-Length": String(data.length),
      // the picture behind an id never changes (a new picture gets a new id); access is checked on every load after an hour
      "Cache-Control": "private, max-age=3600",
      ETag: `"${img.sha256.slice(0, 32)}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}

export const notAllowed = (status = 403) => new Response(status === 401 ? "Nicht angemeldet." : "Nicht erlaubt.", { status });
