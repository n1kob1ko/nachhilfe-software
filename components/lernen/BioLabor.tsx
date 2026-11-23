"use client";

import "./lernspiel.css";
import "./phantombild.css";
import "./biolabor.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Blocks, BookOpen, Check, Eye, EyeOff, Flame, FlaskConical, Grid2x2, Heart, Lock, Map as KarteIcon, PenLine, Star, Swords, Volume2, VolumeX, X, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { bioStartenAction, spielBeendenAction, tabletBioStartenAction, tabletSpielBeendenAction } from "@/app/lernspiel-actions";
import { BIO_EINTRAEGE, BIO_THEMEN, felder, feldWahl, GROSSER_TEST, LEBEN, LEVEL_TITEL, LEVELS, levelAuswahl, levelOffen, levelVon, pruefeGeschrieben, pruefeSchema, sterneFuer, thema as themaVon, WELT_ANFANG, type BioAuswahl, type BioDaten, type BioModus } from "@/lib/biolabor";
import type { SpielErgebnis, SpielKarte } from "@/lib/lernspiele-typen";
import { aufTon, klang, setzeTon, tonAn } from "./klang";
import { Konfetti } from "./Lernspiel";
import { vibriere } from "./SpielTeile";

/**
 * Biolabor (lib/biolabor.ts, docs/lernspiele.md „Biolabor“): Genetik und Nervensystem für den Biologie-Test der 4.
 * Klasse. Oben das Thema, darunter die Frage. „Üben“: Antworten antippen, im Kreuzungsschema
 * sind die Keimzellen vorgegeben. „Wie im Test“: Begriffe schreiben, offene Fragen selbst kontrollieren, im Schema
 * auch die Keimzellen eintragen. Ein Fehler zeigt die Lösung und das Merke; die Karte kommt drei Karten später noch
 * einmal (Merksatz: merkeFuer in lib/biolabor.ts). Bilder und Animationen zum Stoff gibt es bewusst keine (niko 2026-11-23). Gezählt wird der erste Versuch. Erbsi, die Labor-Erbse, freut sich mit (Bilder mit Higgsfield gemacht).
 *
 * Labor-Mission (niko 2026-11-23 „kein richtiges spiel“): die Fragen der Lehrerin als Level auf einer Karte. In
 * jedem Level steht ein Keim; jede richtige Antwort ist ein Treffer (schnell beim ersten Versuch: kritisch, mehr
 * Punkte), jede falsche beim ersten Versuch kostet ein Herz. Drei Herzen, Sterne = übrige Herzen; ein Stern öffnet
 * das nächste Level (lib/biolabor.ts levelStand, levelOffen).
 */

type Phase = "karte" | "start" | "laden" | "spiel" | "ende" | "lernzettel";
type Runde = { rundeId: number; karten: SpielKarte[]; auswahl: BioAuswahl; modus: BioModus; gross: boolean };
type Hilfe = { karte: SpielKarte; art: "falsch" | "fast"; eingabe?: string };
type ThemaStand = { id: string; titel: string; bereich: "genetik" | "mensch"; sicher: number; gesehen: number; alle: number };

const WIEDER_NACH = 3;
/** So schnell beim ersten Versuch ist ein Treffer kritisch (ms): Kacheln antippen, Antwort schreiben. */
const KRITISCH_MS: Partial<Record<BioDaten["art"], number>> = { kacheln: 7000, schreiben: 15000 };
type Kampf = { herzen: number; punkte: number; besiegt: string[] };
type Effekt = { art: "treffer" | "kritisch" | "angriff"; wert: number; n: number };
const KAMPF_ANFANG: Kampf = { herzen: LEBEN, punkte: 0, besiegt: [] };

/** Die Keime der Level (Higgsfield, public/spiele/biolabor/keim-*.webp); am Ende jeder Welt der Boss. */
const KEIME = [
  { bild: "bakterie", name: "Bakti" },
  { bild: "virus", name: "Virax" },
  { bild: "stab", name: "Stäbchen-Bandit" },
  { bild: "pilz", name: "Schimmelino" },
  { bild: "amoebe", name: "Amöbix" },
];
const BOSS = { bild: "boss", name: "König Phago" };
/** Der Pfad auf der Karte schlängelt sich (Versatz je Stufe). */
const PFAD_X = ["0px", "48px", "72px", "48px", "0px", "-48px", "-72px", "-48px"];
const istBoss = (n: number) => n === 19 || n === LEVELS[LEVELS.length - 1];
const keimFuer = (n: number) => (istBoss(n) ? BOSS : KEIME[LEVELS.indexOf(n) % KEIME.length]);
const AUSWAHL_NAME: Record<string, string> = { alle: "Alles", genetik: "Genetik", mensch: "Der Mensch" };
const auswahlName = (a: BioAuswahl) => AUSWAHL_NAME[a] ?? themaVon(a)?.titel ?? "Alles";

