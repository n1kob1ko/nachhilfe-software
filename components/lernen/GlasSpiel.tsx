"use client";

import "./lernspiel.css";
import "./arena.css";
import "./blockwerk.css";
import "./glasklar.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Flame, Heart, Lightbulb, Shuffle, Trophy, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { glasStartenAction, spielBeendenAction, tabletGlasStartenAction, tabletSpielBeendenAction } from "@/app/lernspiel-actions";
import { allesSortiert, GLAS_HERZEN, GLAS_PUNKTE, glasZufall, hatZug, istZu, legeAus, neuMischen, pruefeZug, stufeFuer, zieh, type Glas, type GlasThemaInfo, type Sorten } from "@/lib/glasklar";
import type { Bestenliste, SpielErgebnis, SpielKarte, SpielStart } from "@/lib/lernspiele-typen";
import { MathText } from "@/components/MathText";
import { BestenListe, Hintergrund, Konfetti } from "./Lernspiel";
import { Abriss, vibriere } from "./SpielTeile";
import { sicher, verbindungWeg } from "@/lib/verbindung";

/**
 * Glasklar (lib/glasklar.ts, docs/lernspiele.md „Glasklar“): Begriffe liegen gemischt in Gläsern; ein Glas antippen hebt
 * den obersten Begriff an, ein zweites setzt ihn dort ab. Erlaubt ist ein leeres Glas oder ein Begriff derselben Sorte;
 * eine andere Sorte ist die falsche Antwort (ein Herz weg, beide Sorten stehen danach klein auf den Begriffen, ein Blatt
 * erklärt es). Ein volles Glas mit einer Sorte geht zu. Sind alle zu, kommt die nächste Stufe (eine neue Runde am
 * Server, wie im Endlos-Modus); ohne Herzen ist das Spiel aus.
 *
 * Gezählt wird je Begriff der erste Zug auf einen anderen Begriff; ein Begriff, der so nie gesetzt wurde, zählt als
 * richtig, wenn sein Glas zugeht. Die Punkte zählt das Gerät und meldet sie am Ende (der Server nimmt sie für Rekord und
 * Bestenliste, app/lernspiel-actions.ts).
 *
 * Bewegung: ein Begriff fliegt mit FLIP (gemessen vor und nach dem Zug, dazwischen die Web Animations API), nur
 * transform; bei „weniger Bewegung“ springt er. Tasten am Laptop: 1 bis 9 wählen ein Glas, Rücktaste nimmt zurück.
 */

