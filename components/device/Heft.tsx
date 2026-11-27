"use client";

import { Check, Eraser, Hand, Loader2, PenLine, Plus, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { HeftAbschnitt, HeftKontrolle, HeftVorweg } from "@/components/HeftAbschnitt";
import { MathText } from "@/components/MathText";
import type { HeftAufgabe, HeftFeld, HeftStatus, HeftUrteil, Strich } from "@/lib/heft";

/** Wie lib/heft.ts (hier ohne Server-Import): Breite der Seite, Platz unter einer Aufgabe, „Mehr Platz“, höchstens. */
const BREITE = 1000;
const MEHR = 360;
const MAX_HOEHE = 2600;
/** Kästchen 5 mm, in Heft-Einheiten. */
const KAESTCHEN = 25;
/** Linien (Übungsheft in Deutsch, Englisch …): etwa 10 mm Abstand, in Heft-Einheiten. */
const LINIE = 48;
const STIFT = 2.8;
const TINTE = "#1c2740";
/** So nah (in Heft-Einheiten) muss der Radierer an einen Strich, damit er ihn wegnimmt. */
const RADIUS = 14;

type Werkzeug = "stift" | "radierer";

const URTEIL: Record<HeftUrteil, { text: string; klasse: string }> = {
  richtig: { text: "Richtig", klasse: "bg-green-wash text-green" },
  teilweise: { text: "Teilweise", klasse: "bg-[#fff1dc] text-[#a35a00]" },
  falsch: { text: "Falsch", klasse: "bg-red-wash text-red" },
  offen: { text: "Wird noch angeschaut", klasse: "bg-panel text-ink-2" },
};

/**
 * **Heft am Tablet** (lib/heft.ts): eine karierte Seite, die Aufgaben untereinander, unter jeder Platz zum Rechnen. Der Stift
 * schreibt, der Finger blättert (oder schreibt, wenn „Mit Finger schreiben“ an ist). Gespeichert wird laufend; „Fertig“ macht aus
 * den Feldern Seiten (Bilder) und gibt sie ab, die KI prüft alles auf einmal.
 */
export function Heft({
  assignmentId,
  titel,
  status,
  aufgaben,
  felder: start,
  homeHref,
  linien = false,
  vorweg = "",
  kontrolle = [],
}: {
  assignmentId: number;
  titel: string;
  status: HeftStatus;
  aufgaben: HeftAufgabe[];
  felder: HeftFeld[];
  homeHref: string;
  linien?: boolean;
  vorweg?: string;
  kontrolle?: string[];
}) {
  const router = useRouter();
  const [felder, setFelder] = useState(start);
  const [verlauf, setVerlauf] = useState<{ i: number; striche: Strich[] }[]>([]);
  const [werkzeug, setWerkzeug] = useState<Werkzeug>("stift");
  const [finger, setFinger] = useState(false);
  const [speichern, setSpeichern] = useState<"" | "laeuft" | "ok" | "fehler">("");
  const [fragen, setFragen] = useState(false);
  const [abgeben, setAbgeben] = useState<"" | "laeuft" | string>("");
  const [breite, setBreite] = useState(0);
  const liste = useRef<HTMLDivElement>(null);
  const geaendert = useRef(false);
  const offen = status === "schreibt" && abgeben !== "laeuft";

  useEffect(() => {
    try {
      setFinger(localStorage.getItem("heft-finger") === "1");
    } catch {}
  }, []);
  const fingerUmschalten = () =>
    setFinger((f) => {
      try {
        localStorage.setItem("heft-finger", f ? "0" : "1");
      } catch {}
      return !f;
    });

  useLayoutEffect(() => {
    const el = liste.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBreite(el.clientWidth));
    ro.observe(el);
    setBreite(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const sichern = useCallback(
    async (f: HeftFeld[]) => {
      setSpeichern("laeuft");
      try {
        const r = await fetch(`/geraet/heft/${assignmentId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ felder: f }) });
        setSpeichern(r.ok ? "ok" : "fehler");
      } catch {
        setSpeichern("fehler");
      }
    },
    [assignmentId],
  );

  // laufend speichern: kurz nach dem letzten Strich
  useEffect(() => {
    if (!geaendert.current || !offen) return;
    const t = setTimeout(() => sichern(felder), 1200);
    return () => clearTimeout(t);
  }, [felder, offen, sichern]);

  const aendere = (i: number, striche: Strich[]) => {
    geaendert.current = true;
    setVerlauf((v) => [...v.slice(-80), { i, striche: felder[i].striche }]);
    setFelder((fs) => fs.map((f, j) => (j === i ? { ...f, striche } : f)));
  };
  const rueckgaengig = () => {
    const letzter = verlauf.at(-1);
    if (!letzter) return;
    geaendert.current = true;
    setVerlauf((v) => v.slice(0, -1));
    setFelder((fs) => fs.map((f, j) => (j === letzter.i ? { ...f, striche: letzter.striche } : f)));
  };
  const mehrPlatz = (i: number) => {
    geaendert.current = true;
    setFelder((fs) => fs.map((f, j) => (j === i ? { ...f, hoehe: Math.min(MAX_HOEHE, f.hoehe + MEHR) } : f)));
  };

  const gibAb = async () => {
    setAbgeben("laeuft");
    try {
      const seiten = seitenBilder(titel, aufgaben, felder, linien);
      const r = await fetch(`/geraet/heft/${assignmentId}/abgeben`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ felder, seiten }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) return setAbgeben(j.error ?? "Das Abgeben hat nicht geklappt. Bitte noch einmal.");
      setAbgeben("");
      setFragen(false);
      router.refresh();
    } catch {
      setAbgeben("Keine Verbindung. Bitte noch einmal „Fertig“.");
    }
  };

  const bewertet = aufgaben.filter((a) => a.urteil);
  const richtig = bewertet.filter((a) => a.urteil === "richtig").length;

  return (
    <div className="grid gap-4" data-testid="heft">
      <a href={homeHref} className="inline-flex min-h-[44px] w-fit items-center text-[15px] font-medium text-ink-2">
        ← Alle Aufgaben
      </a>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.01em]">{titel}</h1>
        {offen && <span className="text-[13px] text-ink-3">{speichern === "laeuft" ? "Speichert …" : speichern === "ok" ? "Gespeichert" : speichern === "fehler" ? "Nicht gespeichert, keine Verbindung" : ""}</span>}
      </div>

      {status === "pruefen" || abgeben === "laeuft" ? (
        <p className="panel flex items-center gap-3 px-5 py-4 text-[17px] font-semibold" data-testid="heft-prueft">
          <Loader2 size={20} className="animate-spin text-accent" aria-hidden /> Abgegeben. Dein Heft wird geprüft …
        </p>
      ) : status === "geprueft" ? (
        <p className="panel px-5 py-4 text-[18px] font-semibold" data-testid="heft-ergebnis">
          Geprüft: {richtig} von {aufgaben.length} richtig
        </p>
      ) : status === "fehler" ? (
        <p className="panel px-5 py-4 text-[16px] text-ink-2">Abgegeben. Deine Lehrerin oder dein Lehrer schaut es gleich an.</p>
      ) : (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/95 p-2 shadow-[var(--shadow-card)] backdrop-blur" role="toolbar" aria-label="Werkzeuge">
          <Knopf an={werkzeug === "stift"} onClick={() => setWerkzeug("stift")} testid="heft-stift">
            <PenLine size={19} aria-hidden /> Stift
          </Knopf>
          <Knopf an={werkzeug === "radierer"} onClick={() => setWerkzeug("radierer")} testid="heft-radierer">
            <Eraser size={19} aria-hidden /> Radierer
          </Knopf>
          <Knopf onClick={rueckgaengig} disabled={!verlauf.length} testid="heft-zurueck">
            <Undo2 size={19} aria-hidden /> Zurück
          </Knopf>
          <span className="flex-1" />
          <Knopf an={finger} onClick={fingerUmschalten} testid="heft-finger">
            <Hand size={19} aria-hidden /> {finger ? "Finger schreibt" : "Finger blättert"}
          </Knopf>
        </div>
      )}

      <HeftVorweg text={vorweg} />
      <div ref={liste} className="grid gap-5">
        {aufgaben.map((a, i) => (
          <Fragment key={a.taskId}>
          {a.abschnitt && <HeftAbschnitt a={a.abschnitt} />}
          <section className="overflow-hidden rounded-2xl border border-line bg-white" aria-label={`Aufgabe ${a.nr}`} data-testid="heft-aufgabe">
            <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2 text-[#16213a]">
              <p className="text-[18px] leading-relaxed whitespace-pre-line">
                <span className="mr-2 font-semibold">{a.nr}.</span>
                <MathText text={a.text} />
              </p>
              {a.urteil && (
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[14px] font-semibold ${URTEIL[a.urteil].klasse}`}>
                  {a.urteil === "richtig" ? <Check size={15} aria-hidden /> : a.urteil === "falsch" ? <X size={15} aria-hidden /> : null}
                  {URTEIL[a.urteil].text}
                </span>
              )}
            </div>
            {breite > 0 && <Feld feld={felder[i]} breite={breite} werkzeug={werkzeug} finger={finger} offen={offen} linien={linien} aendere={(s) => aendere(i, s)} />}
            {offen && felder[i].hoehe < MAX_HOEHE && (
              <button type="button" onClick={() => mehrPlatz(i)} className="treffer flex min-h-[44px] w-full items-center justify-center gap-1.5 border-t border-line text-[14.5px] font-medium text-accent">
                <Plus size={16} aria-hidden /> Mehr Platz
              </button>
            )}
          </section>
          </Fragment>
        ))}
      </div>
      <HeftKontrolle punkte={kontrolle} />

      {offen &&
        (fragen ? (
          <div className="panel grid gap-3 px-5 py-4 text-center" data-testid="heft-fragen">
            <p className="text-[18px] font-semibold">Alles fertig? Dann wird dein Heft geprüft.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" className="btn btn-secondary btn-lg" onClick={() => setFragen(false)}>
                Weiter schreiben
              </button>
              <button type="button" className="btn btn-primary btn-lg" onClick={gibAb} data-testid="heft-abgeben">
                <Check size={19} aria-hidden /> Ja, abgeben
              </button>
            </div>
            {abgeben && abgeben !== "laeuft" && <p className="text-[15px] font-semibold text-red">{abgeben}</p>}
          </div>
        ) : (
          <button type="button" className="btn btn-primary btn-lg w-full !text-[18px]" onClick={() => setFragen(true)} data-testid="heft-fertig">
            <Check size={20} aria-hidden /> Fertig
          </button>
        ))}
    </div>
  );
}

