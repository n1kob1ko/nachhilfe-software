"use client";

import "./lernspiel.css";
import "./arena.css";
import Link from "next/link";
import { Check, Clock, Copy, Share2, Trophy, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { duellBeendenAction, duellBereitAction, duellRundeAction, duellSichtAction, duellZugAction, revancheAction } from "@/app/wettspiel-actions";
import { Lernspiel, type DuellRahmen } from "@/components/lernen/Lernspiel";
import type { DuellSicht } from "@/lib/duelle";
import { SPIEL_TITEL, type SpielErgebnis } from "@/lib/lernspiele-typen";

/**
 * Ein Duell (lib/duelle.ts) in der Schüler-App: warten auf den anderen, Countdown (live), spielen mit derselben Mechanik
 * wie die Lernspiele (components/lernen/Lernspiel.tsx mit `duell`), dann das Ergebnis mit Revanche.
 * Der Stand kommt alle paar Sekunden vom Server (live jede Sekunde).
 */
export function Duell({ token, start }: { token: string; start: DuellSicht }) {
  const [sicht, setSicht] = useState(start);
  const [spielt, setSpielt] = useState(false);
  const [ergebnis, setErgebnis] = useState<SpielErgebnis | null>(null);
  const [jetzt, setJetzt] = useState(() => Date.now());
  const [bereitGetippt, setBereitGetippt] = useState(false);
  const id = start.id;
  const arena = `/lernen/${token}/arena`;
  const zurueck = sicht.live ? `/lernen/${token}` : arena;

  const holen = useCallback(async () => {
    const s = await duellSichtAction(token, id);
    if (s) setSicht(s);
  }, [token, id]);

  // wie oft fragen: live und beim Warten oft, sonst selten; fertig gar nicht mehr
  const takt = sicht.status === "fertig" || sicht.status === "abgelaufen" ? 0 : sicht.live ? 1000 : spielt ? 0 : 4000;
  useEffect(() => {
    if (!takt) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void holen();
    }, takt);
    return () => clearInterval(t);
  }, [takt, holen]);

  // Uhr für Countdown und Restzeit
  useEffect(() => {
    if (!sicht.live || sicht.status !== "laeuft") return;
    const t = setInterval(() => setJetzt(Date.now()), 250);
    return () => clearInterval(t);
  }, [sicht.live, sicht.status]);

  useEffect(() => {
    const alt = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = alt;
    };
  }, []);

  // live: nach dem Countdown geht es von selbst los
  const countdown = sicht.live && sicht.status === "laeuft" && sicht.startAt ? Math.ceil((sicht.startAt - jetzt) / 1000) : 0;
  useEffect(() => {
    if (sicht.live && sicht.status === "laeuft" && sicht.binDran && !ergebnis && countdown <= 0) setSpielt(true);
  }, [sicht.live, sicht.status, sicht.binDran, ergebnis, countdown]);

  const rahmen: DuellRahmen = useMemo(
    () => ({
      starten: () => duellRundeAction(token, id),
      beenden: (_rundeId, antworten) => duellBeendenAction(token, id, antworten),
      ersteWahl: (key, wahl) => void duellZugAction(token, id, key, wahl),
      fertig: (e) => {
        setErgebnis(e);
        setSpielt(false);
        void holen();
      },
      sofort: true,
      bis: sicht.live ? sicht.endeAt : null,
      zurueck,
    }),
    [token, id, holen, sicht.live, sicht.endeAt, zurueck],
  );

  if (spielt) {
    return (
      <Lernspiel
        token={token}
        art={sicht.art}
        vorschlaege={[]}
        serie={0}
        lernstand={null}
        duell={{ ...rahmen, leiste: sicht.live ? <LiveLeiste sicht={sicht} jetzt={jetzt} /> : null }}
      />
    );
  }

  const g = sicht.gegner;
  let inhalt: React.ReactNode;

  if (sicht.status === "offen" && !sicht.live) {
    inhalt = <CodeWartet code={sicht.code ?? ""} art={SPIEL_TITEL[sicht.art]} />;
  } else if (sicht.status === "offen" && sicht.live) {
    inhalt = (
      <>
        <p className="ls-oberzeile">Live-Duell · {SPIEL_TITEL[sicht.art]}</p>
        <h1 className="ls-titel">Du gegen {g?.name ?? "…"}</h1>
        <p className="ls-text mt-2">2 Minuten, dieselben Karten. Wer mehr beim ersten Mal richtig hat, gewinnt.</p>
        <div className="mt-auto pt-8">
          {bereitGetippt ? (
            <p className="ls-text text-center">Warte auf {g?.name ?? "den anderen"} …</p>
          ) : (
            <button
              type="button"
              className="ls-knopf ls-los"
              onClick={() => {
                setBereitGetippt(true);
                void duellBereitAction(token, id).then(holen);
              }}
              autoFocus
            >
              Bereit!
            </button>
          )}
        </div>
      </>
    );
  } else if (sicht.live && sicht.status === "laeuft" && countdown > 0 && sicht.binDran) {
    inhalt = (
      <div className="m-auto text-center">
        <p className="ls-text">Gleich geht’s los</p>
        <p key={countdown} className="ar-countdown mt-2" aria-live="assertive">
          {Math.min(countdown, 3)}
        </p>
      </div>
    );
  } else if (sicht.status === "laeuft" && sicht.binDran && !sicht.live) {
    inhalt = (
      <>
        <p className="ls-oberzeile">Duell · {SPIEL_TITEL[sicht.art]}</p>
        <h1 className="ls-titel">Du gegen {g?.name ?? "…"}</h1>
        <Gegenueber sicht={sicht} verdeckt />
        <p className="ls-text mt-6 text-center">
          {g?.fertig ? `${g.name} hat schon gespielt. Schaffst du mehr?` : "Ihr spielt dieselben 12 Karten. Gezählt wird der erste Versuch."}
        </p>
        <div className="mt-auto pt-8">
          <button type="button" className="ls-knopf ls-los" onClick={() => setSpielt(true)} autoFocus>
            Los geht’s
          </button>
        </div>
      </>
    );
  } else {
    inhalt = <Ergebnis token={token} sicht={sicht} ergebnis={ergebnis} />;
  }

  return (
    <div className="ls" role="dialog" aria-modal="true" aria-label="Duell">
      <div className="ls-kopf">
        <Link href={zurueck} className="ls-zu" aria-label="Schließen">
          <X size={24} aria-hidden />
        </Link>
        <span className="flex-1" />
      </div>
      <div className="ls-mitte ls-staffel">{inhalt}</div>
    </div>
  );
}

