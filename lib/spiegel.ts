/**
 * Schüler-Bildschirm (niko 2026-11-12: „ich verwende immer scrcpy … ich möchte das in der Software haben“):
 * the teacher sees in the running unit what DreamStudy shows on the student tablet, live, and can tap, type
 * and scroll there. Not a video of the whole Android tablet (a web app cannot do that), but the tablet's
 * page itself: DreamStudy on the tablet records its own page (rrweb, components/device/SpiegelAufnahme.tsx)
 * and the teacher's unit page rebuilds it (components/device/SchuelerBildschirm.tsx).
 *
 * The tablet only records while a teacher watches: the teacher's stream on "spiegel:<unit id>" tells the
 * tablets of the unit to start (each new watcher gets a fresh full picture) and to stop when nobody is left.
 * Nothing is stored: events go from the tablet's POST straight to the watching teacher.
 *
 * Eingreifen: the teacher's taps, drags, keys, pasted text and scrolling go as small commands to the tablet,
 * which plays them on its own page (where the student sees a short ring at each tap).
 */
import { devicesOfUnit } from "./devices";
import { deviceChannel } from "./live";
import type { UnitView } from "./units";
import { isOnline, publish } from "./whiteboard-hub";

export const spiegelChannel = (unitId: number) => `spiegel:${unitId}`;

/** Does a teacher watch the student screen of this unit right now? */
export const spiegelAktiv = (unitId: number) => isOnline(spiegelChannel(unitId), "lehrer");

/**
 * Tells the tablets of the unit whether to record. `neu`: a teacher just came, so a recording tablet sends
 * a fresh full picture (the new viewer cannot start from the middle of a stream).
 */
export function spiegelMelden(unit: Pick<UnitView, "id" | "teacher_id">, neu = true) {
  const an = spiegelAktiv(unit.id);
  for (const d of devicesOfUnit(unit)) publish(deviceChannel(d.id), { type: "spiegel", an, neu: an && neu });
}

/** Sends the tablet's recorded events to the teachers who watch. */
export function spiegelSenden(unitId: number, events: unknown[]) {
  publish(spiegelChannel(unitId), { type: "ev", events });
}

/** A tablet came or went: the open student screens of the unit say so. */
export function spiegelTablet(unitId: number, online: boolean) {
  if (spiegelAktiv(unitId)) publish(spiegelChannel(unitId), { type: "tablet", online });
}

export type Steuern =
  /** finger or mouse on the student screen, in the tablet's CSS pixels of its viewport */
  | { art: "zeiger"; phase: "down" | "move" | "up"; x: number; y: number }
  /** one key as KeyboardEvent.key, e.g. "a", "Ä", "Backspace", "Enter" */
  | { art: "taste"; key: string }
  /** pasted text, typed at the tablet's cursor */
  | { art: "text"; text: string }
  /** mouse wheel or touchpad: scroll where the pointer is */
  | { art: "rad"; x: number; y: number; dx: number; dy: number };

const TASTEN = new Set(["Backspace", "Delete", "Enter", "Tab", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", " "]);
const zahl = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(-max, Math.min(max, Math.round(v * 10) / 10)) : null);

/** Only well-formed, small commands reach the tablet. */
export function pruefeSteuern(raw: unknown): Steuern | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.art === "zeiger") {
    const x = zahl(r.x, 10_000);
    const y = zahl(r.y, 10_000);
    if (x === null || y === null || x < 0 || y < 0) return null;
    if (r.phase !== "down" && r.phase !== "move" && r.phase !== "up") return null;
    return { art: "zeiger", phase: r.phase, x, y };
  }
  if (r.art === "taste") {
    if (typeof r.key !== "string") return null;
    // one printable character (also ä, ß, €) or a known editing key
    if ([...r.key].length === 1 || TASTEN.has(r.key)) return { art: "taste", key: r.key };
    return null;
  }
  if (r.art === "text") {
    if (typeof r.text !== "string" || !r.text) return null;
    return { art: "text", text: r.text.slice(0, 2000) };
  }
  if (r.art === "rad") {
    const x = zahl(r.x, 10_000);
    const y = zahl(r.y, 10_000);
    const dx = zahl(r.dx, 5_000);
    const dy = zahl(r.dy, 5_000);
    if (x === null || y === null || dx === null || dy === null) return null;
    return { art: "rad", x, y, dx, dy };
  }
  return null;
}

/** Plays a command on the tablets of the unit. */
export function steuern(unit: Pick<UnitView, "id" | "teacher_id">, c: Steuern) {
  const tablets = devicesOfUnit(unit);
  for (const d of tablets) publish(deviceChannel(d.id), { type: "steuern", c });
  return tablets.length;
}
