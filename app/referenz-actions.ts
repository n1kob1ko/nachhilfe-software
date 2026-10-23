"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { inBibliothek, loescheEintrag, neuerEintrag, speichereEintrag } from "@/lib/referenz";

const RS = "/mehr/referenzen";
const str = (f: FormData, k: string) => String(f.get(k) ?? "");
/** Errors go back to the page in the address, one per line. */
const mitFehler = (url: string, fehler: string[] | string) => `${url}${url.includes("?") ? "&" : "?"}fehler=${encodeURIComponent((Array.isArray(fehler) ? fehler : [fehler]).slice(0, 8).join("\n"))}`;

/** A new entry by hand (without KI): it opens to be filled in and stays „Ungeprüft“ until it is saved. */
export async function neuerEintragAction(f: FormData) {
  const teacher = await requireTeacher();
  const out = neuerEintrag({ fach: str(f, "fach"), quelle: str(f, "quelle"), teacherId: teacher.id });
  if ("fehler" in out) redirect(mitFehler(RS, out.fehler));
  revalidatePath(RS);
  redirect(`${RS}/${out.id}`);
}

/** Saving is the teacher's check: the entry is „Geprüft“ from now on (lib/referenz.ts). */
export async function speichereEintragAction(id: number, f: FormData) {
  const teacher = await requireTeacher();
  const out = speichereEintrag(
    id,
    {
      fach: str(f, "fach"),
      skillId: str(f, "skill_id") || null,
      grundkompetenz: str(f, "grundkompetenz"),
      format: str(f, "format"),
      aufgabe: str(f, "aufgabe"),
      loesung: str(f, "loesung"),
      quelle: str(f, "quelle"),
      dritte: f.get("dritte") === "1",
    },
    teacher.id,
  );
  if ("fehler" in out) redirect(mitFehler(`${RS}/${id}`, out.fehler));
  revalidatePath(RS, "layout");
  redirect(`${RS}/${id}?gespeichert=1`);
}

/** A checked entry without material of third parties becomes a library task with its source. */
export async function inBibliothekAction(id: number) {
  const teacher = await requireTeacher();
  const out = inBibliothek(id, teacher.id);
  if ("fehler" in out) redirect(mitFehler(`${RS}/${id}`, out.fehler));
  revalidatePath(RS, "layout");
  revalidatePath("/uebungen/bibliothek");
  redirect(`/uebungen/bibliothek/${out.libraryId}`);
}

export async function loescheEintragAction(id: number) {
  await requireTeacher();
  loescheEintrag(id);
  revalidatePath(RS, "layout");
  redirect(`${RS}?geloescht=1`);
}
