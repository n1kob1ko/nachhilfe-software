"use client";

/**
 * Das Gitter der Wochenansicht (ab Laptop-Breite; darunter `WochenplanTage.tsx`): je Lehrer ein Band
 * mit seinen Kennzahlen und darunter seine Zeile, Spalten = die Tage, Höhe = Zeit. Jeder Lehrer zeigt
 * nur seine Arbeitszeit (Verfügbarkeit und Plätze), Samstag/Sonntag erscheinen nur, wenn dort jemand
 * kann oder etwas steht, und die Tageszeile bleibt beim Scrollen oben stehen. Volle Stunden sind
 * Linien, das 10-Minuten-Raster (D19) erscheint erst beim Ziehen. Es zeichnet nur; gerechnet wird im
 * Server (`lib/planung/uebersicht.ts`).
 *
 * Für die Verwaltung: Ein Klick auf einen Platz öffnet ihn, ein Klick auf freie Zeit legt dort einen
 * neuen an (der Umriss unter dem Zeiger zeigt, wo), das Schloss erscheint beim Darüberfahren.
 *
 * Ziehen und Ablegen: Ein Platz wird gezogen, die Zelle unter dem Zeiger meldet ihre Position
 * (`onDragOverZelle`), die Seite fragt damit `checkSlotTargetAction` — und die antwortet über
 * `repo.pruefeUeberlappung`, der **einzigen** Überlappungsprüfung der App. Ein unzulässiges Ziel
 * wird rot ausgeblendet und nimmt nichts an; ein zulässiges zeigt den Platz als Umriss.
 */
import { Fragment, useState } from "react";
import { Lock, LockOpen, Plus, Users } from "lucide-react";
import { lockSlotAction } from "@/app/planung-actions";
import { subjectTone } from "@/components/Calendar";
import { anzeigeBereich } from "@/lib/planung/ansicht";
import type { UebersichtLehrer, UebersichtLuecke, UebersichtPlatz, UebersichtSchueler, UebersichtTage } from "@/lib/planung/uebersicht";
import type { Verfuegbarkeit } from "@/lib/planung/verfuegbarkeit";
import { auf10, minutenLabel, type Wochentag } from "@/lib/planung/zeit";

/** Pixel je Minute — 0,8 px macht aus 100 Minuten 80 px Höhe. */
export const MINUTEN_HOEHE = 0.8;
/** Raster der Startzeiten in Minuten (D19: Vielfache von 10). */
export const RASTER = 10;

const SPALTE_ZEIT = 52;

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
export const SCHRAFFUR = "repeating-linear-gradient(135deg, var(--paper) 0 7px, var(--panel) 7px 8px)";

type Props = {
  tage: UebersichtTage[];
  /** Heutiger Wochentag, nur wenn die gezeigte Woche läuft. */
  heute: Wochentag | null;
  lehrer: UebersichtLehrer[];
  plaetze: UebersichtPlatz[];
  schueler: UebersichtSchueler[];
  luecken: UebersichtLuecke[];
  /** Verwaltung: ziehen, sperren, öffnen, anlegen. Ein Lehrer sieht nur zu. */
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
  /** Ein Klick auf freie Zeit: einen neuen Platz an dieser Stelle anlegen. */
  onNeu: (z: Ziel) => void;
};

/** Gehört das Ereignis zu einem Platz (oder seinem Schloss)? Dann legt ein Klick keinen neuen an. */
const aufPlatz = (ziel: EventTarget | null) => !!(ziel as HTMLElement | null)?.closest?.("[data-platz]");

