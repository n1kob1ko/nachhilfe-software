/**
 * Eine gespeicherte Antwort lesbar für die Lehrkraft (Ergebnis-Seite, „Zu bewerten“ in lib/zu-bewerten.ts): die Kurzform eines
 * Rechenwegs, die angekreuzte Auswahl, die Lücken, die Reihenfolge, ein Writing mit seiner Wortanzahl. Nur auf Lehrerseiten.
 */
import { wortRahmen } from "./englisch-matura-formate";
import { wordCount } from "./lesen";
import { readMathAnswer } from "./math-check";
import { maturaAntwortText } from "./matura-formate";
import type { Task } from "./repo";

const isMath = (t: Task) => t.type === "rechenweg" || t.type === "sachaufgabe";

export function antwortAnzeige(t: Task, raw: string) {
  if (isMath(t)) {
    // the short form per try; the full working of the last try is shown below
    const a = readMathAnswer(raw);
    if (t.type === "sachaufgabe") return (t.data.parts ?? []).map((p, i) => `${p.label || `${String.fromCharCode(97 + i)})`} ${(p.kind === "text" ? a.parts?.[i]?.text : a.parts?.[i]?.result) || "–"}`).join("  ·  ");
    const steps = a.steps?.filter((l) => l.trim()).length ?? 0;
    return `${a.result?.trim() || "kein Ergebnis"}${steps ? ` (${steps} ${steps === 1 ? "Zeile" : "Zeilen"} Rechenweg)` : a.board ? " (Rechenweg am Whiteboard)" : ""}`;
  }
  // Englisch-Matura, Writing: der Text mit seiner Wortanzahl und dem verlangten Rahmen (±10 %)
  if (t.data.schreibauftrag && raw.trim()) {
    const { min, max } = wortRahmen(t.data.schreibauftrag.woerter);
    return `${raw.trim()}\n\n${wordCount(raw)} Wörter, verlangt ${min} bis ${max}`;
  }
  // Matura-Formate: die angekreuzten Antworten („b) … · d) …“), die Buchstaben der Zuordnung, ① ② des Lückentexts
  const matura = maturaAntwortText(t, raw);
  if (matura !== null) return matura;
  if (t.data.options) {
    const i = Number(raw);
    return Number.isInteger(i) && t.data.options[i] !== undefined ? `${String.fromCharCode(97 + i)}) ${t.data.options[i]}` : raw;
  }
  if (t.data.steps) {
    try {
      return (JSON.parse(raw) as number[]).map((i, n) => `${n + 1}. ${t.data.steps![i]}`).join("  ");
    } catch {
      return raw;
    }
  }
  if (t.answer.blanks) {
    try {
      return (JSON.parse(raw) as string[]).join(" · ");
    } catch {
      return raw;
    }
  }
  return raw;
}
