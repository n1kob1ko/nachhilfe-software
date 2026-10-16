"use client";

/**
 * Das Gitter der Wochenansicht: Zeilen = Lehrer, Spalten = die sieben Tage, Höhe = Zeit auf einem
 * 10-Minuten-Raster (D19). Es zeichnet nur; gerechnet wird im Server (`lib/planung/uebersicht.ts`).
 *
 * Ziehen und Ablegen: Ein Platz wird gezogen, die Zelle unter dem Zeiger meldet ihre Position
 * (`onDragOverZelle`), die Seite fragt damit `checkSlotTargetAction` — und die antwortet über
 * `repo.pruefeUeberlappung`, der **einzigen** Überlappungsprüfung der App. Ein unzulässiges Ziel
 * wird rot ausgeblendet und nimmt nichts an; ein zulässiges zeigt den Platz als Umriss.
 */
import { Fragment } from "react";
import { Lock, Pencil } from "lucide-react";
import { deleteSlotAction, lockSlotAction } from "@/app/planung-actions";
import { subjectTone } from "@/components/Calendar";
import type { UebersichtLehrer, UebersichtLuecke, UebersichtPlatz, UebersichtSchueler, UebersichtTage } from "@/lib/planung/uebersicht";
import type { Verfuegbarkeit } from "@/lib/planung/verfuegbarkeit";
import { auf10, minutenLabel, type Wochentag } from "@/lib/planung/zeit";

/** Pixel je Minute — 0,8 px macht aus 100 Minuten 80 px Höhe. */
export const MINUTEN_HOEHE = 0.8;
/** Raster der Startzeiten in Minuten (D19: Vielfache von 10). */
export const RASTER = 10;

const SPALTE_ZEIT = 46;
const SPALTE_LEHRER = 132;
const SPALTE_TAG = 104;

export type Ziel = { teacherId: number; weekday: Wochentag; startMin: number };
export type Urteil = { ziel: Ziel; ok: boolean; fehler?: string };

export const zielSchluessel = (z: Ziel) => `${z.teacherId}|${z.weekday}|${z.startMin}`;

/** Der sichtbare Zeitbereich: mindestens 08:00–18:00, sonst alles, was Plätze oder Verfügbarkeit brauchen. */
export function anzeigeBereich(plaetze: { startMin: number; dauer: number }[], lehrer: { verfuegbarkeit: Verfuegbarkeit }[]): { von: number; bis: number } {
  let von = 8 * 60;
  let bis = 18 * 60;
  const merken = (start: number, ende: number) => {
    von = Math.min(von, start);
    bis = Math.max(bis, ende);
  };
  for (const p of plaetze) merken(p.startMin, p.startMin + p.dauer);
  for (const l of lehrer)
    for (const spannen of Object.values(l.verfuegbarkeit)) for (const spanne of spannen ?? []) merken(spanne.start, spanne.end);
  von = Math.max(0, Math.floor(von / 60) * 60);
  bis = Math.min(1440, Math.ceil(bis / 60) * 60);
  return { von, bis: Math.max(bis, von + 240) };
}

/** Die Startzeit unter dem Zeiger, auf das 10-Minuten-Raster gezogen (`auf10`, D19). */
export function startAusY(clientY: number, obenImDokument: number, bereich: { von: number; bis: number }): number {
  const roh = bereich.von + (clientY - obenImDokument) / MINUTEN_HOEHE;
  return Math.max(0, Math.min(1430, auf10(roh)));
}

type Props = {
  tage: UebersichtTage[];
  heute: Wochentag;
  lehrer: UebersichtLehrer[];
  plaetze: UebersichtPlatz[];
  schueler: UebersichtSchueler[];
  luecken: UebersichtLuecke[];
  bereich: { von: number; bis: number };
  /** Verwaltung: ziehen, sperren, öffnen. Ein Lehrer sieht nur zu. */
  interaktiv: boolean;
  ziehPlatz: UebersichtPlatz | null;
  ziel: Ziel | null;
  urteil: Urteil | null;
  woche: string;
  zurueck: string;
  onZiehen: (p: UebersichtPlatz) => void;
  onZiehenEnde: () => void;
  onZellenZiel: (z: Ziel) => void;
  onZellenVerlassen: () => void;
  onAblegen: (z: Ziel) => void;
  onBearbeiten: (p: UebersichtPlatz) => void;
};

