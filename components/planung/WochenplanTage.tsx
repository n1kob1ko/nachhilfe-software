"use client";

/**
 * Die Wochenansicht für Telefon und Tablet: oben die Tage zum Antippen, darunter **ein** Tag als
 * Liste, je Lehrer seine Plätze und Lücken in zeitlicher Reihenfolge. Ein breites Gitter mit
 * seitlichem Scrollen ist auf kleinen Bildschirmen schwer zu lesen, und Ziehen geht mit dem Finger
 * nicht: Hier öffnet ein Tipp den Platz (Verschieben, Sperren, Löschen im Dialog).
 *
 * Es zeichnet nur; gerechnet wird im Server (`lib/planung/uebersicht.ts`), Reihenfolge und erster
 * Tag kommen aus `lib/planung/ansicht.ts`.
 */
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Lock, Plus, Users } from "lucide-react";
import { subjectTone } from "@/components/Calendar";
import { startTag, tagesListe } from "@/lib/planung/ansicht";
import type { UebersichtLehrer, UebersichtLuecke, UebersichtPlatz, UebersichtSchueler, UebersichtTage } from "@/lib/planung/uebersicht";
import type { Verfuegbarkeit } from "@/lib/planung/verfuegbarkeit";
import { minutenLabel, type Wochentag } from "@/lib/planung/zeit";

const LANGE_TAGE: Record<Wochentag, string> = { 1: "Montag", 2: "Dienstag", 3: "Mittwoch", 4: "Donnerstag", 5: "Freitag", 6: "Samstag", 7: "Sonntag" };

type Props = {
  tage: UebersichtTage[];
  /** Heutiger Wochentag, nur wenn die gezeigte Woche läuft. */
  heute: Wochentag | null;
  lehrer: UebersichtLehrer[];
  plaetze: UebersichtPlatz[];
  schueler: UebersichtSchueler[];
  luecken: UebersichtLuecke[];
  /** Verwaltung: Plätze öffnen und anlegen. Ein Lehrer sieht nur zu. */
  interaktiv: boolean;
  /** Nur Plätze zeigen, keine leeren Lehrer (z. B. wenn nach einem Schüler gefiltert wird). */
  nurBelegte: boolean;
  onOeffnen: (p: UebersichtPlatz) => void;
  neuHref: (teacherId: number, weekday: Wochentag) => string;
};