function CodeWartet({ code, art }: { code: string; art: string }) {
  const [kopiert, setKopiert] = useState(false);
  async function teilen() {
    try {
      if (navigator.share) return await navigator.share({ text: `Duell in DreamStudy (${art}): gib den Code ${code} unter „Liga und Duelle“ ein.` });
      await navigator.clipboard.writeText(code);
      setKopiert(true);
    } catch {
      /* abgebrochen */
    }
  }
  return (
    <div className="my-auto text-center">
      <p className="ls-oberzeile">Duell · {art}</p>
      <p className="ar-code mt-3">{code}</p>
      <p className="ls-text mt-2">Gib den Code weiter. Sobald jemand annimmt, könnt ihr beide spielen.</p>
      <button type="button" className="ls-knopf ls-los mt-8" onClick={() => void teilen()}>
        {kopiert ? <Check size={20} aria-hidden /> : typeof navigator !== "undefined" && "share" in navigator ? <Share2 size={20} aria-hidden /> : <Copy size={20} aria-hidden />}
        <span className="ml-2">{kopiert ? "Kopiert" : "Code teilen"}</span>
      </button>
    </div>
  );
}

function Gegenueber({ sicht, verdeckt }: { sicht: DuellSicht; verdeckt?: boolean }) {
  const g = sicht.gegner;
  const vorne = sicht.ausgang === "gewonnen" ? "ich" : sicht.ausgang === "verloren" ? "gegner" : null;
  return (
    <div className="ar-vs">
      <div className="ar-seite" data-zurueck={vorne === "gegner" ? "" : undefined}>
        <span className="ar-bild" data-gross="" aria-hidden>
          {sicht.ich.bild}
        </span>
        <span className="ar-zahl">{verdeckt ? "?" : sicht.ich.richtig}</span>
        <span className="text-[14px] font-bold">{sicht.ich.name === "Du" ? "Du" : `${sicht.ich.name} (du)`}</span>
      </div>
      <span className="text-[22px] font-extrabold opacity-70" aria-hidden>
        :
      </span>
      <div className="ar-seite" data-zurueck={vorne === "ich" ? "" : undefined}>
        <span className="ar-bild" data-gross="" aria-hidden>
          {g?.bild ?? "❔"}
        </span>
        <span className="ar-zahl">{!g?.fertig && !(sicht.live && g) ? "?" : g.richtig}</span>
        <span className="text-[14px] font-bold">{g?.name ?? "…"}</span>
      </div>
    </div>
  );
}

