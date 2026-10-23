/**
 * What a writer chose to see beside a Schreibauftrag on this device (components/text/TextEditor.tsx): the
 * Textbeilage can be hidden on a wide screen, remembered per text in localStorage.
 */

/**
 * Where the choice is kept. Next to the copy of the text (`<prefix><id>`), but never under that prefix itself:
 * the student laptop reads every key with its prefix as a copy of a text. "lernheft-text-" gives
 * "lernheft-beilage-12", the laptop's "lernheft-laptop-text-" gives "lernheft-laptop-beilage-12", which the
 * laptop removes with all its data. Any other prefix falls back to "lernheft-beilage-12".
 */
export function beilageKey(backupPrefix: string, textId: number): string {
  const base = backupPrefix.endsWith("text-") ? backupPrefix.slice(0, -"text-".length) : "lernheft-";
  return `${base}beilage-${textId}`;
}
