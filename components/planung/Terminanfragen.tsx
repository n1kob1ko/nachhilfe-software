import { ArrowLeftRight, ArrowRight, CalendarSync } from "lucide-react";
import { Pill } from "@/components/ui";
import { STATUS_LABEL, STATUS_TONE, type AnfragbarerTermin, type AnfrageSicht } from "@/lib/planung/terminanfragen";

/**
 * Terminanfragen (lib/planung/terminanfragen.ts): das Formular „Verschieben oder tauschen“ zu einem Termin und
 * die Liste der Anfragen mit Zustand. Dieselben Bausteine in der Schüler-App, in „Meine Woche“ und in der Planung;
 * was ein Schüler sieht, kommt schon ohne Namen aus lib/planung/terminanfragen.ts.
 */

type Aktion = (formData: FormData) => void | Promise<void>;

/** Rückmeldung nach einer Aktion (`?anfrage_ok=` / `?anfrage_fehler=`). */
export function AnfrageMeldung({ ok, fehler }: { ok?: string; fehler?: string }) {
  if (!ok && !fehler) return null;
  return (
    <p role="status" className={`mt-3 rounded-2xl px-4 py-3 text-[14px] ${fehler ? "text-red" : "text-green"}`} style={{ background: fehler ? "var(--red-wash)" : "var(--green-wash)" }}>
      {fehler ?? ok}
    </p>
  );
}

/**
 * Zu einem Termin: verschieben (eine der freien Zeiten oder eine eigene) oder mit einem anderen Termin desselben
 * Lehrers tauschen. Ohne JavaScript: zwei kleine Formulare in einem aufklappbaren Abschnitt.
 */
