"use client";

/**
 * Die Wochenansicht (Phase 4): **eine** Ansicht mit Filtern statt der getrennten Seiten des
 * Quell-Repos. Oben drei ruhige Zeilen: die Woche mit ihrem Zustand und nur den Knöpfen, die in
 * diesem Zustand gehen (Generieren / Vorwoche übernehmen, dann Neu generieren / Veröffentlichen /
 * Entwurf verwerfen); die Kennzahlen der Woche mit dem Weg ins Offen-Schubfach; Filter und
 * Werkzeuge. Darunter das Gitter (je Lehrer ein Band, Spalten = Tage), das die volle Breite bekommt.
 *
 * Die Rechte entscheiden die Server Actions (`lib/planung/aktionen.ts`, D23); hier wird nur
 * ausgeblendet, was ein Lehrer ohnehin nicht darf. Die Filter stehen in der Adresse, damit die
 * Rückleitung nach einer Aktion sie behält.
 */
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ListPlus, Printer, Settings2, Sparkles, Wand2 } from "lucide-react";
import { checkSlotTargetAction, copyPreviousWeekAction, discardDraftAction, generateWeekAction, moveSlotAction, publishWeekAction, regenerateWeekAction } from "@/app/planung-actions";
import { Pill } from "@/components/ui";
import type { WochenUebersicht } from "@/lib/planung/uebersicht";
import { minutenLabel, tagAddieren } from "@/lib/planung/zeit";
import { PlatzDialog } from "./PlatzDialog";
import { RegelnDialog } from "./RegelnDialog";
import { anzeigeBereich, sichtbareTage } from "@/lib/planung/ansicht";
import { WochenplanGitter, zielSchluessel, type Urteil, type Ziel } from "./WochenplanGitter";
import { OffenSchubfach, WochenKennzahlen } from "./WochenplanPanels";
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

  // Filter: nur die Anzeige. Die Kennzahlen bleiben die ganze Woche (bzw. die Sicht der Rolle).
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
  const tage = useMemo(() => sichtbareTage(uebersicht.tage, sichtbarePlaetze, sichtbareLehrer), [uebersicht.tage, sichtbarePlaetze, sichtbareLehrer]);

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
      {/* 1. Die Woche, ihr Zustand und was in diesem Zustand geht */}
      <div className="no-print flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1">
          <Link href={url({ woche: tagAddieren(woche, -7) })} className="btn btn-ghost btn-sm !px-2.5" aria-label="Vorwoche">
            <ChevronLeft size={18} aria-hidden />
          </Link>
          <h2 className="min-w-[190px] text-center font-[family-name:var(--font-display)] text-[18px] font-semibold tracking-[-0.01em]">{uebersicht.label}</h2>
          <Link href={url({ woche: tagAddieren(woche, 7) })} className="btn btn-ghost btn-sm !px-2.5" aria-label="Nächste Woche">
            <ChevronRight size={18} aria-hidden />
          </Link>
        </div>
        <Pill tone={status === "veroeffentlicht" ? "green" : status === "entwurf" ? "amber" : "neutral"}>
          {status === "veroeffentlicht" ? "veröffentlicht" : status === "entwurf" ? "Entwurf" : "leer"}
        </Pill>
        {!darfBearbeiten && <Pill tone="neutral">nur lesen</Pill>}
        {woche !== aktuelleWoche && (
          <Link href={url({ woche: aktuelleWoche })} className="btn btn-ghost btn-sm">
            Diese Woche
          </Link>
        )}

        {darfBearbeiten && status !== "veroeffentlicht" && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {status === "leer" ? (
              <>
                <Werkzeug action={copyPreviousWeekAction} woche={woche} zurueck={zurueck} titel="Die Plätze der Vorwoche als Entwurf übernehmen">
                  Vorwoche übernehmen
                </Werkzeug>
                <Werkzeug action={generateWeekAction} woche={woche} zurueck={zurueck} titel="Plätze für diese Woche vorschlagen" className="btn btn-primary btn-sm">
                  <Wand2 size={15} aria-hidden /> Generieren
                </Werkzeug>
              </>
            ) : (
              <>
                <Werkzeug action={discardDraftAction} woche={woche} zurueck={zurueck} titel="Nur den Entwurf wegwerfen" bestaetigen="Den Entwurf dieser Woche wirklich verwerfen?" className="btn btn-ghost btn-sm">
                  Entwurf verwerfen
                </Werkzeug>
                <Werkzeug action={regenerateWeekAction} woche={woche} zurueck={zurueck} titel="Neu rechnen; gesperrte Plätze bleiben stehen">
                  <Sparkles size={15} aria-hidden /> Neu generieren
                </Werkzeug>
                <Werkzeug action={publishWeekAction} woche={woche} zurueck={zurueck} titel="Den Entwurf veröffentlichen" className="btn btn-primary btn-sm">
                  Veröffentlichen
                </Werkzeug>
              </>
            )}
          </div>
        )}
      </div>

      {/* 2. Kennzahlen der Woche; „offen“ öffnet das Schubfach */}
      <WochenKennzahlen uebersicht={uebersicht} onOffen={() => setOffenAuf(true)} />

      {/* 3. Filter links, Werkzeuge rechts */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <select className="input !min-h-[38px] !w-auto max-w-[170px] !py-1.5 !text-[14px]" aria-label="Lehrer" value={filter.lehrer} onChange={(e) => filterSetzen({ lehrer: Number(e.currentTarget.value) })}>
          <option value={0}>Alle Lehrer</option>
          {uebersicht.lehrer.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <select className="input !min-h-[38px] !w-auto max-w-[180px] !py-1.5 !text-[14px]" aria-label="Raum" value={filter.raum} onChange={(e) => filterSetzen({ raum: Number(e.currentTarget.value) })}>
          <option value={0}>Alle Räume</option>
          {uebersicht.raeume.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · {r.building}
            </option>
          ))}
        </select>
        <select className="input !min-h-[38px] !w-auto max-w-[180px] !py-1.5 !text-[14px]" aria-label="Schüler" value={filter.schueler} onChange={(e) => filterSetzen({ schueler: Number(e.currentTarget.value) })}>
          <option value={0}>Alle Schüler</option>
          {uebersicht.schueler.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {filter.lehrer || filter.raum || filter.schueler ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => filterSetzen({ lehrer: 0, raum: 0, schueler: 0 })}>
            Filter zurücksetzen
          </button>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-1">
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

      {(meldung.fehler || ziehFehler || meldung.ok) && (
        <p role="status" className={`rounded-2xl px-4 py-3 text-[14px] ${meldung.fehler || ziehFehler ? "text-red" : "text-green"}`} style={{ background: meldung.fehler || ziehFehler ? "var(--red-wash)" : "var(--green-wash)" }}>
          {meldung.fehler ?? ziehFehler ?? meldung.ok}
        </p>
      )}

      <WochenplanGitter
        tage={tage}
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

      <OffenSchubfach offen={uebersicht.offen} istOffen={offenAuf} onSchliessen={() => setOffenAuf(false)} />

      <PlatzDialog
        // a different place (or a new one) starts with its own values, not those of the last one opened
        key={platzImDialog?.id ?? (dialog.neu ? "neu" : "zu")}
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
