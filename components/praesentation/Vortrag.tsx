"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Maximize2, MonitorUp, MonitorX, Pencil } from "lucide-react";
import { folieAmGeraetAction, nimmVomGeraetAction, speichereNotizAction, zeigeAmGeraetAction } from "@/app/praesentation-actions";
import { blaettern, MAX_FOLIE, type Stelle } from "@/lib/praesentation-protokoll";
import { DeckFrame } from "./DeckFrame";

export type Hinweis = { paketId: number; paket: string; schritt: string; lehrer_sagt: string; lehrer_fragt: string };

/**
 * The teacher's player: the presentation on the left (in its sandbox), on the right the Vortragstext of the
 * slide on show, what linked Lernpakete say there, and the student device. A deck that reports its slide
 * (reveal.js through the bridge, or a deck speaking the protocol) moves the notes along; otherwise the
 * teacher sets the slide here. In the Schüleransicht (`notizen` absent) the server sends no notes at all.
 */
export function Vortrag({
  praesId,
  title,
  src,
  deckOrigin,
  notizen,
  hinweise = {},
  geraete = [],
  aufGeraet = null,
  start = 1,
}: {
  praesId: number;
  title: string;
  src: string;
  deckOrigin: string | null;
  /** Vortragstext per slide; absent in the Schüleransicht */
  notizen?: Record<number, string>;
  hinweise?: Record<number, Hinweis[]>;
  /** running units of this teacher with a student device */
  geraete?: { unitId: number; student: string }[];
  /** the unit whose device shows this presentation now */
  aufGeraet?: number | null;
  start?: number;
}) {
  const router = useRouter();
  const [stelle, setStelle] = useState<Stelle>({ folie: start, schritt: null });
  const [ziel, setZiel] = useState<Stelle>({ folie: start, schritt: null });
  const [folien, setFolien] = useState<number | null>(null);
  // the deck tells its slide: buttons and clicker go to the deck, the notes follow it
  const [meldet, setMeldet] = useState(false);
  const [geraet, setGeraet] = useState<number | null>(aufGeraet);
  const [geraetMeldung, setGeraetMeldung] = useState<string | null>(null);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [entwurf, setEntwurf] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start_] = useTransition();
  const senden = useRef<((m: object) => void) | null>(null);
  const buehne = useRef<HTMLDivElement>(null);
  const vorschau = notizen === undefined;
  const max = Math.min(MAX_FOLIE, folien ?? MAX_FOLIE);

  const geheZu = (n: number) => {
    const f = Math.min(max, Math.max(1, Math.round(n) || 1));
    setStelle({ folie: f, schritt: null });
    setZiel({ folie: f, schritt: null });
    setBearbeiten(false);
  };
  const schritt = (r: 1 | -1) => {
    if (meldet) senden.current?.(blaettern(r === 1 ? "weiter" : "zurueck"));
    else geheZu(stelle.folie + r);
  };
  const schrittRef = useRef(schritt);
  useEffect(() => {
    schrittRef.current = schritt;
  });

  // a presenter's clicker (PageDown/PageUp, arrows) while the page has the focus; inside the deck the deck decides
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable]") || e.altKey || e.ctrlKey || e.metaKey)) return;
      if (e.key === "PageDown" || e.key === "ArrowRight") schrittRef.current(1);
      else if (e.key === "PageUp" || e.key === "ArrowLeft") schrittRef.current(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);

  // the student device follows the teacher's slide and animation step
  useEffect(() => {
    if (!geraet) return;
    const t = setTimeout(() => void folieAmGeraetAction(praesId, geraet, stelle.folie, stelle.schritt), 120);
    return () => clearTimeout(t);
  }, [geraet, praesId, stelle.folie, stelle.schritt]);

  const vollbild = () => {
    const el = buehne.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void el.requestFullscreen?.().catch(() => {});
  };

  const notiz = notizen?.[stelle.folie] ?? "";
  const ausPaketen = hinweise[stelle.folie] ?? [];

  const speichern = () =>
    start_(async () => {
      const out = await speichereNotizAction(praesId, stelle.folie, entwurf);
      if ("fehler" in out) setFehler(out.fehler);
      else {
        setFehler(null);
        setBearbeiten(false);
        router.refresh();
      }
    });

  const zeigen = (unitId: number) =>
    start_(async () => {
      const out = await zeigeAmGeraetAction(praesId, unitId, stelle.folie);
      if (!out) return setGeraetMeldung("Die Einheit läuft nicht mehr.");
      setGeraet(unitId);
      setGeraetMeldung(out.status === "gesendet" ? "Am Schülergerät." : out.status === "kein-geraet" ? "Kein Schülergerät verbunden." : "Das Schülergerät ist gerade offline; es zeigt die Präsentation, sobald es wieder da ist.");
    });
  const zurueckholen = () =>
    start_(async () => {
      if (geraet) await nimmVomGeraetAction(praesId, geraet);
      setGeraet(null);
      setGeraetMeldung(null);
    });

  return (
    <div className={vorschau ? "" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"}>
      <div className="min-w-0">
        <div ref={buehne} className="aspect-video w-full overflow-hidden rounded-[18px] border border-line bg-black">
          <DeckFrame
            src={src}
            deckOrigin={deckOrigin}
            ziel={ziel}
            title={title}
            senden={senden}
            onBereit={(n) => n && setFolien(n)}
            onStelle={(s, n) => {
              setMeldet(true);
              if (n) setFolien(n);
              setStelle(s);
              setBearbeiten((b) => (b && s.folie !== stelle.folie ? false : b));
            }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => schritt(-1)} aria-label="Zurück">
            <ChevronLeft size={16} aria-hidden /> Zurück
          </button>
          <label className="flex items-center gap-2 text-[14px] whitespace-nowrap text-ink-2">
            Folie
            <input
              className="input num w-[76px] text-center"
              type="number"
              min={1}
              max={max}
              value={stelle.folie}
              onChange={(e) => geheZu(Number(e.target.value))}
              aria-label="Foliennummer"
            />
            {folien && <span className="num">von {folien}</span>}
          </label>
          <button type="button" className="btn btn-primary" onClick={() => schritt(1)} aria-label="Weiter">
            Weiter <ChevronRight size={16} aria-hidden />
          </button>
          <button type="button" className="btn btn-ghost ml-auto" onClick={vollbild} title="Präsentation im Vollbild (Esc beendet)">
            <Maximize2 size={16} aria-hidden /> Vollbild
          </button>
        </div>
        {!meldet && (
          <p className="mt-2 text-[13px] text-ink-3">
            Diese Präsentation meldet ihre Folie nicht. Blättere in der Präsentation selbst und stell hier die Folie ein{vorschau ? "" : ", dann passt der Vortragstext"}.
          </p>
        )}
      </div>

      {!vorschau && (
        <aside className="grid content-start gap-4" aria-label="Vortragstext">
          <section className="panel px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[17px] font-semibold">
                Folie <span className="num">{stelle.folie}</span>
                {stelle.schritt !== null && <span className="num ml-1 text-[13px] font-normal text-ink-3">· Schritt {stelle.schritt + 1}</span>}
              </h2>
              {!bearbeiten && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setEntwurf(notiz);
                    setFehler(null);
                    setBearbeiten(true);
                  }}
                >
                  <Pencil size={14} aria-hidden /> {notiz ? "Bearbeiten" : "Schreiben"}
                </button>
              )}
            </div>
            {bearbeiten ? (
              <div className="mt-2 grid gap-2">
                <label className="field">
                  <span className="label">Vortragstext zu Folie {stelle.folie}</span>
                  <textarea className="input" rows={7} maxLength={4000} value={entwurf} onChange={(e) => setEntwurf(e.target.value)} autoFocus />
                </label>
                {fehler && (
                  <p className="text-[13px] text-red" role="alert">
                    {fehler}
                  </p>
                )}
                <div className="flex gap-2">
                  <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={speichern}>
                    Speichern
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBearbeiten(false)}>
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : notiz ? (
              <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line">{notiz}</p>
            ) : (
              <p className="mt-2 text-[14px] text-ink-3">Noch kein Vortragstext zu dieser Folie.</p>
            )}
          </section>

          {ausPaketen.map((h, i) => (
            <section key={i} className="panel px-4 py-3 text-[14px]">
              <p className="text-[12px] font-semibold text-ink-3">
                <a href={`/mehr/lernpakete/${h.paketId}`} className="hover:text-accent">
                  {h.paket}
                </a>{" "}
                › {h.schritt}
              </p>
              {h.lehrer_sagt && (
                <p className="mt-1 whitespace-pre-line">
                  <span className="font-semibold">Lehrer sagt: </span>
                  {h.lehrer_sagt}
                </p>
              )}
              {h.lehrer_fragt && (
                <p className="mt-1 whitespace-pre-line">
                  <span className="font-semibold">Lehrer fragt: </span>
                  {h.lehrer_fragt}
                </p>
              )}
            </section>
          ))}

          {geraete.length > 0 && (
            <section className="panel px-4 py-3" aria-label="Schülergerät">
              <p className="text-[13px] font-semibold text-ink-3">Schülergerät</p>
              {geraet ? (
                <>
                  <p className="mt-1 text-[14px]">
                    {geraete.find((g) => g.unitId === geraet)?.student ?? "Das Schülergerät"} sieht die Präsentation und folgt deinen Folien, ohne Vortragstext.
                  </p>
                  <button type="button" className="btn btn-secondary btn-sm mt-2" disabled={pending} onClick={zurueckholen}>
                    <MonitorX size={15} aria-hidden /> Zurück zu den Aufgaben
                  </button>
                </>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {geraete.map((g) => (
                    <button key={g.unitId} type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => zeigen(g.unitId)}>
                      <MonitorUp size={15} aria-hidden /> {geraete.length > 1 ? `Bei ${g.student} zeigen` : "Am Schülergerät zeigen"}
                    </button>
                  ))}
                </div>
              )}
              {geraetMeldung && (
                <p className="mt-2 text-[13px] text-ink-2" role="status">
                  {geraetMeldung}
                </p>
              )}
            </section>
          )}
        </aside>
      )}
    </div>
  );
}