function Ergebnis({ token, sicht, ergebnis }: { token: string; sicht: DuellSicht; ergebnis: SpielErgebnis | null }) {
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const g = sicht.gegner;
  const fertig = sicht.status === "fertig";
  const titel = !fertig ? `Warte auf ${g?.name ?? "den anderen"}` : sicht.ausgang === "gewonnen" ? "Duell gewonnen!" : sicht.ausgang === "verloren" ? "Knapp daneben!" : "Unentschieden!";
  const e = ergebnis && !("fehler" in ergebnis) ? ergebnis : null;

  async function nochmal() {
    setSendet(true);
    const r = await revancheAction(token, sicht.id);
    setSendet(false);
    if (!r.ok) return setFehler(r.fehler);
    window.location.href = `/lernen/${token}/duell/${r.id}`;
  }

  return (
    <>
      <p className="ls-oberzeile text-center">
        {sicht.live ? "Live-Duell" : "Duell"} · {SPIEL_TITEL[sicht.art]}
      </p>
      <h1 className="ls-titel text-center" style={{ "--n": 0 } as CSSProperties}>
        {titel}
      </h1>
      <p className="ls-text mt-1 text-center" style={{ "--n": 1 } as CSSProperties}>
        {!fertig
          ? sicht.live
            ? "Gleich steht fest, wer gewonnen hat."
            : "Du hast gespielt. Sobald der andere fertig ist, siehst du hier, wer gewonnen hat."
          : sicht.ausgang === "gewonnen" && !g?.gespielt
            ? `${g?.name ?? "Der andere"} hat nicht gespielt.`
            : sicht.ausgang === "gleich"
              ? "Gleich viele richtig und gleich schnell."
              : g && sicht.ich.richtig === g.richtig
                ? sicht.live
                  ? "Gleich viele richtig, entschieden hat, wer mehr Karten geschafft hat."
                  : "Gleich viele richtig, entschieden hat die Zeit."
                : "Gleiche Karten, gezählt wird der erste Versuch."}
      </p>
      <Gegenueber sicht={sicht} />
      {e?.liga && (
        <p className="ls-text mt-4 text-center" style={{ "--n": 2 } as CSSProperties}>
          {e.liga.punkte > 0 ? <b>+{e.liga.punkte} Ligapunkte</b> : e.liga.grund}
        </p>
      )}
      {fertig && sicht.beideFalsch.length > 0 && (
        <div className="ls-blatt mt-6 p-4" style={{ "--n": 3 } as CSSProperties}>
          <p className="text-[13px] font-semibold text-ink-3">Beide falsch: das lernt ihr gerade</p>
          <ul className="mt-1 space-y-1 text-[17px] font-semibold">
            {sicht.beideFalsch.slice(0, 4).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
      {!fertig && !sicht.live && sicht.endeAt && (
        <p className="ls-klein mt-6 flex items-center justify-center gap-1.5">
          <Clock size={14} aria-hidden /> Läuft bis {new Date(sicht.endeAt).toLocaleString("de-AT", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" })}
        </p>
      )}
      {fehler && (
        <p className="ls-fehler mt-4" role="alert">
          {fehler}
        </p>
      )}
      <div className="mt-auto grid gap-3 pt-8" style={{ "--n": 4 } as CSSProperties}>
        {fertig && !sicht.live && (
          <button type="button" className="ls-knopf ls-los" onClick={() => void nochmal()} disabled={sendet}>
            <Trophy size={20} aria-hidden />
            <span className="ml-2">{sicht.revancheId ? "Zur Revanche" : "Revanche"}</span>
          </button>
        )}
        <Link href={sicht.live ? `/lernen/${token}` : `/lernen/${token}/arena`} className="ls-knopf ls-los" data-zweit="">
          {sicht.live ? "Fertig" : "Zu Liga und Duellen"}
        </Link>
      </div>
    </>
  );
}

function LiveLeiste({ sicht, jetzt }: { sicht: DuellSicht; jetzt: number }) {
  const rest = sicht.endeAt ? Math.max(0, Math.ceil((sicht.endeAt - jetzt) / 1000)) : 0;
  const g = sicht.gegner;
  const n = Math.max(1, sicht.anzahl);
  const vorne = g ? sicht.ich.richtig - g.richtig : 0;
  return (
    <div className="ar-leiste" aria-label="Stand im Duell">
      <div className="ar-leiste-kopf">
        <span>
          {sicht.ich.bild} Du · {sicht.ich.richtig}
        </span>
        <span className="tabular-nums" aria-label={`noch ${rest} Sekunden`}>
          <Clock size={13} className="mr-1 inline align-[-2px]" aria-hidden />
          {Math.floor(rest / 60)}:{String(rest % 60).padStart(2, "0")}
        </span>
      </div>
      <div className="ar-balken">
        <span style={{ transform: `scaleX(${sicht.ich.beantwortet / n})` }} />
      </div>
      {g && (
        <>
          <div className="ar-leiste-kopf">
            <span>
              {g.bild} {g.name} · {g.richtig}
            </span>
            <span className="opacity-80">{vorne > 0 ? "du liegst vorne" : vorne < 0 ? "holt auf dich auf" : "gleichauf"}</span>
          </div>
          <div className="ar-balken" data-gegner="">
            <span style={{ transform: `scaleX(${g.beantwortet / n})` }} />
          </div>
        </>
      )}
    </div>
  );
}