export function BioLabor({
  token,
  amTablet,
  serie: serieAnfang,
  themen: themenAnfang,
  sicher: sicherAnfang,
  level: levelAnfang,
  grund,
  zurueck: zurueckZiel,
}: {
  token: string;
  amTablet?: boolean;
  serie: number;
  /** je Thema: sicher, gesehen, alle (lib/biolabor.ts themenStand) */
  themen: ThemaStand[];
  /** die Einträge, die sicher sitzen */
  sicher: string[];
  /** Labor-Mission: Sterne je Level (lib/biolabor.ts levelStand) */
  level?: Record<number, number>;
  /** warum es gerade passt („Biologie-Test in 3 Tagen“) */
  grund?: string;
  zurueck?: string;
}) {
  const router = useRouter();
  const server = useMemo(
    () => ({
      starten: (a: BioAuswahl, m: BioModus, g: boolean) => (amTablet ? tabletBioStartenAction(a, m, g) : bioStartenAction(token, a, m, g)),
      beenden: (id: number, antworten: { key: string; wahl: string }[]) => (amTablet ? tabletSpielBeendenAction(id, antworten) : spielBeendenAction(token, id, antworten)),
    }),
    [amTablet, token],
  );
  const zurueck = zurueckZiel ?? `/lernen/${token}/spiele`;
  const ZuLink = amTablet ? "a" : Link;

  const [phase, setPhase] = useState<Phase>("karte");
  const [fehler, setFehler] = useState<string | null>(null);
  const [ton, setTon] = useState(true);
  const [auswahl, setAuswahl] = useState<BioAuswahl>("alle");
  // „Mehr üben“: die Themen aus dem Buch, erst nach einem Tipp
  const [mehr, setMehr] = useState(false);
  // der Lernzettel: nur diese Themen (Lösungen der Lehrerin und Glossar), null = alle
  const [zettel, setZettel] = useState<string[] | null>(null);
  const [sicher, setSicher] = useState<Set<string>>(new Set(sicherAnfang));
  const [gesehen, setGesehen] = useState<Set<string>>(new Set());
  const [runde, setRunde] = useState<Runde | null>(null);
  const [reihe, setReihe] = useState<SpielKarte[]>([]);
  const [pos, setPos] = useState(0);
  const [wahl, setWahl] = useState<{ wert: string; ok: boolean } | null>(null);
  const [hilfe, setHilfe] = useState<Hilfe | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [folge, setFolge] = useState(0);
  const [beste, setBeste] = useState(0);
  const [ergebnis, setErgebnis] = useState<SpielErgebnis | null>(null);
  const [daneben, setDaneben] = useState<SpielKarte[]>([]);
  const [levelStand, setLevelStand] = useState<Record<number, number>>(levelAnfang ?? {});
  const [kampf, setKampf] = useState<Kampf>(KAMPF_ANFANG);
  const [effekt, setEffekt] = useState<Effekt | null>(null);
  const gezeigt = useRef(0);
  const auswahlLaden = useRef<BioAuswahl>("alle");

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

  // der Stand je Thema, nach jeder Runde aus `sicher` und `gesehen` neu gezählt
  const themen = useMemo(
    () =>
      themenAnfang.map((t) => {
        const liste = BIO_EINTRAEGE.filter((e) => e.thema === t.id);
        return { ...t, sicher: liste.filter((e) => sicher.has(e.id)).length, gesehen: Math.max(t.gesehen, liste.filter((e) => gesehen.has(e.id)).length) };
      }),
    [themenAnfang, sicher, gesehen],
  );
  const alleSicher = themen.reduce((n, t) => n + t.sicher, 0);
  const lehrerin = themen.find((t) => t.id === "lehrerin");
  const alleAnzahl = themen.reduce((n, t) => n + t.alle, 0);

  const karte = reihe[pos] ?? null;
  const daten: BioDaten | null = karte?.bio ?? null;

  const starten = useCallback(
    async (a: BioAuswahl, m: BioModus, g = false) => {
      auswahlLaden.current = a;
      setPhase("laden");
      setFehler(null);
      const r = await server.starten(a, m, g);
      if ("fehler" in r) {
        setFehler(r.fehler);
        setPhase(levelVon(a) !== null ? "karte" : "start");
        return;
      }
      antworten.current = new Map();
      wieder.current = new Map();
      setRunde({ rundeId: r.rundeId, karten: r.karten, auswahl: a, modus: g ? "test" : m, gross: g });
      setReihe(r.karten);
      setPos(0);
      setWahl(null);
      setHilfe(null);
      setEingabe("");
      setFolge(0);
      setBeste(0);
      setErgebnis(null);
      setDaneben([]);
      setKampf(KAMPF_ANFANG);
      setEffekt(null);
      setPhase("spiel");
    },
    [server],
  );

  const fertig = useCallback(async () => {
    if (!runde) return;
    setPhase("ende");
    const liste = [...antworten.current.entries()].map(([key, w]) => ({ key, wahl: w }));
    const richtig = runde.karten.filter((k) => antworten.current.get(k.key) === k.richtig).length;
    if (levelVon(runde.auswahl) !== null) spiele((k) => (kampf.herzen > 0 ? k.rekord() : k.aus()));
    else spiele((k) => (richtig / Math.max(1, runde.karten.length) >= 0.7 ? k.frei() : k.aus()));
    const e = await server.beenden(runde.rundeId, liste);
    setErgebnis(e);
    if (!("fehler" in e) && e.bio) {
      setSicher(new Set(e.bio.sicher));
      if (e.bio.level) setLevelStand(e.bio.level);
    }
    setGesehen((g) => new Set([...g, ...runde.karten.map((k) => k.bio?.eintrag ?? "")].filter(Boolean)));
    router.refresh();
  }, [runde, server, router, spiele, kampf.herzen]);

  const weiter = useCallback(
    (nochmal?: SpielKarte) => {
      setWahl(null);
      setHilfe(null);
      setEffekt(null);
      setEingabe("");
      let neu = reihe;
      if (nochmal && nochmal.bio?.art !== "selbst" && (wieder.current.get(nochmal.key) ?? 0) < 2) {
        wieder.current.set(nochmal.key, (wieder.current.get(nochmal.key) ?? 0) + 1);
        neu = [...reihe];
        neu.splice(Math.min(neu.length, pos + 1 + WIEDER_NACH), 0, nochmal);
        setReihe(neu);
      }
      if (pos + 1 >= neu.length || (runde && levelVon(runde.auswahl) !== null && kampf.herzen <= 0)) void fertig();
      else setPos(pos + 1);
    },
    [reihe, pos, fertig, runde, kampf.herzen],
  );

  /** Eine Antwort: `wert` ist das, was zählt (bei „fast“ schon die richtige Schreibweise). */
  const antworte = useCallback(
    (wert: string, o: { fast?: boolean; eingabe?: string; still?: boolean } = {}) => {
      if (!karte || !daten || wahl || hilfe) return;
      const erste = !antworten.current.has(karte.key);
      if (erste) antworten.current.set(karte.key, wert);
      const ok = wert === karte.richtig;
      setWahl({ wert: o.eingabe ?? wert, ok });
      if (runde && levelVon(runde.auswahl) !== null) {
        const n = Date.now();
        if (ok) {
          const grenze = KRITISCH_MS[daten.art];
          const kritisch = erste && (folge >= 2 || (grenze !== undefined && n - gezeigt.current < grenze));
          const punkte = erste ? (kritisch ? 150 : 100) + Math.min(folge, 5) * 10 : 40;
          setKampf((k) => ({ ...k, punkte: k.punkte + punkte, besiegt: k.besiegt.includes(karte.key) ? k.besiegt : [...k.besiegt, karte.key] }));
          setEffekt({ art: kritisch ? "kritisch" : "treffer", wert: punkte, n });
        } else {
          if (erste) setKampf((k) => ({ ...k, herzen: Math.max(0, k.herzen - 1) }));
          setEffekt({ art: "angriff", wert: erste ? 1 : 0, n });
        }
      }
      if (ok) {
        if (erste) {
          setFolge((f) => {
            const n = f + 1;
            setBeste((b) => Math.max(b, n));
            return n;
          });
        }
        spiele((k) => k.richtig(erste && folge >= 2));
        vibriere(12);
        if (o.fast) setHilfe({ karte, art: "fast", eingabe: o.eingabe });
        return;
      }
      setFolge(0);
      setDaneben((d) => (d.some((k) => k.key === karte.key) ? d : [...d, karte]));
      spiele((k) => k.falsch());
      vibriere([40, 60, 40]);
      if (!o.still) setHilfe({ karte, art: "falsch", eingabe: o.eingabe });
    },
    [karte, daten, wahl, hilfe, spiele, folge, runde],
  );

  // richtig: kurz zeigen, dann weiter (Schema und Selbstkontrolle gehen mit „Weiter“)
  useEffect(() => {
    if (!wahl?.ok || hilfe || daten?.art === "schema" || daten?.art === "selbst") return;
    const t = window.setTimeout(() => weiter(), reduziert.current ? 300 : 750);
    return () => window.clearTimeout(t);
  }, [wahl, hilfe, weiter, daten]);

  // auf der Karte: das Level, das jetzt dran ist, in die Mitte
  useEffect(() => {
    if (phase !== "karte") return;
    document.querySelector(".bio-knoten[data-jetzt]")?.scrollIntoView({ block: "center" });
  }, [phase]);

  // wann die Karte kam (für kritische Treffer)
  useEffect(() => {
    gezeigt.current = Date.now();
  }, [pos, reihe]);

  useEffect(() => {
    if (phase === "spiel" && daten?.art === "schreiben" && !hilfe && !wahl) feld.current?.focus({ preventScroll: true });
  }, [phase, daten, hilfe, wahl, pos]);

  // am Laptop: Ziffern für die Kacheln, Eingabe für „Weiter“
  useEffect(() => {
    if (phase !== "spiel") return;
    const taste = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (hilfe && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        weiter(hilfe.art === "falsch" ? hilfe.karte : undefined);
        return;
      }
      if (!karte || daten?.art !== "kacheln" || wahl) return;
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
    const r = pruefeGeschrieben(text, [karte.richtig, ...(daten.auch ?? [])]);
    if (r === "falsch") antworte(text, { eingabe: text });
    else antworte(karte.richtig, { fast: r === "fast", eingabe: text });
  };

  const imLevel = phase === "spiel" && runde ? levelVon(runde.auswahl) : null;
  const kopf = (
    <div className="ls-kopf">
      {imLevel !== null || (phase === "ende" && runde && levelVon(runde.auswahl) !== null) ? (
        <button type="button" className="ls-zu treffer" onClick={() => setPhase("karte")} aria-label="Zur Karte" data-testid="bio-zur-karte">
          <ArrowLeft size={24} aria-hidden />
        </button>
      ) : (
        <ZuLink href={zurueck} className="ls-zu treffer" aria-label="Spiel schließen">
          <X size={24} aria-hidden />
        </ZuLink>
      )}
      {imLevel !== null ? (
        <>
          <span className="bio-herzen" aria-label={`${kampf.herzen} von ${LEBEN} Herzen`} data-testid="bio-herzen" data-herzen={kampf.herzen}>
            {Array.from({ length: LEBEN }, (_, i) => (
              <Heart key={i} size={22} fill={i < kampf.herzen ? "currentColor" : "none"} data-weg={i >= kampf.herzen ? "" : undefined} aria-hidden />
            ))}
          </span>
          <span className="bio-score tabular-nums" data-testid="bio-score">
            <b key={kampf.punkte}>{kampf.punkte}</b>
          </span>
          <span className="ls-combo bio-folge" data-heiss={folge >= 3 ? "" : undefined} aria-label={`${folge} richtig in Folge`} data-testid="bio-folge">
            <Zap size={16} aria-hidden />
            <b key={folge}>{folge}</b>
          </span>
        </>
      ) : phase === "spiel" && runde ? (
        <>
          <span className="pb-fortschritt" role="progressbar" aria-valuemin={0} aria-valuemax={reihe.length} aria-valuenow={pos} aria-label="Fortschritt">
            <i style={{ width: `${Math.round((pos / Math.max(1, reihe.length)) * 100)}%` }} />
          </span>
          <span className="ls-combo bio-folge" data-heiss={folge >= 3 ? "" : undefined} aria-label={`${folge} richtig in Folge`} data-testid="bio-folge">
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

  // ---------- Labor-Mission: die Karte ----------

  if (phase === "karte") {
    const summe = LEVELS.reduce((n, l) => n + (levelStand[l] ?? 0), 0);
    const jetzt = LEVELS.find((l) => levelOffen(l, levelStand) && !levelStand[l]) ?? null;
    return (
      <div className="ls bio" role="dialog" aria-modal="true" aria-label="Biolabor: Labor-Mission">
        {kopf}
        <div className="ls-mitte ls-rollt bio-mission" data-testid="bio-karte-seite">
          <div className="bio-start-kopf">
            <Erbsi pose="ruhig" />
            <div className="min-w-0">
              <p className="ls-oberzeile">Biolabor</p>
              <h1 className="ls-titel">Labor-Mission</h1>
              <p className="bio-sprech">Besiege die Keime mit den Fragen der Lehrerin!</p>
            </div>
          </div>
          <div className="bio-mission-stand">
            <span className="bio-mission-sterne tabular-nums" data-testid="bio-sterne-gesamt">
              <Star size={20} fill="currentColor" aria-hidden /> {summe} von {LEVELS.length * 3}
            </span>
            {grund && (
              <span className="ls-grund" data-testid="bio-grund">
                <BookOpen size={16} aria-hidden />
                {grund}
              </span>
            )}
          </div>
          <ol className="bio-pfad" data-testid="bio-pfad">
            {LEVELS.map((n, i) => {
              const offen = levelOffen(n, levelStand);
              const sterne = levelStand[n] ?? 0;
              const keim = keimFuer(n);
              const welt = WELT_ANFANG.indexOf(n);
              return (
                <li key={n} className="bio-pfad-stufe" style={{ "--x": PFAD_X[i % PFAD_X.length] } as CSSProperties}>
                  {welt >= 0 && <p className="bio-welt">{welt === 0 ? "Welt 1 · Genetik" : "Welt 2 · Nervensystem und Hormone"}</p>}
                  <button
                    type="button"
                    className="bio-knoten"
                    data-zustand={!offen ? "zu" : sterne > 0 ? "geschafft" : "offen"}
                    data-jetzt={n === jetzt ? "" : undefined}
                    data-boss={istBoss(n) ? "" : undefined}
                    disabled={!offen}
                    onClick={() => void starten(levelAuswahl(n), "test")}
                    aria-label={`Level ${n}: ${LEVEL_TITEL[n]}${offen ? `, ${sterne} von 3 Sternen` : ", noch zu"}`}
                    data-testid={`bio-level-${n}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/spiele/biolabor/keim-${keim.bild}.webp`} alt="" aria-hidden draggable={false} className="bio-knoten-keim" data-besiegt={sterne > 0 ? "" : undefined} />
                    <span className="bio-knoten-zahl">{offen ? n : <Lock size={16} aria-hidden />}</span>
                  </button>
                  <span className="bio-knoten-name">{LEVEL_TITEL[n]}</span>
                  <span className="bio-knoten-sterne" aria-hidden>
                    {[0, 1, 2].map((s) => (
                      <Star key={s} size={14} fill={s < sterne ? "currentColor" : "none"} data-an={s < sterne ? "" : undefined} />
                    ))}
                  </span>
                </li>
              );
            })}
          </ol>

          <p className="bio-themen-titel mt-6">Mehr zum Lernen</p>
          <div className="pb-wahl mt-2">
            <ZuLink href={amTablet ? "/geraet/ansicht?zu=bloecke:bio" : `/lernen/${token}/spiel?modus=bloecke&art=bio`} className="pb-wahl-knopf" data-testid="bio-start-blockwerk">
              <Blocks size={26} aria-hidden />
              <span>
                <b>Blockwerk</b>
                <small>Das Blockspiel mit den Fragen der Lehrerin und deinem Glossar. Jede Antwort schreibst du selbst.</small>
              </span>
            </ZuLink>
            <button type="button" className="pb-wahl-knopf" onClick={() => { setZettel(["lehrerin", "heft"]); setPhase("lernzettel"); }} data-testid="bio-loesungen">
              <BookOpen size={26} aria-hidden />
              <span>
                <b>Lösungen zum Nachlesen</b>
                <small>Die Antwort zu jeder Frage der Lehrerin und dein Glossar.</small>
              </span>
            </button>
            <button type="button" className="pb-wahl-knopf" onClick={() => setPhase("start")} data-testid="bio-andere">
              <FlaskConical size={26} aria-hidden />
              <span>
                <b>Andere Übungen</b>
                <small>Dein Glossar, alle Fragen der Reihe nach, Themen aus dem Buch, großer Test.</small>
              </span>
            </button>
          </div>
          {fehler && (
            <p className="ls-fehler mt-6" role="alert">
              {fehler}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---------- Start ----------

  if (phase === "laden" && levelVon(auswahlLaden.current) !== null) {
    return (
      <div className="ls bio" role="dialog" aria-modal="true" aria-label="Biolabor">
        {kopf}
        <div className="ls-mitte items-center justify-center text-center">
          <p className="ls-klein">Der Keim kommt …</p>
        </div>
      </div>
    );
  }

  if (phase === "start" || phase === "laden") {
    const name = auswahlName(auswahl);
    return (
      <div className="ls bio" role="dialog" aria-modal="true" aria-label="Lernspiel Biolabor">
        {kopf}
        <div className="ls-mitte ls-rollt ls-staffel">
          <p className="ls-oberzeile" style={{ "--n": 0 } as CSSProperties}>
            Lernspiel · Biologie
          </p>
          <div className="bio-start-kopf" style={{ "--n": 1 } as CSSProperties}>
            <Erbsi pose="ruhig" />
            <div className="min-w-0">
              <h1 className="ls-titel">Biolabor</h1>
              <p className="bio-sprech">{grund ? "Wir machen dich fit für den Test!" : "Genetik und Nervensystem, Schritt für Schritt."}</p>
            </div>
          </div>
          {grund && (
            <span className="ls-grund mt-1" style={{ "--n": 2 } as CSSProperties} data-testid="bio-grund">
              <BookOpen size={16} aria-hidden />
              {grund}
            </span>
          )}

          {/* niko 2026-11-23 „es sind zu viele Fragen“: oben nur der Fragenkatalog der Lehrerin, Blockwerk und das eigene Glossar */}
          <div className="pb-wahl mt-4" style={{ "--n": 2 } as CSSProperties}>
            <button type="button" className="pb-wahl-knopf bio-wichtig" onClick={() => setPhase("karte")} disabled={phase === "laden"} data-testid="bio-start-mission" autoFocus>
              <Swords size={26} aria-hidden />
              <span>
                <b>Labor-Mission</b>
                <small>Die Fragen der Lehrerin als Level: besiege die Keime.</small>
              </span>
            </button>
            <button type="button" className="pb-wahl-knopf" onClick={() => void starten("lehrerin", "test")} disabled={phase === "laden"} data-testid="bio-start-lehrerin">
              <Star size={26} aria-hidden />
              <span>
                <b>Fragen der Lehrerin am Stück</b>
                <small>
                  Alle Fragen vom Blatt der Reihe nach, ohne Level.{" "}
                  {lehrerin ? `${lehrerin.sicher} von ${lehrerin.alle} sicher.` : ""}
                </small>
              </span>
            </button>
            <button type="button" className="pb-wahl-knopf" onClick={() => void starten("heft", "test")} disabled={phase === "laden"} data-testid="bio-start-heft">
              <PenLine size={26} aria-hidden />
              <span>
                <b>Dein Glossar</b>
                <small>Die Begriffe aus deinem Heft, in deinen Worten.</small>
              </span>
            </button>
          </div>

          <button type="button" className="bio-mehr mt-5" aria-expanded={mehr} onClick={() => setMehr((m) => !m)} data-testid="bio-mehr">
            {mehr ? "Weniger anzeigen" : "Mehr üben: alle Themen aus dem Buch"}
          </button>
          {mehr && (
          <>
          <div className="bio-bereich mt-4" role="group" aria-label="Was üben?" style={{ "--n": 2 } as CSSProperties}>
            {(["alle", "genetik", "mensch"] as const).map((a) => (
              <button key={a} type="button" aria-pressed={auswahl === a} onClick={() => setAuswahl(a)} data-testid={`bio-auswahl-${a}`}>
                {AUSWAHL_NAME[a]}
              </button>
            ))}
          </div>
          {auswahl !== "alle" && auswahl !== "genetik" && auswahl !== "mensch" && (
            <p className="ls-klein mt-2 text-center" style={{ "--n": 2 } as CSSProperties} data-testid="bio-thema-gewaehlt">
              Nur: <b>{name}</b>
            </p>
          )}

          <div className="pb-wahl mt-4" style={{ "--n": 3 } as CSSProperties}>
            <button type="button" className="pb-wahl-knopf" onClick={() => void starten(auswahl, "ueben")} disabled={phase === "laden"} data-testid="bio-start-ueben">
              <FlaskConical size={26} aria-hidden />
              <span>
                <b>Üben</b>
                <small>Antworten antippen, Fehler kommen wieder. {name}.</small>
              </span>
            </button>
            <button type="button" className="pb-wahl-knopf" onClick={() => void starten(auswahl, "test")} disabled={phase === "laden"} data-testid="bio-start-test">
              <PenLine size={26} aria-hidden />
              <span>
                <b>Wie im Test</b>
                <small>Begriffe selbst schreiben, Fragen selbst beantworten. {name}.</small>
              </span>
            </button>
            <button type="button" className="pb-wahl-knopf" onClick={() => void starten("schema", "ueben")} disabled={phase === "laden"} data-testid="bio-start-schema">
              <Grid2x2 size={26} aria-hidden />
              <span>
                <b>Kreuzungsschemata</b>
                <small>Mendel, Geschlecht und Blutgruppen im Quadrat ausfüllen.</small>
              </span>
            </button>
            <button type="button" className="pb-wahl-knopf" onClick={() => void starten("alle", "test", true)} disabled={phase === "laden"} data-testid="bio-start-gross">
              <Star size={26} aria-hidden />
              <span>
                <b>Großer Test</b>
                <small>{GROSSER_TEST} Aufgaben aus allen Themen, wie bei der echten Prüfung.</small>
              </span>
            </button>
            <button type="button" className="pb-wahl-knopf" onClick={() => { setZettel(null); setPhase("lernzettel"); }} disabled={phase === "laden"} data-testid="bio-lernzettel">
              <BookOpen size={26} aria-hidden />
              <span>
                <b>Lernzettel</b>
                <small>Das Wichtigste zu jedem Thema, Begriffe zum Abdecken.</small>
              </span>
            </button>
          </div>

          <div className="ls-glas bio-themen mt-4 p-4" style={{ "--n": 4 } as CSSProperties} data-testid="bio-themen">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-semibold">Dein Labor</span>
              <span className="ls-klein tabular-nums" data-testid="bio-sicher">
                {alleSicher} von {alleAnzahl} sicher
              </span>
            </p>
            {(["genetik", "mensch"] as const).map((b) => (
              <div key={b} className="mt-3">
                <p className="bio-themen-titel">{b === "genetik" ? "Genetik" : "Der Mensch"}</p>
                <ul className="mt-1 grid gap-1.5">
                  {themen
                    .filter((t) => t.bereich === b)
                    .map((t) => (
                      <li key={t.id}>
                        <button type="button" className="bio-thema" aria-pressed={auswahl === t.id} onClick={() => setAuswahl(auswahl === t.id ? "alle" : t.id)} data-testid={`bio-thema-${t.id}`}>
                          <span className="bio-thema-name">{t.titel}</span>
                          <span className="bio-balken" aria-hidden>
                            <i style={{ width: `${Math.round((t.sicher / Math.max(1, t.alle)) * 100)}%` }} />
                          </span>
                          <span className="bio-thema-zahl tabular-nums">
                            {t.sicher}/{t.alle}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
            <p className="ls-klein mt-3">Tipp ein Thema an, um nur das zu üben. Sicher heißt: zweimal hintereinander beim ersten Versuch richtig.</p>
          </div>
          </>
          )}

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
          {phase === "laden" && <p className="ls-klein mt-4 text-center">Das Labor wird vorbereitet …</p>}
        </div>
      </div>
    );
  }

  // ---------- Lernzettel ----------

  if (phase === "lernzettel") return <Lernzettel kopf={kopf} nur={zettel} ueben={(t) => void starten(t, t === "lehrerin" || t === "heft" ? "test" : "ueben")} zurueck={() => setPhase("start")} />;

  // ---------- Ende ----------

  if (phase === "ende" && runde && levelVon(runde.auswahl) !== null) {
    const n = levelVon(runde.auswahl)!;
    const gewonnen = kampf.herzen > 0;
    const sterne = gewonnen ? sterneFuer(LEBEN - kampf.herzen) : 0;
    const keim = keimFuer(n);
    const naechstes = LEVELS[LEVELS.indexOf(n) + 1];
    return (
      <div className="ls bio" role="dialog" aria-modal="true" aria-label={gewonnen ? "Level geschafft" : "Level verloren"}>
        {gewonnen && <Konfetti />}
        {kopf}
        <div className="ls-mitte ls-rollt ls-staffel text-center" data-testid="bio-level-ende" data-gewonnen={gewonnen ? "" : undefined}>
          <div className="bio-ende-kampf" style={{ "--n": 0 } as CSSProperties}>
            <Erbsi pose={gewonnen ? "jubel" : "denkt"} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/spiele/biolabor/keim-${keim.bild}.webp`} alt="" aria-hidden draggable={false} className="bio-keim" data-besiegt={gewonnen ? "" : undefined} data-sieger={gewonnen ? undefined : ""} />
          </div>
          <p className="ls-oberzeile mt-2">Level {n} · {LEVEL_TITEL[n]}</p>
          <h1 className="bw-ende-titel" style={{ "--n": 1 } as CSSProperties}>
            {gewonnen ? `${keim.name} ist besiegt!` : `${keim.name} war diesmal stärker`}
          </h1>
          <div className="ls-sterne" aria-label={`${sterne} von 3 Sternen`} data-testid="bio-level-sterne" data-sterne={sterne}>
            {[0, 1, 2].map((i) => (
              <Star key={i} size={i === 1 ? 44 : 34} className="ls-stern" data-an={i < sterne ? "" : undefined} fill="currentColor" style={{ "--n": i } as CSSProperties} aria-hidden />
            ))}
          </div>
          <p className="ls-text mt-1 tabular-nums" style={{ "--n": 1 } as CSSProperties}>
            {kampf.punkte} Punkte{beste >= 3 ? ` · ${beste} in Folge` : ""}
          </p>
          <p className="ls-klein mt-1" style={{ "--n": 1 } as CSSProperties}>
            {gewonnen ? (sterne < 3 ? "Ohne Fehler beim ersten Versuch gibt es drei Sterne." : "Keine Fehler. Perfekt!") : "Drei Fehler, keine Herzen mehr. Schau dir die Lösungen an und versuch es gleich nochmal."}
          </p>
          {ergebnis && "fehler" in ergebnis && (
            <p className="ls-fehler mt-4" role="alert">
              {ergebnis.fehler}
            </p>
          )}
          {daneben.length > 0 && (
            <div className="ls-blatt mt-4 p-4 text-left" style={{ "--n": 2 } as CSSProperties} data-testid="bio-daneben">
              <p className="text-[15px] font-semibold">Schau dir das noch einmal an</p>
              <ul className="bio-daneben mt-3">
                {daneben.map((k) => (
                  <li key={k.key}>
                    <span className="bio-daneben-frage">{k.bio?.art === "schema" ? `Kreuzungsschema: ${k.bio.schema?.titel}` : k.bio?.frage}</span>
                    <b>{k.loesung}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-auto grid gap-3 pt-8" style={{ "--n": 3 } as CSSProperties}>
            {gewonnen && naechstes !== undefined ? (
              <button type="button" className="ls-knopf ls-los" onClick={() => void starten(levelAuswahl(naechstes), "test")} disabled={!ergebnis} autoFocus data-testid="bio-naechstes">
                Nächstes Level: {LEVEL_TITEL[naechstes]}
              </button>
            ) : (
              <button type="button" className="ls-knopf ls-los" onClick={() => void starten(runde.auswahl, "test")} disabled={!ergebnis} autoFocus data-testid="bio-nochmal">
                Nochmal
              </button>
            )}
            {gewonnen && naechstes !== undefined && sterne < 3 && (
              <button type="button" className="ls-knopf ls-los" data-zweit="" onClick={() => void starten(runde.auswahl, "test")} disabled={!ergebnis} data-testid="bio-nochmal">
                Nochmal für mehr Sterne
              </button>
            )}
            <button type="button" className="ls-knopf ls-los" data-zweit="" onClick={() => setPhase("karte")} data-testid="bio-ende-karte">
              <KarteIcon size={18} aria-hidden /> Zur Karte
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "ende" && runde) {
    const anzahl = runde.karten.length;
    const richtig = runde.karten.filter((k) => antworten.current.get(k.key) === k.richtig).length;
    const anteil = anzahl ? richtig / anzahl : 0;
    const sterne = anteil >= 0.9 ? 3 : anteil >= 0.7 ? 2 : 1;
    // je Thema dieser Runde: richtig von gestellt
    const jeThema = new Map<string, { r: number; n: number }>();
    for (const k of runde.karten) {
      const t = k.bio?.thema ?? "";
      const z = jeThema.get(t) ?? { r: 0, n: 0 };
      z.n++;
      if (antworten.current.get(k.key) === k.richtig) z.r++;
      jeThema.set(t, z);
    }
    return (
      <div className="ls bio" role="dialog" aria-modal="true" aria-label="Runde vorbei">
        {sterne >= 2 && <Konfetti />}
        {kopf}
        <div className="ls-mitte ls-rollt ls-staffel text-center">
          <div className="bio-ende-kopf" style={{ "--n": 0 } as CSSProperties}>
            <Erbsi pose={sterne >= 2 ? "jubel" : "denkt"} />
            <div className="ls-ring" data-testid="bio-ende">
              <svg viewBox="0 0 120 120" aria-hidden>
                <circle cx="60" cy="60" r="50" pathLength={100} className="ls-ring-spur" />
                <circle cx="60" cy="60" r="50" pathLength={100} className="ls-ring-wert" style={{ strokeDashoffset: 100 - Math.round(anteil * 100) } as CSSProperties} />
              </svg>
              <div className="ls-ring-zahl" data-lang={3}>
                <b data-testid="bio-ende-richtig">{richtig}</b>
                <span>von {anzahl}</span>
              </div>
            </div>
          </div>
          <div className="ls-sterne" aria-label={`${sterne} von 3 Sternen`}>
            {[0, 1, 2].map((i) => (
              <Star key={i} size={i === 1 ? 44 : 34} className="ls-stern" data-an={i < sterne ? "" : undefined} fill="currentColor" style={{ "--n": i } as CSSProperties} aria-hidden />
            ))}
          </div>
          <h1 className="bw-ende-titel" style={{ "--n": 1 } as CSSProperties}>
            {anteil >= 0.9 ? "Laborprofi!" : anteil >= 0.7 ? "Gut gemacht!" : "Weiter üben, das wird!"}
          </h1>
          <p className="ls-text mt-1" style={{ "--n": 1 } as CSSProperties}>
            {richtig} von {anzahl} beim ersten Versuch richtig{beste >= 3 ? ` · ${beste} in Folge` : ""}
          </p>
          {ergebnis && "fehler" in ergebnis && (
            <p className="ls-fehler mt-4" role="alert">
              {ergebnis.fehler}
            </p>
          )}
          <div className="ls-glas mt-4 p-4 text-left" style={{ "--n": 2 } as CSSProperties} data-testid="bio-ende-themen">
            <p className="text-[15px] font-semibold">Nach Themen</p>
            <ul className="mt-2 grid gap-1.5">
              {[...jeThema].map(([t, z]) => (
                <li key={t} className="bio-thema" data-still="">
                  <span className="bio-thema-name">{themaVon(t)?.titel ?? t}</span>
                  <span className="bio-balken" aria-hidden>
                    <i style={{ width: `${Math.round((z.r / Math.max(1, z.n)) * 100)}%` }} />
                  </span>
                  <span className="bio-thema-zahl tabular-nums">
                    {z.r}/{z.n}
                  </span>
                </li>
              ))}
            </ul>
            <p className="ls-klein mt-3 tabular-nums">{ergebnis ? `Insgesamt ${sicher.size} von ${alleAnzahl} Aufgaben sicher.` : "…"}</p>
          </div>
          {daneben.length > 0 && (
            <div className="ls-blatt mt-4 p-4 text-left" style={{ "--n": 3 } as CSSProperties} data-testid="bio-daneben">
              <p className="text-[15px] font-semibold">Schau dir das noch einmal an</p>
              <ul className="bio-daneben mt-3">
                {daneben.map((k) => (
                  <li key={k.key}>
                    <span className="bio-daneben-frage">{k.bio?.art === "schema" ? `Kreuzungsschema: ${k.bio.schema?.titel}` : k.bio?.frage}</span>
                    <b>{k.bio?.art === "selbst" ? k.loesung : k.loesung}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-auto grid gap-3 pt-8" style={{ "--n": 4 } as CSSProperties}>
            <button type="button" className="ls-knopf ls-los" onClick={() => void starten(runde.auswahl, runde.modus, runde.gross)} disabled={!ergebnis} autoFocus data-testid="bio-nochmal">
              Nochmal
            </button>
            <button type="button" className="ls-knopf ls-los" data-zweit="" onClick={() => setPhase("start")}>
              Anders spielen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Spiel ----------

  if (!karte || !daten) return null;
  const titel = themaVon(daten.thema)?.titel ?? "";
  return (
    <div className="ls bio" role="dialog" aria-modal="true" aria-label="Biolabor" data-art={daten.art} data-kampf={imLevel !== null ? "" : undefined}>
      {kopf}
      {effekt?.art === "angriff" && <div className="bio-aua" key={effekt.n} aria-hidden />}
      <div className="bio-spiel">
        {imLevel !== null && runde ? (
          <Arena n={imLevel} hp={Math.max(0, runde.karten.length - kampf.besiegt.length)} max={runde.karten.length} effekt={effekt} />
        ) : (
          <div className="bio-oben" key={`${karte.key}-${pos}`}>
            <p className="bio-thema-schild">{titel}</p>
          </div>
        )}

        <div className="bio-karte" key={`k-${karte.key}-${pos}`} data-testid="bio-karte" data-art={daten.art} data-eintrag={daten.eintrag}>
          {daten.ueber && <p className="bio-ueber">{daten.ueber}</p>}
          {daten.nachSchema && <FertigesSchema s={daten.nachSchema} />}
          {daten.art === "schema" && daten.schema ? (
            <Schema key={karte.key + pos} karte={karte} daten={daten} gesperrt={!!wahl} onFertig={(ok, text) => antworte(ok ? karte.richtig : text, { still: true })} weiter={() => weiter(wahl && !wahl.ok ? karte : undefined)} />
          ) : (
            <p className="bio-frage" data-testid="bio-frage" data-lang={daten.frage.length > 90 ? "" : undefined}>
              {daten.frage}
            </p>
          )}

          {daten.art === "kacheln" && (
            <div className="bio-antworten" data-anzahl={karte.faecher.length} data-lang={karte.faecher.some((f) => f.length > 26) ? "" : undefined}>
              {karte.faecher.map((f, i) => (
                <button
                  key={`${karte.key}-${f}`}
                  type="button"
                  className="bio-antwort"
                  onClick={() => antworte(f)}
                  disabled={!!wahl}
                  data-richtig={wahl && f === karte.richtig ? "" : undefined}
                  data-falsch={wahl && !wahl.ok && f === wahl.wert ? "" : undefined}
                  data-testid="bio-antwort"
                  data-wert={f}
                  aria-keyshortcuts={String(i + 1)}
                  style={{ "--i": i } as CSSProperties}
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          {daten.art === "schreiben" && (
            <form className="bio-schreiben" onSubmit={schreiben}>
              <input
                ref={feld}
                className="bio-feld"
                value={eingabe}
                onChange={(e) => setEingabe(e.target.value)}
                disabled={!!wahl}
                data-ok={wahl ? (wahl.ok ? "" : "nein") : undefined}
                placeholder="Deine Antwort"
                aria-label="Deine Antwort"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
                maxLength={60}
                data-testid="bio-feld"
              />
              <div className="bio-schreiben-knoepfe">
                <button type="button" className="ls-knopf" data-zweit="" onClick={() => antworte("", { eingabe: "" })} disabled={!!wahl} data-testid="bio-weiss-nicht">
                  Weiß ich nicht
                </button>
                <button type="submit" className="ls-knopf" disabled={!!wahl || !eingabe.trim()} data-testid="bio-pruefen">
                  Fertig
                </button>
              </div>
            </form>
          )}

          {daten.art === "selbst" && <Selbst key={karte.key + pos} daten={daten} gesperrt={!!wahl} antworte={(gewusst) => antworte(gewusst ? "gewusst" : "nicht gewusst", { still: true })} weiter={() => weiter()} />}
        </div>
      </div>

      {hilfe && (
        <div className="bio-hilfe" role="alert" data-art={hilfe.art} data-testid="bio-hilfe">
          <div className="ls-blatt bio-hilfe-blatt">
            <div className="flex items-start gap-3">
              <Erbsi pose="denkt" klein />
              <div className="min-w-0 flex-1">
                <p className="bio-hilfe-titel">{hilfe.art === "fast" ? "Fast! Achte auf die Schreibung" : hilfe.eingabe === "" ? "So heißt es" : "Nicht ganz"}</p>
                <p className="bio-hilfe-text">
                  {hilfe.eingabe ? (
                    <>
                      Du: <s>{hilfe.eingabe}</s>
                      <br />
                    </>
                  ) : null}
                  Richtig: <b>{hilfe.karte.richtig}</b>
                </p>
              </div>
            </div>
            {hilfe.art === "falsch" && hilfe.karte.regel && (
              <p className="bio-merke">
                <FlaskConical size={16} aria-hidden /> {hilfe.karte.regel}
              </p>
            )}
            <button type="button" className="ls-knopf ls-los mt-4" onClick={() => weiter(hilfe.art === "falsch" ? hilfe.karte : undefined)} autoFocus data-testid="bio-weiter">
              Weiter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Der Kampf oben: Erbsi links, rechts der Keim mit Name und Lebensbalken. Ein Treffer lässt ihn wackeln und zeigt die
 * Punkte, ein Angriff lässt ihn nach vorn springen (der rote Blitz dazu liegt über dem ganzen Spiel).
 */
function Arena({ n, hp, max, effekt }: { n: number; hp: number; max: number; effekt: Effekt | null }) {
  const keim = keimFuer(n);
  const anteil = max ? hp / max : 0;
  return (
    <div className="bio-arena" data-testid="bio-arena" data-boss={istBoss(n) ? "" : undefined}>
      <Erbsi pose={effekt?.art === "angriff" ? "denkt" : effekt ? "jubel" : "ruhig"} klein />
      <div className="bio-gegner">
        <p className="bio-gegner-name">
          <span>{keim.name}</span>
          <small>Level {n}</small>
        </p>
        <span className="bio-hp" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp} aria-label={`${keim.name}: ${hp} von ${max}`} data-testid="bio-hp" data-hp={hp} data-wenig={anteil <= 0.34 ? "" : undefined}>
          <i style={{ width: `${Math.round(anteil * 100)}%` }} />
        </span>
        <div className="bio-keim-platz">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={effekt?.n ?? 0}
            src={`/spiele/biolabor/keim-${keim.bild}.webp`}
            alt=""
            aria-hidden
            draggable={false}
            className="bio-keim"
            data-effekt={effekt?.art}
            data-besiegt={hp === 0 ? "" : undefined}
          />
          {effekt && effekt.art !== "angriff" && (
            <b className="bio-schaden" key={`s-${effekt.n}`} data-kritisch={effekt.art === "kritisch" ? "" : undefined} data-testid="bio-schaden">
              {effekt.art === "kritisch" ? "Kritisch! " : ""}+{effekt.wert}
            </b>
          )}
        </div>
      </div>
    </div>
  );
}

/** Erbsi, die Labor-Erbse (Higgsfield): ruhig am Start, jubelt am Ende, denkt bei Fehlern. */
function Erbsi({ pose, klein }: { pose: "ruhig" | "jubel" | "denkt"; klein?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/spiele/biolabor/maskottchen-${pose}.webp`} alt="" aria-hidden className="bio-erbsi" data-pose={pose} data-klein={klein ? "" : undefined} draggable={false} />;
}

// ---------- Kreuzungsschema ----------

/**
 * Das Quadrat: oben die Keimzellen des Vaters, links die der Mutter. Ein Feld antippen, dann unten den Genotyp wählen;
 * das nächste leere Feld ist gleich dran. Wie im Test sind auch die Keimzellen leer. „Prüfen“ färbt jedes Feld; falsche
 * zeigen die richtige Lösung.
 */
function Schema({ karte, daten, gesperrt, onFertig, weiter }: { karte: SpielKarte; daten: BioDaten; gesperrt: boolean; onFertig: (ok: boolean, text: string) => void; weiter: () => void }) {
  const s = daten.schema!;
  const ohneGameten = s.gameten;
  // Stellen: g0, g1 (Mutter links), g2, g3 (Vater oben), f0–f3 (Felder)
  const stellen = [...(ohneGameten ? [] : ["g2", "g3", "g0", "g1"]), "f0", "f1", "f2", "f3"];
  const [werte, setWerte] = useState<Record<string, string>>({});
  const [aktiv, setAktiv] = useState<string>(stellen[0]);
  const [ergebnis, setErgebnis] = useState<{ ok: boolean; falsch: string[] } | null>(null);

  const gamete = (stelle: string) => {
    const i = Number(stelle.slice(1));
    if (ohneGameten) return i < 2 ? s.mutter[i] : s.vater[i - 2];
    return werte[stelle] ?? "";
  };
  const wahl = aktiv.startsWith("g") ? s.allele : feldWahl(s.allele);
  const alleVoll = stellen.every((st) => werte[st]);

  const setze = (w: string) => {
    if (ergebnis || gesperrt) return;
    const neu = { ...werte, [aktiv]: w };
    setWerte(neu);
    klangSetzen();
    const naechste = stellen.find((st) => !neu[st] && st !== aktiv) ?? stellen.find((st) => !neu[st]);
    if (naechste) setAktiv(naechste);
  };
  const pruefen = () => {
    if (!alleVoll || ergebnis) return;
    const gameten = ohneGameten ? null : ([werte.g0, werte.g1, werte.g2, werte.g3] as [string, string, string, string]);
    const r = pruefeSchema(s, { gameten, felder: ["f0", "f1", "f2", "f3"].map((f) => werte[f]) });
    setErgebnis(r);
    onFertig(r.ok, [...(gameten ?? []), "#", ...["f0", "f1", "f2", "f3"].map((f) => werte[f])].join("|"));
  };
  const richtigeFelder = felder(s.mutter, s.vater, s.allele);
  const zeichne = (stelle: string, inhalt: string, art: "g" | "f") => {
    const falsch = ergebnis?.falsch.includes(stelle);
    const fest = art === "g" && ohneGameten;
    const i = Number(stelle.slice(1));
    const loesung = art === "f" ? richtigeFelder[i] : i < 2 ? s.mutter[i] : s.vater[i - 2];
    return (
      <button
        type="button"
        key={stelle}
        className="ks-zelle"
        data-art={art}
        data-fest={fest ? "" : undefined}
        data-aktiv={!ergebnis && aktiv === stelle && !fest ? "" : undefined}
        data-ok={ergebnis ? (falsch ? "nein" : "") : undefined}
        data-voll={inhalt ? "" : undefined}
        onClick={() => !fest && !ergebnis && setAktiv(stelle)}
        disabled={fest || !!ergebnis || gesperrt}
        aria-label={art === "g" ? `Keimzelle ${inhalt || "leer"}` : `Feld ${i + 1}: ${inhalt || "leer"}`}
        data-testid={`ks-${stelle}`}
        style={{ "--i": i } as CSSProperties}
      >
        <span key={inhalt} className="ks-inhalt">
          {inhalt || "?"}
        </span>
        {falsch && <small className="ks-loesung">{loesung}</small>}
      </button>
    );
  };
  // die Zeile und Spalte des aktiven Felds leuchten mit
  const aktivFeld = aktiv.startsWith("f") ? Number(aktiv.slice(1)) : -1;
  return (
    <div className="ks" data-fertig={ergebnis ? (ergebnis.ok ? "ok" : "nein") : undefined}>
      <p className="ks-titel">{s.titel}</p>
      <p className="ks-eltern">
        <span>♀ Mutter: {s.mutter.join("")}</span>
        <span aria-hidden>×</span>
        <span>♂ Vater: {s.vater.join("")}</span>
      </p>
      <ul className="ks-legende">
        {s.legende.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="bio-frage mt-2 text-[17px]">{ohneGameten ? "Füll die vier Felder aus." : "Trag die Geschlechtszellen ein, dann die vier Felder."}</p>
      <div className="ks-raster" data-zeile={aktivFeld >= 0 ? Math.floor(aktivFeld / 2) : undefined} data-spalte={aktivFeld >= 0 ? aktivFeld % 2 : undefined}>
        <span className="ks-ecke" aria-hidden>
          <i>♂</i>
          <i>♀</i>
        </span>
        {zeichne("g2", gamete("g2"), "g")}
        {zeichne("g3", gamete("g3"), "g")}
        {zeichne("g0", gamete("g0"), "g")}
        {zeichne("f0", werte.f0 ?? "", "f")}
        {zeichne("f1", werte.f1 ?? "", "f")}
        {zeichne("g1", gamete("g1"), "g")}
        {zeichne("f2", werte.f2 ?? "", "f")}
        {zeichne("f3", werte.f3 ?? "", "f")}
      </div>
      {!ergebnis ? (
        <>
          <div className="ks-wahl" data-testid="ks-wahl">
            {wahl.map((w) => (
              <button key={w} type="button" onClick={() => setze(w)} disabled={gesperrt} data-testid="ks-wahl-knopf" data-wert={w}>
                {w}
              </button>
            ))}
          </div>
          <button type="button" className="ls-knopf ls-los mt-3 w-full" onClick={pruefen} disabled={!alleVoll} data-testid="ks-pruefen">
            Prüfen
          </button>
        </>
      ) : (
        <div className="ks-ergebnis" role="status" data-testid="ks-ergebnis">
          <p className="bio-hilfe-titel">{ergebnis.ok ? "Richtig ausgefüllt!" : "Nicht ganz: die richtigen stehen klein darunter."}</p>
          {!ergebnis.ok && <p className="bio-merke mt-2">{karte.regel}</p>}
          <button type="button" className="ls-knopf ls-los mt-3 w-full" onClick={weiter} autoFocus data-testid="ks-weiter">
            Weiter
          </button>
        </div>
      )}
    </div>
  );
}

function klangSetzen() {
  if (tonAn()) klang.setzen();
}

/** Das fertige Schema über der Frage danach. */
function FertigesSchema({ s }: { s: NonNullable<BioDaten["nachSchema"]> }) {
  const f = felder(s.mutter, s.vater, s.allele);
  return (
    <div className="ks ks-fertig" aria-label={`Kreuzungsschema ${s.titel}: ${f.join(", ")}`}>
      <p className="ks-titel">{s.titel}</p>
      <div className="ks-raster">
        <span className="ks-ecke" aria-hidden>
          <i>♂</i>
          <i>♀</i>
        </span>
        {[s.vater[0], s.vater[1], s.mutter[0], f[0], f[1], s.mutter[1], f[2], f[3]].map((x, i) => (
          <span key={i} className="ks-zelle" data-art={[0, 1, 2, 5].includes(i) ? "g" : "f"} data-fest="" data-voll="" style={{ "--i": i } as CSSProperties}>
            <span className="ks-inhalt">{x}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- Selbst kontrollieren ----------

function Selbst({ daten, gesperrt, antworte, weiter }: { daten: BioDaten; gesperrt: boolean; antworte: (gewusst: boolean) => void; weiter: () => void }) {
  const [text, setText] = useState("");
  const [offen, setOffen] = useState(false);
  const [bewertet, setBewertet] = useState<boolean | null>(null);
  return (
    <div className="bio-selbst">
      {!offen ? (
        <>
          <textarea className="bio-feld bio-textfeld" value={text} onChange={(e) => setText(e.target.value)} placeholder="Schreib deine Antwort hier oder sag sie laut." aria-label="Deine Antwort" rows={4} data-testid="bio-selbst-text" />
          <button type="button" className="ls-knopf ls-los mt-3 w-full" onClick={() => setOffen(true)} data-testid="bio-loesung-zeigen">
            Lösung zeigen
          </button>
        </>
      ) : (
        <>
          <p className="bio-ueber mt-1">Das sollte drin sein:</p>
          <ul className="bio-punkte" data-testid="bio-punkte">
            {daten.punkte?.map((p, i) => (
              <li key={p} style={{ "--i": i } as CSSProperties}>
                <Check size={18} strokeWidth={3} aria-hidden />
                {p}
              </li>
            ))}
          </ul>
          {bewertet === null ? (
            <div className="bio-schreiben-knoepfe mt-3">
              <button
                type="button"
                className="ls-knopf"
                data-zweit=""
                disabled={gesperrt}
                onClick={() => {
                  setBewertet(false);
                  antworte(false);
                }}
                data-testid="bio-nicht-gewusst"
              >
                Hatte ich nicht
              </button>
              <button
                type="button"
                className="ls-knopf"
                disabled={gesperrt}
                onClick={() => {
                  setBewertet(true);
                  antworte(true);
                }}
                data-testid="bio-gewusst"
              >
                Hatte ich (fast alles)
              </button>
            </div>
          ) : (
            <button type="button" className="ls-knopf ls-los mt-3 w-full" onClick={weiter} autoFocus data-testid="bio-selbst-weiter">
              {bewertet ? "Super, weiter" : "Merk ich mir, weiter"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Lernzettel ----------

function Lernzettel({ kopf, nur, ueben, zurueck }: { kopf: React.ReactNode; nur?: string[] | null; ueben: (thema: string) => void; zurueck: () => void }) {
  const [abdecken, setAbdecken] = useState(false);
  const [offen, setOffen] = useState<Set<string>>(new Set());
  return (
    <div className="ls bio" role="dialog" aria-modal="true" aria-label="Lernzettel">
      {kopf}
      <div className="ls-mitte bio-zettel" data-testid="bio-zettel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="ls-titel text-[28px]">{nur ? "Lösungen" : "Lernzettel"}</h1>
          <button type="button" className="bio-abdecken" aria-pressed={abdecken} onClick={() => { setAbdecken((a) => !a); setOffen(new Set()); }} data-testid="bio-abdecken">
            {abdecken ? <Eye size={18} aria-hidden /> : <EyeOff size={18} aria-hidden />}
            {abdecken ? "Aufdecken" : "Abdecken"}
          </button>
        </div>
        {(nur ? (["alle"] as const) : (["genetik", "mensch"] as const)).map((b) => (
          <section key={b} className="mt-5">
            {b !== "alle" && <h2 className="bio-zettel-bereich">{b === "genetik" ? "1) Genetik" : "2) Der Mensch"}</h2>}
            {BIO_THEMEN.filter((t) => (nur ? nur.includes(t.id) : t.bereich === b)).map((t) => {
              // die Fragen der Lehrerin: nur die Lösungen je Nummer, ohne Begriffsliste darunter
              const begriffe = t.id === "lehrerin" ? [] : BIO_EINTRAEGE.filter((e) => e.thema === t.id && e.art === "begriff");
              return (
                <article key={t.id} className="ls-blatt bio-zettel-blatt mt-3" data-testid={`bio-zettel-${t.id}`}>
                  <h3 className="bio-zettel-titel">{t.titel}</h3>
                  <ul className="bio-zettel-liste">
                    {t.merke.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                  {begriffe.length > 0 && (
                    <dl className="bio-glossar">
                      {begriffe.map((e) =>
                        e.art === "begriff" ? (
                          <div key={e.id}>
                            <dt>
                              {!abdecken || offen.has(e.id) ? (
                                e.begriff
                              ) : (
                                <button type="button" className="bio-verdeckt" onClick={() => setOffen((o) => new Set(o).add(e.id))} aria-label="Begriff aufdecken">
                                  ?
                                </button>
                              )}
                            </dt>
                            <dd>{e.erklaerung}</dd>
                          </div>
                        ) : null,
                      )}
                    </dl>
                  )}
                  <button type="button" className="bio-zettel-ueben" onClick={() => ueben(t.id)} data-testid={`bio-zettel-ueben-${t.id}`}>
                    {t.id === "lehrerin" ? "Diese Fragen üben" : "Dieses Thema üben"}
                  </button>
                </article>
              );
            })}
          </section>
        ))}
        <div className="mt-8 grid gap-3 pb-4">
          <button type="button" className="ls-knopf ls-los" data-zweit="" onClick={zurueck}>
            Zurück
          </button>
        </div>
      </div>
    </div>
  );
}