export function WochenplanGitter(props: Props) {
  const { tage, heute, lehrer, plaetze, schueler, luecken, bereich, interaktiv, ziehPlatz, ziel, urteil, woche, zurueck, onZiehen, onZiehenEnde, onZellenZiel, onZellenVerlassen, onAblegen, onBearbeiten } = props;
  const hoehe = (bereich.bis - bereich.von) * MINUTEN_HOEHE;
  const rasterPx = RASTER * MINUTEN_HOEHE;
  const stundePx = 60 * MINUTEN_HOEHE;
  const stunden: number[] = [];
  for (let m = Math.ceil(bereich.von / 60) * 60; m <= bereich.bis; m += 60) stunden.push(m);

  if (!lehrer.length)
    return (
      <p className="panel px-5 py-6 text-[15px] text-ink-2">
        Kein Lehrer für diese Woche. Verfügbarkeit pflegt die Verwaltung unter Mehr › Lehrer &amp; Verfügbarkeit.
      </p>
    );

  return (
    <div className="overflow-x-auto rounded-[20px] border border-line bg-surface shadow-[var(--shadow-card)]">
      <div style={{ minWidth: SPALTE_ZEIT + SPALTE_LEHRER + 7 * SPALTE_TAG }}>
        <div className="grid" style={{ gridTemplateColumns: `${SPALTE_ZEIT}px ${SPALTE_LEHRER}px repeat(7, minmax(${SPALTE_TAG}px, 1fr))` }}>
          <div className="sticky top-0 left-0 z-30 border-r border-b border-line bg-surface" aria-hidden />
          <div className="sticky top-0 z-20 border-r border-b border-line bg-surface px-2 py-2 text-[12px] font-semibold text-ink-2">Lehrer</div>
          {tage.map((t) => (
            <div
              key={t.tag}
              className={`sticky top-0 z-20 border-r border-b border-line px-1.5 py-2 text-center last:border-r-0 ${t.tag === heute ? "bg-accent-wash" : "bg-surface"}`}
            >
              <div className={`text-[12px] font-semibold ${t.tag === heute ? "text-accent" : "text-ink"}`}>{t.label}</div>
            </div>
          ))}

          {lehrer.map((l) => (
            <Fragment key={l.id}>
              {/* Zeitleiste dieser Zeile */}
              <div className="relative border-r border-b border-line bg-panel/40" style={{ height: hoehe }}>
                {stunden.map((m) => (
                  <span key={m} className="num absolute right-1.5 -translate-y-1/2 text-[10px] text-ink-3" style={{ top: (m - bereich.von) * MINUTEN_HOEHE }}>
                    {minutenLabel(m)}
                  </span>
                ))}
              </div>

              {/* Lehrername und Kennzahlen */}
              <div className="sticky left-0 z-10 border-r border-b border-line bg-surface px-2 py-2" style={{ height: hoehe }}>
                <div className="text-[13px] font-semibold text-ink">{l.name}</div>
                <div className="num text-[11px] text-ink-3">
                  {l.einheiten} {l.einheiten === 1 ? "Einheit" : "Einheiten"} · {l.minuten} min
                </div>
                {l.zielMin ? (
                  <div className="num text-[11px] text-ink-3">
                    Ziel {l.zielMin} min ({Math.round((l.minuten / l.zielMin) * 100)} %)
                  </div>
                ) : null}
                {l.lueckenMinuten > 0 ? <div className="num text-[11px] text-amber">Lücken {l.lueckenMinuten} min</div> : null}
              </div>

              {tage.map((t) => {
                const meine = plaetze.filter((p) => p.teacherId === l.id && p.weekday === t.tag);
                const meineLuecken = luecken.filter((x) => x.teacherId === l.id && x.weekday === t.tag);
                const spannen = l.verfuegbarkeit[String(t.tag) as keyof Verfuegbarkeit] ?? [];
                const zielHier = ziel && ziel.teacherId === l.id && ziel.weekday === t.tag ? ziel : null;
                const urteilHier = zielHier && urteil && zielSchluessel(urteil.ziel) === zielSchluessel(zielHier) ? urteil : null;
                const ungueltig = urteilHier?.ok === false;
                const ziehDauer = ziehPlatz?.dauer ?? 100;

                return (
                  <div
                    key={`${l.id}-${t.tag}`}
                    className={`relative border-r border-b border-line ${ungueltig ? "cursor-not-allowed ring-1 ring-inset ring-red" : interaktiv && ziehPlatz ? "cursor-copy" : ""}`}
                    style={{
                      height: hoehe,
                      backgroundImage: `repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px ${rasterPx}px), repeating-linear-gradient(to bottom, var(--line-strong) 0 1px, transparent 1px ${stundePx}px)`,
                    }}
                    title={ungueltig ? urteilHier?.fehler : undefined}
                    onDragOver={(e) => {
                      if (!interaktiv || !ziehPlatz) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      onZellenZiel({ teacherId: l.id, weekday: t.tag, startMin: startAusY(e.clientY, e.currentTarget.getBoundingClientRect().top, bereich) });
                    }}
                    onDragLeave={(e) => {
                      const naechstes = e.relatedTarget as Node | null;
                      if (naechstes && e.currentTarget.contains(naechstes)) return;
                      onZellenVerlassen();
                    }}
                    onDrop={(e) => {
                      if (!interaktiv || !ziehPlatz) return;
                      e.preventDefault();
                      onAblegen({ teacherId: l.id, weekday: t.tag, startMin: startAusY(e.clientY, e.currentTarget.getBoundingClientRect().top, bereich) });
                    }}
                  >
                    {/* Verfügbarkeit des Lehrers */}
                    {spannen.map((s, i) => (
                      <div
                        key={`v${i}`}
                        className="absolute inset-x-0"
                        style={{ top: (Math.max(s.start, bereich.von) - bereich.von) * MINUTEN_HOEHE, height: (Math.min(s.end, bereich.bis) - Math.max(s.start, bereich.von)) * MINUTEN_HOEHE, background: "var(--green-wash)", opacity: 0.5 }}
                        aria-hidden
                      />
                    ))}

                    {/* Lücken, die als unnütz gelten */}
                    {meineLuecken.map((x, i) => (
                      <div
                        key={`l${i}`}
                        className="absolute inset-x-0 flex items-center justify-center"
                        style={{ top: (x.start - bereich.von) * MINUTEN_HOEHE, height: (x.end - x.start) * MINUTEN_HOEHE, background: "var(--amber-wash)", opacity: 0.85 }}
                        title={`Lücke ${x.end - x.start} min`}
                      >
                        <span className="num text-[9px] text-amber">{x.end - x.start}′</span>
                      </div>
                    ))}

                    {/* Geplante Einheiten */}
                    <div className={ungueltig ? "opacity-50" : ""}>
                      {meine.map((p) => {
                        const tone = subjectTone(schueler.find((s) => s.id === p.studentId)?.subjects[0]);
                        const blockHoehe = Math.max(16, p.dauer * MINUTEN_HOEHE);
                        const kompakt = blockHoehe < 46;
                        return (
                          <div
                            key={p.id}
                            draggable={interaktiv}
                            onDragStart={(e) => {
                              if ((e.target as HTMLElement).closest("button, a")) {
                                e.preventDefault();
                                return;
                              }
                              e.dataTransfer.setData("text/plain", String(p.id));
                              e.dataTransfer.effectAllowed = "move";
                              onZiehen(p);
                            }}
                            onDragEnd={onZiehenEnde}
                            className={`group absolute left-1 right-1 z-10 overflow-hidden rounded-[10px] border px-1.5 py-0.5 text-left text-[11px] leading-tight ${interaktiv ? "cursor-grab" : ""} ${p.locked ? "ring-1 ring-accent" : ""} ${p.status === "entwurf" ? "border-dashed" : "border-solid"} ${p.nichtStattgefunden ? "opacity-60" : ""}`}
                            style={{ top: (p.startMin - bereich.von) * MINUTEN_HOEHE, height: blockHoehe, background: tone.soft, borderColor: tone.bg, color: tone.fg }}
                            title={`${p.studentName} · ${minutenLabel(p.startMin)}–${minutenLabel(p.startMin + p.dauer)}${p.roomName ? ` · ${p.roomName}` : ""}${p.locked ? " · gesperrt" : ""}${p.nichtStattgefunden ? " · nicht stattgefunden" : ""}`}
                          >
                            <div className="flex items-center gap-1">
                              <span className="min-w-0 truncate font-semibold">{p.studentName}</span>
                              {p.locked && (
                                <span
                                  className="ml-auto flex shrink-0 items-center gap-0.5 rounded-full px-1 text-[9px] font-semibold"
                                  style={{ background: "var(--surface)" }}
                                  title="Gesperrt: bleibt bei „Neu generieren“ stehen"
                                >
                                  <Lock size={9} strokeWidth={2.6} aria-hidden /> gesperrt
                                </span>
                              )}
                            </div>
                            {!kompakt && (
                              <div className="num truncate">
                                {minutenLabel(p.startMin)}–{minutenLabel(p.startMin + p.dauer)}
                                {p.roomName ? ` · ${p.roomName}` : ""}
                              </div>
                            )}
                            {p.nichtStattgefunden && !kompakt && <div className="truncate font-semibold">nicht stattgefunden</div>}
                            {interaktiv && (
                              <div className="absolute top-0 right-0 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                                <button type="button" className="rounded bg-surface/90 p-0.5 text-ink-2 hover:text-accent" aria-label={`${p.studentName} bearbeiten`} onClick={() => onBearbeiten(p)}>
                                  <Pencil size={11} aria-hidden />
                                </button>
                                <form action={lockSlotAction.bind(null, p.id, !p.locked)}>
                                  <input type="hidden" name="woche" value={woche} />
                                  <input type="hidden" name="zurueck" value={zurueck} />
                                  <button type="submit" className="rounded bg-surface/90 p-0.5 text-ink-2 hover:text-accent" aria-label={p.locked ? `${p.studentName} entsperren` : `${p.studentName} sperren`}>
                                    <Lock size={11} aria-hidden />
                                  </button>
                                </form>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Ziel des Ziehvorgangs: Umriss oder Absage */}
                    {zielHier && ziehPlatz && (
                      urteilHier?.ok === false ? (
                        <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center pt-1" style={{ background: "var(--red-wash)", opacity: 0.7 }}>
                          <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-red">nicht möglich</span>
                        </div>
                      ) : (
                        <div
                          className="pointer-events-none absolute left-1 right-1 z-20 rounded-[10px] border-2 border-dashed border-accent bg-accent-wash/70 px-1.5 py-0.5 text-[11px]"
                          style={{ top: (zielHier.startMin - bereich.von) * MINUTEN_HOEHE, height: Math.max(16, ziehDauer * MINUTEN_HOEHE) }}
                        >
                          <span className="num font-semibold text-accent">{minutenLabel(zielHier.startMin)}</span>
                          <span className="truncate"> {ziehPlatz.studentName}</span>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Die Lösch-Aktion eines Platzes als eigenes Formular — im Bearbeiten-Dialog benutzt. */
export function LoeschenFormular({ id, woche, zurueck }: { id: number; woche: string; zurueck: string }) {
  return (
    <form action={deleteSlotAction.bind(null, id)}>
      <input type="hidden" name="woche" value={woche} />
      <input type="hidden" name="zurueck" value={zurueck} />
      <button type="submit" className="btn btn-danger btn-sm">
        Platz löschen
      </button>
    </form>
  );
}
