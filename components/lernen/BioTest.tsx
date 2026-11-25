"use client";

import "./lernspiel.css";
import "./phantombild.css";
import "./biotest.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ListChecks, PenLine, RotateCcw, Star, Volume2, VolumeX, X, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { biotestStartenAction, spielBeendenAction, tabletBiotestStartenAction, tabletSpielBeendenAction } from "@/app/lernspiel-actions";
import { BILDER, biotestKey, istBild, merkeFuer, optionenFuer, pruefeGeschrieben, TEILE, uebung as uebungVon, UEBUNGEN, uebungenStand, zeige, type BiotestModus, type Stelle, type Uebung } from "@/lib/biotest";
import type { SpielErgebnis, SpielKarte } from "@/lib/lernspiele-typen";
import { aufTon, klang, setzeTon, tonAn } from "./klang";
import { Konfetti } from "./Lernspiel";
import { vibriere } from "./SpielTeile";
import { useSpielstand } from "./spielstand";
import { WeiterKnopf } from "./WeiterKnopf";

/**
 * „Bio Test 4.Klasse Vorbereitung De La Salle“ (lib/biotest.ts, docs/lernspiele.md): die 16 Übungen der Lehrkraft,
 * so wie sie auf ihrem Blatt stehen. Feld antippen (das nächste leere ist schon gewählt), unten das Wort aus dem
 * Wortkasten oder aus der Auswahlliste antippen. „Üben“: sofort richtig oder falsch; ein Fehler zeigt die Lösung und
 * den Satz dazu. „Wie im Test“: alles ausfüllen, dann „Abgeben“. Gezählt wird der erste Versuch; Fehler kommen mit
 * „Meine Fehler“ wieder. Keine Animationen außer kleinen Rückmeldungen (niko 2026-11-23).
 */

type Phase = "start" | "laden" | "uebung" | "ende";
type Schritt = { uebung: string; nur?: string[] };
type Plan = { name: string; schritte: Schritt[]; modus: BiotestModus };
type Runde = { rundeId: number; karten: SpielKarte[]; u: Uebung; offen: string[] };
type Zustand = "richtig" | "falsch" | "geholfen" | "fest";
type Hilfe = { s: Stelle; art: "falsch" | "fast"; du?: string };
type Ergebnis = { uebung: string; richtig: number; anzahl: number };
/** Eine angefangene Übung zum Weiterspielen (components/lernen/spielstand.ts). */
type BtStand = { v: 1; plan: Plan; schritt: number; runde: Runde; werte: Record<string, string>; zustand: Record<string, Zustand>; aktiv: string | null; erste: [string, string][]; ergebnisse: Ergebnis[] };
const istBtStand = (x: unknown): x is BtStand => {
  const s = x as BtStand | null;
  return !!s && s.v === 1 && !!s.plan && Array.isArray(s.plan.schritte) && !!s.runde && Number.isInteger(s.runde.rundeId) && !!s.runde.u && Array.isArray(s.runde.offen) && !!s.werte && Array.isArray(s.erste);
};

const MODUS_NAME: Record<BiotestModus, string> = { ueben: "Üben", test: "Wie im Test" };