export function TerminAendern({ termin, aktion, zurueck, schueler = false }: { termin: AnfragbarerTermin; aktion: Aktion; zurueck?: string; schueler?: boolean }) {
  return (
    <details className="group mt-1" data-testid="termin-aendern">
      <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[14px] font-medium text-accent">
        <CalendarSync size={16} aria-hidden /> Verschieben oder tauschen
      </summary>
      <div className="mt-2 grid gap-4 rounded-2xl bg-panel/60 p-4 md:grid-cols-2">
        <form action={aktion} className="grid content-start gap-3">
          <input type="hidden" name="art" value="verschieben" />
          <input type="hidden" name="platz_id" value={termin.id} />
          {zurueck && <input type="hidden" name="zurueck" value={zurueck} />}
          <fieldset className="grid gap-1.5">
            <legend className="label mb-1">Neue Zeit</legend>
            {schueler && termin.frei.length === 0 && <p className="text-[13px] text-ink-2">Gerade ist keine freie Zeit zu finden. Wähl selbst eine Zeit.</p>}
            {termin.frei.map((f, i) => (
              <label key={f.wert} className="flex min-h-[40px] cursor-pointer items-center gap-2 text-[14px]">
                <input type="radio" name="wahl" value={f.wert} defaultChecked={i === 0} className="h-4 w-4 accent-[var(--accent)]" />
                <span className="num">{f.label}</span>
              </label>
            ))}
            <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-[14px]">
              <input type="radio" name="wahl" value="eigene" defaultChecked={termin.frei.length === 0} className="h-4 w-4 accent-[var(--accent)]" />
              Andere Zeit
            </label>
            <span className="grid grid-cols-[minmax(0,1fr)_110px] gap-2 pl-6">
              <select name="datum" className="input input-sm" aria-label="Tag">
                {termin.tage.map((t) => (
                  <option key={t.wert} value={t.wert}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input type="time" name="zeit" step={600} className="input input-sm num" aria-label="Uhrzeit" />
            </span>
          </fieldset>
          <label className="field">
            <span className="label">Notiz (freiwillig)</span>
            <input name="notiz" maxLength={200} className="input" placeholder={schueler ? "z. B. Schularbeit am Dienstag" : "z. B. Wunsch der Eltern"} />
          </label>
          <button className="btn btn-primary btn-sm justify-self-start">Verschieben anfragen</button>
        </form>
        {termin.tausch.length > 0 && (
          <form action={aktion} className="grid content-start gap-3">
            <input type="hidden" name="art" value="tauschen" />
            <input type="hidden" name="platz_id" value={termin.id} />
            {zurueck && <input type="hidden" name="zurueck" value={zurueck} />}
            <label className="field">
              <span className="label">Tauschen mit</span>
              <select name="partner_platz_id" className="input" required>
                {termin.tausch.map((t) => (
                  <option key={t.wert} value={t.wert}>
                    {t.label}
                  </option>
                ))}
              </select>
              <span className="text-[12px] text-ink-3">{schueler ? "Ein anderer Termin bei deinem Lehrer. Die andere Seite muss zustimmen." : "Die andere Seite (Schüler oder Lehrer) muss zustimmen."}</span>
            </label>
            <label className="field">
              <span className="label">Notiz (freiwillig)</span>
              <input name="notiz" maxLength={200} className="input" />
            </label>
            <button className="btn btn-secondary btn-sm justify-self-start">Tausch anfragen</button>
          </form>
        )}
      </div>
      <p className="mt-2 text-[13px] text-ink-2">Die Verwaltung bestätigt jede Änderung. Bis dahin bleibt der Termin, wie er ist.</p>
    </details>
  );
}

const ART_TITEL = { verschieben: "Verschieben", tauschen: "Tausch" } as const;

/**
 * Die Anfragen mit Zustand und, wo es geht, den Knöpfen. `aktionen` liefert je Anfrage die Server Actions:
 * zustimmen/ablehnen/zurückziehen (Schüler: ohne Grund; Lehrer: Ablehnen mit Grund) und bestätigen (Verwaltung).
 */
export function AnfragenListe({
  anfragen,
  antwort,
  bestaetigen,
  zurueck,
  schueler = false,
  raeume = [],
}: {
  anfragen: AnfrageSicht[];
  /** Schüler: (id, was) gebunden; Lehrer: (id) gebunden, `was` kommt vom Knopf */
  antwort: (a: AnfrageSicht, was: "zustimmen" | "ablehnen" | "zurueckziehen") => Aktion;
  bestaetigen?: (a: AnfrageSicht) => Aktion;
  zurueck?: string;
  schueler?: boolean;
  raeume?: { id: number; name: string; building: string }[];
}) {
  return (
    <ul className="panel divide-y divide-line" data-testid="anfragen">
      {anfragen.map((a) => {
        const partnerSicht = a.rolle === "partner";
        const titel = partnerSicht ? (schueler ? "Tauschanfrage an dich" : "Tausch angefragt, du bist die andere Seite") : ART_TITEL[a.art];
        const namen = !schueler && a.schueler ? (a.art === "tauschen" ? `${a.schueler} ↔ ${a.partnerSchueler ?? ""}` : a.schueler) : null;
        return (
          <li key={a.id} className="grid gap-1.5 px-4 py-3 text-[14px]">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {a.art === "tauschen" ? <ArrowLeftRight size={16} className="shrink-0 text-accent" aria-hidden /> : <CalendarSync size={16} className="shrink-0 text-accent" aria-hidden />}
              <span className="font-semibold">{titel}</span>
              {namen && <span className="text-ink-2">· {namen}{a.lehrer ? ` · bei ${a.lehrer}` : ""}</span>}
              <Pill tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Pill>
            </span>
            {a.art === "tauschen" && !(schueler && partnerSicht) ? (
              <span className="num flex flex-wrap items-center gap-x-2">
                {a.von} <ArrowLeftRight size={14} className="text-ink-3" aria-label="getauscht mit" /> {a.anderer}
              </span>
            ) : (
              <span className="num flex flex-wrap items-center gap-x-2">
                {partnerSicht && schueler && <span className="text-ink-2">Dein Termin</span>}
                {a.von} <ArrowRight size={14} className="text-ink-3" aria-label="neu" /> {a.nach}
              </span>
            )}
            {a.notiz && <span className="text-ink-2">Notiz: {a.notiz}</span>}
            {a.status === "abgelehnt" && a.grund && <span className="text-red">Grund: {a.grund}</span>}
            {(a.kannZustimmen || a.kannAblehnen || a.kannZurueckziehen || a.kannBestaetigen) && (
              <span className="mt-1 flex flex-wrap items-start gap-2">
                {a.kannBestaetigen && bestaetigen && (
                  <form action={bestaetigen(a)} className="flex flex-wrap items-center gap-2">
                    {zurueck && <input type="hidden" name="zurueck" value={zurueck} />}
                    {a.art === "verschieben" && raeume.length > 0 && (
                      <select name="room_id" className="input input-sm" defaultValue={String(a.zielRaumId ?? a.raumId ?? "")} aria-label="Raum">
                        {raeume.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} · {r.building}
                          </option>
                        ))}
                        {a.raumId === null && <option value="">ohne Raum</option>}
                      </select>
                    )}
                    <button className="btn btn-primary btn-sm">Bestätigen</button>
                  </form>
                )}
                {a.kannZustimmen && (
                  <form action={antwort(a, "zustimmen")}>
                    <input type="hidden" name="was" value="zustimmen" />
                    {zurueck && <input type="hidden" name="zurueck" value={zurueck} />}
                    <button className="btn btn-primary btn-sm">Zustimmen</button>
                  </form>
                )}
                {a.kannAblehnen &&
                  (schueler ? (
                    <form action={antwort(a, "ablehnen")}>
                      <button className="btn btn-secondary btn-sm">Ablehnen</button>
                    </form>
                  ) : (
                    <details className="group">
                      <summary className="btn btn-secondary btn-sm list-none">Ablehnen</summary>
                      <form action={antwort(a, "ablehnen")} className="mt-2 flex flex-wrap items-center gap-2">
                        <input type="hidden" name="was" value="ablehnen" />
                        {zurueck && <input type="hidden" name="zurueck" value={zurueck} />}
                        <input name="grund" required maxLength={200} className="input input-sm min-w-0 flex-1" placeholder="Kurzer Grund, z. B. Raum belegt" aria-label="Grund" />
                        <button className="btn btn-danger btn-sm">Ablehnen</button>
                      </form>
                    </details>
                  ))}
                {a.kannZurueckziehen && (
                  <form action={antwort(a, "zurueckziehen")}>
                    <input type="hidden" name="was" value="zurueckziehen" />
                    {zurueck && <input type="hidden" name="zurueck" value={zurueck} />}
                    <button className="btn btn-ghost btn-sm">Zurückziehen</button>
                  </form>
                )}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
