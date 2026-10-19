"use client";

/**
 * Die Wochenansicht (Phase 4): **eine** Ansicht mit Filtern statt der getrennten Seiten des
 * Quell-Repos. Von oben nach unten: die Woche mit den Werkzeugen (Platz anlegen, Regeln, Drucken);
 * die Statuskarte mit dem Zustand der Woche, dem nächsten Schritt (nur die Knöpfe, die in diesem
 * Zustand gehen) und den Kennzahlen; die Filter (Lehrer als Reiter, Raum und Schüler als Auswahl);
 * dann der Plan selbst. Ab Laptop-Breite ist das das Gitter (je Lehrer ein Band, Spalten = Tage,
 * ziehen und klicken), darunter die Tagesansicht (`WochenplanTage.tsx`): ein Tag als Liste, antippen
 * öffnet den Platz.
 *
 * Die Rechte entscheiden die Server Actions (`lib/planung/aktionen.ts`, D23); hier wird nur
 * ausgeblendet, was ein Lehrer ohnehin nicht darf. Filter und Dialoge stehen in der Adresse, damit
 * die Rückleitung nach einer Aktion sie behält.
 */
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock, MousePointerClick, Plus, Printer, Send, Settings2, Sparkles, Wand2 } from "lucide-react";
import { checkSlotTargetAction, copyPreviousWeekAction, discardDraftAction, generateWeekAction, moveSlotAction, publishWeekAction, regenerateWeekAction } from "@/app/planung-actions";
import type { WochenUebersicht } from "@/lib/planung/uebersicht";
import { minutenLabel, tagAddieren, type Wochentag } from "@/lib/planung/zeit";
import { PlatzDialog } from "./PlatzDialog";
import { RegelnDialog } from "./RegelnDialog";
import { sichtbareTage } from "@/lib/planung/ansicht";
import { SCHRAFFUR, WochenplanGitter, zielSchluessel, type Urteil, type Ziel } from "./WochenplanGitter";
import { OffenSchubfach, WochenStatus } from "./WochenplanPanels";
import { WochenplanTage } from "./WochenplanTage";
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
  /**
   * `?neu=1`, `?platz=<id>` und `?regeln=1`: Die Dialoge hängen an der Adresse. Ein Klick auf freie
   * Zeit gibt dem neuen Platz Lehrer, Tag und Start mit (`&bei=&tag=&um=`).
   */
  dialog: { neu: boolean; platzId: number; regeln: boolean; vorgabe?: Vorgabe };
};