export function WochenplanGitter(props: Props) {
  const { tage, heute, lehrer, plaetze, schueler, luecken, interaktiv, ziehPlatz, ziel, urteil, woche, zurueck, onZiehen, onZiehenEnde, onZellenZiel, onZellenVerlassen, onAblegen, onBearbeiten, onNeu } = props;
  // wo ein Klick einen neuen Platz anlegen würde: ein gestrichelter Umriss unter dem Zeiger
  const [vorschau, setVorschau] = useState<Ziel | null>(null);
  const stundePx = 60 * MINUTEN_HOEHE;
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
    // `overflow-clip` statt `overflow-auto`: Die Tageszeile kann so am oberen Rand kleben bleiben.
    <div className="overflow-clip rounded-[20px] border border-line bg-surface shadow-[var(--shadow-card)]">
      <div className="grid" style={{ gridTemplateColumns: `${SPALTE_ZEIT}px repeat(${tage.length}, minmax(0, 1fr))` }}>
        <div className="sticky top-0 z-30 border-b border-line bg-surface" aria-hidden />
        {tage.map((t) => {
          const [kurz, datum] = t.label.split(", ");
          const istHeute = t.tag === heute;
          return (
            <div key={t.tag} className={`sticky top-0 z-30 border-b border-l border-line px-2 py-2.5 text-center ${istHeute ? "bg-accent-wash" : "bg-surface"}`}>
              <div className={`text-[13px] font-semibold ${istHeute ? "text-accent" : "text-ink"}`}>
                {kurz}
                {istHeute && <span className="sr-only">, heute</span>}
              </div>
              <div className={`num text-[11.5px] ${istHeute ? "text-accent" : "text-ink-3"}`}>{datum}</div>
            </div>
          );
        })}

        {lehrer.map((l) => {
          // jeder Lehrer bekommt seinen eigenen Zeitbereich: wer nur nachmittags kann, kostet keinen Vormittag
          const bereich = anzeigeBereich(
            plaetze.filter((p) => p.teacherId === l.id),
            [l],
          );
          const hoehe = (bereich.bis - bereich.von) * MINUTEN_HOEHE;
          const stunden: number[] = [];
          for (let m = Math.ceil(bereich.von / 60) * 60; m < bereich.bis; m += 60) stunden.push(m);
          return (
            <Fragment key={l.id}>
              {/* Band des Lehrers: Name und Kennzahlen */}
              <div className="col-span-full flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-panel/70 px-4 py-2">
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

              {/* Zeitleiste dieser Zeile: die Uhrzeit steht unter ihrer Linie */}
              <div className="relative border-b border-line bg-surface" style={{ height: hoehe }} aria-hidden>
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
                const vorschauHier = !ziehPlatz && vorschau && vorschau.teacherId === l.id && vorschau.weekday === t.tag ? vorschau : null;
                const zeitUnterZeiger = (e: React.MouseEvent<HTMLDivElement>) => startAusY(e.clientY, e.currentTarget.getBoundingClientRect().top, bereich);

                return (
                  <div
                    key={`${l.id}-${t.tag}`}
                    className={`relative border-b border-l border-line ${ungueltig ? "cursor-not-allowed ring-1 ring-red ring-inset" : interaktiv && ziehPlatz ? "cursor-copy" : interaktiv ? "cursor-pointer" : ""}`}
                    style={{ height: hoehe, background: SCHRAFFUR }}
                    title={ungueltig ? urteilHier?.fehler : undefined}
                    onMouseMove={(e) => {
                      if (!interaktiv || ziehPlatz) return;
                      if (aufPlatz(e.target)) {
                        if (vorschau) setVorschau(null);
                        return;
                      }
                      const neu: Ziel = { teacherId: l.id, weekday: t.tag, startMin: zeitUnterZeiger(e) };
                      setVorschau((alt) => (alt && zielSchluessel(alt) === zielSchluessel(neu) ? alt : neu));
                    }}
                    onMouseLeave={() => setVorschau(null)}
                    onClick={(e) => {
                      if (!interaktiv || ziehPlatz || aufPlatz(e.target)) return;
                      onNeu({ teacherId: l.id, weekday: t.tag, startMin: zeitUnterZeiger(e) });
                    }}
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

                    {/* Wo ein Klick einen neuen Platz anlegt; außerhalb der Verfügbarkeit gedämpft */}
                    {vorschauHier &&
                      (() => {
                        const kann = spannen.some((s) => s.start <= vorschauHier.startMin && vorschauHier.startMin < s.end);
                        return (
                          <div
                            className={`pointer-events-none absolute right-1 left-1 z-[5] rounded-[10px] border border-dashed px-2 py-1 ${kann ? "border-accent-bright bg-accent-wash/60" : "border-ink-3 bg-surface/70"}`}
                            style={{ top: (vorschauHier.startMin - bereich.von) * MINUTEN_HOEHE, height: 60 * MINUTEN_HOEHE }}
                            aria-hidden
                          >
                            <span className={`num flex items-center gap-1 text-[11.5px] font-semibold ${kann ? "text-accent" : "text-ink-3"}`}>
                              <Plus size={12} strokeWidth={2.6} /> {minutenLabel(vorschauHier.startMin)}
                              {!kann && <span className="font-medium">· kann nicht</span>}
                            </span>
                          </div>
                        );
                      })()}

                    {/* Geplante Einheiten; zwei Schüler gleichzeitig (D26) stehen nebeneinander */}
                    <div className={ungueltig ? "opacity-50" : ""}>
                      {meine.map((p) => {
                        const tone = subjectTone(schueler.find((s) => s.id === p.studentId)?.subjects[0]);
                        const blockHoehe = Math.max(22, p.dauer * MINUTEN_HOEHE);
                        // so viele Textzeilen passen in den Block; der Name steht immer da
                        const zeilen = Math.floor((blockHoehe - 10) / 15);
                        const { spur, spuren } = spurNach.get(p.id) ?? { spur: 0, spuren: 1 };
                        const zugleich = p.zugleichMit.length ? ` · gleichzeitig mit ${p.zugleichMit.join(", ")}` : "";
                        const aus = p.nichtStattgefunden;
                        const oben = (p.startMin - bereich.von) * MINUTEN_HOEHE + 1;
                        const links = `calc(${(spur / spuren) * 100}% + ${spur ? 2 : 4}px)`;
                        const breite = `calc(${100 / spuren}% - ${spuren > 1 ? 6 : 8}px)`;
                        const zeit = `${minutenLabel(p.startMin)}–${minutenLabel(p.startMin + p.dauer)}`;
                        return (
                          // je Platz ein eigener Rahmen, damit `peer-hover` nur das eigene Schloss zeigt
                          <div key={p.id} className="contents">
                            <div
                              data-platz
                              draggable={interaktiv}
                              role={interaktiv ? "button" : undefined}
                              tabIndex={interaktiv ? 0 : undefined}
                              aria-label={interaktiv ? `${p.studentName}, ${zeit}${p.locked ? ", gesperrt" : ""}. Öffnen` : undefined}
                              onClick={interaktiv ? () => onBearbeiten(p) : undefined}
                              onKeyDown={
                                interaktiv
                                  ? (e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        onBearbeiten(p);
                                      }
                                    }
                                  : undefined
                              }
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", String(p.id));
                                e.dataTransfer.effectAllowed = "move";
                                setVorschau(null);
                                onZiehen(p);
                              }}
                              onDragEnd={onZiehenEnde}
                              className={`peer absolute z-10 overflow-hidden rounded-[10px] border px-2 py-1 text-left leading-tight shadow-[var(--shadow-card)] transition-shadow duration-150 ${
                                interaktiv ? "cursor-grab hover:shadow-[var(--shadow-pop)] active:cursor-grabbing" : ""
                              } ${p.status === "entwurf" ? "border-dashed" : "border-solid"}`}
                              style={{
                                top: oben,
                                height: blockHoehe - 2,
                                left: links,
                                width: breite,
                                background: aus ? "var(--paper)" : tone.bg,
                                borderColor: aus ? "var(--line-strong)" : `color-mix(in srgb, ${tone.fg} 35%, transparent)`,
                              }}
                              title={`${p.studentName} · ${zeit}${p.roomName ? ` · ${p.roomName}` : ""}${p.locked ? " · gesperrt" : ""}${zugleich}${aus ? " · nicht stattgefunden" : ""}`}
                            >
                              <div className="flex items-start gap-1 pr-0.5">
                                <span className={`min-w-0 flex-1 truncate text-[12.5px] font-semibold ${aus ? "text-ink-3 line-through" : "text-ink"}`}>{p.studentName}</span>
                                {zugleich && <Users size={11} strokeWidth={2.4} className="mt-0.5 shrink-0 text-ink-2" aria-label="gleichzeitig" />}
                                {p.locked && <Lock size={11} strokeWidth={2.4} className="mt-0.5 shrink-0 text-ink-2" aria-label="gesperrt" />}
                              </div>
                              {zeilen >= 2 && <div className="num truncate text-[11.5px] text-ink-2">{spuren > 1 ? minutenLabel(p.startMin) : zeit}</div>}
                              {zeilen >= 3 &&
                                (aus ? (
                                  <div className="truncate text-[10.5px] font-semibold text-red">nicht stattgefunden</div>
                                ) : (
                                  p.roomName && spuren === 1 && <div className="truncate text-[11.5px] text-ink-3">{p.roomName}</div>
                                ))}
                            </div>
                            {interaktiv && (
                              // das Schloss liegt über der rechten oberen Ecke des Platzes und erscheint beim Darüberfahren
                              <form
                                data-platz
                                action={lockSlotAction.bind(null, p.id, !p.locked)}
                                className="absolute z-20 opacity-0 transition-opacity duration-150 peer-hover:opacity-100 peer-focus-visible:opacity-100 focus-within:opacity-100 hover:opacity-100"
                                style={{ top: oben + 3, left: `calc(${links} + ${breite} - 27px)` }}
                              >
                                <input type="hidden" name="woche" value={woche} />
                                <input type="hidden" name="zurueck" value={zurueck} />
                                <button type="submit" className="drueck flex h-6 w-6 items-center justify-center rounded-md bg-surface text-ink-2 shadow-sm hover:text-accent" aria-label={p.locked ? `${p.studentName} entsperren` : `${p.studentName} sperren`} title={p.locked ? "Entsperren" : "Sperren: bleibt bei „Neu generieren“ stehen"}>
                                  {p.locked ? <LockOpen size={12} aria-hidden /> : <Lock size={12} aria-hidden />}
                                </button>
                              </form>
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
                          className="pointer-events-none absolute right-1 left-1 z-20 rounded-[10px] border-2 border-dashed border-accent bg-accent-wash/70 px-1.5 py-0.5 text-[11px]"
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
          );
        })}
      </div>
    </div>
  );
}
