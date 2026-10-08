/**
 * Copies of unsaved texts on the student's laptop (localStorage). They carry their own prefix, so the
 * laptop pages can remove exactly these and never a teacher's copies in the same browser.
 */
import { countWords, type TextDoc } from "@/lib/text-doc";

export const DRAFT_PREFIX = "lernheft-laptop-text-";
/** set before signing out without saving: the next page removes every copy */
export const DISCARD_FLAG = "lernheft-laptop-verwerfen";

export type Draft = { textId: number; base: number; body: TextDoc; at: number; words: number; title: string };

export function readDrafts(): Draft[] {
  const out: Draft[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(DRAFT_PREFIX)) continue;
      const textId = Number(key.slice(DRAFT_PREFIX.length));
      try {
        const b = JSON.parse(localStorage.getItem(key) ?? "") as { base: number; body: TextDoc; at: number; title?: string };
        out.push({ textId, base: b.base, body: b.body, at: b.at, words: Array.isArray(b.body) ? countWords(b.body) : 0, title: b.title || "Text" });
      } catch {
        out.push({ textId, base: 0, body: [], at: 0, words: 0, title: "Text" });
      }
    }
  } catch {
    // no storage (private mode): nothing kept, nothing to clean
  }
  return out;
}

export function removeDraft(textId: number) {
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${textId}`);
  } catch {
    // nothing to remove
  }
}

/** Everything the laptop pages ever kept on this device. */
export function removeAllLaptopData() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith("lernheft-laptop-")) localStorage.removeItem(key);
    sessionStorage.removeItem(DISCARD_FLAG);
  } catch {
    // nothing to remove
  }
}