/** Lehrer, Tag und Start für einen neuen Platz, z. B. aus einem Klick ins Gitter. */
export type Vorgabe = { teacherId?: number; weekday?: Wochentag; startMin?: number };

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
  const url = (aenderung: Partial<PlanungFilterWerte> & { neu?: boolean | Vorgabe; platz?: number; regeln?: boolean; woche?: string } = {}) => {
    const werte = { ...filter, ...aenderung };
    const teile = [`woche=${aenderung.woche ?? woche}`];
    if (werte.lehrer) teile.push(`lehrer=${werte.lehrer}`);
    if (werte.raum) teile.push(`raum=${werte.raum}`);
    if (werte.schueler) teile.push(`schueler=${werte.schueler}`);
    if (aenderung.neu) teile.push("neu=1");
    if (typeof aenderung.neu === "object") {
      if (aenderung.neu.teacherId) teile.push(`bei=${aenderung.neu.teacherId}`);
      if (aenderung.neu.weekday) teile.push(`tag=${aenderung.neu.weekday}`);
      if (aenderung.neu.startMin !== undefined) teile.push(`um=${aenderung.neu.startMin}`);
    }
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
  const tage = useMemo(() => sichtbareTage(uebersicht.tage, sichtbarePlaetze, sichtbareLehrer), [uebersicht.tage, sichtbarePlaetze, sichtbareLehrer]);

  // „heute“ nur hervorheben, wenn die gezeigte Woche gerade läuft
  const heute = woche === aktuelleWoche ? uebersicht.heute : null;
  const filterAktiv = !!(filter.lehrer || filter.raum || filter.schueler);

  function filterSetzen(neu: Partial<PlanungFilterWerte>) {
    router.replace(url(neu), { scroll: false });
  }

  /** Einen Dialog öffnen, ohne dass die Seite nach oben springt. */
  function oeffnen(ziel: string) {
    router.push(ziel, { scroll: false });
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

  const aktionen =
    darfBearbeiten && status === "leer" ? (
      <>
        <Werkzeug action={copyPreviousWeekAction} woche={woche} zurueck={zurueck} titel="Die Plätze der Vorwoche als Entwurf übernehmen">
          Vorwoche übernehmen
        </Werkzeug>
        <Werkzeug action={generateWeekAction} woche={woche} zurueck={zurueck} titel="Plätze für diese Woche vorschlagen" className="btn btn-primary btn-sm" haupt>
          <Wand2 size={15} aria-hidden /> Generieren
        </Werkzeug>
      </>
    ) : darfBearbeiten && status === "entwurf" ? (
      <>
        <Werkzeug action={discardDraftAction} woche={woche} zurueck={zurueck} titel="Nur den Entwurf wegwerfen" bestaetigen="Den Entwurf dieser Woche wirklich verwerfen?" className="btn btn-ghost btn-sm">
          Entwurf verwerfen
        </Werkzeug>
        <Werkzeug action={regenerateWeekAction} woche={woche} zurueck={zurueck} titel="Neu rechnen; gesperrte Plätze bleiben stehen">
          <Sparkles size={15} aria-hidden /> Neu generieren
        </Werkzeug>
        <Werkzeug action={publishWeekAction} woche={woche} zurueck={zurueck} titel="Den Entwurf für alle Lehrer sichtbar machen" className="btn btn-primary btn-sm" haupt>
          <Send size={15} aria-hidden /> Veröffentlichen
        </Werkzeug>
      </>
    ) : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Die Woche und die Werkzeuge */}
      <div className="no-print flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-1">
          <Link href={url({ woche: tagAddieren(woche, -7) })} scroll={false} className="btn btn-ghost btn-sm !px-2.5" aria-label="Vorwoche">
            <ChevronLeft size={18} aria-hidden />
          </Link>
          <h2 className="min-w-0 text-center font-[family-name:var(--font-display)] text-[17px] font-semibold tracking-[-0.01em] sm:min-w-[200px] sm:text-[18px]">{uebersicht.label}</h2>
          <Link href={url({ woche: tagAddieren(woche, 7) })} scroll={false} className="btn btn-ghost btn-sm !px-2.5" aria-label="Nächste Woche">
            <ChevronRight size={18} aria-hidden />
          </Link>
          {woche !== aktuelleWoche && (
            <Link href={url({ woche: aktuelleWoche })} scroll={false} className="btn btn-ghost btn-sm">
              Diese Woche
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {darfBearbeiten && (
            <>
              <Link href={url({ neu: true })} scroll={false} className="btn btn-secondary btn-sm">
                <Plus size={15} aria-hidden /> Platz anlegen
              </Link>
              <Link href={url({ regeln: true })} scroll={false} className="btn btn-ghost btn-sm">
                <Settings2 size={15} aria-hidden /> Regeln
              </Link>
            </>
          )}
          <Link href={druckHref} className="btn btn-ghost btn-sm">
            <Printer size={15} aria-hidden /> Drucken
          </Link>
        </div>
      </div>

      {/* 2. Zustand der Woche, der nächste Schritt und die Kennzahlen; „offen“ öffnet das Schubfach */}
      <WochenStatus uebersicht={uebersicht} darfBearbeiten={darfBearbeiten} aktionen={aktionen} onOffen={() => setOffenAuf(true)} />

      {/* 3. Filter: Lehrer als Reiter, Raum und Schüler als Auswahl */}
      <div className="no-print flex flex-col gap-2 lg:flex-row lg:items-center">
        {uebersicht.lehrer.length > 1 && (
          <div className="ohne-leiste -mx-4 overflow-x-auto px-4 md:-mx-8 md:px-8 lg:mx-0 lg:px-0">
            <div role="group" aria-label="Lehrer" className="inline-flex gap-1 rounded-full bg-panel p-1">
              {[{ id: 0, name: "Alle Lehrer" }, ...uebersicht.lehrer].map((l) => {
                const aktiv = filter.lehrer === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    aria-pressed={aktiv}
                    onClick={() => filterSetzen({ lehrer: l.id })}
                    className={`drueck min-h-[36px] rounded-full px-3.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors ${aktiv ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-ink-2 hover:text-ink"}`}
                  >
                    {l.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center lg:ml-auto">
          <select className="input !min-h-[40px] !py-1.5 !text-[14px] sm:!w-auto sm:max-w-[200px]" aria-label="Raum" value={filter.raum} onChange={(e) => filterSetzen({ raum: Number(e.currentTarget.value) })}>
            <option value={0}>Alle Räume</option>
            {uebersicht.raeume.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.building}
              </option>
            ))}
          </select>
          <select className="input !min-h-[40px] !py-1.5 !text-[14px] sm:!w-auto sm:max-w-[200px]" aria-label="Schüler" value={filter.schueler} onChange={(e) => filterSetzen({ schueler: Number(e.currentTarget.value) })}>
            <option value={0}>Alle Schüler</option>
            {uebersicht.schueler.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {filterAktiv && (
            <button type="button" className="btn btn-ghost btn-sm col-span-2 justify-self-start" onClick={() => filterSetzen({ lehrer: 0, raum: 0, schueler: 0 })}>
              Filter zurücksetzen
            </button>
          )}
        </div>
      </div>

      {(meldung.fehler || ziehFehler || meldung.ok) && (
        <p role="status" className={`rounded-2xl px-4 py-3 text-[14px] ${meldung.fehler || ziehFehler ? "text-red" : "text-green"}`} style={{ background: meldung.fehler || ziehFehler ? "var(--red-wash)" : "var(--green-wash)" }}>
          {meldung.fehler ?? ziehFehler ?? meldung.ok}
        </p>
      )}

      {/* 4a. Laptop: das Gitter zum Ziehen und Klicken */}
      <div className="hidden lg:block">
        <div className="no-print mb-2 flex flex-wrap items-center justify-between gap-x-5 gap-y-1.5 text-[12.5px] text-ink-3">
          {darfBearbeiten ? (
            <span className="flex items-center gap-1.5">
              <MousePointerClick size={14} aria-hidden /> Anklicken öffnet, ziehen verschiebt. Ein Klick auf freie Zeit legt einen Platz an.
            </span>
          ) : (
            <span />
          )}
          <Legende />
        </div>
        <WochenplanGitter
          tage={tage}
          heute={heute}
          lehrer={sichtbareLehrer}
          plaetze={sichtbarePlaetze}
          schueler={uebersicht.schueler}
          luecken={uebersicht.luecken}
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
            if (darfBearbeiten) oeffnen(url({ platz: p.id }));
          }}
          onNeu={(z) => {
            if (darfBearbeiten) oeffnen(url({ neu: z }));
          }}
        />
      </div>

      {/* 4b. Telefon und Tablet: ein Tag als Liste */}
      <div className="lg:hidden">
        <WochenplanTage
          tage={tage}
          heute={heute}
          lehrer={sichtbareLehrer}
          plaetze={sichtbarePlaetze}
          schueler={uebersicht.schueler}
          luecken={uebersicht.luecken}
          interaktiv={darfBearbeiten}
          nurBelegte={!!(filter.raum || filter.schueler)}
          onOeffnen={(p) => oeffnen(url({ platz: p.id }))}
          neuHref={(teacherId, weekday) => url({ neu: { teacherId, weekday } })}
        />
      </div>

      <OffenSchubfach offen={uebersicht.offen} istOffen={offenAuf} onSchliessen={() => setOffenAuf(false)} />

      <PlatzDialog
        // a different place (or a new one) starts with its own values, not those of the last one opened
        key={platzImDialog?.id ?? (dialog.neu ? `neu-${dialog.vorgabe?.teacherId}-${dialog.vorgabe?.weekday}-${dialog.vorgabe?.startMin}` : "zu")}
        platz={platzImDialog}
        neu={dialog.neu}
        woche={woche}
        zurueck={zurueck}
        schliessenHref={url({})}
        vorgabe={dialog.vorgabe}
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

/** Ein Werkzeugknopf als eigenes Formular. Die Server Action prüft die Berechtigung selbst (D23). */
function Werkzeug({
  action,
  woche,
  zurueck,
  children,
  disabled,
  titel,
  bestaetigen,
  haupt,
  className = "btn btn-secondary btn-sm",
}: {
  action: (formData: FormData) => void | Promise<void>;
  woche: string;
  zurueck: string;
  children: React.ReactNode;
  disabled?: boolean;
  titel?: string;
  bestaetigen?: string;
  /** Der Hauptschritt: auf dem Telefon zuerst und über die ganze Breite. */
  haupt?: boolean;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={haupt ? "order-first w-full sm:order-none sm:w-auto" : "flex-1 sm:flex-none"}
      onSubmit={(e) => {
        if (bestaetigen && !window.confirm(bestaetigen)) e.preventDefault();
      }}
    >
      <input type="hidden" name="woche" value={woche} />
      <input type="hidden" name="zurueck" value={zurueck} />
      <button type="submit" className={`${className} w-full sm:w-auto`} disabled={disabled} title={titel}>
        {children}
      </button>
    </form>
  );
}

/** Was die Flächen und Zeichen im Gitter bedeuten. */
function Legende() {
  const feld = "inline-block h-3 w-4 rounded-[3px] border";
  return (
    <span className="flex flex-wrap items-center gap-x-3.5 gap-y-1" aria-label="Legende">
      <span className="flex items-center gap-1.5">
        <span className={`${feld} border-line-strong bg-surface`} aria-hidden /> kann
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`${feld} border-line-strong`} style={{ background: SCHRAFFUR }} aria-hidden /> kann nicht
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`${feld} border-dashed border-ink-3`} aria-hidden /> Entwurf
      </span>
      <span className="flex items-center gap-1.5">
        <Lock size={12} aria-hidden /> gesperrt
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`${feld} border-transparent bg-amber-wash`} aria-hidden /> Lücke
      </span>
    </span>
  );
}
