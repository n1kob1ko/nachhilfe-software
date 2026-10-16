"use client";

/**
 * Die Wochenansicht (Phase 4): **eine** Ansicht mit Filtern statt der getrennten Seiten des
 * Quell-Repos — Zeilen = Lehrer, Spalten = Tage, 10-Minuten-Raster, Lückenschraffur, Sperrmarke,
 * Entwurfsrand, Ziehen mit ausgeblendeten unzulässigen Zielen, Seitenleiste, Offen-Schubfach,
 * Summenfuß und die Knöpfe Generieren / Neu generieren / Vorwoche übernehmen / Veröffentlichen /
 * Entwurf verwerfen.
 *
 * Die Rechte entscheiden die Server Actions (`lib/planung/aktionen.ts`, D23); hier wird nur
 * ausgeblendet, was ein Lehrer ohnehin nicht darf. Die Filter stehen in der Adresse, damit die
 * Rückleitung nach einer Aktion sie behält.
 */
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ListPlus, Printer, Settings2, Sparkles, TriangleAlert, Wand2 } from "lucide-react";
import { checkSlotTargetAction, copyPreviousWeekAction, discardDraftAction, generateWeekAction, moveSlotAction, publishWeekAction, regenerateWeekAction } from "@/app/planung-actions";
import { Pill } from "@/components/ui";
import type { WochenUebersicht } from "@/lib/planung/uebersicht";
import { minutenLabel, tagAddieren } from "@/lib/planung/zeit";
import { PlatzDialog } from "./PlatzDialog";
import { RegelnDialog } from "./RegelnDialog";
import { anzeigeBereich, WochenplanGitter, zielSchluessel, type Urteil, type Ziel } from "./WochenplanGitter";
import { OffenSchubfach, WochenplanFuss, WochenplanSeitenleiste } from "./WochenplanPanels";
import type { PlanungsRegeln } from "@/lib/planung/regeln";

export type PlanungFilterWerte = { lehrer: number; raum: number; schueler: number };

type Props = {
  uebersicht: WochenUebersicht;
  /** Verwaltung: alles darf geändert werden. Ein Lehrer sieht nur zu (D23). */
  darfBearbeiten: boolean;
  /** Pfad der Ansicht ohne Query, z. B. „/planung“ oder „/“ (Tab „Meine Woche“). */
  basisPfad: string;
  /** Der Link zum A4-Druck. */
  druckHref: string;
  /** Montag der laufenden Woche (Europe/Vienna) — für „Diese Woche“. */
  aktuelleWoche: string;
  zurueck: string;
  filter: PlanungFilterWerte;
  meldung: { ok?: string; fehler?: string };
  regeln: PlanungsRegeln;
  regelnGebrochen: boolean;
  /** `?neu=1`, `?platz=<id>` und `?regeln=1` — die Dialoge hängen an der Adresse. */
  dialog: { neu: boolean; platzId: number; regeln: boolean };
};

