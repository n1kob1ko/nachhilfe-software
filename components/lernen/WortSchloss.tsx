"use client";

import "./lernspiel.css";
import "./arena.css";
import "./blockwerk.css";
import "./glasklar.css";
import "./wortschloss.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Delete, Flame, Heart, KeyRound, Lightbulb, LockOpen, Trophy, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { spielBeendenAction, tabletSpielBeendenAction, tabletWortStartenAction, wortStartenAction } from "@/app/lernspiel-actions";
import type { Bestenliste, SpielErgebnis, SpielKarte, SpielStart } from "@/lib/lernspiele-typen";
import { bewerte, ersteWahl, gross, tastatur, tastenFarben, WORT_HERZEN, WORT_PUNKTE, WORT_VERSUCHE, wortPunkte, type Farbe } from "@/lib/wortschloss";
import { BestenListe, Hintergrund, Konfetti } from "./Lernspiel";
import { Abriss, vibriere } from "./SpielTeile";
import { sicher, verbindungWeg } from "@/lib/verbindung";

/**
 * Wortschloss (lib/wortschloss.ts, docs/lernspiele.md „Wortschloss“): oben der Hinweis, darunter das Schloss mit sechs
 * Reihen, unten die Tastatur. Ist eine Reihe voll, zählt sie sofort (kein Knopf). Die Felder drehen sich und zeigen
 * grün, gold oder grau; die Tasten färben sich mit. Gelöst: das Schloss springt auf, das nächste Wort kommt. Nach sechs
 * Reihen ohne Lösung: ein Herz weg, ein Blatt zeigt das Wort und die Regel. Vier Wörter sind eine Stufe (eine Runde am
 * Server, wie Glasklar); ohne Herzen ist das Spiel aus.
 *
 * Gezählt wird je Wort die erste Reihe (`ersteWahl`). Die Punkte zählt das Gerät und meldet sie am Ende.
 * Am Laptop: Buchstaben tippen, die Rücktaste löscht.
 */

