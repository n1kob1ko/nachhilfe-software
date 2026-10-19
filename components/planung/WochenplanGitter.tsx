"use client";

/**
 * Das Gitter der Wochenansicht: je Lehrer ein Band mit seinen Kennzahlen und darunter seine Zeile,
 * Spalten = die Tage, Höhe = Zeit. Gezeigt wird nur die Arbeitszeit (Verfügbarkeit und Plätze) und
 * Samstag/Sonntag nur, wenn dort jemand kann oder etwas steht. Volle Stunden sind Linien, das
 * 10-Minuten-Raster (D19) erscheint erst beim Ziehen. Es zeichnet nur; gerechnet wird im Server
 * (`lib/planung/uebersicht.ts`).
 *
 * Ziehen und Ablegen: Ein Platz wird gezogen, die Zelle unter dem Zeiger meldet ihre Position
 * (`onDragOverZelle`), die Seite fragt damit `checkSlotTargetAction` — und die antwortet über
 * `repo.pruefeUeberlappung`, der **einzigen** Überlappungsprüfung der App. Ein unzulässiges Ziel
 * wird rot ausgeblendet und nimmt nichts an; ein zulässiges zeigt den Platz als Umriss.
 */
import { Fragment } from "react";
import { Lock, Pencil, Users } from "lucide-react";
import { deleteSlotAction, lockSlotAction } from "@/app/planung-actions";
import { subjectTone } from "@/components/Calendar";
import type { UebersichtLehrer, UebersichtLuecke, UebersichtPlatz, UebersichtSchueler, UebersichtTage } from "@/lib/planung/uebersicht";
import type { Verfuegbarkeit } from "@/lib/planung/verfuegbarkeit";
import { auf10, minutenLabel, type Wochentag } from "@/lib/planung/zeit";

/** Pixel je Minute — 0,8 px macht aus 100 Minuten 80 px Höhe. */
export const MINUTEN_HOEHE = 0.8;
/** Raster der Startzeiten in Minuten (D19: Vielfache von 10). */
export const RASTER = 10;

const SPALTE_ZEIT = 52;
const SPALTE_TAG = 116;

export type Ziel = { teacherId: number; weekday: Wochentag; startMin: number };
export type Urteil = { ziel: Ziel; ok: boolean; fehler?: string };

export const zielSchluessel = (z: Ziel) => `${z.teacherId}|${z.weekday}|${z.startMin}`;

/**
 * Zwei Schüler gleichzeitig (D26): Plätze einer Zelle, die sich überschneiden, stehen nebeneinander,
 * jeder in seiner Spur. `spuren` ist die Zahl der Spuren seiner Gruppe (1 = volle Breite).
 */
export function spurenFuer(plaetze: { id: number; startMin: number; dauer: number }[]): Map<number, { spur: number; spuren: number }> {
  const out = new Map<number, { spur: number; spuren: number }>();
  const sortiert = [...plaetze].sort((a, b) => a.startMin - b.startMin || a.id - b.id);
  let gruppe: typeof sortiert = [];
  let gruppenEnde = -1;
  const abschliessen = () => {
    const enden: number[] = [];
    const spur = new Map<number, number>();
    for (const p of gruppe) {
      let i = enden.findIndex((ende) => ende <= p.startMin);
      if (i === -1) i = enden.push(0) - 1;
      enden[i] = p.startMin + p.dauer;
      spur.set(p.id, i);
    }
    for (const p of gruppe) out.set(p.id, { spur: spur.get(p.id) ?? 0, spuren: enden.length });
  };
  for (const p of sortiert) {
    if (gruppe.length && p.startMin >= gruppenEnde) {
      abschliessen();
      gruppe = [];
      gruppenEnde = -1;
    }
    gruppe.push(p);
    gruppenEnde = Math.max(gruppenEnde, p.startMin + p.dauer);
  }
  if (gruppe.length) abschliessen();
  return out;
}

/** Die Startzeit unter dem Zeiger, auf das 10-Minuten-Raster gezogen (`auf10`, D19). */
export function startAusY(clientY: number, obenImDokument: number, bereich: { von: number; bis: number }): number {
  const roh = bereich.von + (clientY - obenImDokument) / MINUTEN_HOEHE;
  return Math.max(0, Math.min(1430, auf10(roh)));
}

