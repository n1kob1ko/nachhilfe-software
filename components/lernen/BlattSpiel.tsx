"use client";

import "./lernspiel.css";
import "./phantombild.css";
import "./blaetter.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Eye, EyeOff, Flame, Leaf, PenLine, Star, Volume2, VolumeX, X, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { blattStartenAction, spielBeendenAction, tabletBlattStartenAction, tabletSpielBeendenAction } from "@/app/lernspiel-actions";
import { blattBild, BLAETTER_JE_RUNDE, FAMILIEN, mitArtikel, PFLANZEN, pflanze, pruefeGeschrieben, type BlattModus } from "@/lib/blaetter";
import type { SpielErgebnis, SpielKarte } from "@/lib/lernspiele-typen";
import { aufTon, klang, setzeTon, tonAn } from "./klang";
import { Hintergrund, Konfetti } from "./Lernspiel";
import { vibriere } from "./SpielTeile";

/**
 * Blätter bestimmen (lib/blaetter.ts, docs/lernspiele.md „Blätter bestimmen“): ein Herbarbogen mit dem gepressten
 * Blatt, darunter die Frage. Erst „Welche Pflanze?“, dann „Welche Familie?“; die Antwort steht danach auf dem Etikett
 * des Bogens. „Üben“: vier Kacheln, ähnliche Blätter als falsche Antworten. „Wie im Test“: selbst schreiben, ein
 * kleiner Tippfehler zählt, die richtige Schreibweise wird gezeigt. Ein Fehler zeigt das Merkmal des Blatts; die Karte
 * kommt drei Karten später noch einmal. Gezählt wird der erste Versuch.
 */

type Phase = "start" | "laden" | "spiel" | "ende" | "ansehen";
type Runde = { rundeId: number; karten: SpielKarte[]; modus: BlattModus; alle: boolean };
type Hilfe = { karte: SpielKarte; art: "falsch" | "fast"; eingabe?: string };

const DEKO = ["Ahorn", "Linde", "Eiche", "Esche"];
/** Eine falsche Karte kommt so viele Karten später wieder. */
const WIEDER_NACH = 3;