type Phase = "start" | "laden" | "spiel" | "ende";
type Stufe = { rundeId: number; nr: number; karten: SpielKarte[] };
export type WortThemaInfo = { id: string; name: string; fach: string; beispiel: string; grund?: string };

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)} %`);
const zahl = (n: number) => n.toLocaleString("de-AT");
const klein = (w: string) => w.toLowerCase();

export function WortSchloss({
  token,
  amTablet,
  themen,
  thema,
  serie: serieAnfang,
  rekord,
  bestenliste: bestenlisteAnfang,
  zurueck: zurueckZiel,
  themaLink,
  arenaLink,
}: {
  token: string;
  amTablet?: boolean;
  /** die Themen dieses Schülers, das passendste zuerst (lib/lernspiele.ts wortThemen) */
  themen: WortThemaInfo[];
  /** das gewählte Thema (id) */
  thema: string;
  serie: number;
  /** der beste Wortschloss-Stand des Schülers (0: noch keiner) */
  rekord: number;
  bestenliste?: Bestenliste;
  zurueck?: string;
  /** Link zu einem anderen Thema, ohne die id am Ende („…?modus=wort&thema=“) */
  themaLink: string;
  arenaLink?: string;
}) {
  const router = useRouter();
  const server = useMemo(
    () => ({
      starten: (lauf?: number, pausen?: number[]): Promise<SpielStart> => sicher(() => (amTablet ? tabletWortStartenAction(thema, lauf) : wortStartenAction(token, thema, lauf)), pausen),
      beenden: (id: number, antworten: { key: string; wahl: string }[], o?: { teil?: boolean; punkte?: number }): Promise<SpielErgebnis> => sicher(() => (amTablet ? tabletSpielBeendenAction(id, antworten, o) : spielBeendenAction(token, id, antworten, o))),
    }),
    [amTablet, token, thema],
  );
  const zurueck = zurueckZiel ?? `/lernen/${token}/spiele`;
  const ZuLink = amTablet ? "a" : Link;
  const gewaehlt = themen.find((t) => t.id === thema) ?? themen[0];

  const [phase, setPhase] = useState<Phase>("start");
  const [fehler, setFehler] = useState<string | null>(null);
  // die nächste Stufe kam auch nach mehreren Versuchen nicht (Deploy, kein Netz): anhalten, „Neu laden“ (lib/verbindung.ts)
  const [abgerissen, setAbgerissen] = useState(false);
  const [stufe, setStufe] = useState<Stufe | null>(null);
  // das wievielte Wort der Stufe, die fertigen Reihen und was gerade getippt wird
  const [pos, setPos] = useState(0);
  const [reihen, setReihen] = useState<string[]>([]);
  const [tipp, setTipp] = useState("");
  const [herzen, setHerzen] = useState(WORT_HERZEN);
  const [punkte, setPunkte] = useState(0);
  // gelöst (das Schloss springt auf) oder nicht gelöst (das Blatt mit dem Wort)
  const [offen, setOffen] = useState<{ punkte: number } | null>(null);
  const [blatt, setBlatt] = useState<SpielKarte | null>(null);
  const [wackelt, setWackelt] = useState(0);
  const [geschafft, setGeschafft] = useState<{ nr: number; bonus: number; herz: boolean } | null>(null);
  const [ergebnis, setErgebnis] = useState<SpielErgebnis | null>(null);
  const [daneben, setDaneben] = useState<SpielKarte[]>([]);
  const [richtigGesamt, setRichtigGesamt] = useState(0);

  const punkteRef = useRef(0);
  const herzenRef = useRef(WORT_HERZEN);
  const antworten = useRef(new Map<string, string>());
  // je Stufe: ein Wort nicht gelöst (kein Herz zurück), ein Wort nicht in der ersten Reihe (kein Bonus)
  const verlorenInStufe = useRef(false);
  const ersteReiheAlle = useRef(true);
  const lauf = useRef<number | null>(null);
  const vorrat = useRef<Promise<SpielStart> | null>(null);
  const abschluss = useRef<Promise<SpielErgebnis> | null>(null);
  const laufVorher = useRef<number | null | undefined>(undefined);
  const beschaeftigt = useRef(false);
  const reduziert = useRef(false);

  useEffect(() => {
    reduziert.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const alt = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = alt;
    };
  }, []);

  const karte = stufe?.karten[pos] ?? null;
  const ziel = karte ? klein(karte.richtig) : "";
  const tasten = useMemo(() => tastatur(stufe?.karten.map((k) => k.richtig) ?? []), [stufe]);
  const farben = useMemo(() => tastenFarben(reihen, ziel), [reihen, ziel]);

  const dazu = useCallback((p: number) => {
    punkteRef.current += p;
    setPunkte(punkteRef.current);
  }, []);

  const richteEin = useCallback((r: Extract<SpielStart, { rundeId: number }>) => {
    antworten.current = new Map();
    verlorenInStufe.current = false;
    ersteReiheAlle.current = true;
    setStufe({ rundeId: r.rundeId, nr: r.stufe ?? 1, karten: r.karten });
    setPos(0);
    setReihen([]);
    setTipp("");
    setOffen(null);
    setBlatt(null);
    setGeschafft(null);
  }, []);

  const starten = useCallback(async () => {
    setPhase("laden");
    setFehler(null);
    const r = await server.starten();
    if ("fehler" in r) {
      setFehler(r.fehler);
      setPhase("start");
      return;
    }
    lauf.current = r.endlos ?? r.rundeId;
    vorrat.current = null;
    abschluss.current = null;
    laufVorher.current = undefined;
    punkteRef.current = 0;
    herzenRef.current = WORT_HERZEN;
    beschaeftigt.current = false;
    setPunkte(0);
    setHerzen(WORT_HERZEN);
    setDaneben([]);
    setRichtigGesamt(0);
    setErgebnis(null);
    richteEin(r);
    setPhase("spiel");
  }, [server, richteEin]);

  const antwortListe = useCallback(() => [...antworten.current.entries()].map(([key, wahl]) => ({ key, wahl })), []);

  /** Ohne Herzen: die laufende Stufe zählt mit den Wörtern, die schon dran waren; die Punkte gehen mit. */
  const ende = useCallback(async () => {
    if (!stufe) return;
    setPhase("ende");
    const davor = await abschluss.current?.catch(() => null);
    let e = await server.beenden(stufe.rundeId, antwortListe(), { teil: true, punkte: punkteRef.current });
    const vorherStand = laufVorher.current !== undefined ? laufVorher.current : davor && !("fehler" in davor) ? davor.lernstandVorher : undefined;
    if (!("fehler" in e) && vorherStand !== undefined) e = { ...e, lernstandVorher: vorherStand };
    setErgebnis(e);
    router.refresh();
  }, [stufe, antwortListe, server, router]);

  /** Alle Wörter der Stufe sind dran gewesen: im Hintergrund zählen, die nächste Stufe holen (meist schon da). */
  const naechsteStufe = useCallback(async () => {
    if (!stufe || beschaeftigt.current) return;
    beschaeftigt.current = true;
    const id = stufe.rundeId;
    const liste = antwortListe();
    const fertig = server.beenden(id, liste);
    abschluss.current = fertig;
    void fertig.then((e) => {
      if (laufVorher.current === undefined && !("fehler" in e)) laufVorher.current = e.lernstandVorher;
      if (!("fehler" in e)) setRichtigGesamt((n) => n + e.richtig);
    });
    let r = await (vorrat.current ?? server.starten(lauf.current ?? undefined));
    // im Voraus geholt, während der Server neu startete: jetzt noch einmal
    if (vorrat.current && verbindungWeg(r)) r = await server.starten(lauf.current ?? undefined, [800]);
    vorrat.current = null;
    beschaeftigt.current = false;
    if (verbindungWeg(r)) {
      setAbgerissen(true);
      return;
    }
    if ("fehler" in r) {
      setPhase("ende");
      await fertig;
      const e = await server.beenden(id, liste, { teil: true, punkte: punkteRef.current });
      setErgebnis(!("fehler" in e) && laufVorher.current !== undefined ? { ...e, lernstandVorher: laufVorher.current } : e);
      router.refresh();
      return;
    }
    richteEin(r);
  }, [stufe, antwortListe, server, richteEin, router]);

  /** Das nächste Wort, oder die Stufe ist geschafft. */
  const weiterWort = useCallback(() => {
    if (!stufe) return;
    setOffen(null);
    setBlatt(null);
    if (herzenRef.current <= 0) {
      void ende();
      return;
    }
    if (pos + 1 < stufe.karten.length) {
      setPos(pos + 1);
      setReihen([]);
      setTipp("");
      // das vorletzte Wort: die nächste Stufe schon holen
      if (pos + 2 >= stufe.karten.length && !vorrat.current && lauf.current) vorrat.current = server.starten(lauf.current);
      return;
    }
    const bonus = WORT_PUNKTE.stufe * stufe.nr + (ersteReiheAlle.current ? WORT_PUNKTE.fehlerfrei * stufe.nr : 0);
    dazu(bonus);
    const herz = !verlorenInStufe.current && herzenRef.current < WORT_HERZEN;
    if (herz) {
      herzenRef.current += 1;
      setHerzen(herzenRef.current);
    }
    setGeschafft({ nr: stufe.nr, bonus, herz });
  }, [stufe, pos, ende, dazu, server]);

  useEffect(() => {
    if (!geschafft) return;
    const t = window.setTimeout(() => void naechsteStufe(), reduziert.current ? 900 : 1500);
    return () => window.clearTimeout(t);
  }, [geschafft, naechsteStufe]);

  // gelöst: kurz das offene Schloss zeigen, dann weiter
  useEffect(() => {
    if (!offen) return;
    const t = window.setTimeout(weiterWort, reduziert.current ? 700 : 1250);
    return () => window.clearTimeout(t);
  }, [offen, weiterWort]);

  /** Eine volle Reihe zählt sofort. */
  const reiheFertig = useCallback(
    (wort: string) => {
      if (!karte) return;
      const neu = [...reihen, wort];
      if (!antworten.current.has(karte.key)) antworten.current.set(karte.key, ersteWahl(wort, karte.richtig));
      setReihen(neu);
      setTipp("");
      if (wort === ziel) {
        const p = wortPunkte(neu.length, stufe?.nr ?? 1);
        if (neu.length > 1) ersteReiheAlle.current = false;
        dazu(p);
        vibriere([12, 40, 18]);
        setOffen({ punkte: p });
        return;
      }
      vibriere(neu.length >= WORT_VERSUCHE ? [40, 60, 40] : 8);
      if (neu.length >= WORT_VERSUCHE) {
        ersteReiheAlle.current = false;
        verlorenInStufe.current = true;
        herzenRef.current = Math.max(0, herzenRef.current - 1);
        setHerzen(herzenRef.current);
        setWackelt((n) => n + 1);
        setDaneben((d) => (d.some((x) => x.key === karte.key) ? d : [...d, karte]));
        setBlatt(karte);
      }
    },
    [karte, reihen, ziel, stufe, dazu],
  );

  const druecke = useCallback(
    (taste: string) => {
      if (phase !== "spiel" || !karte || offen || blatt || geschafft || reihen.length >= WORT_VERSUCHE) return;
      if (taste === "<") {
        if (tipp) {
          vibriere(3);
          setTipp(tipp.slice(0, -1));
        }
        return;
      }
      if (tipp.length >= ziel.length) return;
      vibriere(3);
      const neu = tipp + taste;
      setTipp(neu);
      // die Reihe ist voll: erst den Buchstaben zeigen, dann zählen
      if (neu.length === ziel.length) window.setTimeout(() => reiheFertig(neu), 120);
    },
    [phase, karte, offen, blatt, geschafft, reihen.length, tipp, ziel, reiheFertig],
  );

  useEffect(() => {
    if (phase !== "spiel") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (blatt) {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
          e.preventDefault();
          weiterWort();
        }
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        druecke("<");
        return;
      }
      const b = e.key.length === 1 ? e.key.toLowerCase() : "";
      if (b && tasten.flat().includes(b)) {
        e.preventDefault();
        druecke(b);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, blatt, tasten, druecke, weiterWort]);

  const deko = ["W", "O", "R", "T"];

  const kopf = (
    <div className="ls-kopf">
      {abgerissen && <Abriss />}
      <ZuLink href={zurueck} className="ls-zu treffer" aria-label="Spiel schließen">
        <X size={24} aria-hidden />
      </ZuLink>
      {phase === "spiel" ? (
        <>
          <div className="ls-herzen" role="img" aria-label={`${herzen} von ${WORT_HERZEN} Herzen`} data-testid="ws-herzen">
            {Array.from({ length: WORT_HERZEN }, (_, i) => (
              <Heart key={i} size={24} strokeWidth={2.2} fill="currentColor" data-an={i < herzen ? "" : undefined} aria-hidden />
            ))}
          </div>
          {stufe && (
            <span className="gk-stufe" data-testid="ws-stufe">
              <span className="ws-lang">Stufe {stufe.nr} · </span>
              {Math.min(pos + 1, stufe.karten.length)}/{stufe.karten.length}
            </span>
          )}
          <span className="ls-combo ls-endlos-stand" aria-label={`${punkte} Punkte`} data-testid="ws-punkte">
            <b key={punkte} data-neu="">
              {zahl(punkte)}
            </b>
          </span>
        </>
      ) : (
        <span className="flex-1" />
      )}
    </div>
  );

  if (phase === "start" || phase === "laden") {
    return (
      <div className="ls" role="dialog" aria-modal="true" aria-label="Lernspiel Wortschloss">
        <Hintergrund woerter={deko} />
        {kopf}
        <div className="ls-mitte ls-rollt ls-staffel">
          <p className="ls-oberzeile" style={{ "--n": 0 } as CSSProperties}>
            Lernspiel
          </p>
          <h1 className="ls-titel" style={{ "--n": 1 } as CSSProperties}>
            Wortschloss
          </h1>
          <p className="ls-text mt-2" style={{ "--n": 2 } as CSSProperties}>
            Tipp das Wort zum Hinweis. Ist die Reihe voll, zeigen die Felder: grün sitzt, gold ist an einer anderen Stelle, grau kommt nicht vor. Sechs Versuche je Wort.
          </p>
          <div className="ls-vorschau" aria-hidden style={{ "--n": 3 } as CSSProperties}>
            <MiniSchloss />
          </div>
          <p className="ls-klein mt-5" style={{ "--n": 3 } as CSSProperties}>
            Wörter aus
          </p>
          <div className="bw-fragen-aus mt-2" style={{ "--n": 3 } as CSSProperties} data-testid="ws-themen">
            {themen.length > 1 ? (
              themen.slice(0, 8).map((t) => (
                <ZuLink key={t.id} href={`${themaLink}${t.id}`} aria-current={t.id === gewaehlt?.id ? "true" : undefined}>
                  {t.name}
                </ZuLink>
              ))
            ) : (
              <span className="ls-grund">{gewaehlt?.name}</span>
            )}
          </div>
          {gewaehlt?.beispiel && (
            <p className="gk-sorten-vorschau mt-3" style={{ "--n": 3 } as CSSProperties} data-testid="ws-beispiel">
              Zum Beispiel: {gewaehlt.beispiel}
            </p>
          )}
          {gewaehlt?.grund && (
            <span className="ls-grund mt-3" style={{ "--n": 3 } as CSSProperties} data-testid="ws-grund">
              <BookOpen size={16} aria-hidden />
              {gewaehlt.grund}
            </span>
          )}
          <div className="ls-glas mt-6 grid grid-cols-2 gap-4 p-4" style={{ "--n": 4 } as CSSProperties}>
            <div>
              <p className="ls-klein">Rekord</p>
              <p className="text-[22px] font-semibold tabular-nums">{rekord > 0 ? zahl(rekord) : "Noch keiner"}</p>
            </div>
            <div>
              <p className="ls-klein">Serie</p>
              <p className="flex items-center gap-1.5 text-[22px] font-semibold tabular-nums">
                <Flame size={20} className={serieAnfang > 0 ? "ls-flamme" : "opacity-60"} fill={serieAnfang > 0 ? "currentColor" : "none"} aria-hidden />
                {serieAnfang === 0 ? "Heute starten" : serieAnfang === 1 ? "1 Tag" : `${serieAnfang} Tage`}
              </p>
            </div>
          </div>
          {bestenlisteAnfang && <BestenListe liste={bestenlisteAnfang} arenaLink={arenaLink} n={5} />}
          {fehler && (
            <p className="ls-fehler mt-6" role="alert">
              {fehler}
            </p>
          )}
        </div>
        <div className="ls-fuss ls-staffel">
          <div className="grid gap-3" style={{ "--n": 6 } as CSSProperties}>
            <button type="button" className="ls-knopf ls-los" onClick={() => void starten()} disabled={phase === "laden" || !gewaehlt} autoFocus data-testid="ws-start">
              {phase === "laden" ? "Das Schloss wird gebaut …" : "Los geht’s"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "ende") {
    const e = ergebnis && !("fehler" in ergebnis) ? ergebnis : null;
    const stand = punkteRef.current;
    const bisher = e?.wort?.rekord ?? rekord;
    const neuerRekord = !!e && stand > 0 && stand > bisher;
    const anteil = bisher > 0 ? Math.min(100, Math.round((stand / bisher) * 100)) : stand > 0 ? 100 : 0;
    const gewusst = e?.wort?.woerter ?? richtigGesamt;
    return (
      <div className="ls" role="dialog" aria-modal="true" aria-label="Wortschloss vorbei">
        <Hintergrund woerter={deko} />
        {neuerRekord && <Konfetti />}
        {kopf}
        <div className="ls-mitte ls-staffel text-center">
          <div className="ls-ring" style={{ "--n": 0 } as CSSProperties} data-testid="ws-ende">
            <svg viewBox="0 0 120 120" aria-hidden>
              <circle cx="60" cy="60" r="50" pathLength={100} className="ls-ring-spur" />
              <circle cx="60" cy="60" r="50" pathLength={100} className="ls-ring-wert" style={{ strokeDashoffset: 100 - anteil } as CSSProperties} />
            </svg>
            <div className="ls-ring-zahl" data-lang={Math.min(9, Math.max(3, zahl(stand).length))}>
              <b>{zahl(stand)}</b>
              <span>Punkte</span>
            </div>
          </div>
          <h1 className="bw-ende-titel" style={{ "--n": 1 } as CSSProperties}>
            {neuerRekord && <Trophy size={26} strokeWidth={2.4} aria-hidden />}
            {neuerRekord ? "Neuer Rekord!" : herzen <= 0 ? "Keine Herzen mehr" : "Alle Schlösser offen"}
          </h1>
          <p className="ls-text mt-1" style={{ "--n": 1 } as CSSProperties}>
            Stufe {stufe?.nr ?? 1} · {gewusst} {gewusst === 1 ? "Wort" : "Wörter"} auf Anhieb
            {!neuerRekord && bisher > 0 ? ` · Rekord ${zahl(bisher)}` : ""}
          </p>
          {ergebnis && "fehler" in ergebnis && (
            <p className="ls-fehler mt-4" role="alert">
              {ergebnis.fehler}
            </p>
          )}
          <div className="bw-ende-stand ls-glas" style={{ "--n": 2 } as CSSProperties}>
            <span className="min-w-0 truncate">
              <span className="opacity-75">{gewaehlt?.name}</span>{" "}
              <b className="tabular-nums">{e ? (e.lernstandVorher === null || pct(e.lernstandVorher) === pct(e.lernstandNachher) ? pct(e.lernstandNachher) : `${pct(e.lernstandVorher)} → ${pct(e.lernstandNachher)}`) : "…"}</b>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <Flame size={16} className="ls-flamme" fill="currentColor" aria-hidden />
              <b className="tabular-nums">{e ? (e.serie === 1 ? "1 Tag" : `${e.serie} Tage`) : "…"}</b>
            </span>
          </div>
          {(e?.wort?.bestenliste ?? bestenlisteAnfang) && <BestenListe liste={(e?.wort?.bestenliste ?? bestenlisteAnfang)!} arenaLink={arenaLink} n={3} />}
          {daneben.length > 0 && (
            <div className="ls-blatt mt-4 p-4 text-left" style={{ "--n": 4 } as CSSProperties}>
              <p className="text-[15px] font-semibold">Kommt nächstes Mal wieder</p>
              <ul className="mt-2 space-y-1.5 text-[16px]">
                {daneben.slice(0, 5).map((k) => (
                  <li key={k.key}>{k.loesung}</li>
                ))}
              </ul>
              {daneben.length > 5 && <p className="mt-2 text-[14px] text-ink-3">und {daneben.length - 5} weitere</p>}
            </div>
          )}
          <div className="mt-auto grid gap-3 pt-8" style={{ "--n": 5 } as CSSProperties}>
            <button type="button" className="ls-knopf ls-los" onClick={() => void starten()} disabled={!ergebnis} autoFocus data-testid="ws-nochmal">
              Nochmal
            </button>
            <ZuLink href={zurueck} className="ls-knopf ls-los" data-zweit="">
              Fertig
            </ZuLink>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Spiel ----------
  if (!stufe || !karte) return null;
  const n = ziel.length;
  const geloestReihe = offen ? reihen.length - 1 : -1;

  return (
    <div className="ls" role="dialog" aria-modal="true" aria-label="Lernspiel Wortschloss">
      <Hintergrund woerter={deko} />
      {kopf}
      <div className="ws" style={{ "--n-buchstaben": n } as CSSProperties}>
        <div key={karte.key} className="ws-hinweis" data-testid="ws-hinweis">
          {karte.marke && <span className="ws-marke">{karte.marke}</span>}
          <p className="ws-wort" data-lang={(karte.wort ?? "").length > 40 ? "l" : (karte.wort ?? "").length > 18 ? "m" : undefined}>
            {karte.wort}
          </p>
        </div>

        <div className="ws-schloss" data-offen={offen ? "" : undefined} data-wackelt={wackelt ? wackelt % 2 : undefined} role="grid" aria-label={`Schloss mit ${n} Buchstaben`} data-testid="ws-schloss">
          <span className="ws-buegel" aria-hidden>
            {offen ? <LockOpen size={22} strokeWidth={2.6} /> : <KeyRound size={20} strokeWidth={2.6} />}
          </span>
          {offen && (
            <span className="ws-plus" role="status" data-testid="ws-plus">
              {reihen.length === 1 ? "Auf Anhieb!" : "Offen!"} +{zahl(offen.punkte)}
            </span>
          )}
          {Array.from({ length: WORT_VERSUCHE }, (_, r) => {
            const fertig = reihen[r];
            const aktiv = r === reihen.length && !offen && !blatt;
            const f: Farbe[] | null = fertig ? bewerte(fertig, ziel) : null;
            const text = fertig ?? (aktiv ? tipp : "");
            return (
              <div key={r} className="ws-reihe" role="row" data-aktiv={aktiv ? "" : undefined} data-geloest={r === geloestReihe ? "" : undefined} data-testid={`ws-reihe-${r}`}>
                {Array.from({ length: n }, (_, i) => {
                  const b = text[i] ?? "";
                  return (
                    <span
                      key={`${r}-${i}-${fertig ? "f" : b}`}
                      className="ws-feld"
                      role="gridcell"
                      data-f={f?.[i]}
                      data-voll={b ? "" : undefined}
                      style={{ "--i": i } as CSSProperties}
                      aria-label={b ? `${gross(b)}${f ? `, ${f[i] === "ja" ? "richtig" : f[i] === "fast" ? "an anderer Stelle" : "nicht im Wort"}` : ""}` : "leer"}
                    >
                      {b ? gross(b) : ""}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="ws-tastatur" role="group" aria-label="Tastatur" data-testid="ws-tastatur">
          {tasten.map((reihe, ri) => (
            <div key={ri} className="ws-tastenreihe">
              {reihe.map((b) => (
                <button key={b} type="button" className="ws-taste ohne-druck" data-f={farben.get(b)} onClick={() => druecke(b)} aria-label={gross(b)} data-testid={`ws-taste-${b}`}>
                  {gross(b)}
                </button>
              ))}
              {ri === tasten.length - 1 && (
                <button type="button" className="ws-taste ws-loeschen ohne-druck" onClick={() => druecke("<")} disabled={!tipp} aria-label="Letzten Buchstaben löschen" data-testid="ws-loeschen">
                  <Delete size={22} aria-hidden />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {geschafft && (
        <div className="gk-geschafft" role="status" data-testid="ws-geschafft">
          <p className="gk-geschafft-titel">Stufe {geschafft.nr} geschafft!</p>
          <p className="gk-geschafft-punkte">+{zahl(geschafft.bonus)}</p>
          {geschafft.herz && (
            <p className="gk-geschafft-herz">
              <Heart size={18} fill="currentColor" aria-hidden /> Kein Wort verloren: ein Herz zurück
            </p>
          )}
        </div>
      )}

      {blatt && (
        <div className="gk-blatt-schirm" onClick={weiterWort}>
          <div className="ls-regel gk-regel" role="alertdialog" aria-label="Das Wort war" onClick={(e) => e.stopPropagation()} data-testid="ws-blatt">
            <p className="ls-regel-kopf">
              <Lightbulb size={16} aria-hidden /> Das Wort war
            </p>
            <p className="ws-loesung" data-testid="ws-loesung">
              {[...klein(blatt.richtig)].map((b, i) => (
                <span key={i}>{gross(b)}</span>
              ))}
            </p>
            {blatt.regel && <p className="ls-regel-text">{blatt.regel}</p>}
            <button type="button" className="ls-knopf ls-los mt-3" onClick={weiterWort} autoFocus data-testid="ws-weiter">
              {herzen <= 0 ? "Zum Ergebnis" : "Weiter"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Ein kleines Schloss für den Anfang: eine Reihe mit den drei Farben. */
function MiniSchloss() {
  const f: Farbe[] = ["ja", "nein", "fast", "ja", "nein"];
  return (
    <span className="ws-mini">
      {[..."TRANK"].map((b, i) => (
        <i key={i} data-f={f[i]}>
          {b}
        </i>
      ))}
    </span>
  );
}