/** Nicht verfügbare Zeit: feine Schraffur auf dem Papierton, damit freie Zeit weiß hervortritt. */
const SCHRAFFUR = "repeating-linear-gradient(135deg, var(--paper) 0 7px, var(--panel) 7px 8px)";

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
  const stundePx = 60 * MINUTEN_HOEHE;
  const stunden: number[] = [];
  for (let m = Math.ceil(bereich.von / 60) * 60; m < bereich.bis; m += 60) stunden.push(m);
  // volle Stunden als Linie; beim Ziehen zusätzlich das 10-Minuten-Raster, auf das abgelegt wird
  const linien = [
    `repeating-linear-gradient(to bottom, var(--line-strong) 0 1px, transparent 1px ${stundePx}px)`,
    ...(ziehPlatz ? [`repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px ${RASTER * MINUTEN_HOEHE}px)`] : []),
  ].join(", ");

  if (!lehrer.length)
    return (
      <p className="panel px-5 py-6 text-[15px] text-ink-2">
        Kein Lehrer für diese Woche. Verfügbarkeit pflegt die Verwaltung unter Mehr › Lehrer &amp; Verfügbarkeit.
      </p>
    );

  return (
    <div className="overflow-x-auto rounded-[20px] border border-line bg-surface shadow-[var(--shadow-card)]">
      <div className="grid" style={{ gridTemplateColumns: `${SPALTE_ZEIT}px repeat(${tage.length}, minmax(${SPALTE_TAG}px, 1fr))`, minWidth: SPALTE_ZEIT + tage.length * SPALTE_TAG }}>
        <div className="sticky left-0 z-30 border-b border-line bg-surface" aria-hidden />
        {tage.map((t) => {
          const [kurz, datum] = t.label.split(", ");
          const istHeute = t.tag === heute;
          return (
            <div key={t.tag} className={`border-b border-l border-line px-2 py-2.5 text-center ${istHeute ? "bg-accent-wash" : ""}`}>
              <div className={`text-[13px] font-semibold ${istHeute ? "text-accent" : "text-ink"}`}>{kurz}</div>
              <div className={`num text-[11.5px] ${istHeute ? "text-accent" : "text-ink-3"}`}>{datum}</div>
            </div>
          );
        })}

        {lehrer.map((l) => (
          <Fragment key={l.id}>
            {/* Band des Lehrers: Name und Kennzahlen, beim seitlichen Scrollen bleibt es stehen */}
            <div className="col-span-full border-b border-line bg-panel/70">
              <div className="sticky left-0 flex w-max max-w-[100vw] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
                <span className="text-[14px] font-semibold text-ink">{l.name}</span>
                <span className="num text-[12.5px] text-ink-2">
                  {l.einheiten} {l.einheiten === 1 ? "Einheit" : "Einheiten"} · {l.minuten} min
                </span>
                {l.zielMin ? (
                  <span className="flex items-center gap-2 text-[12.5px] text-ink-2" title={`Ziel: ${l.zielMin} min in der Woche`}>
                    <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-[var(--bar-track)]" aria-hidden>
                      <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--bar)]" style={{ width: `${Math.min(100, (l.minuten / l.zielMin) * 100)}%` }} />
                    </span>
                    <span className="num">
                      {Math.round((l.minuten / l.zielMin) * 100)} % vom Ziel {l.zielMin} min
                    </span>
                  </span>
                ) : null}
                {l.lueckenMinuten > 0 ? <span className="num text-[12.5px] font-medium text-amber">Lücken {l.lueckenMinuten} min</span> : null}
              </div>
            </div>

            {/* Zeitleiste dieser Zeile: die Uhrzeit steht unter ihrer Linie, die letzte fällt weg */}
            <div className="sticky left-0 z-20 border-b border-line bg-surface" style={{ height: hoehe }} aria-hidden>
              {stunden.map((m) => (
                <span key={m} className="num absolute right-2 text-[11px] leading-none text-ink-3" style={{ top: (m - bereich.von) * MINUTEN_HOEHE + 4 }}>
                  {minutenLabel(m)}
                </span>
              ))}
            </div>

            {tage.map((t) => {
              const meine = plaetze.filter((p) => p.teacherId === l.id && p.weekday === t.tag);
              const spurNach = spurenFuer(meine);
              const meineLuecken = luecken.filter((x) => x.teacherId === l.id && x.weekday === t.tag);
              const spannen = l.verfuegbarkeit[String(t.tag) as keyof Verfuegbarkeit] ?? [];
              const zielHier = ziel && ziel.teacherId === l.id && ziel.weekday === t.tag ? ziel : null;
              const urteilHier = zielHier && urteil && zielSchluessel(urteil.ziel) === zielSchluessel(zielHier) ? urteil : null;
              const ungueltig = urteilHier?.ok === false;
              const ziehDauer = ziehPlatz?.dauer ?? 100;

              return (
                <div
                  key={`${l.id}-${t.tag}`}
                  className={`relative border-b border-l border-line ${ungueltig ? "cursor-not-allowed ring-1 ring-inset ring-red" : interaktiv && ziehPlatz ? "cursor-copy" : ""}`}
                  style={{ height: hoehe, background: SCHRAFFUR }}
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
                  {/* Verfügbarkeit des Lehrers: weiß, der Rest bleibt schraffiert */}
                  {spannen.map((s, i) => (
                    <div
                      key={`v${i}`}
                      className="absolute inset-x-0 bg-surface"
                      style={{ top: (Math.max(s.start, bereich.von) - bereich.von) * MINUTEN_HOEHE, height: (Math.min(s.end, bereich.bis) - Math.max(s.start, bereich.von)) * MINUTEN_HOEHE }}
                      aria-hidden
                    />
                  ))}

                  {/* Stundenlinien über allem Flächigen, unter den Plätzen */}
                  <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: linien }} aria-hidden />

                  {/* Lücken, die als unnütz gelten */}
                  {meineLuecken.map((x, i) => (
                    <div
                      key={`l${i}`}
                      className="absolute inset-x-1 flex items-center justify-center rounded-md"
                      style={{ top: (x.start - bereich.von) * MINUTEN_HOEHE, height: (x.end - x.start) * MINUTEN_HOEHE, background: "var(--amber-wash)" }}
                      title={`Lücke ${x.end - x.start} min`}
                    >
                      <span className="num text-[10.5px] font-semibold text-amber">Lücke {x.end - x.start}′</span>
                    </div>
                  ))}

                  {/* Geplante Einheiten; zwei Schüler gleichzeitig (D26) stehen nebeneinander */}
                  <div className={ungueltig ? "opacity-50" : ""}>
                    {meine.map((p) => {
                      const tone = subjectTone(schueler.find((s) => s.id === p.studentId)?.subjects[0]);
                      const blockHoehe = Math.max(22, p.dauer * MINUTEN_HOEHE);
                      // so viele Textzeilen passen in den Block; der Name steht immer da
                      const zeilen = Math.floor((blockHoehe - 12) / 14);
                      const { spur, spuren } = spurNach.get(p.id) ?? { spur: 0, spuren: 1 };
                      const zugleich = p.zugleichMit.length ? ` · gleichzeitig mit ${p.zugleichMit.join(", ")}` : "";
                      const aus = p.nichtStattgefunden;
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
                          className={`group absolute z-10 overflow-hidden rounded-[10px] border px-2 py-1 text-left leading-tight shadow-[0_1px_2px_rgba(80,45,20,0.08)] ${interaktiv ? "cursor-grab" : ""} ${p.status === "entwurf" ? "border-dashed" : "border-solid"}`}
                          style={{
                            top: (p.startMin - bereich.von) * MINUTEN_HOEHE + 1,
                            height: blockHoehe - 2,
                            left: `calc(${(spur / spuren) * 100}% + ${spur ? 2 : 4}px)`,
                            width: `calc(${100 / spuren}% - ${spuren > 1 ? 6 : 8}px)`,
                            background: aus ? "var(--paper)" : tone.bg,
                            borderColor: aus ? "var(--line-strong)" : `color-mix(in srgb, ${tone.fg} 35%, transparent)`,
                          }}
                          title={`${p.studentName} · ${minutenLabel(p.startMin)}–${minutenLabel(p.startMin + p.dauer)}${p.roomName ? ` · ${p.roomName}` : ""}${p.locked ? " · gesperrt" : ""}${zugleich}${aus ? " · nicht stattgefunden" : ""}`}
                        >
                          <div className="flex items-start gap-1">
                            <span className={`min-w-0 flex-1 truncate text-[12px] font-semibold ${aus ? "text-ink-3 line-through" : "text-ink"}`}>{p.studentName}</span>
                            {zugleich && <Users size={11} strokeWidth={2.4} className="mt-0.5 shrink-0 text-ink-2" aria-label="gleichzeitig" />}
                            {p.locked && <Lock size={11} strokeWidth={2.4} className="mt-0.5 shrink-0 text-ink-2" aria-label="gesperrt" />}
                          </div>
                          {zeilen >= 2 && (
                            <div className="num truncate text-[11px] text-ink-2">
                              {spuren > 1 ? minutenLabel(p.startMin) : `${minutenLabel(p.startMin)}–${minutenLabel(p.startMin + p.dauer)}`}
                            </div>
                          )}
                          {zeilen >= 3 &&
                            (aus ? (
                              <div className="truncate text-[10.5px] font-semibold text-red">nicht stattgefunden</div>
                            ) : (
                              p.roomName && spuren === 1 && <div className="truncate text-[11px] text-ink-3">{p.roomName}</div>
                            ))}
                          {interaktiv && (
                            <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                              <button type="button" className="rounded-md bg-surface p-1 text-ink-2 shadow-sm hover:text-accent" aria-label={`${p.studentName} bearbeiten`} onClick={() => onBearbeiten(p)}>
                                <Pencil size={11} aria-hidden />
                              </button>
                              <form action={lockSlotAction.bind(null, p.id, !p.locked)}>
                                <input type="hidden" name="woche" value={woche} />
                                <input type="hidden" name="zurueck" value={zurueck} />
                                <button type="submit" className="rounded-md bg-surface p-1 text-ink-2 shadow-sm hover:text-accent" aria-label={p.locked ? `${p.studentName} entsperren` : `${p.studentName} sperren`}>
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
                        style={{ top: (zielHier.startMin - bereich.von) * MINUTEN_HOEHE, height: Math.max(22, ziehDauer * MINUTEN_HOEHE) }}
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