export function Wochenplan({ uebersicht, darfBearbeiten, basisPfad, druckHref, aktuelleWoche, zurueck, filter, meldung, regeln, regelnGebrochen, dialog }: Props) {
  const router = useRouter();
  const [ziehPlatz, setZiehPlatz] = useState<WochenUebersicht["plaetze"][number] | null>(null);
  const [ziel, setZiel] = useState<Ziel | null>(null);
  const [urteil, setUrteil] = useState<Urteil | null>(null);
  const [ziehFehler, setZiehFehler] = useState<string | null>(null);
  const [offenAuf, setOffenAuf] = useState(false);
  const geprueft = useRef(new Map<string, Urteil>());
  const versprechen = useRef(new Map<string, Promise<Urteil>>());

  const woche = uebersicht.woche;
  const status = uebersicht.status;

  /** Eine Adresse dieser Ansicht: Woche und Filter bleiben erhalten. */
  const url = (aenderung: Partial<PlanungFilterWerte> & { neu?: boolean; platz?: number; regeln?: boolean; woche?: string } = {}) => {
    const werte = { ...filter, ...aenderung };
    const teile = [`woche=${aenderung.woche ?? woche}`];
    if (werte.lehrer) teile.push(`lehrer=${werte.lehrer}`);
    if (werte.raum) teile.push(`raum=${werte.raum}`);
    if (werte.schueler) teile.push(`schueler=${werte.schueler}`);
    if (aenderung.neu) teile.push("neu=1");
    if (aenderung.platz) teile.push(`platz=${aenderung.platz}`);
    if (aenderung.regeln) teile.push("regeln=1");
    return `${basisPfad}${basisPfad.includes("?") ? "&" : "?"}${teile.join("&")}`;
  };

  // Filter: nur die Anzeige. Seitenleiste und Summen bleiben die ganze Woche (bzw. die Sicht der Rolle).
  const sichtbareLehrer = useMemo(() => (filter.lehrer ? uebersicht.lehrer.filter((l) => l.id === filter.lehrer) : uebersicht.lehrer), [uebersicht.lehrer, filter.lehrer]);
  const sichtbarePlaetze = useMemo(
    () =>
      uebersicht.plaetze.filter(
        (p) =>
          (!filter.lehrer || p.teacherId === filter.lehrer) &&
          (!filter.raum || p.roomId === filter.raum) &&
          (!filter.schueler || p.studentId === filter.schueler),
      ),
    [uebersicht.plaetze, filter],
  );
  const bereich = useMemo(() => anzeigeBereich(sichtbarePlaetze, sichtbareLehrer), [sichtbarePlaetze, sichtbareLehrer]);

  function filterSetzen(neu: Partial<PlanungFilterWerte>) {
    router.replace(url(neu), { scroll: false });
  }

  /**
   * Ein Ziel unter dem Zeiger prüfen lassen — die Antwort kommt aus `repo.pruefeUeberlappung`
   * (`checkSlotTargetAction`), damit die Überlappungsregel nicht doppelt existiert. Antworten und
   * laufende Anfragen werden zwischengespeichert: Bei jedem `dragover` wird nur einmal gefragt.
   */
  function pruefen(z: Ziel, platz: WochenUebersicht["plaetze"][number]): Promise<Urteil> {
    const schluessel = zielSchluessel(z);
    const bekannt = geprueft.current.get(schluessel);
    if (bekannt) return Promise.resolve(bekannt);
    const laeuft = versprechen.current.get(schluessel);
    if (laeuft) return laeuft;
    const anfrage = checkSlotTargetAction(platz.id, { teacherId: z.teacherId, weekday: z.weekday, startMin: z.startMin }).then((antwort) => {
      const ergebnis: Urteil = { ziel: z, ok: antwort.ok, fehler: antwort.ok ? undefined : antwort.fehler };
      geprueft.current.set(schluessel, ergebnis);
      versprechen.current.delete(schluessel);
      return ergebnis;
    });
    versprechen.current.set(schluessel, anfrage);
    return anfrage;
  }

  function zellenZiel(z: Ziel) {
    // nur bei echter Änderung neu zeichnen: `dragover` feuert viel häufiger als das Raster wechselt
    setZiel((alt) => (alt && zielSchluessel(alt) === zielSchluessel(z) ? alt : z));
    if (!ziehPlatz) return;
    void pruefen(z, ziehPlatz).then((ergebnis) => setUrteil(ergebnis));
  }

  function ziehenBeenden() {
    setZiehPlatz(null);
    setZiel(null);
    setUrteil(null);
  }

  async function ablegen(z: Ziel) {
    const platz = ziehPlatz;
    if (!platz) return;
    setZiel(z);
    const ergebnis = await pruefen(z, platz);
    if (!ergebnis.ok) {
      setZiehFehler(ergebnis.fehler ?? "Dieses Ziel ist nicht möglich.");
      ziehenBeenden();
      return;
    }
    const daten = new FormData();
    daten.set("id", String(platz.id));
    daten.set("woche", woche);
    daten.set("weekday", String(z.weekday));
    daten.set("start", minutenLabel(z.startMin));
    daten.set("teacher_id", String(z.teacherId));
    daten.set("zurueck", zurueck);
    setZiehFehler(null);
    ziehenBeenden();
    geprueft.current.clear();
    versprechen.current.clear();
    await moveSlotAction(daten);
  }

  const platzImDialog = dialog.platzId ? (uebersicht.plaetze.find((p) => p.id === dialog.platzId) ?? null) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Kopfzeile: Woche, Zustand, Werkzeuge */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Link href={url({ woche: tagAddieren(woche, -7) })} className="btn btn-ghost btn-sm" aria-label="Vorwoche">
            <ChevronLeft size={16} aria-hidden />
          </Link>
          <span className="min-w-[180px] text-center text-[15px] font-semibold">{uebersicht.label}</span>
          <Link href={url({ woche: tagAddieren(woche, 7) })} className="btn btn-ghost btn-sm" aria-label="Nächste Woche">
            <ChevronRight size={16} aria-hidden />
          </Link>
        </div>
        <Pill tone={status === "veroeffentlicht" ? "green" : status === "entwurf" ? "amber" : "neutral"}>
          {status === "veroeffentlicht" ? "veröffentlicht" : status === "entwurf" ? "Entwurf" : "leer"}
        </Pill>
        {!darfBearbeiten && <Pill tone="neutral">nur lesen</Pill>}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {woche !== aktuelleWoche && (
            <Link href={url({ woche: aktuelleWoche })} className="btn btn-ghost btn-sm">
              Diese Woche
            </Link>
          )}
          {uebersicht.offen.length > 0 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOffenAuf(true)}>
              <TriangleAlert size={15} aria-hidden /> Offen ({uebersicht.offen.length})
            </button>
          )}
          {darfBearbeiten && (
            <>
              <Link href={url({ neu: true })} className="btn btn-secondary btn-sm">
                <ListPlus size={15} aria-hidden /> Platz anlegen
              </Link>
              <Link href={url({ regeln: true })} className="btn btn-ghost btn-sm">
                <Settings2 size={15} aria-hidden /> Regeln
              </Link>
            </>
          )}
          <Link href={druckHref} className="btn btn-ghost btn-sm">
            <Printer size={15} aria-hidden /> Drucken
          </Link>
        </div>
      </div>

      {darfBearbeiten && (
        <div className="no-print flex flex-wrap items-center gap-2">
          <Werkzeug action={generateWeekAction} woche={woche} zurueck={zurueck} disabled={status !== "leer"} titel={status !== "leer" ? "Die Woche ist nicht leer. Nimm „Neu generieren“." : "Plätze für diese Woche vorschlagen"}>
            <Wand2 size={15} aria-hidden /> Generieren
          </Werkzeug>
          <Werkzeug action={regenerateWeekAction} woche={woche} zurueck={zurueck} disabled={status === "veroeffentlicht"} titel={status === "veroeffentlicht" ? "Eine veröffentlichte Woche wird nicht neu gerechnet." : "Neu rechnen; gesperrte Plätze bleiben stehen"}>
            <Sparkles size={15} aria-hidden /> Neu generieren
          </Werkzeug>
          <Werkzeug action={copyPreviousWeekAction} woche={woche} zurueck={zurueck} disabled={status !== "leer"} titel={status !== "leer" ? "Diese Woche ist nicht leer." : "Die Plätze der Vorwoche als Entwurf übernehmen"}>
            Vorwoche übernehmen
          </Werkzeug>
          <Werkzeug action={publishWeekAction} woche={woche} zurueck={zurueck} disabled={status !== "entwurf"} titel={status !== "entwurf" ? "Es gibt keinen Entwurf zum Veröffentlichen." : "Den Entwurf veröffentlichen"} className="btn btn-primary btn-sm">
            Veröffentlichen
          </Werkzeug>
          <Werkzeug action={discardDraftAction} woche={woche} zurueck={zurueck} disabled={status !== "entwurf"} titel={status !== "entwurf" ? "Es gibt keinen Entwurf." : "Nur den Entwurf wegwerfen"} bestaetigen="Den Entwurf dieser Woche wirklich verwerfen?">
            Entwurf verwerfen
          </Werkzeug>
        </div>
      )}

      {/* Filter: Lehrer, Raum, Schüler */}
      <div className="no-print flex flex-wrap items-end gap-3">
        <label className="field max-w-[220px]">
          <span className="label">Lehrer</span>
          <select className="input" value={filter.lehrer} onChange={(e) => filterSetzen({ lehrer: Number(e.currentTarget.value) })}>
            <option value={0}>Alle Lehrer</option>
            {uebersicht.lehrer.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field max-w-[220px]">
          <span className="label">Raum</span>
          <select className="input" value={filter.raum} onChange={(e) => filterSetzen({ raum: Number(e.currentTarget.value) })}>
            <option value={0}>Alle Räume</option>
            {uebersicht.raeume.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.building}
              </option>
            ))}
          </select>
        </label>
        <label className="field max-w-[240px]">
          <span className="label">Schüler</span>
          <select className="input" value={filter.schueler} onChange={(e) => filterSetzen({ schueler: Number(e.currentTarget.value) })}>
            <option value={0}>Alle Schüler</option>
            {uebersicht.schueler.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {filter.lehrer || filter.raum || filter.schueler ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => filterSetzen({ lehrer: 0, raum: 0, schueler: 0 })}>
            Filter zurücksetzen
          </button>
        ) : null}
        <p className="ml-auto max-w-[46ch] text-[12px] text-ink-3">
          Ziehen verschiebt einen Platz. Unzulässige Ziele werden rot ausgeblendet und nehmen nichts an.
        </p>
      </div>

      {(meldung.fehler || ziehFehler || meldung.ok) && (
        <p role="status" className={`rounded-2xl px-4 py-3 text-[14px] ${meldung.fehler || ziehFehler ? "text-red" : "text-green"}`} style={{ background: meldung.fehler || ziehFehler ? "var(--red-wash)" : "var(--green-wash)" }}>
          {meldung.fehler ?? ziehFehler ?? meldung.ok}
        </p>
      )}

      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <WochenplanGitter
            tage={uebersicht.tage}
            heute={uebersicht.heute}
            lehrer={sichtbareLehrer}
            plaetze={sichtbarePlaetze}
            schueler={uebersicht.schueler}
            luecken={uebersicht.luecken}
            bereich={bereich}
            interaktiv={darfBearbeiten}
            ziehPlatz={ziehPlatz}
            ziel={ziel}
            urteil={urteil}
            woche={woche}
            zurueck={zurueck}
            onZiehen={(p) => {
              setZiehFehler(null);
              geprueft.current.clear();
              versprechen.current.clear();
              setZiehPlatz(p);
            }}
            onZiehenEnde={ziehenBeenden}
            onZellenZiel={zellenZiel}
            onZellenVerlassen={() => setZiel(null)}
            onAblegen={(z) => void ablegen(z)}
            onBearbeiten={(p) => {
              if (darfBearbeiten) router.push(url({ platz: p.id }));
            }}
          />
        </div>
        <WochenplanSeitenleiste
          lehrer={uebersicht.lehrer}
          schueler={uebersicht.schueler}
          gewaehlterLehrer={filter.lehrer || undefined}
          gewaehlterSchueler={filter.schueler || undefined}
          onLehrerWaehlen={(id) => filterSetzen({ lehrer: filter.lehrer === id ? 0 : id })}
          onSchuelerWaehlen={(id) => filterSetzen({ schueler: filter.schueler === id ? 0 : id })}
        />
      </div>

      <WochenplanFuss summen={uebersicht.summen} raeume={uebersicht.raeume} />
      <OffenSchubfach offen={uebersicht.offen} istOffen={offenAuf} onSchliessen={() => setOffenAuf(false)} />

      <PlatzDialog
        platz={platzImDialog}
        neu={dialog.neu}
        woche={woche}
        zurueck={zurueck}
        schliessenHref={url({})}
        tage={uebersicht.tage}
        lehrer={uebersicht.lehrer}
        schueler={uebersicht.schueler}
        raeume={uebersicht.raeume}
      />
      {dialog.regeln && darfBearbeiten && (
        <RegelnDialog regeln={regeln} gebrochen={regelnGebrochen} schliessenHref={url({})} zurueck={zurueck} woche={woche} />
      )}
    </div>
  );
}

/** Ein Werkzeugknopf als eigenes Formular — die Server Action prüft die Berechtigung selbst (D23). */
function Werkzeug({
  action,
  woche,
  zurueck,
  children,
  disabled,
  titel,
  bestaetigen,
  className = "btn btn-secondary btn-sm",
}: {
  action: (formData: FormData) => void | Promise<void>;
  woche: string;
  zurueck: string;
  children: React.ReactNode;
  disabled?: boolean;
  titel?: string;
  bestaetigen?: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (bestaetigen && !window.confirm(bestaetigen)) e.preventDefault();
      }}
    >
      <input type="hidden" name="woche" value={woche} />
      <input type="hidden" name="zurueck" value={zurueck} />
      <button type="submit" className={className} disabled={disabled} title={titel}>
        {children}
      </button>
    </form>
  );
}