type Phase = "start" | "laden" | "spiel" | "ende";
type Stufe = { rundeId: number; nr: number; karten: Map<string, SpielKarte>; sorte: Sorten; reihe: string[]; hoehe: number };

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)} %`);
const zahl = (n: number) => n.toLocaleString("de-AT");

export function GlasSpiel({
  token,
  amTablet,
  themen,
  thema,
  serie: serieAnfang,
  lernstand,
  rekord,
  bestenliste: bestenlisteAnfang,
  zurueck: zurueckZiel,
  themaLink,
  arenaLink,
}: {
  token: string;
  amTablet?: boolean;
  /** die Themen dieses Schülers, das passendste zuerst (lib/lernspiele.ts glasThemen) */
  themen: (GlasThemaInfo & { grund?: string })[];
  /** das gewählte Thema (id) */
  thema: string;
  serie: number;
  /** der Lernstand der Fähigkeit des Themas */
  lernstand: number | null;
  /** der beste Glasklar-Stand des Schülers (0: noch keiner) */
  rekord: number;
  bestenliste?: Bestenliste;
  zurueck?: string;
  /** Link zu einem anderen Thema, ohne die id am Ende („…?modus=glas&thema=“) */
  themaLink: string;
  arenaLink?: string;
}) {
  const router = useRouter();
  const server = useMemo(
    () => ({
      starten: (lauf?: number, pausen?: number[]): Promise<SpielStart> => sicher(() => (amTablet ? tabletGlasStartenAction(thema, lauf) : glasStartenAction(token, thema, lauf)), pausen),
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
  const [glaeser, setGlaeser] = useState<Glas[]>([]);
  const [gehoben, setGehoben] = useState<number | null>(null);
  const [verlauf, setVerlauf] = useState<[number, number][]>([]);
  const [enthuellt, setEnthuellt] = useState<Set<string>>(new Set());
  const [herzen, setHerzen] = useState(GLAS_HERZEN);
  const [punkte, setPunkte] = useState(0);
  const [blatt, setBlatt] = useState<{ karte: SpielKarte; auf: SpielKarte } | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; n: number; gut?: boolean } | null>(null);
  const [wackelt, setWackelt] = useState<{ glas: number; n: number } | null>(null);
  const [geschafft, setGeschafft] = useState<{ nr: number; bonus: number; herz: boolean } | null>(null);
  const [ergebnis, setErgebnis] = useState<SpielErgebnis | null>(null);
  const [daneben, setDaneben] = useState<SpielKarte[]>([]);
  const [richtigGesamt, setRichtigGesamt] = useState(0);

  const punkteRef = useRef(0);
  const herzenRef = useRef(GLAS_HERZEN);
  const antworten = useRef(new Map<string, string>());
  const bepunktet = useRef(new Set<string>());
  const fehlerInStufe = useRef(false);
  const lauf = useRef<number | null>(null);
  const vorrat = useRef<Promise<SpielStart> | null>(null);
  const abschluss = useRef<Promise<SpielErgebnis> | null>(null);
  const laufVorher = useRef<number | null | undefined>(undefined);
  const mischZahl = useRef(0);
  const reduziert = useRef(false);
  const begriffe = useRef(new Map<string, HTMLElement>());
  const vorher = useRef<Map<string, DOMRect> | null>(null);
  const beschaeftigt = useRef(false);

  useEffect(() => {
    reduziert.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const alt = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = alt;
    };
  }, []);

  // ---------- Bewegung: FLIP ----------

  /** Merkt, wo jeder Begriff gerade ist (vor einem Zug). */
  const merke = useCallback(() => {
    if (reduziert.current) return;
    const m = new Map<string, DOMRect>();
    for (const [k, el] of begriffe.current) if (el.isConnected) m.set(k, el.getBoundingClientRect());
    vorher.current = m;
  }, []);

  useLayoutEffect(() => {
    const v = vorher.current;
    if (!v) return;
    vorher.current = null;
    for (const [k, el] of begriffe.current) {
      const a = v.get(k);
      if (!a || !el.isConnected) continue;
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) + Math.abs(dy) < 1) continue;
      const weit = Math.hypot(dx, dy);
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], {
        duration: Math.round(Math.min(420, 170 + weit * 0.45)),
        // kurzer Weg (anheben): ease-out; über das Feld: ease-in-out (DESIGN.md „Bewegung“)
        easing: weit < 70 ? "cubic-bezier(0.23, 1, 0.32, 1)" : "cubic-bezier(0.77, 0, 0.175, 1)",
      });
    }
  }, [glaeser, gehoben]);

  // ---------- Stufen ----------

  const zeige = useCallback((n: { text: string; gut?: boolean }) => setMeldung((alt) => ({ ...n, n: (alt?.n ?? 0) + 1 })), []);
  const dazu = useCallback((p: number) => {
    punkteRef.current += p;
    setPunkte(punkteRef.current);
  }, []);

  /** Legt eine Runde vom Server als Stufe aus. */
  const richteEin = useCallback((r: Extract<SpielStart, { rundeId: number }>) => {
    const karten = new Map(r.karten.map((k) => [k.key, k]));
    const sorte: Sorten = Object.fromEntries(r.karten.map((k) => [k.key, k.richtig]));
    const reihe = r.karten[0]?.faecher.length ? r.karten[0].faecher : [...new Set(r.karten.map((k) => k.richtig))];
    const hoehe = Math.max(1, Math.round(r.karten.length / Math.max(1, reihe.length)));
    const nr = r.stufe ?? 1;
    begriffe.current = new Map();
    antworten.current = new Map();
    fehlerInStufe.current = false;
    mischZahl.current = 0;
    setStufe({ rundeId: r.rundeId, nr, karten, sorte, reihe, hoehe });
    setGlaeser(legeAus([...karten.keys()], sorte, { hoehe, leer: stufeFuer(nr).leer, rng: glasZufall(r.rundeId * 31 + nr) }));
    setGehoben(null);
    setVerlauf([]);
    setEnthuellt(new Set());
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
    herzenRef.current = GLAS_HERZEN;
    bepunktet.current = new Set();
    beschaeftigt.current = false;
    setPunkte(0);
    setHerzen(GLAS_HERZEN);
    setDaneben([]);
    setRichtigGesamt(0);
    setErgebnis(null);
    setMeldung(null);
    richteEin(r);
    setPhase("spiel");
  }, [server, richteEin]);

  /** Alle Antworten der Stufe; `alle`: auch die Begriffe, die nie auf einen anderen gesetzt wurden, als richtig. */
  const antwortListe = useCallback(
    (alle: boolean) => {
      const m = new Map(antworten.current);
      if (alle && stufe) for (const [k, karte] of stufe.karten) if (!m.has(k)) m.set(k, karte.richtig);
      return [...m.entries()].map(([key, wahl]) => ({ key, wahl }));
    },
    [stufe],
  );

  /** Ohne Herzen: die laufende Stufe zählt mit den Begriffen, die gesetzt wurden; die Punkte gehen mit. */
  const ende = useCallback(async () => {
    if (!stufe) return;
    setPhase("ende");
    const liste = antwortListe(false);
    const davor = await abschluss.current?.catch(() => null);
    let e = await server.beenden(stufe.rundeId, liste, { teil: true, punkte: punkteRef.current });
    const vorherStand = laufVorher.current !== undefined ? laufVorher.current : davor && !("fehler" in davor) ? davor.lernstandVorher : undefined;
    if (!("fehler" in e) && vorherStand !== undefined) e = { ...e, lernstandVorher: vorherStand };
    setErgebnis(e);
    router.refresh();
  }, [stufe, antwortListe, server, router]);

  /** Die Stufe ist sortiert: im Hintergrund zählen, die nächste holen (meist schon da). */
  const naechste = useCallback(async () => {
    if (!stufe || beschaeftigt.current) return;
    beschaeftigt.current = true;
    const id = stufe.rundeId;
    const liste = antwortListe(true);
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
      // keine Begriffe mehr: das Spiel endet hier (die Stufe ist schon gezählt)
      setPhase("ende");
      await fertig;
      const e = await server.beenden(id, liste, { teil: true, punkte: punkteRef.current });
      setErgebnis(!("fehler" in e) && laufVorher.current !== undefined ? { ...e, lernstandVorher: laufVorher.current } : e);
      router.refresh();
      return;
    }
    richteEin(r);
  }, [stufe, antwortListe, server, richteEin, router]);

  // nach dem Bild „Stufe geschafft“ geht es von selbst weiter
  useEffect(() => {
    if (!geschafft) return;
    const t = window.setTimeout(() => void naechste(), reduziert.current ? 900 : 1500);
    return () => window.clearTimeout(t);
  }, [geschafft, naechste]);

  useEffect(() => {
    if (!meldung) return;
    const t = window.setTimeout(() => setMeldung(null), 1600);
    return () => window.clearTimeout(t);
  }, [meldung]);

  // ---------- Züge ----------

  const zu = useMemo(() => (stufe ? glaeser.map((g) => istZu(g, stufe.sorte, stufe.hoehe)) : []), [glaeser, stufe]);
  const fest = phase === "spiel" && !!stufe && !geschafft && !allesSortiert(glaeser, stufe.sorte, stufe.hoehe) && !hatZug(glaeser, stufe.sorte, stufe.hoehe);

  const tippe = useCallback(
    (i: number) => {
      if (phase !== "spiel" || !stufe || blatt || geschafft) return;
      const g = glaeser[i];
      if (!g) return;
      if (gehoben === null) {
        if (!g.length || zu[i]) {
          setWackelt((w) => ({ glas: i, n: (w?.n ?? 0) + 1 }));
          return;
        }
        merke();
        setGehoben(i);
        return;
      }
      if (gehoben === i) {
        merke();
        setGehoben(null);
        return;
      }
      const z = pruefeZug(glaeser, gehoben, i, stufe.sorte, stufe.hoehe);
      if (z.art === "nichts" || z.art === "voll") {
        // ein anderes Glas, das man anheben kann: dann eben das
        if (z.art === "voll" && !zu[i] && g.length) {
          zeige({ text: "Das Glas ist voll." });
          setWackelt((w) => ({ glas: i, n: (w?.n ?? 0) + 1 }));
        } else setWackelt((w) => ({ glas: i, n: (w?.n ?? 0) + 1 }));
        merke();
        setGehoben(null);
        return;
      }
      if (z.art === "falsch") {
        const karte = stufe.karten.get(z.key)!;
        const auf = stufe.karten.get(z.auf)!;
        if (!antworten.current.has(z.key)) {
          antworten.current.set(z.key, stufe.sorte[z.auf]);
          setDaneben((d) => (d.some((x) => x.key === karte.key) ? d : [...d, karte]));
        }
        fehlerInStufe.current = true;
        herzenRef.current = Math.max(0, herzenRef.current - 1);
        setHerzen(herzenRef.current);
        setEnthuellt((e) => new Set([...e, z.key, z.auf]));
        setWackelt((w) => ({ glas: i, n: (w?.n ?? 0) + 1 }));
        vibriere([40, 60, 40]);
        merke();
        setGehoben(null);
        setBlatt({ karte, auf });
        return;
      }
      // erlaubt: setzen
      merke();
      const neu = zieh(glaeser, gehoben, i);
      if (z.auf && !antworten.current.has(z.key)) antworten.current.set(z.key, stufe.sorte[z.auf]);
      if (z.auf && !bepunktet.current.has(z.key)) {
        bepunktet.current.add(z.key);
        dazu(GLAS_PUNKTE.begriff);
      }
      setGlaeser(neu);
      setGehoben(null);
      if (istZu(neu[i], stufe.sorte, stufe.hoehe)) {
        // das Glas geht zu: alle darin liegen richtig
        for (const k of neu[i]) if (!antworten.current.has(k)) antworten.current.set(k, stufe.sorte[k]);
        const p = GLAS_PUNKTE.glas * stufe.nr;
        dazu(p);
        setVerlauf([]);
        vibriere(25);
        if (allesSortiert(neu, stufe.sorte, stufe.hoehe)) {
          const fehlerfrei = !fehlerInStufe.current;
          const bonus = GLAS_PUNKTE.stufe * stufe.nr + (fehlerfrei ? GLAS_PUNKTE.fehlerfrei * stufe.nr : 0);
          dazu(bonus);
          const herz = fehlerfrei && herzenRef.current < GLAS_HERZEN;
          if (herz) {
            herzenRef.current += 1;
            setHerzen(herzenRef.current);
          }
          setGeschafft({ nr: stufe.nr, bonus: bonus + p, herz });
        } else {
          zeige({ text: `${stufe.sorte[neu[i][0]]}: zu! +${p}`, gut: true });
          // nur noch ein Glas offen: die nächste Stufe schon holen
          const offen = neu.filter((x) => x.length && !istZu(x, stufe.sorte, stufe.hoehe)).length;
          if (offen <= 2 && !vorrat.current && lauf.current) vorrat.current = server.starten(lauf.current);
        }
      } else {
        setVerlauf((v) => [...v, [gehoben, i]]);
      }
    },
    [phase, stufe, blatt, geschafft, glaeser, gehoben, zu, merke, zeige, dazu, server],
  );

  const zurueckNehmen = useCallback(() => {
    if (phase !== "spiel" || blatt || geschafft || !verlauf.length) return;
    const [von, nach] = verlauf[verlauf.length - 1];
    merke();
    setGlaeser((g) => zieh(g, nach, von));
    setVerlauf((v) => v.slice(0, -1));
    setGehoben(null);
  }, [phase, blatt, geschafft, verlauf, merke]);

  const mischen = useCallback(() => {
    if (!stufe) return;
    mischZahl.current += 1;
    merke();
    setGlaeser((g) => neuMischen(g, stufe.sorte, stufe.hoehe, glasZufall(stufe.rundeId * 31 + 977 * mischZahl.current)));
    setVerlauf([]);
    setGehoben(null);
  }, [stufe, merke]);

  const weiter = useCallback(() => {
    setBlatt(null);
    if (herzenRef.current <= 0) void ende();
  }, [ende]);

  // Tasten am Laptop
  useEffect(() => {
    if (phase !== "spiel") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (blatt) {
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
          e.preventDefault();
          weiter();
        }
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        tippe(Number(e.key) - 1);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        zurueckNehmen();
      } else if (e.key === "Escape" && gehoben !== null) {
        merke();
        setGehoben(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, blatt, gehoben, tippe, zurueckNehmen, weiter, merke]);

  // ---------- Darstellung ----------

  const deko = gewaehlt?.sorten.slice(0, 3) ?? ["der", "die", "das"];

  const kopf = (
    <div className="ls-kopf">
      {abgerissen && <Abriss />}
      <ZuLink href={zurueck} className="ls-zu treffer" aria-label="Spiel schließen">
        <X size={24} aria-hidden />
      </ZuLink>
      {phase === "spiel" ? (
        <>
          <div className="ls-herzen" role="img" aria-label={`${herzen} von ${GLAS_HERZEN} Herzen`} data-testid="gk-herzen">
            {Array.from({ length: GLAS_HERZEN }, (_, i) => (
              <Heart key={i} size={24} strokeWidth={2.2} fill="currentColor" data-an={i < herzen ? "" : undefined} aria-hidden />
            ))}
          </div>
          {stufe && (
            <span className="gk-stufe" data-testid="gk-stufe">
              Stufe {stufe.nr}
            </span>
          )}
          <span className="ls-combo ls-endlos-stand" aria-label={`${punkte} Punkte`} data-testid="gk-punkte">
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
      <div className="ls" role="dialog" aria-modal="true" aria-label="Lernspiel Glasklar">
        <Hintergrund woerter={deko} />
        {kopf}
        <div className="ls-mitte ls-rollt ls-staffel">
          <p className="ls-oberzeile" style={{ "--n": 0 } as CSSProperties}>
            Lernspiel
          </p>
          <h1 className="ls-titel" style={{ "--n": 1 } as CSSProperties}>
            Glasklar
          </h1>
          <p className="ls-text mt-2" style={{ "--n": 2 } as CSSProperties}>
            Tipp ein Glas an, dann ein zweites: der oberste Begriff wandert hinüber. Er darf nur in ein leeres Glas oder auf einen Begriff derselben Sorte.
          </p>
          <div className="ls-vorschau" aria-hidden style={{ "--n": 3 } as CSSProperties}>
            <MiniGlaeser />
          </div>
          <p className="ls-klein mt-5" style={{ "--n": 3 } as CSSProperties}>
            Sortieren nach
          </p>
          <div className="bw-fragen-aus mt-2" style={{ "--n": 3 } as CSSProperties} data-testid="gk-themen">
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
          {gewaehlt && (
            <p className="gk-sorten-vorschau mt-3" style={{ "--n": 3 } as CSSProperties} data-testid="gk-sorten-vorschau">
              Gläser für: {gewaehlt.sorten.slice(0, 5).join(", ")}
              {gewaehlt.sorten.length > 5 ? " …" : ""}
            </p>
          )}
          {gewaehlt?.grund && (
            <span className="ls-grund mt-3" style={{ "--n": 3 } as CSSProperties} data-testid="gk-grund">
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
            <button type="button" className="ls-knopf ls-los" onClick={() => void starten()} disabled={phase === "laden" || !gewaehlt} autoFocus data-testid="gk-start">
              {phase === "laden" ? "Gläser werden gefüllt …" : "Los geht’s"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "ende") {
    const e = ergebnis && !("fehler" in ergebnis) ? ergebnis : null;
    const stand = punkteRef.current;
    const bisher = e?.glas?.rekord ?? rekord;
    const neuerRekord = !!e && stand > 0 && stand > bisher;
    const anteil = bisher > 0 ? Math.min(100, Math.round((stand / bisher) * 100)) : stand > 0 ? 100 : 0;
    const begriffeRichtig = e?.glas?.begriffe ?? richtigGesamt;
    return (
      <div className="ls" role="dialog" aria-modal="true" aria-label="Glasklar vorbei">
        <Hintergrund woerter={deko} />
        {neuerRekord && <Konfetti />}
        {kopf}
        <div className="ls-mitte ls-staffel text-center">
          <div className="ls-ring" style={{ "--n": 0 } as CSSProperties} data-testid="gk-ende">
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
            {neuerRekord ? "Neuer Rekord!" : herzen <= 0 ? "Keine Herzen mehr" : "Alles sortiert"}
          </h1>
          <p className="ls-text mt-1" style={{ "--n": 1 } as CSSProperties}>
            Stufe {stufe?.nr ?? 1} · {begriffeRichtig} {begriffeRichtig === 1 ? "Begriff" : "Begriffe"} richtig
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
          {(e?.glas?.bestenliste ?? bestenlisteAnfang) && <BestenListe liste={(e?.glas?.bestenliste ?? bestenlisteAnfang)!} arenaLink={arenaLink} n={3} />}
          {daneben.length > 0 && (
            <div className="ls-blatt mt-4 p-4 text-left" style={{ "--n": 4 } as CSSProperties}>
              <p className="text-[15px] font-semibold">Kommt nächstes Mal wieder</p>
              <ul className="mt-2 space-y-1.5 text-[16px]">
                {daneben.slice(0, 5).map((k) => (
                  <li key={k.key}>{k.mathe ? <MathText text={k.loesung} /> : k.loesung}</li>
                ))}
              </ul>
              {daneben.length > 5 && <p className="mt-2 text-[14px] text-ink-3">und {daneben.length - 5} weitere</p>}
            </div>
          )}
          <div className="mt-auto grid gap-3 pt-8" style={{ "--n": 5 } as CSSProperties}>
            <button type="button" className="ls-knopf ls-los" onClick={() => void starten()} disabled={!ergebnis} autoFocus data-testid="gk-nochmal">
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
  if (!stufe) return null;
  const spalten = glaeser.length <= 4 ? glaeser.length : Math.ceil(glaeser.length / 2);
  const farbe = (s: string) => Math.max(0, stufe.reihe.indexOf(s)) % 5;
  const zuSorten = new Set(glaeser.filter((g, i) => zu[i]).map((g) => stufe.sorte[g[0]]));

  return (
    <div className="ls" role="dialog" aria-modal="true" aria-label="Lernspiel Glasklar">
      <Hintergrund woerter={deko} />
      {kopf}
      <div className="gk">
        <p className="gk-sorten" aria-label={`Sortiere nach: ${stufe.reihe.join(", ")}`}>
          {stufe.reihe.map((s) => (
            <span key={s} data-f={farbe(s)} data-zu={zuSorten.has(s) ? "" : undefined}>
              {zuSorten.has(s) && <Check size={13} strokeWidth={3.2} aria-hidden />}
              {stufe.karten.values().next().value?.mathe ? <MathText text={s} /> : s}
            </span>
          ))}
        </p>
        <div className="gk-brett" style={{ "--spalten": spalten, "--hoehe": stufe.hoehe } as CSSProperties} data-testid="gk-brett">
          {glaeser.map((g, i) => {
            const offen = gehoben === i;
            const istZuGlas = zu[i];
            const obenKey = offen ? g[g.length - 1] : null;
            const drin = offen ? g.slice(0, -1) : g;
            const sorteZu = istZuGlas ? stufe.sorte[g[0]] : null;
            return (
              <button
                key={i}
                type="button"
                className="gk-glas"
                onClick={() => tippe(i)}
                aria-pressed={offen}
                aria-label={`Glas ${i + 1}: ${g.length ? g.map((k) => stufe.karten.get(k)?.wort).join(", ") : "leer"}${sorteZu ? `, zu: ${sorteZu}` : ""}`}
                data-zu={istZuGlas ? "" : undefined}
                data-f={sorteZu ? farbe(sorteZu) : undefined}
                data-offen={offen ? "" : undefined}
                data-wackelt={wackelt?.glas === i ? wackelt.n % 2 : undefined}
                data-testid={`gk-glas-${i}`}
              >
                <span className="gk-luft">{obenKey && <Begriff k={obenKey} stufe={stufe} enthuellt={enthuellt} farbe={farbe} refs={begriffe} schwebt />}</span>
                <span className="gk-rohr">
                  {sorteZu && (
                    <span className="gk-deckel">
                      {stufe.karten.get(g[0])?.mathe ? <MathText text={sorteZu} /> : sorteZu}
                    </span>
                  )}
                  <span className="gk-inhalt">
                    {drin.map((k) => (
                      <Begriff key={k} k={k} stufe={stufe} enthuellt={enthuellt} farbe={farbe} refs={begriffe} zu={istZuGlas} />
                    ))}
                  </span>
                </span>
                <span className="gk-nummer" aria-hidden>
                  {i + 1}
                </span>
              </button>
            );
          })}
        </div>
        <div className="gk-leiste">
          <button type="button" className="gk-knopf treffer" onClick={zurueckNehmen} disabled={!verlauf.length || !!blatt} aria-label="Zug zurücknehmen" data-testid="gk-zurueck">
            <Undo2 size={20} strokeWidth={2.4} aria-hidden />
            <span>Zurück</span>
          </button>
          {fest && (
            <p className="gk-fest" role="status">
              Kein Zug mehr frei.
            </p>
          )}
          {fest && (
            <button type="button" className="gk-knopf treffer" data-hell="" onClick={mischen} data-testid="gk-mischen">
              <Shuffle size={20} strokeWidth={2.4} aria-hidden />
              <span>Neu mischen</span>
            </button>
          )}
        </div>
      </div>

      {meldung && (
        <div key={meldung.n} className="gk-meldung" role="status" data-gut={meldung.gut ? "" : undefined}>
          {meldung.text}
        </div>
      )}

      {geschafft && (
        <div className="gk-geschafft" role="status" data-testid="gk-geschafft">
          <p className="gk-geschafft-titel">Stufe {geschafft.nr} geschafft!</p>
          <p className="gk-geschafft-punkte">+{zahl(geschafft.bonus)}</p>
          {geschafft.herz && (
            <p className="gk-geschafft-herz">
              <Heart size={18} fill="currentColor" aria-hidden /> Ohne Fehler: ein Herz zurück
            </p>
          )}
        </div>
      )}

      {blatt && (
        <div className="gk-blatt-schirm" onClick={weiter}>
          <div className="ls-regel gk-regel" role="alertdialog" aria-label="Passt nicht zusammen" onClick={(e) => e.stopPropagation()} data-testid="gk-blatt">
            <p className="ls-regel-kopf">
              <Lightbulb size={16} aria-hidden /> Passt nicht zusammen
            </p>
            <div className="gk-regel-paar">
              <span>
                <b>{blatt.karte.mathe ? <MathText text={blatt.karte.wort} /> : blatt.karte.wort}</b>
                <i data-f={farbe(blatt.karte.richtig)}>{blatt.karte.mathe ? <MathText text={blatt.karte.richtig} /> : blatt.karte.richtig}</i>
              </span>
              <span>
                <b>{blatt.auf.mathe ? <MathText text={blatt.auf.wort} /> : blatt.auf.wort}</b>
                <i data-f={farbe(blatt.auf.richtig)}>{blatt.auf.mathe ? <MathText text={blatt.auf.richtig} /> : blatt.auf.richtig}</i>
              </span>
            </div>
            {blatt.karte.regel && <p className="ls-regel-text">{blatt.karte.mathe ? <MathText text={blatt.karte.regel} /> : blatt.karte.regel}</p>}
            <button type="button" className="ls-knopf ls-los mt-3" onClick={weiter} autoFocus data-testid="gk-weiter">
              {herzen <= 0 ? "Zum Ergebnis" : "Weiter"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Ein Begriff in einem Glas: ein weißes Kärtchen; nach einem Fehler steht seine Sorte klein darunter. */
function Begriff({ k, stufe, enthuellt, farbe, refs, schwebt, zu }: { k: string; stufe: Stufe; enthuellt: Set<string>; farbe: (s: string) => number; refs: React.RefObject<Map<string, HTMLElement>>; schwebt?: boolean; zu?: boolean }) {
  const karte = stufe.karten.get(k);
  if (!karte) return null;
  const text = karte.wort ?? "";
  const laenge = text.replace(/\s/g, "").length;
  const gross = laenge <= 4 ? "s" : laenge <= 7 ? "m" : laenge <= 10 ? "l" : "xl";
  return (
    <span
      ref={(el) => {
        if (el) refs.current.set(k, el);
      }}
      className="gk-begriff"
      data-lang={gross}
      data-schwebt={schwebt ? "" : undefined}
      data-f={zu || enthuellt.has(k) ? farbe(karte.richtig) : undefined}
      data-zu={zu ? "" : undefined}
    >
      <span className="gk-wort">{karte.mathe ? <MathText text={text} /> : text}</span>
      {enthuellt.has(k) && !zu && <span className="gk-etikett">{karte.mathe ? <MathText text={karte.richtig} /> : karte.richtig}</span>}
    </span>
  );
}

/** Drei kleine Gläser für den Anfang. */
function MiniGlaeser() {
  const reihen = [
    [0, 1, 0],
    [1, 2, 1],
    [2, 0, 2],
  ];
  return (
    <span className="gk-mini">
      {reihen.map((r, i) => (
        <span key={i} className="gk-mini-glas">
          {r.map((f, j) => (
            <i key={j} data-f={f} />
          ))}
        </span>
      ))}
      <span className="gk-mini-glas" data-leer="" />
    </span>
  );
}
