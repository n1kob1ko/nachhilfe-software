/**
 * Der Dialog der Planungsregeln (D2). Die Werte kommen aus `leseRegeln()` (die geprüften Regeln aus
 * `app_settings`); die Paarregeln stehen als JSON darunter, weil sie eine Liste sind. Geschrieben
 * wird über `saveRulesAction` → `schreibeRegeln`, das mit zod prüft und Ungültiges **ablehnt** statt
 * es zu glätten. Geöffnet wird der Dialog über `?regeln=1` in der Adresse.
 */
import Link from "next/link";
import { X } from "lucide-react";
import { saveRulesAction } from "@/app/planung-actions";
import type { PlanungsRegeln } from "@/lib/planung/regeln";

const ZAHL_FELDER: { name: keyof PlanungsRegeln; label: string; hinweis: string; min: number; max: number }[] = [
  { name: "gapUsefulMinutesThreshold", label: "Lücke gilt als unnütz unter", hinweis: "Minuten; kürzere Lücken werden nur mit dem Abzug bewertet (Vorgabe 15)", min: 1, max: 1440 },
  { name: "pointsPerMinuteRemainingCapacity", label: "Punkte je freie Minute des Lehrers", hinweis: "belohnt Restkapazität (Vorgabe 2)", min: 0, max: 100000 },
  { name: "pointsPreferredTeacher", label: "Punkte für den Klassenlehrer", hinweis: "0 = gleichwertig (Vorgabe 0)", min: 0, max: 100000 },
  { name: "pointsAdjacentTeacher", label: "Punkte für Anschluss an eine Einheit", hinweis: "belohnt nahtlose Folgen (Vorgabe 0)", min: 0, max: 100000 },
  { name: "penaltyPer30MinGap", label: "Abzug je angefangene 30 Minuten Lücke", hinweis: "hoch = geschlossene Lehrertage (Vorgabe 999)", min: 0, max: 100000 },
  { name: "penaltySingleLessonTeacherDay", label: "Abzug für einen Tag mit einer Einheit", hinweis: "Vorgabe 10", min: 0, max: 100000 },
  { name: "penaltyLessPlannedLessonsOverall", label: "Gewicht, überhaupt zu vergeben", hinweis: "× Knappheit des Schülers (Vorgabe 980)", min: 0, max: 100000 },
  { name: "pointsStudentPairShouldSameTime", label: "Punkte für Paarregel „should“", hinweis: "ab 999 wird sie hart (Vorgabe 25)", min: 0, max: 100000 },
  { name: "penaltyStudentPairShouldntSameTime", label: "Abzug für Paarregel „shouldnt“", hinweis: "ab 999 wird sie hart (Vorgabe 25)", min: 0, max: 100000 },
];

const SCHALTER: { name: keyof PlanungsRegeln; label: string; hinweis: string }[] = [
  { name: "prioritizeMaxPlannedLessons", label: "In jeder Runde den global besten Kandidaten setzen", hinweis: "Vorgabe an" },
  { name: "enforceSingleLessonPerStudentPerDay", label: "Höchstens eine Einheit je Schüler und Tag", hinweis: "Vorgabe an" },
  { name: "enforceTeacherAvailability", label: "Lehrer nur in seiner Verfügbarkeit", hinweis: "Vorgabe an" },
  { name: "enforceStudentAvailability", label: "Schüler nur in seiner Verfügbarkeit", hinweis: "Vorgabe an" },
  { name: "enforceTeacherRoomPreference", label: "Nur Wunschräume, wenn welche eingetragen sind", hinweis: "Vorgabe an" },
  { name: "enforceNoTeacherBreaks", label: "Keine Lücken im Lehrertag", hinweis: "Toleranz: die Lückenschwelle oben" },
  { name: "enforceTeacherCapacity", label: "Wochenziel des Lehrers als Obergrenze", hinweis: "Vorgabe aus" },
  { name: "enforceStudentWeekWeekendDistribution", label: "Verteilung auf Woche und Wochenende", hinweis: "Vorgabe aus" },
];

export function RegelnDialog({ regeln, gebrochen, schliessenHref, zurueck, woche }: { regeln: PlanungsRegeln; gebrochen: boolean; schliessenHref: string; zurueck: string; woche: string }) {
  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/20 px-4 py-8" role="dialog" aria-modal="true" aria-label="Planungsregeln">
      <div className="w-full max-w-[720px] rounded-[20px] bg-surface px-5 py-5 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold">Regeln des Wochenplans</h2>
            <p className="mt-1 max-w-[62ch] text-[13px] text-ink-2">
              Diese Werte steuern den Generator. Sie gelten für alle; eine kaputte Einstellung lässt die Planung nie scheitern — dann gelten die Vorgaben.
            </p>
            {gebrochen && (
              <p className="mt-2 rounded-xl px-3 py-2 text-[13px] text-red" role="status" style={{ background: "var(--red-wash)" }}>
                Die gespeicherten Regeln konnten nicht gelesen werden; angezeigt werden die Vorgaben. Speichern ersetzt sie.
              </p>
            )}
          </div>
          <Link href={schliessenHref} className="btn btn-ghost btn-sm" aria-label="Schließen">
            <X size={16} aria-hidden />
          </Link>
        </div>

        <form action={saveRulesAction} className="grid gap-4">
          <input type="hidden" name="woche" value={woche} />
          <input type="hidden" name="zurueck" value={zurueck} />

          <label className="field max-w-[240px]">
            <span className="label">Raster der Startzeiten (Minuten)</span>
            <select name="snapMinutes" defaultValue={String(regeln.snapMinutes)} className="input">
              {[10, 20, 30, 40, 50, 60].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="text-[12px] text-ink-3">Startzeiten liegen immer auf 10 Minuten (D19); 10 ist die Vorgabe.</span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            {ZAHL_FELDER.map((f) => (
              <label key={String(f.name)} className="field">
                <span className="label">{f.label}</span>
                <input className="input" type="number" name={String(f.name)} min={f.min} max={f.max} step={1} defaultValue={Number(regeln[f.name])} />
                <span className="text-[12px] text-ink-3">{f.hinweis}</span>
              </label>
            ))}
          </div>

          <fieldset className="grid gap-2 rounded-xl border border-line px-3 py-3 sm:grid-cols-2">
            <legend className="px-1 text-[13px] font-semibold text-ink-2">Harte Regeln</legend>
            {SCHALTER.map((s) => (
              <label key={String(s.name)} className="flex items-start gap-2 text-[13px]">
                <input type="checkbox" name={String(s.name)} defaultChecked={Boolean(regeln[s.name])} className="mt-0.5" />
                <span>
                  {s.label}
                  <span className="block text-[12px] text-ink-3">{s.hinweis}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="field">
            <span className="label">Paarregeln (JSON)</span>
            <textarea
              className="input text-[13px]"
              name="studentPairTimingRules"
              rows={4}
              spellCheck={false}
              defaultValue={JSON.stringify(regeln.studentPairTimingRules, null, 2)}
            />
            <span className="text-[12px] text-ink-3">
              Liste aus <code>{`{ "id": "paar-1", "studentAId": 3, "studentBId": 4, "strength": "should" }`}</code>; Stärken: must, should, shouldnt, mustnt. Schüler sind Zahlen (Datenbank-Ids).
            </span>
          </label>

          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              Regeln speichern
            </button>
            <Link href={schliessenHref} className="btn btn-secondary">
              Abbrechen
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
