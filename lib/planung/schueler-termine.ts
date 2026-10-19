/**
 * Die Termine eines Schülers für seine App (`/lernen/[token]`). niko, 2026-10-19: „ich möchte aber
 * auch das schüler die webapp verwenden können damit sie sehen wo und wann sie unterricht haben“.
 *
 * Wie bisher (D17/D23) nur **veröffentlichte** Plätze und bewusst ohne Namen: zu sehen sind Tag, Zeit,
 * Ort und ob die Einheit online oder vor Ort ist. Dazu kommt die nächste Woche, sobald sie
 * veröffentlicht ist, und der nächste Termin ganz oben.
 */
import { einheitenFuerWoche, istNichtStattgefunden, mitNamen, slotDatum, type PlatzMitNamen } from "./repo";
import { datumLabel, minutenLabel, tagAddieren, wienerDatum, wienerMinuten, wienerWochenstart, wochenLabel } from "./zeit";

export type SchuelerTermin = {
  id: number;
  datum: string;
  /** „Mo, 20.10.“ */
  label: string;
  /** „15:30–17:10“ */
  zeit: string;
  ort: string;
  /** noch kein Raum: dann ist auch „online“ oder „vor Ort“ noch offen */
  raumOffen: boolean;
  online: boolean;
  heute: boolean;
  /** die geplante Zeit läuft gerade */
  jetzt: boolean;
  /** die geplante Zeit ist vorbei */
  vorbei: boolean;
  nichtStattgefunden: boolean;
};

export type TerminWoche = { wochenstart: string; label: string; titel: "Diese Woche" | "Nächste Woche"; termine: SchuelerTermin[] };

/**
 * Der Ort eines Termins: Raumname und Gebäude. „Online“ als Gebäudename wäre neben dem Hinweis
 * „online“ nur doppelt und wird weggelassen. Ohne Raum steht „Raum noch offen“.
 */
export function ortLabel(raum: string | null, gebaeude: string | null, online: boolean): string {
  if (!raum) return "Raum noch offen";
  const zusatz = gebaeude && gebaeude.toLowerCase() !== (online ? "online" : "vor ort") ? ` · ${gebaeude}` : "";
  return `${raum}${zusatz}`;
}

function alsTermin(z: PlatzMitNamen, now: Date): SchuelerTermin {
  const datum = slotDatum(z.week_start, z.weekday);
  const heute = wienerDatum(now);
  const minuten = wienerMinuten(now);
  const ende = z.start_min + z.geplante_dauer;
  const online = z.room_mode === "online";
  return {
    id: z.id,
    datum,
    label: datumLabel(datum),
    zeit: `${minutenLabel(z.start_min)}–${minutenLabel(z.start_min + z.geplante_dauer)}`,
    ort: ortLabel(z.room_name, z.room_building, online),
    raumOffen: !z.room_name,
    online,
    heute: datum === heute,
    jetzt: datum === heute && z.start_min <= minuten && minuten < ende,
    vorbei: datum < heute || (datum === heute && ende <= minuten),
    nichtStattgefunden: istNichtStattgefunden(z, now),
  };
}

/** Diese Woche und, sobald veröffentlicht, die nächste; dazu der nächste Termin, der noch nicht vorbei ist. */
export function termineFuerSchueler(studentId: number, now: Date = new Date()): { naechster: SchuelerTermin | null; wochen: TerminWoche[] } {
  const diese = wienerWochenstart(now);
  const wochen: TerminWoche[] = [diese, tagAddieren(diese, 7)].map((wochenstart, i) => ({
    wochenstart,
    label: wochenLabel(wochenstart),
    titel: i === 0 ? "Diese Woche" : "Nächste Woche",
    termine: mitNamen(einheitenFuerWoche(wochenstart, { status: "veroeffentlicht" }).filter((z) => z.student_id === studentId))
      .sort((a, b) => a.weekday - b.weekday || a.start_min - b.start_min || a.id - b.id)
      .map((z) => alsTermin(z, now)),
  }));
  const naechster = wochen.flatMap((w) => w.termine).find((t) => !t.vorbei) ?? null;
  // die nächste Woche nur, wenn dort schon etwas veröffentlicht ist
  return { naechster, wochen: wochen.filter((w, i) => i === 0 || w.termine.length > 0) };
}