export function WochenplanTage({ tage, heute, lehrer, plaetze, schueler, luecken, interaktiv, nurBelegte, onOeffnen, neuHref }: Props) {
  const [gewaehlt, setGewaehlt] = useState<Wochentag>(() => startTag(tage, plaetze, heute));
  // a filter can hide the chosen day (e.g. the weekend): fall back to the first visible one
  const tag = tage.some((t) => t.tag === gewaehlt) ? gewaehlt : startTag(tage, plaetze, heute);

  const amTag = plaetze.filter((p) => p.weekday === tag);
  const gruppen = lehrer
    .map((l) => ({
      lehrer: l,
      spannen: l.verfuegbarkeit[String(tag) as keyof Verfuegbarkeit] ?? [],
      liste: tagesListe(
        amTag.filter((p) => p.teacherId === l.id),
        luecken.filter((x) => x.teacherId === l.id && x.weekday === tag),
      ),
    }))
    .filter((g) => g.liste.some((e) => e.art === "platz") || (!nurBelegte && g.spannen.length > 0));

  return (
    <div>
      {/* Die Tage der Woche: bleiben beim Scrollen oben stehen */}
      <div className="sticky top-0 z-20 -mx-4 bg-paper/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8" role="tablist" aria-label="Tag wählen">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${tage.length}, minmax(0, 1fr))` }}>
          {tage.map((t) => {
            const [kurz, datum] = t.label.split(", ");
            const anzahl = plaetze.filter((p) => p.weekday === t.tag).length;
            const aktiv = t.tag === tag;
            const istHeute = t.tag === heute;
            return (
              <button
                key={t.tag}
                type="button"
                role="tab"
                aria-selected={aktiv}
                aria-label={`${LANGE_TAGE[t.tag]}, ${datum}, ${anzahl === 1 ? "1 Einheit" : `${anzahl} Einheiten`}${istHeute ? ", heute" : ""}`}
                onClick={() => setGewaehlt(t.tag)}
                className={`drueck flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 py-1.5 ${
                  aktiv ? "border-transparent bg-accent text-on-fill shadow-[var(--shadow-card)]" : istHeute ? "border-accent-bright/50 bg-accent-wash text-ink" : "border-line bg-surface text-ink"
                }`}
              >
                <span className={`text-[12px] font-semibold ${aktiv ? "text-white/80" : istHeute ? "text-accent" : "text-ink-2"}`}>{kurz}</span>
                <span className="num display text-[17px] leading-none font-semibold">{datum?.split(".")[0]}</span>
                <span className={`num mt-0.5 h-[15px] text-[11px] leading-[15px] font-semibold ${aktiv ? "text-white/80" : "text-ink-3"}`} aria-hidden>
                  {anzahl > 0 ? anzahl : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" aria-label={LANGE_TAGE[tag]} className="mt-3 flex flex-col gap-5">
        {gruppen.length === 0 ? (
          <div className="panel px-5 py-6 text-center">
            <p className="text-[15px] font-semibold">Am {LANGE_TAGE[tag]} ist nichts geplant.</p>
            <p className="mt-1 text-[13.5px] text-ink-2">{lehrer.length ? "Kein Lehrer hat an diesem Tag Zeit eingetragen." : "Für diese Woche gibt es keinen Lehrer."}</p>
            {interaktiv && lehrer[0] && (
              <Link href={neuHref(lehrer[0].id, tag)} className="btn btn-secondary btn-sm mt-4">
                <Plus size={15} aria-hidden /> Platz anlegen
              </Link>
            )}
          </div>
        ) : (
          gruppen.map(({ lehrer: l, spannen, liste }) => (
            <section key={l.id} aria-label={l.name}>
              <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                <h3 className="text-[15px] font-semibold">{l.name}</h3>
                <span className="num text-[12.5px] text-ink-3">{spannen.length ? `kann ${spannen.map((s) => `${minutenLabel(s.start)}–${minutenLabel(s.end)}`).join(", ")}` : "keine Zeit eingetragen"}</span>
              </div>
              <ol className="flex flex-col gap-2">
                {liste.map((e) =>
                  e.art === "luecke" ? (
                    <li key={`l${e.luecke.start}`} className="num flex items-center justify-between rounded-xl bg-amber-wash px-3.5 py-2 text-[12.5px] font-medium text-amber">
                      <span>Lücke {e.luecke.end - e.luecke.start} min</span>
                      <span>
                        {minutenLabel(e.luecke.start)}–{minutenLabel(e.luecke.end)}
                      </span>
                    </li>
                  ) : (
                    <li key={e.platz.id}>
                      <PlatzZeile platz={e.platz} schueler={schueler} interaktiv={interaktiv} onOeffnen={onOeffnen} />
                    </li>
                  ),
                )}
                {liste.length === 0 && <li className="rounded-xl border border-dashed border-line-strong px-3.5 py-3 text-[13px] text-ink-3">Noch kein Platz an diesem Tag.</li>}
              </ol>
              {interaktiv && (
                <Link href={neuHref(l.id, tag)} className="btn btn-ghost btn-sm mt-1.5 !px-2 text-accent">
                  <Plus size={15} aria-hidden /> Platz bei {l.name}
                </Link>
              )}
            </section>
          ))
        )}
      </div>
    </div>
  );
}

/** Ein Platz als Zeile: Zeit links, Schüler und Raum in der Mitte; antippen öffnet ihn (Verwaltung). */
function PlatzZeile({ platz: p, schueler, interaktiv, onOeffnen }: { platz: UebersichtPlatz; schueler: UebersichtSchueler[]; interaktiv: boolean; onOeffnen: (p: UebersichtPlatz) => void }) {
  const tone = subjectTone(schueler.find((s) => s.id === p.studentId)?.subjects[0]);
  const aus = p.nichtStattgefunden;
  const inhalt = (
    <>
      <span className="num w-[50px] shrink-0 leading-tight">
        <span className="block text-[15px] font-semibold text-ink">{minutenLabel(p.startMin)}</span>
        <span className="block text-[12.5px] text-ink-2">{minutenLabel(p.startMin + p.dauer)}</span>
      </span>
      <span className="min-w-0 flex-1 leading-snug">
        <span className={`block truncate text-[15px] font-semibold ${aus ? "text-ink-3 line-through" : "text-ink"}`}>{p.studentName}</span>
        <span className="block truncate text-[13px] text-ink-2">
          {[p.roomName ? `${p.roomName}${p.roomMode === "online" ? " (online)" : ""}` : "kein Raum", `${p.dauer} min`, p.status === "entwurf" ? "Entwurf" : null].filter(Boolean).join(" · ")}
        </span>
        {p.zugleichMit.length > 0 && (
          <span className="mt-0.5 flex items-center gap-1 text-[12.5px] text-ink-2">
            <Users size={13} aria-hidden /> gleichzeitig mit {p.zugleichMit.join(", ")}
          </span>
        )}
        {aus && <span className="mt-0.5 block text-[12.5px] font-semibold text-red">nicht stattgefunden</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 self-center text-ink-2">
        {p.locked && <Lock size={15} aria-label="gesperrt" />}
        {interaktiv && <ChevronRight size={18} className="text-ink-3" aria-hidden />}
      </span>
    </>
  );
  const klasse = `flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left ${p.status === "entwurf" ? "border-dashed" : ""}`;
  const stil = { background: aus ? "var(--paper)" : tone.bg, borderColor: aus ? "var(--line-strong)" : `color-mix(in srgb, ${tone.fg} 30%, transparent)` };
  return interaktiv ? (
    <button type="button" className={`drueck ${klasse}`} style={stil} onClick={() => onOeffnen(p)} aria-label={`${p.studentName}, ${minutenLabel(p.startMin)} bis ${minutenLabel(p.startMin + p.dauer)}, öffnen`}>
      {inhalt}
    </button>
  ) : (
    <div className={klasse} style={stil}>
      {inhalt}
    </div>
  );
}