export function BlattSpiel({
  token,
  amTablet,
  serie: serieAnfang,
  sicher: sicherAnfang,
  gesehen,
  grund,
  zurueck: zurueckZiel,
}: {
  token: string;
  amTablet?: boolean;
  serie: number;
  /** die Nummern der Blätter, die schon sicher sitzen */
  sicher: number[];
  /** die Nummern der Blätter, die schon einmal dran waren */
  gesehen: number[];
  /** warum es gerade passt („Biologie-Test in 5 Tagen“) */
  grund?: string;
  zurueck?: string;
}) {
  const router = useRouter();
  const server = useMemo(
    () => ({
      starten: (modus: BlattModus, alle: boolean) => (amTablet ? tabletBlattStartenAction(modus, alle) : blattStartenAction(token, modus, alle)),
      beenden: (id: number, antworten: { key: string; wahl: string }[]) => (amTablet ? tabletSpielBeendenAction(id, antworten) : spielBeendenAction(token, id, antworten)),
    }),
    [amTablet, token],
  );
  const zurueck = zurueckZiel ?? `/lernen/${token}/spiele`;
  const ZuLink = amTablet ? "a" : Link;

  const [phase, setPhase] = useState<Phase>("start");
  const [fehler, setFehler] = useState<string | null>(null);
  const [ton, setTon] = useState(true);
  const [sicher, setSicher] = useState<number[]>(sicherAnfang);
  const [gesehenListe, setGesehen] = useState<number[]>(gesehen);
  const [runde, setRunde] = useState<Runde | null>(null);
  const [reihe, setReihe] = useState<SpielKarte[]>([]);
  const [pos, setPos] = useState(0);
  const [etikett, setEtikett] = useState<Record<number, { name?: string; familie?: string }>>({});
  const [wahl, setWahl] = useState<{ wert: string; ok: boolean } | null>(null);
  const [hilfe, setHilfe] = useState<Hilfe | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [folge, setFolge] = useState(0);
  const [beste, setBeste] = useState(0);
  const [ergebnis, setErgebnis] = useState<SpielErgebnis | null>(null);
  const [daneben, setDaneben] = useState<number[]>([]);
  const [abdecken, setAbdecken] = useState(false);
  const [offen, setOffen] = useState<Set<number>>(new Set());

  const antworten = useRef(new Map<string, string>());
  const wieder = useRef(new Map<string, number>());
  const reduziert = useRef(false);
  const feld = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    reduziert.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTon(tonAn());
    const ab = aufTon(setTon);
    const alt = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      ab();
      document.body.style.overflow = alt;
    };
  }, []);

  const spiele = useCallback((f: (k: typeof klang) => void) => {
    if (tonAn()) f(klang);
  }, []);

  const karte = reihe[pos] ?? null;
  const daten = karte?.blatt ?? null;

  const starten = useCallback(
    async (modus: BlattModus, alle = false) => {
      setPhase("laden");
      setFehler(null);
      const r = await server.starten(modus, alle);
      if ("fehler" in r) {
        setFehler(r.fehler);
        setPhase("start");
        return;
      }
      antworten.current = new Map();
      wieder.current = new Map();
      setRunde({ rundeId: r.rundeId, karten: r.karten, modus, alle });
      setReihe(r.karten);
      setPos(0);
      setEtikett({});
      setWahl(null);
      setHilfe(null);
      setEingabe("");
      setFolge(0);
      setBeste(0);
      setErgebnis(null);
      setDaneben([]);
      setPhase("spiel");
    },
    [server],
  );

  const fertig = useCallback(async () => {
    if (!runde) return;
    setPhase("ende");
    const liste = [...antworten.current.entries()].map(([key, w]) => ({ key, wahl: w }));
    const richtig = runde.karten.filter((k) => antworten.current.get(k.key) === k.richtig).length;
    spiele((k) => (richtig / Math.max(1, runde.karten.length) >= 0.7 ? k.frei() : k.aus()));
    const e = await server.beenden(runde.rundeId, liste);
    setErgebnis(e);
    if (!("fehler" in e) && e.blatt) setSicher(e.blatt.sicher);
    setGesehen((g) => [...new Set([...g, ...runde.karten.map((k) => k.blatt?.nr ?? 0)])].filter(Boolean));
    router.refresh();
  }, [runde, server, router, spiele]);

  /** Weiter zur nächsten Karte (eine falsche kommt `WIEDER_NACH` Karten später noch einmal). */
  const weiter = useCallback(
    (nochmal?: SpielKarte) => {
      setWahl(null);
      setHilfe(null);
      setEingabe("");
      let neu = reihe;
      if (nochmal && (wieder.current.get(nochmal.key) ?? 0) < 2) {
        wieder.current.set(nochmal.key, (wieder.current.get(nochmal.key) ?? 0) + 1);
        neu = [...reihe];
        neu.splice(Math.min(neu.length, pos + 1 + WIEDER_NACH), 0, nochmal);
        setReihe(neu);
      }
      if (pos + 1 >= neu.length) void fertig();
      else setPos(pos + 1);
    },
    [reihe, pos, fertig],
  );

  /** Eine Antwort: `wert` ist das, was zählt (bei „fast“ schon die richtige Schreibweise). */
  const antworte = useCallback(
    (wert: string, o: { fast?: boolean; eingabe?: string } = {}) => {
      if (!karte || !daten || wahl || hilfe) return;
      const erste = !antworten.current.has(karte.key);
      if (erste) antworten.current.set(karte.key, wert);
      const ok = wert === karte.richtig;
      setWahl({ wert: o.eingabe ?? wert, ok });
      if (ok) {
        setEtikett((e) => ({ ...e, [daten.nr]: { ...e[daten.nr], [daten.teil]: karte.richtig } }));
        if (erste) {
          setFolge((f) => {
            const n = f + 1;
            setBeste((b) => Math.max(b, n));
            return n;
          });
        }
        spiele((k) => k.richtig(erste && daten.teil === "familie"));
        vibriere(12);
        if (o.fast) setHilfe({ karte, art: "fast", eingabe: o.eingabe });
        return;
      }
      setFolge(0);
      setDaneben((d) => (d.includes(daten.nr) ? d : [...d, daten.nr]));
      setEtikett((e) => ({ ...e, [daten.nr]: { ...e[daten.nr], [daten.teil]: karte.richtig } }));
      spiele((k) => k.falsch());
      vibriere([40, 60, 40]);
      setHilfe({ karte, art: "falsch", eingabe: o.eingabe });
    },
    [karte, daten, wahl, hilfe, spiele],
  );

  // richtig: kurz zeigen, dann weiter
  useEffect(() => {
    if (!wahl?.ok || hilfe) return;
    const t = window.setTimeout(() => weiter(), reduziert.current ? 280 : daten?.teil === "familie" ? 900 : 620);
    return () => window.clearTimeout(t);
  }, [wahl, hilfe, weiter, daten]);

  // Schreiben: das Feld bekommt den Fokus
  useEffect(() => {
    if (phase === "spiel" && daten?.modus === "schreiben" && !hilfe && !wahl) feld.current?.focus({ preventScroll: true });
  }, [phase, daten, hilfe, wahl, pos]);

  // am Laptop: Ziffern 1–4 für die Kacheln, Eingabe für „Weiter“
  useEffect(() => {
    if (phase !== "spiel") return;
    const taste = (e: KeyboardEvent) => {
      if (hilfe && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        weiter(hilfe.art === "falsch" ? hilfe.karte : undefined);
        return;
      }
      if (!karte || daten?.modus !== "kacheln" || wahl) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < karte.faecher.length) antworte(karte.faecher[i]);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [phase, hilfe, karte, daten, wahl, weiter, antworte]);

  const schreiben = (e: FormEvent) => {
    e.preventDefault();
    if (!karte || !daten || wahl || hilfe) return;
    const text = eingabe.trim();
    if (!text) return;
    const r = pruefeGeschrieben(text, karte.richtig, daten.teil);
    if (r === "falsch") antworte(text, { eingabe: text });
    else antworte(karte.richtig, { fast: r === "fast", eingabe: text });
  };

  const kopf = (
    <div className="ls-kopf">
      <ZuLink href={zurueck} className="ls-zu treffer" aria-label="Spiel schließen">
        <X size={24} aria-hidden />
      </ZuLink>
      {phase === "spiel" && runde ? (
        <>
          <span className="pb-fortschritt" role="progressbar" aria-valuemin={0} aria-valuemax={reihe.length} aria-valuenow={pos} aria-label="Fortschritt">
            <i style={{ width: `${Math.round((pos / Math.max(1, reihe.length)) * 100)}%` }} />
          </span>
          <span className="ls-combo bl-folge" data-heiss={folge >= 3 ? "" : undefined} aria-label={`${folge} richtig in Folge`} data-testid="bl-folge">
            <Zap size={16} aria-hidden />
            <b key={folge}>{folge}</b>
          </span>
        </>
      ) : (
        <span className="flex-1" />
      )}
      <button type="button" className="ls-zu treffer" onClick={() => setzeTon(!ton)} aria-pressed={!ton} aria-label={ton ? "Töne ausschalten" : "Töne einschalten"}>
        {ton ? <Volume2 size={22} aria-hidden /> : <VolumeX size={22} aria-hidden />}
      </button>
    </div>
  );

  // ---------- Start ----------

  if (phase === "start" || phase === "laden") {
    return (
      <div className="ls pb bl" role="dialog" aria-modal="true" aria-label="Lernspiel Blätter bestimmen">
        <Hintergrund woerter={DEKO} />
        {kopf}
        <div className="ls-mitte ls-rollt ls-staffel">
          <p className="ls-oberzeile" style={{ "--n": 0 } as CSSProperties}>
            Lernspiel · Biologie
          </p>
          <h1 className="ls-titel" style={{ "--n": 1 } as CSSProperties}>
            Blätter bestimmen
          </h1>
          <div className="bl-faecher" style={{ "--n": 2 } as CSSProperties} aria-hidden>
            {[22, 15, 7].map((nr, i) => (
              <span key={nr} className="bl-faecher-bogen" data-i={i}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={blattBild(nr)} alt="" />
              </span>
            ))}
          </div>
          {grund && (
            <span className="ls-grund mt-1" style={{ "--n": 2 } as CSSProperties} data-testid="bl-grund">
              <BookOpen size={16} aria-hidden />
              {grund}
            </span>
          )}
          <Sammlung sicher={sicher} gesehen={gesehenListe} n={3} />
          <div className="pb-wahl mt-4" style={{ "--n": 4 } as CSSProperties}>
            <button type="button" className="pb-wahl-knopf" onClick={() => void starten("kacheln")} disabled={phase === "laden"} data-testid="bl-start-kacheln" autoFocus>
              <Leaf size={26} aria-hidden />
              <span>
                <b>Üben</b>
                <small>Schau das Blatt an und tipp Pflanze und Familie an. {BLAETTER_JE_RUNDE} Blätter.</small>
              </span>
            </button>
            <button type="button" className="pb-wahl-knopf" onClick={() => void starten("schreiben")} disabled={phase === "laden"} data-testid="bl-start-schreiben">
              <PenLine size={26} aria-hidden />
              <span>
                <b>Wie im Test</b>
                <small>Schreib Pflanze und Familie selbst. {BLAETTER_JE_RUNDE} Blätter.</small>
              </span>
            </button>
            <button type="button" className="pb-wahl-knopf" onClick={() => void starten("schreiben", true)} disabled={phase === "laden"} data-testid="bl-start-alle">
              <Star size={26} aria-hidden />
              <span>
                <b>Großer Test</b>
                <small>Alle {PFLANZEN.length} Blätter schreiben, wie bei der echten Prüfung.</small>
              </span>
            </button>
            <button type="button" className="pb-wahl-knopf" onClick={() => setPhase("ansehen")} disabled={phase === "laden"} data-testid="bl-ansehen">
              <BookOpen size={26} aria-hidden />
              <span>
                <b>Alle Blätter ansehen</b>
                <small>Nach Familien geordnet, zum Lernen. Namen kannst du abdecken.</small>
              </span>
            </button>
          </div>
          <div className="ls-glas mt-4 flex items-center justify-between gap-4 p-4" style={{ "--n": 5 } as CSSProperties}>
            <p className="ls-klein">Serie</p>
            <p className="flex items-center gap-1.5 text-[20px] font-semibold tabular-nums">
              <Flame size={20} className={serieAnfang > 0 ? "ls-flamme" : "opacity-60"} fill={serieAnfang > 0 ? "currentColor" : "none"} aria-hidden />
              {serieAnfang === 0 ? "Heute starten" : serieAnfang === 1 ? "1 Tag" : `${serieAnfang} Tage`}
            </p>
          </div>
          {fehler && (
            <p className="ls-fehler mt-6" role="alert">
              {fehler}
            </p>
          )}
          {phase === "laden" && <p className="ls-klein mt-4 text-center">Die Blätter kommen …</p>}
        </div>
      </div>
    );
  }

  // ---------- Ansehen ----------

  if (phase === "ansehen") {
    return (
      <div className="ls pb bl" role="dialog" aria-modal="true" aria-label="Alle Blätter ansehen">
        {kopf}
        <div className="ls-mitte bl-ansehen" data-testid="bl-ansehen-liste">
          <div className="flex items-center justify-between gap-3">
            <h1 className="ls-titel text-[28px]">Alle Blätter</h1>
            <button type="button" className="bl-abdecken" aria-pressed={abdecken} onClick={() => { setAbdecken((a) => !a); setOffen(new Set()); }} data-testid="bl-abdecken">
              {abdecken ? <Eye size={18} aria-hidden /> : <EyeOff size={18} aria-hidden />}
              {abdecken ? "Namen zeigen" : "Namen abdecken"}
            </button>
          </div>
          <p className="ls-text mt-1">{abdecken ? "Sag Pflanze und Familie, dann tipp aufs Blatt." : "Blätter derselben Familie stehen zusammen."}</p>
          {FAMILIEN.map((familie) => (
            <section key={familie} className="mt-5">
              <h2 className="bl-familie-titel">{abdecken ? "Familie ?" : familie}</h2>
              <div className="bl-raster">
                {PFLANZEN.filter((p) => p.familie === familie).map((p) => {
                  const zeigen = !abdecken || offen.has(p.nr);
                  return (
                    <button
                      key={p.nr}
                      type="button"
                      className="bl-karte"
                      onClick={() => abdecken && setOffen((o) => new Set(o).add(p.nr))}
                      aria-label={zeigen ? `${p.name}, ${p.familie}` : "Blatt, Name verdeckt: antippen zum Aufdecken"}
                      data-testid={`bl-karte-${p.nr}`}
                    >
                      <span className="bl-karte-bild">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={blattBild(p.nr)} alt="" loading="lazy" />
                        {sicher.includes(p.nr) && (
                          <i className="bl-sicher-haken" aria-label="sicher">
                            <Check size={14} strokeWidth={3} aria-hidden />
                          </i>
                        )}
                      </span>
                      <span className="bl-karte-name">{zeigen ? p.name : "?"}</span>
                      {zeigen && abdecken && <span className="bl-karte-familie">{p.familie}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          <div className="mt-8 grid gap-3 pb-4">
            <button type="button" className="ls-knopf ls-los" onClick={() => void starten("kacheln")} data-testid="bl-ansehen-ueben">
              Jetzt üben
            </button>
            <button type="button" className="ls-knopf ls-los" data-zweit="" onClick={() => setPhase("start")}>
              Zurück
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Ende ----------

  if (phase === "ende" && runde) {
    const anzahl = runde.karten.length;
    const richtig = runde.karten.filter((k) => antworten.current.get(k.key) === k.richtig).length;
    const anteil = anzahl ? richtig / anzahl : 0;
    const sterne = anteil >= 0.9 ? 3 : anteil >= 0.7 ? 2 : 1;
    const blaetter = new Set(runde.karten.map((k) => k.blatt?.nr ?? 0));
    return (
      <div className="ls pb bl" role="dialog" aria-modal="true" aria-label="Runde vorbei">
        <Hintergrund woerter={DEKO} />
        {sterne >= 2 && <Konfetti />}
        {kopf}
        <div className="ls-mitte ls-rollt ls-staffel text-center">
          <div className="ls-ring" style={{ "--n": 0 } as CSSProperties} data-testid="bl-ende">
            <svg viewBox="0 0 120 120" aria-hidden>
              <circle cx="60" cy="60" r="50" pathLength={100} className="ls-ring-spur" />
              <circle cx="60" cy="60" r="50" pathLength={100} className="ls-ring-wert" style={{ strokeDashoffset: 100 - Math.round(anteil * 100) } as CSSProperties} />
            </svg>
            <div className="ls-ring-zahl" data-lang={3}>
              <b data-testid="bl-ende-richtig">{richtig}</b>
              <span>von {anzahl}</span>
            </div>
          </div>
          <div className="ls-sterne" aria-label={`${sterne} von 3 Sternen`}>
            {[0, 1, 2].map((i) => (
              <Star key={i} size={i === 1 ? 44 : 34} className="ls-stern" data-an={i < sterne ? "" : undefined} fill="currentColor" style={{ "--n": i } as CSSProperties} aria-hidden />
            ))}
          </div>
          <h1 className="bw-ende-titel" style={{ "--n": 1 } as CSSProperties}>
            {anteil >= 0.9 ? "Super bestimmt!" : anteil >= 0.7 ? "Gut gemacht!" : "Weiter üben!"}
          </h1>
          <p className="ls-text mt-1" style={{ "--n": 1 } as CSSProperties}>
            {blaetter.size} Blätter · {richtig} von {anzahl} Antworten beim ersten Versuch richtig{beste >= 3 ? ` · ${beste} in Folge` : ""}
          </p>
          {ergebnis && "fehler" in ergebnis && (
            <p className="ls-fehler mt-4" role="alert">
              {ergebnis.fehler}
            </p>
          )}
          <Sammlung sicher={sicher} gesehen={gesehenListe} n={2} laedt={!ergebnis} />
          {daneben.length > 0 && (
            <div className="ls-blatt mt-4 p-4 text-left" style={{ "--n": 3 } as CSSProperties} data-testid="bl-daneben">
              <p className="text-[15px] font-semibold">Schau dir diese noch einmal an</p>
              <ul className="bl-daneben mt-3">
                {daneben.map((nr) => {
                  const p = pflanze(nr)!;
                  return (
                    <li key={nr}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={blattBild(nr)} alt="" />
                      <span>
                        <b>{p.name}</b>
                        <small>{p.familie}</small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="mt-auto grid gap-3 pt-8" style={{ "--n": 4 } as CSSProperties}>
            <button type="button" className="ls-knopf ls-los" onClick={() => void starten(runde.modus, runde.alle)} disabled={!ergebnis} autoFocus data-testid="bl-nochmal">
              Nochmal
            </button>
            <button type="button" className="ls-knopf ls-los" data-zweit="" onClick={() => setPhase("start")}>
              {runde.modus === "kacheln" ? "Wie im Test schreiben" : "Anders spielen"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Spiel ----------

  if (!karte || !daten) return null;
  const p = pflanze(daten.nr)!;
  // Auf dem Etikett steht nur, was schon beantwortet ist: bei der Frage nach der Familie der Name (er steht ja in
  // der Frage), die gefragte Zeile erst nach der Antwort. Auch wenn ein Blatt nach einem Fehler wiederkommt.
  const gemerkt = etikett[daten.nr] ?? {};
  const schild = {
    name: daten.teil === "familie" ? p.name : wahl ? gemerkt.name : undefined,
    familie: daten.teil === "familie" && wahl ? gemerkt.familie : undefined,
  };
  const frage = daten.teil === "name" ? "Welche Pflanze ist das?" : `Zu welcher Familie gehört ${mitArtikel(p.name)}?`;
  return (
    <div className="ls pb bl" role="dialog" aria-modal="true" aria-label="Blätter bestimmen" data-modus={daten.modus}>
      {kopf}
      <div className="bl-spiel">
        <figure className="bl-bogen" key={daten.nr} data-testid="bl-bogen" data-nr={daten.nr}>
          <div className="bl-bild">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={daten.bild} alt="Ein gepresstes Blatt" draggable={false} />
          </div>
          <figcaption className="bl-etikett">
            <span className="bl-zeile" data-jetzt={daten.teil === "name" ? "" : undefined}>
              <i>Pflanze</i>
              <b key={schild.name ?? "leer"} data-voll={schild.name ? "" : undefined}>
                {schild.name ?? "?"}
              </b>
            </span>
            <span className="bl-zeile" data-jetzt={daten.teil === "familie" ? "" : undefined}>
              <i>Familie</i>
              <b key={schild.familie ?? "leer"} data-voll={schild.familie ? "" : undefined}>
                {schild.familie ?? "?"}
              </b>
            </span>
          </figcaption>
        </figure>

        <div className="bl-unten">
          <p className="pb-frage bl-frage" data-testid="bl-frage">
            {frage}
          </p>
          {daten.modus === "kacheln" ? (
            <div className="pb-antworten bl-antworten" data-anzahl={karte.faecher.length}>
              {karte.faecher.map((f, i) => (
                <button
                  key={`${karte.key}-${f}`}
                  type="button"
                  className="pb-antwort bl-antwort"
                  onClick={() => antworte(f)}
                  disabled={!!wahl}
                  data-richtig={wahl && f === karte.richtig ? "" : undefined}
                  data-falsch={wahl && !wahl.ok && f === wahl.wert ? "" : undefined}
                  data-testid="bl-antwort"
                  data-wert={f}
                  aria-keyshortcuts={String(i + 1)}
                >
                  <span className="bl-antwort-wort" data-lang={f.length > 16 ? "" : undefined}>
                    {f}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <form className="bl-schreiben" onSubmit={schreiben}>
              <input
                ref={feld}
                className="bl-feld"
                value={eingabe}
                onChange={(e) => setEingabe(e.target.value)}
                disabled={!!wahl}
                data-ok={wahl ? (wahl.ok ? "" : "nein") : undefined}
                placeholder={daten.teil === "name" ? "Name der Pflanze" : "…gewächse"}
                aria-label={daten.teil === "name" ? "Name der Pflanze" : "Familie"}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
                enterKeyHint="done"
                maxLength={40}
                data-testid="bl-feld"
              />
              <div className="bl-schreiben-knoepfe">
                <button type="button" className="ls-knopf bl-weiss-nicht" data-zweit="" onClick={() => antworte("", { eingabe: "" })} disabled={!!wahl} data-testid="bl-weiss-nicht">
                  Weiß ich nicht
                </button>
                <button type="submit" className="ls-knopf bl-pruefen" disabled={!!wahl || !eingabe.trim()} data-testid="bl-pruefen">
                  Fertig
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {hilfe && (
        <div className="bl-hilfe" role="alert" data-art={hilfe.art} data-testid="bl-hilfe">
          <div className="ls-blatt bl-hilfe-blatt">
            {hilfe.art === "fast" ? (
              <>
                <p className="bl-hilfe-titel">Fast! Achte auf die Schreibung</p>
                <p className="bl-hilfe-text">
                  Du: <s>{hilfe.eingabe}</s>
                  <br />
                  Richtig: <b>{hilfe.karte.richtig}</b>
                </p>
              </>
            ) : (
              <>
                <p className="bl-hilfe-titel">{hilfe.eingabe === "" ? "So heißt es" : "Nicht ganz"}</p>
                <p className="bl-hilfe-text">
                  {hilfe.eingabe ? (
                    <>
                      Du: <s>{hilfe.eingabe}</s>
                      <br />
                    </>
                  ) : null}
                  Richtig: <b>{hilfe.karte.richtig}</b>
                  {daten.teil === "familie" && <span className="bl-hilfe-klein"> ({p.name})</span>}
                </p>
                {daten.teil === "name" ? (
                  <p className="bl-merkmal">
                    <Leaf size={16} aria-hidden /> {p.merkmal}
                  </p>
                ) : (
                  <p className="bl-merkmal">
                    <Leaf size={16} aria-hidden /> {familieText(p.nr)}
                  </p>
                )}
              </>
            )}
            <button type="button" className="ls-knopf ls-los mt-4" onClick={() => weiter(hilfe.art === "falsch" ? hilfe.karte : undefined)} autoFocus data-testid="bl-weiter">
              Weiter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Nach einem Fehler bei der Familie: wer in deiner Liste noch dazugehört. */
function familieText(nr: number): string {
  const p = pflanze(nr)!;
  const andere = PFLANZEN.filter((q) => q.familie === p.familie && q.nr !== nr).map((q) => q.name);
  if (!andere.length) return `${mitArtikel(p.name).replace(/^./, (c) => c.toUpperCase())} ist die einzige Pflanze aus dieser Familie in deiner Liste.`;
  const liste = andere.length === 1 ? andere[0] : `${andere.slice(0, -1).join(", ")} und ${andere[andere.length - 1]}`;
  return `Zu den ${p.familie}n gehört auch ${liste}.`;
}

/** Die Sammlung: alle Blätter klein, die sicheren mit Haken, die noch nie gesehenen nur als Umriss. */
function Sammlung({ sicher, gesehen, n, laedt }: { sicher: number[]; gesehen: number[]; n: number; laedt?: boolean }) {
  return (
    <div className="ls-glas bl-sammlung mt-4 p-4" style={{ "--n": n } as CSSProperties} data-testid="bl-sammlung">
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold">Deine Sammlung</span>
        <span className="ls-klein tabular-nums" data-testid="bl-sicher">
          {laedt ? "…" : `${sicher.length} von ${PFLANZEN.length} sicher`}
        </span>
      </p>
      <div className="bl-mini mt-3" aria-hidden>
        {PFLANZEN.map((p) => (
          <span key={p.nr} data-stand={sicher.includes(p.nr) ? "sicher" : gesehen.includes(p.nr) ? "gesehen" : "neu"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={blattBild(p.nr)} alt="" loading="lazy" />
          </span>
        ))}
      </div>
      <p className="ls-klein mt-2">Sicher heißt: Pflanze und Familie zweimal hintereinander beim ersten Versuch richtig.</p>
    </div>
  );
}