function Knopf({ an = false, onClick, disabled = false, testid, children }: { an?: boolean; onClick: () => void; disabled?: boolean; testid?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={an}
      data-testid={testid}
      className={`inline-flex min-h-[48px] items-center gap-2 rounded-xl px-4 text-[15px] font-semibold disabled:opacity-40 ${an ? "bg-accent text-white" : "text-ink-2 hover:bg-panel"}`}
    >
      {children}
    </button>
  );
}

/** Ein Feld unter einer Aufgabe: karierter (Mathe) oder linierter Hintergrund, darauf die Striche. */
function Feld({ feld, breite, werkzeug, finger, offen, linien, aendere }: { feld: HeftFeld; breite: number; werkzeug: Werkzeug; finger: boolean; offen: boolean; linien: boolean; aendere: (s: Strich[]) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const massstab = breite / BREITE;
  const hoehe = feld.hoehe * massstab;
  const strich = useRef<number[] | null>(null);
  const blaettern = useRef<{ id: number; y: number } | null>(null);
  const radiert = useRef<Strich[] | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(breite * dpr);
    c.height = Math.round(hoehe * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr * massstab, 0, 0, dpr * massstab, 0, 0);
    ctx.clearRect(0, 0, BREITE, feld.hoehe);
    zeichne(ctx, feld.striche);
  }, [feld.striche, feld.hoehe, breite, hoehe, massstab]);

  const punkt = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / massstab) * 10) / 10, Math.round(((e.clientY - r.top) / massstab) * 10) / 10] as const;
  };
  const radiere = (x: number, y: number) => {
    const vorher = radiert.current ?? feld.striche;
    const bleibt = vorher.filter((s) => !nahe(s, x, y));
    if (bleibt.length !== vorher.length) {
      radiert.current = bleibt;
      const ctx = ref.current!.getContext("2d")!;
      ctx.clearRect(0, 0, BREITE, feld.hoehe);
      zeichne(ctx, bleibt);
    }
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!offen) return;
    if (e.pointerType === "touch" && !finger) {
      blaettern.current = { id: e.pointerId, y: e.clientY };
      return;
    }
    if (strich.current || radiert.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = punkt(e);
    // Radierer, oder der Radier-Knopf am Stift
    if (werkzeug === "radierer" || e.buttons === 32) {
      radiert.current = feld.striche;
      radiere(x, y);
      return;
    }
    strich.current = [x, y];
    const ctx = ref.current!.getContext("2d")!;
    stil(ctx);
    ctx.beginPath();
    ctx.arc(x, y, STIFT / 2, 0, Math.PI * 2);
    ctx.fillStyle = TINTE;
    ctx.fill();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const b = blaettern.current;
    if (b && b.id === e.pointerId) {
      window.scrollBy(0, b.y - e.clientY);
      b.y = e.clientY;
      return;
    }
    if (radiert.current) {
      const [x, y] = punkt(e);
      radiere(x, y);
      return;
    }
    const s = strich.current;
    if (!s) return;
    const ctx = ref.current!.getContext("2d")!;
    stil(ctx);
    // auch die Zwischenpunkte, die der Browser zusammenfasst: die Schrift bleibt rund
    const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    ctx.beginPath();
    ctx.moveTo(s[s.length - 2], s[s.length - 1]);
    const r = ref.current!.getBoundingClientRect();
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const x = Math.round(((ev.clientX - r.left) / massstab) * 10) / 10;
      const y = Math.round(((ev.clientY - r.top) / massstab) * 10) / 10;
      s.push(x, y);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  const up = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (blaettern.current?.id === e.pointerId) {
      blaettern.current = null;
      return;
    }
    if (radiert.current) {
      const bleibt = radiert.current;
      radiert.current = null;
      if (bleibt.length !== feld.striche.length) aendere(bleibt);
      return;
    }
    const s = strich.current;
    strich.current = null;
    if (s) aendere([...feld.striche, s]);
  };

  return (
    <canvas
      ref={ref}
      className="block w-full"
      style={{
        height: hoehe,
        touchAction: "none",
        cursor: offen ? (werkzeug === "radierer" ? "cell" : "crosshair") : "default",
        backgroundColor: "#fff",
        ...(linien
          ? { backgroundImage: "linear-gradient(transparent calc(100% - 1px), #c9d3e3 calc(100% - 1px))", backgroundSize: `100% ${LINIE * massstab}px` }
          : { backgroundImage: "linear-gradient(#dfe6f1 1px, transparent 1px), linear-gradient(90deg, #dfe6f1 1px, transparent 1px)", backgroundSize: `${KAESTCHEN * massstab}px ${KAESTCHEN * massstab}px` }),
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="heft-feld"
    />
  );
}

function stil(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = TINTE;
  ctx.lineWidth = STIFT;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function zeichne(ctx: CanvasRenderingContext2D, striche: Strich[]) {
  stil(ctx);
  ctx.fillStyle = TINTE;
  for (const s of striche) {
    if (s.length === 2) {
      ctx.beginPath();
      ctx.arc(s[0], s[1], STIFT / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(s[0], s[1]);
    for (let i = 2; i + 1 < s.length; i += 2) ctx.lineTo(s[i], s[i + 1]);
    ctx.stroke();
  }
}

function nahe(s: Strich, x: number, y: number) {
  for (let i = 0; i + 1 < s.length; i += 2) if ((s[i] - x) ** 2 + (s[i + 1] - y) ** 2 <= RADIUS * RADIUS) return true;
  return false;
}

// ---------- Seiten zum Abgeben ----------

const SEITE_MAX = 1500;
const RAND = 36;
const SCHRIFT = 24;
const ZEILE = 32;

/** Zeilen umbrechen, damit der Text auf die Seite passt. */
function umbrechen(ctx: CanvasRenderingContext2D, text: string, breite: number): string[] {
  const out: string[] = [];
  for (const absatz of text.split("\n")) {
    let zeile = "";
    for (const wort of absatz.split(/\s+/)) {
      const neu = zeile ? `${zeile} ${wort}` : wort;
      if (ctx.measureText(neu).width > breite && zeile) {
        out.push(zeile);
        zeile = wort;
      } else zeile = neu;
    }
    out.push(zeile);
  }
  return out.slice(0, 6);
}

/**
 * Die Felder als Seiten (PNG, 1000 Pixel breit): oben der Titel, je Aufgabe die Nummer, die Angabe und darunter das Feld mit den
 * Strichen. Mehrere Aufgaben teilen sich eine Seite, bis sie etwa A4-hoch ist; kein Name steht darauf.
 */
export function seitenBilder(titel: string, aufgaben: Pick<HeftAufgabe, "nr" | "text" | "abschnitt">[], felder: Pick<HeftFeld, "hoehe" | "striche">[], linien = false): string[] {
  const mess = document.createElement("canvas").getContext("2d")!;
  mess.font = `${SCHRIFT}px sans-serif`;
  const bloecke = aufgaben.map((a, i) => {
    // Übungsheft: die Anweisung der Übung steht über ihrer ersten Aufgabe, damit die KI beim Lesen weiß, was verlangt war
    const u = a.abschnitt?.uebung;
    const zeilen = [...(u ? umbrechen(mess, `Übung ${u.nr}: ${u.auftrag || u.titel}`, BREITE - 2 * RAND) : []), ...umbrechen(mess, `${a.nr}. ${a.text}`, BREITE - 2 * RAND)];
    const kopf = 18 + zeilen.length * ZEILE + 8;
    return { zeilen, kopf, feld: felder[i], hoehe: kopf + felder[i].hoehe + 24 };
  });
  const KOPF = 64;
  const seiten: (typeof bloecke)[] = [];
  let jetzt: typeof bloecke = [];
  let h = KOPF;
  for (const b of bloecke) {
    if (jetzt.length && h + b.hoehe > SEITE_MAX) {
      seiten.push(jetzt);
      jetzt = [];
      h = KOPF;
    }
    jetzt.push(b);
    h += b.hoehe;
  }
  if (jetzt.length) seiten.push(jetzt);
  return seiten.map((seite, n) => {
    const hoehe = KOPF + seite.reduce((s, b) => s + b.hoehe, 0);
    const c = document.createElement("canvas");
    c.width = BREITE;
    c.height = hoehe;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, BREITE, hoehe);
    ctx.fillStyle = "#111";
    ctx.font = `600 26px sans-serif`;
    ctx.fillText(seiten.length > 1 ? `${titel} (Seite ${n + 1} von ${seiten.length})` : titel, RAND, 42);
    let y = KOPF;
    for (const b of seite) {
      ctx.fillStyle = "#111";
      ctx.font = `${SCHRIFT}px sans-serif`;
      b.zeilen.forEach((z, i) => ctx.fillText(z, RAND, y + 18 + (i + 1) * ZEILE - 8));
      const oben = y + b.kopf;
      // Kästchen oder Linien, hell, damit die Schrift vorne bleibt
      ctx.strokeStyle = "#e6ebf3";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const abstand = linien ? LINIE : KAESTCHEN;
      for (let gy = linien ? LINIE : 0; gy <= b.feld.hoehe; gy += abstand) {
        const yy = oben + gy + (linien ? -0.5 : 0.5);
        ctx.moveTo(0, yy);
        ctx.lineTo(BREITE, yy);
      }
      if (!linien)
        for (let gx = 0; gx <= BREITE; gx += KAESTCHEN) {
          ctx.moveTo(gx + 0.5, oben);
          ctx.lineTo(gx + 0.5, oben + b.feld.hoehe);
        }
      ctx.stroke();
      ctx.save();
      ctx.translate(0, oben);
      zeichne(ctx, b.feld.striche);
      ctx.restore();
      // eine Linie zwischen den Aufgaben
      ctx.strokeStyle = "#9aa6b8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y + b.hoehe - 1);
      ctx.lineTo(BREITE, y + b.hoehe - 1);
      ctx.stroke();
      y += b.hoehe;
    }
    return c.toDataURL("image/png");
  });
}
