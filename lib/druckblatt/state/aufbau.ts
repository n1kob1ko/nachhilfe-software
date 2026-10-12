import type { SentenceBoxDefinition } from "../definition/sentence-box-types";
import { InvalidGeometryError } from "../rendering/geometry";
import { buildLayoutModel } from "../rendering/build-layout";
import { buildSentenceLayout } from "../rendering/build-sentence-layout";
import {
  buildTracingLayout,
  countTracedCells,
  type TracingLayoutModel,
} from "../rendering/build-tracing-layout";
import type { LayoutModel } from "../rendering/layout-model";
import type { SentenceLayoutModel } from "../rendering/sentence-layout-model";
import type { TracingDefinition } from "../definition/tracing-types";
import type { WorksheetDefinition } from "../definition/types";

/**
 * „Aus der Definition wird ein Blatt" — mit einem Netz darunter.
 *
 * `buildLayoutModel` und Verwandte sind reine Funktionen, die bei unmöglichen
 * Maßen laut scheitern (`InvalidGeometryError`). Das ist im Kern richtig und soll
 * so bleiben. In einer Oberfläche, die bei jedem Tastendruck neu rechnet, wäre
 * eine geworfene Ausnahme aber ein weißes Fenster — und die Lehrkraft sähe nicht,
 * welche Einstellung schuld ist.
 *
 * Deshalb hier die eine Stelle, an der gerechnet **und** gefangen wird: entweder
 * ein Layoutmodell oder ein deutscher Satz. Der Renderer bekommt nie eine
 * Ausnahme zu sehen.
 */

export type Aufbau<T> =
  | { readonly ok: true; readonly model: T; readonly fehler: null }
  | { readonly ok: false; readonly model: null; readonly fehler: string };

function versuche<T>(rechnen: () => T): Aufbau<T> {
  try {
    return { ok: true, model: rechnen(), fehler: null };
  } catch (ausnahme) {
    if (ausnahme instanceof InvalidGeometryError) {
      return {
        ok: false,
        model: null,
        fehler: `Das Blatt lässt sich mit diesen Maßen nicht setzen: ${ausnahme.message}`,
      };
    }
    return {
      ok: false,
      model: null,
      fehler: ausnahme instanceof Error ? ausnahme.message : "Das Blatt lässt sich nicht setzen.",
    };
  }
}

export const baueLesetabelle = (definition: WorksheetDefinition): Aufbau<LayoutModel> =>
  versuche(() => buildLayoutModel(definition));

export const baueSatzbaukasten = (definition: SentenceBoxDefinition): Aufbau<SentenceLayoutModel> =>
  versuche(() => buildSentenceLayout(definition));

export const baueNachmalblatt = (definition: TracingDefinition): Aufbau<TracingLayoutModel> =>
  versuche(() => buildTracingLayout(definition));

/** Wie viele Übungszeichen auf dem Nachmalblatt stehen — für die Kennzahl im Kopf. */
export const gezeichneteZeichen = (model: TracingLayoutModel): number => countTracedCells(model);