export function BioTest({
  token,
  amTablet,
  sicher: sicherAnfang,
  falsch: falschAnfang,
  grund,
  zurueck: zurueckZiel,
}: {
  token: string;
  amTablet?: boolean;
  /** Stellen („übung:stelle“), die sicher sitzen */
  sicher: string[];
  /** Stellen, die zuletzt falsch waren */
  falsch: string[];
  /** warum es gerade passt („Biologie-Test in 3 Tagen“) */
  grund?: string;
  zurueck?: string;
}) {
  const router = useRouter();
  const server = useMemo(
    () => ({
      starten: (u: string, nur?: string[]) => (amTablet ? tabletBiotestStartenAction(u, nur) : biotestStartenAction(token, u, nur)),
      beenden: (id: number, antworten: { key: string; wahl: string }[]) => (amTablet ? tabletSpielBeendenAction(id, antworten) : spielBeendenAction(token, id, antworten)),
    }),
    [amTablet, token],
  );
  const zurueck = zurueckZiel ?? `/lernen/${token}/spiele`;
  const ZuLink = amTablet ? "a" : Link;

  const [phase, setPhase] = useState<Phase>("start");
  const [fehler, setFehler] = useState<string | null>(null);
  const [ton, setTon] = useState(true);
  const [modus, setModus] = useState<BiotestModus>("ueben");
  const [sicher, setSicher] = useState<Set<string>>(new Set(sicherAnfang));
  const [falsch, setFalsch] = useState<Set<string>>(new Set(falschAnfang));
  const [plan, setPlan] = useState<Plan | null>(null);
  const [schritt, setSchritt] = useState(0);
  const [runde, setRunde] = useState<Runde | null>(null);
  const [werte, setWerte] = useState<Record<string, string>>({});
  const [zustand, setZustand] = useState<Record<string, Zustand>>({});
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [hilfe, setHilfe] = useState<Hilfe | null>(null);
  const [wackelt, setWackelt] = useState<string | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [fertig, setFertig] = useState<{ richtig: number; anzahl: number; falsch: string[] } | null>(null);
  const [ergebnisse, setErgebnisse] = useState<Ergebnis[]>([]);
  const [gespeichert, setGespeichert] = useState<SpielErgebnis | null>(null);
  const [gross, setGross] = useState(false);

  const erste = useRef(new Map<string, string>());
  const blatt = useRef<HTMLDivElement | null>(null);
  const feld = useRef<HTMLInputElement | null>(null);

  // angefangene Übung merken und weiterspielen (niko 2026-11-25: „es soll den Stand halten“); am Tablet für den Schüler der Einheit
  const spielstand = useSpielstand<BtStand>("biotest", amTablet ? "" : token);
  const gemerkt = spielstand.offen && istBtStand(spielstand.offen.stand) ? spielstand.offen.stand : null;
  const merkeSpiel = spielstand.merke;
  const vergissSpiel = spielstand.vergiss;
  useEffect(() => {
    if (phase !== "uebung" || !runde || !plan || fertig) return;
    merkeSpiel({ v: 1, plan, schritt, runde, werte, zustand, aktiv, erste: [...erste.current.entries()], ergebnisse }, [runde.rundeId]);
  }, [phase, plan, schritt, runde, werte, zustand, aktiv, hilfe, ergebnisse, fertig, merkeSpiel]);
  const fortsetzen = (g: BtStand) => {
    erste.current = new Map(g.erste.filter((a) => Array.isArray(a) && typeof a[0] === "string" && typeof a[1] === "string"));
    setFehler(null);
    setModus(g.plan.modus);
    setPlan(g.plan);
    setSchritt(g.schritt);
    setRunde(g.runde);
    setWerte(g.werte);
    setZustand(g.zustand ?? {});
    setAktiv(g.aktiv);
    setHilfe(null);
    setEingabe("");
    setFertig(null);
    setGespeichert(null);
    setErgebnisse(Array.isArray(g.ergebnisse) ? g.ergebnisse : []);
    setPhase("uebung");
  };
  const gemerktText = (g: BtStand) => `${g.runde.u.titel ?? "Übung"} · ${g.runde.offen.filter((id) => g.werte[id]).length} von ${g.runde.offen.length} ausgefüllt`;

  useEffect(() => {
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

  const jeUebung = useMemo(() => new Map(uebungenStand(sicher, falsch).map((x) => [x.id, x])), [sicher, falsch]);
  const alleSicher = [...jeUebung.values()].reduce((n, x) => n + x.sicher, 0);
  const alleAnzahl = [...jeUebung.values()].reduce((n, x) => n + x.alle, 0);
  const fehlerSchritte: Schritt[] = UEBUNGEN.map((u) => ({ uebung: u.id, nur: jeUebung.get(u.id)?.falsch ?? [] })).filter((s) => s.nur.length > 0);
  const fehlerAnzahl = fehlerSchritte.reduce((n, s) => n + (s.nur?.length ?? 0), 0);

  const u = runde?.u ?? null;
  const offen = useMemo(() => new Set(runde?.offen ?? []), [runde]);
  const stelle = useCallback((id: string | null) => (u && id ? u.stellen.find((s) => s.id === id) : undefined), [u]);
  const aktivStelle = stelle(aktiv);
  const pModus = plan?.modus ?? modus;

  // ---------- Runde ----------

  const ladeSchritt = useCallback(
    async (p: Plan, i: number) => {
      const sch = p.schritte[i];
      const ue = uebungVon(sch.uebung);
      if (!ue) return;
      setPhase("laden");
      setFehler(null);
      const r = await server.starten(sch.uebung, sch.nur);
      if ("fehler" in r) {
        setFehler(r.fehler);
        setPhase("start");
        return;
      }
      const ids = r.karten.map((k) => k.biotest?.stelle ?? "").filter(Boolean);
      const w: Record<string, string> = {};
      const z: Record<string, Zustand> = {};
      for (const s of ue.stellen)
        if (!ids.includes(s.id)) {
          w[s.id] = s.richtig;
          z[s.id] = "fest";
        }
      erste.current = new Map();
      setPlan(p);
      setSchritt(i);
      setRunde({ rundeId: r.rundeId, karten: r.karten, u: ue, offen: ids });
      setWerte(w);
      setZustand(z);
      setAktiv(ue.art === "reihenfolge" ? null : (ids[0] ?? null));
      setHilfe(null);
      setEingabe("");
      setFertig(null);
      setGespeichert(null);
      setPhase("uebung");
    },
    [server],
  );

  const starte = useCallback(
    (p: Plan) => {
      setErgebnisse([]);
      void ladeSchritt(p, 0);
    },
    [ladeSchritt],
  );

  /** Die nächste leere Stelle nach `von` (ringsum); null, wenn alles ausgefüllt ist. */
  const naechste = useCallback(
    (von: string | null, w: Record<string, string>) => {
      if (!runde) return null;
      const liste = runde.offen;
      const start = von ? liste.indexOf(von) : -1;
      for (let i = 1; i <= liste.length; i++) {
        const id = liste[(start + i + liste.length) % liste.length];
        if (!w[id]) return id;
      }
      return null;
    },
    [runde],
  );

  /** Die Übung ist fertig (Üben: alles ausgefüllt, Test: abgegeben): an den Server, Ergebnis zeigen. */
  const abschliessen = useCallback(
    async (antworten: Map<string, string>) => {
      if (!runde) return;
      const liste = runde.offen.map((id) => ({ key: biotestKey(runde.u.id, id), wahl: antworten.get(id) ?? "" }));
      const richtigIds = runde.offen.filter((id) => antworten.get(id) === stelle(id)?.richtig);
      const f = runde.offen.filter((id) => !richtigIds.includes(id));
      const anteil = richtigIds.length / Math.max(1, runde.offen.length);
      spiele((k) => (anteil >= 0.7 ? k.frei() : k.aus()));
      setFertig({ richtig: richtigIds.length, anzahl: runde.offen.length, falsch: f });
      setErgebnisse((e) => [...e, { uebung: runde.u.id, richtig: richtigIds.length, anzahl: runde.offen.length }]);
      setAktiv(null);
      const e = await server.beenden(runde.rundeId, liste).catch(() => ({ fehler: "Die Verbindung ist weg. Lade die Seite neu, dein Stand ist gemerkt." }));
      setGespeichert(e);
      if (!("fehler" in e)) vergissSpiel();
      if (!("fehler" in e) && e.biotest) {
        setSicher(new Set(e.biotest.sicher));
        setFalsch(new Set(e.biotest.falsch));
      }
      router.refresh();
    },
    [runde, server, router, spiele, stelle, vergissSpiel],
  );

  // Üben: wenn alles ausgefüllt ist, ist die Übung fertig
  useEffect(() => {
    if (phase !== "uebung" || !runde || fertig || hilfe || pModus !== "ueben") return;
    if (runde.offen.every((id) => werte[id])) {
      const t = window.setTimeout(() => void abschliessen(erste.current), 450);
      return () => window.clearTimeout(t);
    }
  }, [phase, runde, werte, fertig, hilfe, pModus, abschliessen]);

  // das gewählte Feld ins Bild holen
  useEffect(() => {
    if (!aktiv) return;
    // nur scrollen, wenn das Feld nicht ganz zu sehen ist (unter einer festen Grafik zählt der Platz darunter)
    const box = blatt.current;
    const el = box?.querySelector<HTMLElement>(`[data-stelle="${aktiv}"]`);
    if (box && el) {
      const r = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const oben = b.top + (box.querySelector<HTMLElement>(".bt-grafik")?.getBoundingClientRect().height ?? 0);
      if (r.bottom > b.bottom - 8) box.scrollBy({ top: r.bottom - b.bottom + 48, behavior: "smooth" });
      else if (r.top < oben + 8) box.scrollBy({ top: r.top - oben - 48, behavior: "smooth" });
    }
    if (aktivStelle?.muster) window.setTimeout(() => feld.current?.focus({ preventScroll: true }), 50);
  }, [aktiv, aktivStelle]);

  const falschGetippt = (id: string) => {
    setWackelt(id);
    window.setTimeout(() => setWackelt((x) => (x === id ? null : x)), 450);
    spiele((k) => k.falsch());
    vibriere([40, 60, 40]);
  };

  /** Üben: eine Stelle ist richtig belegt (beim ersten Mal oder nach der Hilfe). */
  const setzeRichtig = (s: Stelle, wert: string, art: Zustand) => {
    const w = { ...werte, [s.id]: wert };
    setWerte(w);
    setZustand((z) => ({ ...z, [s.id]: art }));
    setAktiv(u?.art === "reihenfolge" ? null : naechste(s.id, w));
    setEingabe("");
  };

  /** Eine Wahl für die gewählte Stelle (Wortkasten, Auswahlliste, Spalte). */
  const waehle = (wert: string) => {
    if (!runde || !aktivStelle || fertig || hilfe) return;
    const s = aktivStelle;
    if (pModus === "test") {
      const w = { ...werte, [s.id]: wert };
      setWerte(w);
      setAktiv(naechste(s.id, w) ?? s.id);
      spiele((k) => k.setzen());
      return;
    }
    if (!erste.current.has(s.id)) erste.current.set(s.id, wert);
    if (wert === s.richtig) {
      spiele((k) => k.richtig(false));
      vibriere(12);
      setzeRichtig(s, wert, erste.current.get(s.id) === s.richtig ? "richtig" : "geholfen");
      return;
    }
    falschGetippt(s.id);
    setHilfe({ s, art: "falsch", du: zeige(wert) });
  };

  /** Selbst geschrieben (Fachbegriffe 2). */
  const schreibe = (e: FormEvent) => {
    e.preventDefault();
    if (!aktivStelle || fertig || hilfe) return;
    const s = aktivStelle;
    const text = eingabe.trim();
    if (!text) return;
    if (pModus === "test") {
      const w = { ...werte, [s.id]: text };
      setWerte(w);
      setEingabe("");
      setAktiv(naechste(s.id, w) ?? s.id);
      return;
    }
    const r = pruefeGeschrieben(text, s);
    if (!erste.current.has(s.id)) erste.current.set(s.id, r === "falsch" ? text : s.richtig);
    if (r === "falsch") {
      falschGetippt(s.id);
      setHilfe({ s, art: "falsch", du: text });
      return;
    }
    spiele((k) => k.richtig(false));
    if (r === "fast") setHilfe({ s, art: "fast", du: text });
    setzeRichtig(s, s.richtig, erste.current.get(s.id) === s.richtig ? "richtig" : "geholfen");
  };

  const weissNicht = () => {
    if (!aktivStelle || hilfe) return;
    if (!erste.current.has(aktivStelle.id)) erste.current.set(aktivStelle.id, "");
    setHilfe({ s: aktivStelle, art: "falsch", du: "" });
  };

  const hilfeWeiter = () => {
    if (!hilfe) return;
    const s = hilfe.s;
    setHilfe(null);
    if (hilfe.art === "falsch") setzeRichtig(s, s.richtig, "geholfen");
  };

  /** Reihenfolge: einen Satz antippen. */
  const tippeSatz = (s: Stelle) => {
    if (!runde || fertig || hilfe || zustand[s.id] === "fest") return;
    if (pModus === "test") {
      if (werte[s.id]) {
        const w = { ...werte };
        delete w[s.id];
        setWerte(w);
        return;
      }
      const belegt = new Set(Object.values(werte));
      const n = runde.u.stellen.map((_, i) => String(i + 1)).find((x) => !belegt.has(x));
      if (n) {
        setWerte({ ...werte, [s.id]: n });
        spiele((k) => k.setzen());
      }
      return;
    }
    if (werte[s.id]) return;
    const belegt = new Set(Object.values(werte));
    const k = runde.u.stellen.map((_, i) => String(i + 1)).find((x) => !belegt.has(x));
    if (!k) return;
    if (s.richtig === k) {
      if (!erste.current.has(s.id)) erste.current.set(s.id, k);
      spiele((x) => x.richtig(false));
      vibriere(12);
      setzeRichtig(s, k, erste.current.get(s.id) === k ? "richtig" : "geholfen");
      return;
    }
    const soll = runde.u.stellen.find((x) => x.richtig === k);
    if (!soll) return;
    if (!erste.current.has(soll.id)) erste.current.set(soll.id, "0");
    falschGetippt(s.id);
    setHilfe({ s: soll, art: "falsch", du: s.text });
  };

  /** Wie im Test: abgeben. */
  const abgeben = () => {
    if (!runde || fertig) return;
    const antworten = new Map<string, string>();
    const z: Record<string, Zustand> = { ...zustand };
    for (const id of runde.offen) {
      const s = stelle(id);
      if (!s) continue;
      const wert = werte[id] ?? "";
      const wahl = s.muster && wert ? (pruefeGeschrieben(wert, s) !== "falsch" ? s.richtig : wert) : wert;
      antworten.set(id, wahl);
      z[id] = wahl === s.richtig ? "richtig" : "falsch";
    }
    setZustand(z);
    void abschliessen(antworten);
  };

  const fehlerNochmal = () => {
    if (!runde || !fertig) return;
    const p: Plan = { name: `Fehler: ${runde.u.titel}`, schritte: [{ uebung: runde.u.id, nur: fertig.falsch }], modus: "ueben" };
    starte(p);
  };

  const weiterNachUebung = () => {
    if (!plan) return;
    if (schritt + 1 < plan.schritte.length) void ladeSchritt(plan, schritt + 1);
    else if (plan.schritte.length > 1) setPhase("ende");
    else setPhase("start");
  };

  const naechsteUebung = () => {
    if (!runde) return;
    const i = UEBUNGEN.findIndex((x) => x.id === runde.u.id);
    const n = UEBUNGEN[i + 1];
    if (n) starte({ name: n.titel, schritte: [{ uebung: n.id }], modus: pModus });
    else setPhase("start");
  };

  // ---------- Kopf ----------

  const kopf = (
    <div className="ls-kopf">
      <ZuLink href={zurueck} className="ls-zu treffer" aria-label="Spiel schließen">
        <X size={24} aria-hidden />
      </ZuLink>
      {phase === "uebung" && plan && runde ? (
        <>
          <span className="pb-fortschritt" role="progressbar" aria-valuemin={0} aria-valuemax={runde.offen.length} aria-valuenow={runde.offen.filter((id) => werte[id]).length} aria-label="Ausgefüllt">
            <i style={{ width: `${Math.round((runde.offen.filter((id) => werte[id]).length / Math.max(1, runde.offen.length)) * 100)}%` }} />
          </span>
          <span className="bt-modus-schild">{plan.schritte.length > 1 ? `${schritt + 1}/${plan.schritte.length}` : MODUS_NAME[pModus]}</span>
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
      <div className="ls bt" role="dialog" aria-modal="true" aria-label="Bio Test 4.Klasse Vorbereitung De La Salle">
        {kopf}
        <div className="ls-mitte ls-rollt ls-staffel" key="start">
          <p className="ls-oberzeile" style={{ "--n": 0 } as CSSProperties}>
            Lernspiel · Biologie
          </p>
          <h1 className="ls-titel bt-titel" style={{ "--n": 1 } as CSSProperties}>
            Bio Test 4.Klasse Vorbereitung De La Salle
          </h1>
          <p className="ls-text mt-1" style={{ "--n": 1 } as CSSProperties}>
            Die Übungen deiner Lehrkraft, genau wie auf dem Blatt.
          </p>
          {gemerkt && <WeiterKnopf className="mt-4" text={gemerktText(gemerkt)} onClick={() => fortsetzen(gemerkt)} disabled={phase === "laden"} />}
          {grund && (
            <span className="ls-grund mt-3" style={{ "--n": 2 } as CSSProperties} data-testid="bt-grund">
              <BookOpen size={16} aria-hidden />
              {grund}
            </span>
          )}

          <div className="bt-modus mt-4" role="group" aria-label="Wie üben?" style={{ "--n": 2 } as CSSProperties}>
            {(["ueben", "test"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={modus === m} onClick={() => setModus(m)} data-testid={`bt-modus-${m}`}>
                {MODUS_NAME[m]}
              </button>
            ))}
          </div>
          <p className="ls-klein mt-2 text-center" style={{ "--n": 2 } as CSSProperties}>
            {modus === "ueben" ? "Du siehst sofort, ob es stimmt. Bei einem Fehler kommt die Lösung mit dem Satz dazu." : "Erst alles ausfüllen, dann abgeben. Danach siehst du, was stimmt."}
          </p>

          <div className="pb-wahl mt-4" style={{ "--n": 3 } as CSSProperties}>
            <button
              type="button"
              className="pb-wahl-knopf"
              onClick={() => starte({ name: "Alle Übungen", schritte: UEBUNGEN.map((x) => ({ uebung: x.id })), modus })}
              disabled={phase === "laden"}
              data-testid="bt-alle"
              autoFocus
            >
              <ListChecks size={26} aria-hidden />
              <span>
                <b>Alle Übungen der Reihe nach</b>
                <small>
                  {UEBUNGEN.length} Übungen, {MODUS_NAME[modus]}.
                </small>
              </span>
            </button>
            {fehlerAnzahl > 0 && (
              <button type="button" className="pb-wahl-knopf" onClick={() => starte({ name: "Meine Fehler", schritte: fehlerSchritte, modus: "ueben" })} disabled={phase === "laden"} data-testid="bt-fehler">
                <RotateCcw size={26} aria-hidden />
                <span>
                  <b>Meine Fehler</b>
                  <small>
                    {fehlerAnzahl === 1 ? "1 Feld" : `${fehlerAnzahl} Felder`}, die zuletzt falsch waren, in ihrer Übung.
                  </small>
                </span>
              </button>
            )}
            <button type="button" className="pb-wahl-knopf" onClick={() => starte({ name: "Großer Test", schritte: UEBUNGEN.map((x) => ({ uebung: x.id })), modus: "test" })} disabled={phase === "laden"} data-testid="bt-gross">
              <Star size={26} aria-hidden />
              <span>
                <b>Großer Test</b>
                <small>Alle {UEBUNGEN.length} Übungen wie im Test, am Ende deine Punkte.</small>
              </span>
            </button>
          </div>

          <div className="ls-glas mt-4 p-4" style={{ "--n": 4 } as CSSProperties} data-testid="bt-uebungen">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-semibold">Die Übungen</span>
              <span className="ls-klein tabular-nums" data-testid="bt-sicher">
                {alleSicher} von {alleAnzahl} Feldern sicher
              </span>
            </p>
            {TEILE.map((t) => (
              <div key={t.id} className="mt-3">
                <p className="bt-teil">
                  {t.titel} <span>{t.seiten}</span>
                </p>
                <ul className="mt-1 grid gap-1.5">
                  {UEBUNGEN.filter((x) => x.teil === t.id).map((x) => {
                    const st = jeUebung.get(x.id);
                    const nr = UEBUNGEN.indexOf(x) + 1;
                    return (
                      <li key={x.id}>
                        <button type="button" className="bt-zeile" onClick={() => starte({ name: x.titel, schritte: [{ uebung: x.id }], modus })} disabled={phase === "laden"} data-testid={`bt-uebung-${x.id}`}>
                          <span className="bt-nr">{nr}</span>
                          <span className="bt-zeile-name">{x.titel.replace(/\.$/, "")}</span>
                          {st && st.falsch.length > 0 && (
                            <span className="bt-punkt" aria-label={`${st.falsch.length} zuletzt falsch`}>
                              {st.falsch.length}
                            </span>
                          )}
                          <span className="bt-balken" aria-hidden>
                            <i style={{ width: `${Math.round(((st?.sicher ?? 0) / Math.max(1, x.stellen.length)) * 100)}%` }} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <p className="ls-klein mt-3">Tipp eine Übung an, um nur die zu machen. Sicher heißt: zweimal hintereinander beim ersten Versuch richtig.</p>
          </div>
          {fehler && (
            <p className="ls-fehler mt-6" role="alert">
              {fehler}
            </p>
          )}
          {phase === "laden" && <p className="ls-klein mt-4 text-center">Die Übung wird geladen …</p>}
        </div>
      </div>
    );
  }

  // ---------- Ende (mehrere Übungen) ----------

  if (phase === "ende" && plan) {
    const richtig = ergebnisse.reduce((n, e) => n + e.richtig, 0);
    const anzahl = ergebnisse.reduce((n, e) => n + e.anzahl, 0);
    const anteil = anzahl ? richtig / anzahl : 0;
    return (
      <div className="ls bt" role="dialog" aria-modal="true" aria-label="Geschafft">
        {anteil >= 0.7 && <Konfetti />}
        {kopf}
        <div className="ls-mitte ls-rollt ls-staffel text-center" key="ende">
          <div className="ls-ring mx-auto" data-testid="bt-ende" style={{ "--n": 0 } as CSSProperties}>
            <svg viewBox="0 0 120 120" aria-hidden>
              <circle cx="60" cy="60" r="50" pathLength={100} className="ls-ring-spur" />
              <circle cx="60" cy="60" r="50" pathLength={100} className="ls-ring-wert" style={{ strokeDashoffset: 100 - Math.round(anteil * 100) } as CSSProperties} />
            </svg>
            <div className="ls-ring-zahl" data-lang={3}>
              <b data-testid="bt-ende-richtig">{richtig}</b>
              <span>von {anzahl}</span>
            </div>
          </div>
          <h1 className="bw-ende-titel mt-3" style={{ "--n": 1 } as CSSProperties}>
            {anteil >= 0.9 ? "Bereit für den Test!" : anteil >= 0.7 ? "Gut gemacht!" : "Weiter üben, das wird!"}
          </h1>
          <p className="ls-text mt-1" style={{ "--n": 1 } as CSSProperties}>
            {plan.name}: {Math.round(anteil * 100)} % beim ersten Versuch richtig
          </p>
          <div className="ls-glas mt-4 p-4 text-left" style={{ "--n": 2 } as CSSProperties}>
            <ul className="grid gap-1.5">
              {ergebnisse.map((e, i) => (
                <li key={`${e.uebung}-${i}`} className="bt-zeile" data-still="">
                  <span className="bt-zeile-name">{uebungVon(e.uebung)?.titel.replace(/\.$/, "")}</span>
                  <span className="bt-zahl tabular-nums">
                    {e.richtig}/{e.anzahl}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-auto grid gap-3 pt-8" style={{ "--n": 3 } as CSSProperties}>
            <button type="button" className="ls-knopf ls-los" onClick={() => setPhase("start")} autoFocus>
              Zur Übersicht
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Übung ----------

  if (!runde || !u) return null;
  const test = pModus === "test";
  const abgegeben = test && !!fertig;

  /** Ein Feld (Lücke, Zelle, Zeile): zeigt das Gewählte, nach dem Abgeben auch die Lösung. */
  const feldFuer = (s: Stelle, inline?: boolean, key?: string | number) => {
    const wert = werte[s.id];
    const z = zustand[s.id];
    const gesperrt = z === "fest" || !!fertig || (!test && (z === "richtig" || z === "geholfen"));
    // eslint-disable-next-line @next/next/no-img-element
    const inhalt = (w: string) => (istBild(w) ? <img src={BILDER[w]?.src} alt={BILDER[w]?.alt ?? ""} className="bt-feld-bild" draggable={false} /> : w);
    return (
      <button
        key={key}
        type="button"
        className="bt-feld"
        data-inline={inline ? "" : undefined}
        data-stelle={s.id}
        data-aktiv={aktiv === s.id && !fertig ? "" : undefined}
        data-zustand={z}
        data-leer={!wert ? "" : undefined}
        data-wackelt={wackelt === s.id ? "" : undefined}
        data-bild={istBild(s.richtig) ? "" : undefined}
        onClick={() => !gesperrt && setAktiv(s.id)}
        aria-disabled={gesperrt || undefined}
        aria-label={wert ? `Feld: ${zeige(wert)}` : "Leeres Feld"}
        data-testid="bt-feld"
      >
        {abgegeben && z === "falsch" ? (
          <>
            {wert ? <s className="bt-falsch-wert">{inhalt(wert)}</s> : <span className="bt-falsch-wert">leer</span>}
            <span className="bt-loesung">{inhalt(s.richtig)}</span>
          </>
        ) : wert ? (
          inhalt(wert)
        ) : (
          <span className="bt-muster">{s.muster ?? " "}</span>
        )}
      </button>
    );
  };

  // Wortkasten: was hier noch zu wählen ist
  const optionen = aktivStelle ? optionenFuer(u, aktivStelle) : [];
  const ausKasten = aktivStelle && !aktivStelle.optionen && (u.art === "luecken" || u.art === "liste" || u.art === "bild" || u.art === "tabelle");
  const benutzt = new Set(
    Object.entries(werte)
      .filter(([id]) => id !== aktiv)
      .filter(([id]) => test || zustand[id] === "richtig" || zustand[id] === "geholfen" || zustand[id] === "fest")
      .map(([, w]) => w),
  );
  const zeigeOptionen = ausKasten ? optionen.filter((o) => !benutzt.has(o)) : optionen;
  const ausgefuellt = runde.offen.filter((id) => werte[id]).length;

  let inhalt: ReactNode = null;
  if (u.art === "luecken") {
    inhalt = (
      <div className="bt-text">
        {u.text.split("\n\n").map((absatz, i) => (
          <p key={i}>
            {absatz.split("\n").map((zeile, j) => (
              <span key={j} className="bt-textzeile">
                {zeile.split(/(\[\[[a-z0-9]+\]\])/).map((teil, k) => {
                  const m = /^\[\[([a-z0-9]+)\]\]$/.exec(teil);
                  const s = m ? stelle(m[1]) : undefined;
                  return s ? feldFuer(s, true, k) : <span key={k}>{teil}</span>;
                })}
              </span>
            ))}
          </p>
        ))}
      </div>
    );
  } else if (u.art === "liste" || u.art === "bild") {
    inhalt = (
      <>
        {u.art === "bild" && (
          <button type="button" className="bt-grafik" onClick={() => setGross(true)} aria-label="Grafik vergrößern" data-testid="bt-grafik">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u.bild.src} alt={u.bild.alt} width={u.bild.breite} height={u.bild.hoehe} draggable={false} />
            <span className="bt-lupe" aria-hidden>
              <ZoomIn size={16} />
            </span>
          </button>
        )}
        <ul className="bt-liste" data-art={u.art}>
          {u.stellen.map((s) => (
            <li key={s.id}>
              <span className="bt-liste-text">{u.art === "bild" ? <span className="bt-nummer">{s.text}</span> : s.text}</span>
              {feldFuer(s)}
            </li>
          ))}
        </ul>
      </>
    );
  } else if (u.art === "tabelle") {
    inhalt = (
      <div className="bt-tabelle-rahmen">
        <table className="bt-tabelle" lang="de">
          <tbody>
            {u.zeilen.map((z) => (
              <tr key={z.titel}>
                <th scope="row">{z.titel}</th>
                {z.zellen.map((c, i) => (
                  <td key={i}>{typeof c === "string" ? <span className="bt-fix">{c}</span> : stelle(c.id) ? feldFuer(stelle(c.id)!) : null}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else if (u.art === "reihenfolge") {
    inhalt = (
      <ul className="bt-reihe">
        {u.stellen.map((s) => {
          const z = zustand[s.id];
          const wert = werte[s.id];
          return (
            <li key={s.id}>
              <button
                type="button"
                className="bt-satz"
                onClick={() => tippeSatz(s)}
                data-stelle={s.id}
                data-zustand={z}
                data-wackelt={wackelt === s.id ? "" : undefined}
                disabled={!!fertig || z === "fest"}
                data-testid="bt-satz"
              >
                <span className="bt-satz-nr" data-leer={!wert ? "" : undefined}>
                  {abgegeben && z === "falsch" ? (
                    <>
                      <s>{wert || "–"}</s> {s.richtig}
                    </>
                  ) : (
                    (wert ?? "")
                  )}
                </span>
                <span>{s.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  } else if (u.art === "spalten") {
    inhalt = (
      <>
        <div className="bt-spalten">
          {u.spalten.map((sp) => (
            <div key={sp} className="bt-spalte">
              <p className="bt-spalte-kopf">{sp}</p>
              <div className="bt-spalte-inhalt">
                {u.stellen
                  .filter((s) => werte[s.id] === sp)
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="bt-begriff"
                      data-stelle={s.id}
                      data-zustand={zustand[s.id]}
                      onClick={() => test && !fertig && setAktiv(s.id)}
                      data-aktiv={aktiv === s.id && !fertig ? "" : undefined}
                      disabled={!test || !!fertig}
                    >
                      {s.text}
                      {abgegeben && zustand[s.id] === "falsch" && <small> → {s.richtig}</small>}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <p className="bt-unter">Noch zuordnen</p>
        <div className="bt-pool">
          {u.stellen
            .filter((s) => !werte[s.id])
            .map((s) => (
              <button
                key={s.id}
                type="button"
                className="bt-begriff"
                data-stelle={s.id}
                data-aktiv={aktiv === s.id && !fertig ? "" : undefined}
                data-zustand={zustand[s.id]}
                data-wackelt={wackelt === s.id ? "" : undefined}
                onClick={() => !fertig && setAktiv(s.id)}
                data-testid="bt-begriff"
              >
                {s.text}
              </button>
            ))}
          {u.stellen.every((s) => werte[s.id]) && <span className="ls-klein-dunkel">Alle zugeordnet.</span>}
        </div>
      </>
    );
  }

  // ---------- unten: Auswahl, Schreiben oder Ergebnis ----------

  let unten: ReactNode;
  if (fertig) {
    const anteil = fertig.richtig / Math.max(1, fertig.anzahl);
    const mehrere = (plan?.schritte.length ?? 1) > 1;
    unten = (
      <div className="bt-fertig" data-testid="bt-fertig">
        {anteil >= 0.9 && !mehrere && <Konfetti />}
        <p className="bt-fertig-zahl">
          <b data-testid="bt-fertig-richtig">{fertig.richtig}</b> von {fertig.anzahl} {test ? "richtig" : "beim ersten Versuch richtig"}
        </p>
        <p className="bt-fertig-text">{anteil === 1 ? "Alles richtig!" : fertig.falsch.length === 1 ? "1 Feld war falsch. Schau es dir oben noch einmal an." : `${fertig.falsch.length} Felder waren falsch. Schau sie dir oben noch einmal an.`}</p>
        {gespeichert && "fehler" in gespeichert && (
          <p className="bt-fehler" role="alert">
            {gespeichert.fehler}
          </p>
        )}
        <div className="bt-fertig-knoepfe">
          {fertig.falsch.length > 0 && (
            <button type="button" className="bt-knopf" data-zweit="" onClick={fehlerNochmal} data-testid="bt-fehler-nochmal">
              <RotateCcw size={18} aria-hidden /> Fehler nochmal
            </button>
          )}
          {mehrere ? (
            <button type="button" className="bt-knopf" onClick={weiterNachUebung} autoFocus data-testid="bt-weiter">
              {schritt + 1 < (plan?.schritte.length ?? 0) ? "Nächste Übung" : "Fertig"}
            </button>
          ) : (
            <>
              <button type="button" className="bt-knopf" data-zweit="" onClick={() => setPhase("start")} data-testid="bt-uebersicht">
                Übersicht
              </button>
              {UEBUNGEN.findIndex((x) => x.id === u.id) < UEBUNGEN.length - 1 && (
                <button type="button" className="bt-knopf" onClick={naechsteUebung} autoFocus data-testid="bt-naechste">
                  Nächste Übung
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  } else if (u.art === "reihenfolge") {
    unten = (
      <div className="bt-auswahl">
        <p className="bt-auswahl-kopf">{test ? "Tippe die Sätze der Reihe nach an. Nochmal tippen nimmt die Nummer weg." : "Tippe den Satz an, der als Nächstes kommt."}</p>
        {test && <Abgeben n={ausgefuellt} von={runde.offen.length} onAbgeben={abgeben} />}
      </div>
    );
  } else if (aktivStelle?.muster) {
    unten = (
      <form className="bt-auswahl" onSubmit={schreibe}>
        <p className="bt-auswahl-kopf">Schreib das ganze Wort: {aktivStelle.muster.replace(/ /g, "")}</p>
        <div className="bt-schreiben">
          <input
            ref={feld}
            className="bt-eingabe"
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            placeholder="Dein Wort"
            aria-label="Dein Wort"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            maxLength={40}
            data-testid="bt-eingabe"
          />
          <button type="submit" className="bt-knopf" disabled={!eingabe.trim()} data-testid="bt-schreiben-ok">
            OK
          </button>
        </div>
        {!test && (
          <button type="button" className="bt-leise" onClick={weissNicht}>
            Weiß ich nicht
          </button>
        )}
        {test && <Abgeben n={ausgefuellt} von={runde.offen.length} onAbgeben={abgeben} />}
      </form>
    );
  } else {
    unten = (
      <div className="bt-auswahl">
        {aktivStelle ? (
          <>
            <p className="bt-auswahl-kopf">
              {u.art === "spalten" ? <>Wohin gehört „{aktivStelle.text}“?</> : u.art === "bild" ? <>Feld {aktivStelle.text}:</> : u.art === "liste" ? <>{aktivStelle.text}:</> : aktivStelle.optionen ? "Wähle aus der Liste:" : "Wähle aus dem Wortkasten:"}
            </p>
            <div className="bt-optionen" data-bilder={zeigeOptionen.some(istBild) ? "" : undefined} data-spalten={u.art === "spalten" ? "" : undefined}>
              {zeigeOptionen.map((o) => (
                <button key={o} type="button" className="bt-option" onClick={() => waehle(o)} data-gewaehlt={werte[aktivStelle.id] === o ? "" : undefined} data-testid="bt-option" data-wert={o}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {istBild(o) ? <img src={BILDER[o]?.src} alt={BILDER[o]?.alt ?? ""} draggable={false} /> : o}
                </button>
              ))}
            </div>
            {test && werte[aktivStelle.id] && (
              <button
                type="button"
                className="bt-leise"
                onClick={() => {
                  const w = { ...werte };
                  delete w[aktivStelle.id];
                  setWerte(w);
                }}
              >
                Feld leeren
              </button>
            )}
          </>
        ) : (
          <p className="bt-auswahl-kopf">{test ? "Alles ausgefüllt. Tippe ein Feld an, um es zu ändern." : "Tippe ein leeres Feld an."}</p>
        )}
        {test && <Abgeben n={ausgefuellt} von={runde.offen.length} onAbgeben={abgeben} />}
      </div>
    );
  }

  return (
    <div className="ls bt" role="dialog" aria-modal="true" aria-label={u.titel} data-art={u.art}>
      {kopf}
      <div className="bt-blatt-bereich" ref={blatt} key={`bereich-${runde.rundeId}`}>
        <div className="ls-blatt bt-blatt" key={`${u.id}-${runde.rundeId}`} data-testid="bt-blatt" data-uebung={u.id}>
          <p className="bt-ueberschrift">
            <span aria-hidden>► </span>
            {u.titel}
          </p>
          {u.auftrag !== u.titel && <p className="bt-auftrag">{u.auftrag}</p>}
          <p className="bt-seite">({u.seite})</p>
          {offen.size < u.stellen.length && <p className="bt-nur">Nur deine Fehler sind offen, der Rest ist schon eingetragen.</p>}
          <div className="mt-4">{inhalt}</div>
        </div>
      </div>
      <div className="bt-unten">{unten}</div>

      {gross && u.art === "bild" && (
        <div className="bt-zoom" role="dialog" aria-label="Grafik groß" onClick={() => setGross(false)} data-testid="bt-zoom">
          <div className="bt-zoom-rahmen">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u.bild.src} alt={u.bild.alt} width={u.bild.breite} height={u.bild.hoehe} draggable={false} />
          </div>
          <button type="button" className="ls-zu treffer bt-zoom-zu" onClick={() => setGross(false)} aria-label="Grafik schließen" autoFocus>
            <X size={24} aria-hidden />
          </button>
        </div>
      )}

      {hilfe && (
        <div className="bt-hilfe" role="alert" data-art={hilfe.art} data-testid="bt-hilfe">
          <div className="ls-blatt bt-hilfe-blatt">
            <p className="bt-hilfe-titel">{hilfe.art === "fast" ? "Fast! Achte auf die Schreibung" : hilfe.du ? "Nicht ganz" : "So heißt es"}</p>
            <p className="bt-hilfe-text">
              {hilfe.du ? (
                <>
                  {u.art === "reihenfolge" ? "Du hast getippt: " : "Du: "}
                  <s>{hilfe.du}</s>
                  <br />
                </>
              ) : null}
              {u.art === "reihenfolge" ? (
                <>
                  Schritt {hilfe.s.richtig} ist: <b>{hilfe.s.text}</b>
                </>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  Richtig: <b>{istBild(hilfe.s.richtig) ? <img src={BILDER[hilfe.s.richtig]?.src} alt={BILDER[hilfe.s.richtig]?.alt ?? ""} className="bt-hilfe-bild" /> : hilfe.s.richtig}</b>
                </>
              )}
            </p>
            {u.art !== "reihenfolge" && <p className="bt-merke">{merkeFuer(u, hilfe.s)}</p>}
            <button type="button" className="bt-knopf mt-4 w-full" onClick={hilfeWeiter} autoFocus data-testid="bt-hilfe-weiter">
              Weiter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Abgeben({ n, von, onAbgeben }: { n: number; von: number; onAbgeben: () => void }) {
  return (
    <div className="bt-abgeben">
      <span className="tabular-nums">
        {n} von {von} ausgefüllt
      </span>
      <button type="button" className="bt-knopf" onClick={onAbgeben} data-testid="bt-abgeben">
        <PenLine size={18} aria-hidden /> Abgeben
      </button>
    </div>
  );
}

