"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, FileText, PenLine, Plus, Sparkles, Trash2, X } from "lucide-react";
import { MathText } from "@/components/MathText";
import { shrinkImage } from "@/components/shrink-image";
import { speichereBlattAction } from "@/app/blatt-actions";
import { BEWERTUNGEN, erreichtVon, MAX_SEITEN, MAX_ZEILEN, type Bewertung, type BlattVorschlag, type BlattZeile } from "@/lib/blatt-regeln";
import { NOTEN, noteFuer, punkteText } from "@/lib/probeschularbeit-regeln";
import { PRUEFUNGSARTEN } from "@/lib/pruefungsarten";

/** Mirrors lib/materials.ts (kept here so the browser does not load server code). */
const MAX_FOTO = 5 * 1024 * 1024;
const MAX_PDF = 10 * 1024 * 1024;
const FOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

const BEWERTUNG_TEXT: Record<Bewertung, string> = { richtig: "Richtig", teilweise: "Teilweise", falsch: "Falsch", leer: "Leer" };
const BEWERTUNG_FARBE: Record<Bewertung, string> = {
  richtig: "has-[:checked]:bg-green-wash has-[:checked]:text-green",
  teilweise: "has-[:checked]:bg-amber-wash has-[:checked]:text-amber",
  falsch: "has-[:checked]:bg-red-wash has-[:checked]:text-red",
  leer: "has-[:checked]:bg-surface has-[:checked]:text-ink",
};

type Test = { id: number; subject: string; date: string; label: string; geplant: boolean };
type Skill = { id: string; name: string; area: string };
type Seite = { file: File; url: string | null };
/** a row of the preview; pText/mText keep what is typed („2,“) until it is a number */
type Zeile = BlattZeile & { k: number; pText?: string; mText?: string };

let naechster = 1;
const leereZeile = (nr: number): Zeile => ({ k: naechster++, nr: String(nr), aufgabe: "", antwort: "", bewertung: "richtig", punkte: null, max: null, skillId: null, fehler: "", pruefen: false });
/** „2,5“ oder „2.5“ → 2.5; leer oder unlesbar → null */
const zahl = (s: string): number | null => {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Gelöstes Blatt einlesen (lib/blatt-einlesen.ts): what it is (Fach, Datum, Probeschularbeit or a real test),
 * the photographed pages, then the preview the teacher checks row by row before it goes into the profile.
 * Without KI the teacher fills the same preview by hand. After a failed reading the stored pages are sent
 * again by their ids, so nobody has to take them again.
 */
export function BlattEinlesen({
  studentId,
  subjects,
  today,
  tests,
  vorauswahl,
  faehigkeiten,
  grenzen,
  kiGrund,
}: {
  studentId: number;
  subjects: string[];
  today: string;
  tests: Test[];
  vorauswahl: { testId: number; fach: string } | null;
  faehigkeiten: Record<string, Skill[]>;
  grenzen: readonly number[];
  kiGrund: string | null;
}) {
  const router = useRouter();
  const vorTest = vorauswahl ? tests.find((t) => t.id === vorauswahl.testId) : undefined;
  const [fach, setFach] = useState(vorauswahl?.fach ?? subjects[0]);
  const [datum, setDatum] = useState(vorTest && vorTest.date <= today ? vorTest.date : today);
  const [art, setArt] = useState<"probe" | "pruefung">(vorTest && vorTest.date <= today ? "pruefung" : "probe");
  const [testWahl, setTestWahl] = useState<string>(vorTest ? String(vorTest.id) : "");
  const [pruefungsart, setPruefungsart] = useState<string>(PRUEFUNGSARTEN[0]);
  const [titel, setTitel] = useState("");

  const [seiten, setSeiten] = useState<Seite[]>([]);
  const [gespeichert, setGespeichert] = useState<number[]>([]);
  const [keinName, setKeinName] = useState(false);
  const [busy, setBusy] = useState<null | "vorbereiten" | "lesen">(null);
  const [seit, setSeit] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [zeilen, setZeilen] = useState<Zeile[] | null>(null);
  const [hinweise, setHinweise] = useState<string[]>([]);
  const [gesamtFeld, setGesamtFeld] = useState<string | null>(null);
  const [maxFeld, setMaxFeld] = useState<string | null>(null);
  const [noteFeld, setNoteFeld] = useState<string | null>(null);
  const [speichern, startSpeichern] = useTransition();
  const [speicherFehler, setSpeicherFehler] = useState<string | null>(null);
  const vorschau = useRef<HTMLElement>(null);

  const skills = faehigkeiten[fach] ?? [];
  const bereiche = useMemo(() => {
    const m = new Map<string, Skill[]>();
    for (const s of skills) m.set(s.area, [...(m.get(s.area) ?? []), s]);
    return [...m];
  }, [skills]);
  const passendeTests = tests.filter((t) => t.subject === fach && (art === "pruefung" || t.geplant));

  // what the teacher picked must still exist after a change of Fach or Art
  useEffect(() => {
    if (testWahl && testWahl !== "neu" && !passendeTests.some((t) => String(t.id) === testWahl)) setTestWahl("");
    if (testWahl === "neu" && art === "probe") setTestWahl("");
  }, [art, fach, passendeTests, testWahl]);
  useEffect(() => {
    if (!zeilen) return;
    const ids = new Set(skills.map((s) => s.id));
    if (zeilen.some((z) => z.skillId && !ids.has(z.skillId))) setZeilen(zeilen.map((z) => (z.skillId && !ids.has(z.skillId) ? { ...z, skillId: null } : z)));
  }, [skills, zeilen]);
  useEffect(() => () => seiten.forEach((s) => s.url && URL.revokeObjectURL(s.url)), [seiten]);
  useEffect(() => {
    if (busy !== "lesen") return;
    const start = Date.now();
    setSeit(0);
    const id = setInterval(() => setSeit(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  async function waehle(files: FileList | null) {
    if (!files?.length) return;
    setFehler(null);
    const frei = MAX_SEITEN - seiten.length - gespeichert.length;
    if (files.length > frei) {
      setFehler(`Höchstens ${MAX_SEITEN} Seiten auf einmal.`);
      if (frei <= 0) return;
    }
    setBusy("vorbereiten");
    const neu: Seite[] = [];
    for (const file of [...files].slice(0, Math.max(0, frei))) {
      const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (!pdf && !file.type.startsWith("image/")) {
        setFehler("Bitte Fotos oder ein PDF wählen.");
        continue;
      }
      const small = pdf ? file : await shrinkImage(file, 2400);
      if (!pdf && !FOTO_TYPES.includes(small.type)) {
        setFehler("Dieses Bildformat geht nicht. Bitte JPG, PNG oder WebP wählen.");
        continue;
      }
      if (small.size > (pdf ? MAX_PDF : MAX_FOTO)) {
        setFehler(pdf ? "Ein PDF ist zu groß (höchstens 10 MB)." : "Ein Foto ist zu groß (höchstens 5 MB).");
        continue;
      }
      neu.push({ file: small, url: pdf ? null : URL.createObjectURL(small) });
    }
    setBusy(null);
    if (neu.length) setSeiten((s) => [...s, ...neu]);
  }

  function entferne(i: number) {
    setSeiten((s) => s.filter((_, j) => j !== i));
  }

  function uebernimmVorschlag(v: BlattVorschlag) {
    setZeilen(v.zeilen.map((z) => ({ ...z, k: naechster++ })));
    setHinweise(v.hinweise);
    setGesamtFeld(v.gesamt != null ? punkteText(v.gesamt) : null);
    setMaxFeld(v.gesamtMax != null ? punkteText(v.gesamtMax) : null);
    setNoteFeld(v.note != null ? String(v.note) : null);
    if (v.titel && !titel) setTitel(v.titel);
    requestAnimationFrame(() => vorschau.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function lesen() {
    if (busy) return;
    setFehler(null);
    if (!seiten.length && !gespeichert.length) {
      setFehler("Bitte zuerst die Seiten fotografieren.");
      return;
    }
    const fd = new FormData();
    fd.set("schueler", String(studentId));
    fd.set("fach", fach);
    fd.set("keine_namen", keinName ? "1" : "");
    fd.set("materialien", gespeichert.join(","));
    for (const s of seiten) fd.append("seite", s.file, s.file.name);
    setBusy("lesen");
    try {
      const res = await fetch("/material/blatt", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.materials)) {
        setGespeichert(data.materials);
        setSeiten([]);
      }
      if (res.ok && data.vorschlag) uebernimmVorschlag(data.vorschlag as BlattVorschlag);
      else setFehler(data.error ?? (res.status === 401 ? "Du bist abgemeldet. Bitte neu anmelden." : "Das ging nicht. Bitte noch einmal versuchen."));
    } catch {
      setFehler("Keine Verbindung. Die Fotos sind noch hier, bitte noch einmal versuchen.");
    }
    setBusy(null);
  }

  function selbst() {
    uebernimmVorschlag({ titel: "", zeilen: [], gesamt: null, gesamtMax: null, note: null, hinweise: [] });
    setZeilen([leereZeile(1)]);
  }

  const aendere = (k: number, teil: Partial<Zeile>) => setZeilen((zs) => zs && zs.map((z) => (z.k === k ? { ...z, ...teil, pruefen: false } : z)));

  // Summen aus den Zeilen, solange der Lehrer sie nicht selbst einträgt
  const summe = zeilen?.length && zeilen.every((z) => erreichtVon(z) != null) ? zeilen.reduce((a, z) => a + (erreichtVon(z) ?? 0), 0) : null;
  const maxSumme = zeilen?.length && zeilen.every((z) => z.max != null) ? zeilen.reduce((a, z) => a + (z.max ?? 0), 0) : null;
  const gesamt = gesamtFeld != null ? zahl(gesamtFeld) : summe;
  const gesamtMax = maxFeld != null ? zahl(maxFeld) : maxSumme;
  const schluessel = gesamt != null && gesamtMax ? noteFuer(Math.min(gesamt, gesamtMax), gesamtMax, grenzen) : null;
  const note = noteFeld != null ? (noteFeld ? Number(noteFeld) : null) : (schluessel?.note ?? null);
  const zaehler = BEWERTUNGEN.map((b) => [b, zeilen?.filter((z) => z.bewertung === b).length ?? 0] as const);
  const offen = zeilen?.filter((z) => z.pruefen).length ?? 0;

  function uebernehmen() {
    if (!zeilen) return;
    setSpeicherFehler(null);
    if (gesamtFeld?.trim() && gesamt == null) return setSpeicherFehler("Die erreichten Punkte sind keine Zahl.");
    if (maxFeld?.trim() && gesamtMax == null) return setSpeicherFehler("Die möglichen Punkte sind keine Zahl.");
    startSpeichern(async () => {
      const out = await speichereBlattAction({
        studentId,
        fach,
        datum,
        titel,
        art,
        testId: testWahl && testWahl !== "neu" ? Number(testWahl) : null,
        pruefungsart,
        note: art === "pruefung" ? note : null,
        gesamt,
        gesamtMax: gesamtMax || null,
        zeilen: zeilen.map(({ k: _k, pText: _p, mText: _m, ...z }) => z),
        materialIds: gespeichert,
      });
      if ("error" in out) setSpeicherFehler(out.error);
      else router.push(out.href);
    });
  }

  const seitenZahl = seiten.length + gespeichert.length;

  return (
    <div className="grid gap-5" data-testid="blatt">
      {/* 1 · Was ist es? */}
      <section className="panel grid gap-4 px-5 py-5 md:px-6" aria-labelledby="blatt-was">
        <h2 id="blatt-was" className="text-[17px] font-semibold">
          Was ist es?
        </h2>
        <fieldset className="grid gap-2 sm:grid-cols-2" aria-label="Art">
          {(
            [
              ["probe", "Probeschularbeit oder Übung", "Zählt für den Lernstand."],
              ["pruefung", "Echte Schularbeit oder Test", "Zählt für den Lernstand und kommt mit Note zu den Prüfungen."],
            ] as const
          ).map(([wert, label, text]) => (
            <label
              key={wert}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-line-hover has-[:checked]:border-accent has-[:checked]:bg-accent-wash has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
            >
              <input type="radio" name="blatt-art" value={wert} checked={art === wert} onChange={() => setArt(wert)} className="mt-1 h-[18px] w-[18px] shrink-0 accent-[var(--accent)]" data-testid={`blatt-art-${wert}`} />
              <span className="grid gap-0.5">
                <span className="text-[15px] font-semibold">{label}</span>
                <span className="text-[13px] text-ink-2">{text}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5">
            <span className="text-[14px] font-semibold">Fach</span>
            <select className="input" value={fach} onChange={(e) => setFach(e.target.value)} data-testid="blatt-fach">
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-[14px] font-semibold">Gelöst am</span>
            <input className="input" type="date" value={datum} max={today} onChange={(e) => setDatum(e.target.value)} required data-testid="blatt-datum" />
          </label>
        </div>
        {(passendeTests.length > 0 || art === "pruefung") && (
          <label className="grid gap-1.5">
            <span className="text-[14px] font-semibold">{art === "probe" ? "Zur Schularbeit" : "Welche Prüfung"}</span>
            <select className="input" value={testWahl} onChange={(e) => setTestWahl(e.target.value)} data-testid="blatt-test">
              {art === "probe" ? <option value="">Keine bestimmte</option> : <option value="">Bitte wählen</option>}
              {passendeTests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}, {new Date(`${t.date}T12:00:00`).toLocaleDateString("de-AT", { day: "numeric", month: "short" })}
                </option>
              ))}
              {art === "pruefung" && <option value="neu">Neu eintragen</option>}
            </select>
          </label>
        )}
        {art === "pruefung" && testWahl === "neu" && (
          <label className="grid gap-1.5">
            <span className="text-[14px] font-semibold">Art der Prüfung</span>
            <select className="input" value={pruefungsart} onChange={(e) => setPruefungsart(e.target.value)} data-testid="blatt-pruefungsart">
              {PRUEFUNGSARTEN.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1.5">
          <span className="text-[14px] font-semibold">
            Titel <span className="font-normal text-ink-3">(freiwillig)</span>
          </span>
          <input className="input" value={titel} onChange={(e) => setTitel(e.target.value)} maxLength={100} placeholder={art === "probe" ? "z. B. Probeschularbeit Potenzen" : "z. B. 1. Schularbeit"} autoComplete="off" data-testid="blatt-titel" />
        </label>
      </section>

      {/* 2 · Seiten */}
      <section className="panel grid gap-4 px-5 py-5 md:px-6" aria-labelledby="blatt-seiten">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="blatt-seiten" className="text-[17px] font-semibold">
            Seiten fotografieren
          </h2>
          <span className="num text-[13px] text-ink-3">
            {seitenZahl} von {MAX_SEITEN}
          </span>
        </div>
        {seitenZahl > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="blatt-seitenliste">
            {gespeichert.map((id, i) => (
              <li key={`m${id}`} className="relative overflow-hidden rounded-xl border border-line bg-panel">
                {/* eslint-disable-next-line @next/next/no-img-element -- the stored page of this student */}
                <img src={`/material/${id}/datei`} alt={`Seite ${i + 1}`} className="aspect-[3/4] w-full object-cover" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-surface/90 px-2 py-0.5 text-[12px] text-ink-2">
                  <Check size={12} aria-hidden /> gespeichert
                </span>
              </li>
            ))}
            {seiten.map((s, i) => (
              <li key={s.url ?? `${s.file.name}${i}`} className="relative overflow-hidden rounded-xl border border-line bg-panel">
                {s.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen photo
                  <img src={s.url} alt={`Seite ${gespeichert.length + i + 1}`} className="aspect-[3/4] w-full object-cover" />
                ) : (
                  <span className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 px-2 text-center text-[13px] text-ink-2">
                    <FileText size={28} aria-hidden />
                    <span className="line-clamp-2 break-all">{s.file.name}</span>
                  </span>
                )}
                <button type="button" onClick={() => entferne(i)} disabled={busy !== null} className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-ink-2 hover:text-red" aria-label={`Seite ${gespeichert.length + i + 1} entfernen`}>
                  <X size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {seitenZahl < MAX_SEITEN && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy !== null}
            className={`flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line bg-panel px-5 text-center transition-colors hover:border-ink-3 ${seitenZahl ? "min-h-[64px] py-3" : "min-h-[160px] flex-col py-6"}`}
            data-testid="blatt-waehlen"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-accent shadow-[var(--shadow-card)]" aria-hidden>
              <Camera size={22} />
            </span>
            <span className="grid gap-0.5">
              <span className="text-[16px] font-semibold">{busy === "vorbereiten" ? "Fotos werden vorbereitet …" : seitenZahl ? "Weitere Seite" : "Seiten fotografieren oder auswählen"}</span>
              {!seitenZahl && <span className="text-[13px] text-ink-2">Jede Seite gerade und gut lesbar, mit den Lösungen. Auch ein PDF geht.</span>}
            </span>
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void waehle(e.currentTarget.files);
            e.currentTarget.value = "";
          }}
          data-testid="blatt-datei"
        />

        {kiGrund ? (
          <p className="rounded-xl bg-amber-wash px-4 py-3 text-[14px] text-amber" role="status" data-testid="blatt-ki-aus">
            {kiGrund}
          </p>
        ) : (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-panel px-4 py-3 text-[15px]">
            <input type="checkbox" checked={keinName} onChange={(e) => setKeinName(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" data-testid="blatt-keine-namen" />
            <span>Auf den Seiten steht kein Name, oder er ist abgedeckt.</span>
          </label>
        )}

        {fehler && (
          <p role="alert" className="rounded-xl bg-red-wash px-4 py-3 text-[14px] text-red" data-testid="blatt-fehler">
            {fehler}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {!kiGrund && (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => void lesen()} disabled={busy !== null || !keinName || !seitenZahl} data-testid="blatt-lesen">
              <Sparkles size={18} aria-hidden /> {busy === "lesen" ? "KI liest …" : zeilen ? "Noch einmal auslesen" : "Mit KI auslesen"}
            </button>
          )}
          {!zeilen && (
            <button type="button" className={`btn ${kiGrund ? "btn-primary btn-lg" : "btn-ghost"}`} onClick={selbst} disabled={busy !== null} data-testid="blatt-selbst">
              <PenLine size={16} aria-hidden /> Ohne KI selbst eintragen
            </button>
          )}
        </div>
        <p className="text-[13px] text-ink-3" role="status" aria-live="polite">
          {busy === "lesen" ? (
            <span className="num">Die KI liest jede Aufgabe und rechnet nach. Das dauert meist ein bis zwei Minuten ({seit} s).</span>
          ) : gespeichert.length ? (
            "Die Seiten sind beim Schüler unter Material gespeichert. Ein neuer Versuch schickt sie nicht noch einmal."
          ) : !kiGrund ? (
            "Die KI sieht nur die Seiten, das Fach und die Fähigkeiten, keinen Namen aus der App."
          ) : null}
        </p>
      </section>

      {/* 3 · Prüfen */}
      {zeilen && (
        <section ref={vorschau} className="panel grid gap-4 px-5 py-5 md:px-6" aria-labelledby="blatt-pruefen" data-testid="blatt-vorschau">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="blatt-pruefen" className="text-[17px] font-semibold">
              Prüfen
            </h2>
            <p className="num flex flex-wrap gap-x-3 text-[13px] text-ink-2" data-testid="blatt-zaehler">
              {zaehler
                .filter(([, n]) => n > 0)
                .map(([b, n]) => (
                  <span key={b}>
                    {n} {BEWERTUNG_TEXT[b].toLowerCase()}
                  </span>
                ))}
            </p>
          </div>
          {hinweise.length > 0 && (
            <ul className="grid gap-1 rounded-xl bg-amber-wash px-4 py-3 text-[14px] text-amber" role="status" data-testid="blatt-hinweise">
              {hinweise.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}

          <ol className="grid gap-3">
            {zeilen.map((z, i) => (
              <li
                key={z.k}
                className={`grid gap-3 rounded-xl border px-3 py-3 sm:px-4 ${z.pruefen ? "border-amber/40 bg-amber-wash/50" : "border-line bg-surface"}`}
                data-testid="blatt-zeile"
                data-pruefen={z.pruefen ? "1" : undefined}
              >
                <div className="flex items-start gap-2">
                  <div className="w-14 shrink-0">
                    <input className="input num text-center" value={z.nr} onChange={(e) => aendere(z.k, { nr: e.target.value })} maxLength={8} aria-label={`Nummer der Aufgabe ${i + 1}`} />
                  </div>
                  <div className="grid min-w-0 flex-1 gap-1">
                    <input className="input" value={z.aufgabe} onChange={(e) => aendere(z.k, { aufgabe: e.target.value })} maxLength={300} placeholder="Aufgabe, z. B. (2x³)² · 3x" aria-label={`Aufgabe ${i + 1}`} data-testid="blatt-aufgabe" />
                    {/[\^/√]|sqrt/.test(z.aufgabe) && (
                      <p className="px-1 text-[15px] text-ink-2">
                        <MathText text={z.aufgabe} />
                      </p>
                    )}
                  </div>
                  <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-3 transition-colors hover:bg-panel hover:text-red" onClick={() => setZeilen(zeilen.filter((x) => x.k !== z.k))} aria-label={`Aufgabe ${i + 1} entfernen`}>
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <span className="flex rounded-full bg-panel p-1" role="radiogroup" aria-label={`Bewertung Aufgabe ${i + 1}`}>
                    {BEWERTUNGEN.map((b) => (
                      <label
                        key={b}
                        className={`flex h-9 cursor-pointer items-center rounded-full px-3 text-[14px] font-semibold text-ink-2 transition-colors has-[:checked]:shadow-[var(--shadow-card)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${BEWERTUNG_FARBE[b]}`}
                      >
                        <input type="radio" name={`bewertung-${z.k}`} value={b} checked={z.bewertung === b} onChange={() => aendere(z.k, { bewertung: b, fehler: b === "richtig" ? "" : z.fehler })} className="sr-only" data-testid={`blatt-bewertung-${b}`} />
                        {BEWERTUNG_TEXT[b]}
                      </label>
                    ))}
                  </span>
                  <span className="flex items-center gap-2 text-[14px] text-ink-2">
                    <span className="w-16">
                      <input
                        className="input num text-center"
                        inputMode="decimal"
                        value={z.pText ?? (z.punkte != null ? punkteText(z.punkte) : "")}
                        placeholder={erreichtVon(z) != null ? punkteText(erreichtVon(z)!) : "–"}
                        onChange={(e) => aendere(z.k, { pText: e.target.value, punkte: zahl(e.target.value) })}
                        aria-label={`Punkte Aufgabe ${i + 1}`}
                      />
                    </span>
                    von
                    <span className="w-16">
                      <input className="input num text-center" inputMode="decimal" value={z.mText ?? (z.max != null ? punkteText(z.max) : "")} placeholder="–" onChange={(e) => aendere(z.k, { mText: e.target.value, max: zahl(e.target.value) || null })} aria-label={`Höchstpunkte Aufgabe ${i + 1}`} />
                    </span>
                    Punkten
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-[13px] text-ink-2">Fähigkeit</span>
                    <select className="input" value={z.skillId ?? ""} onChange={(e) => aendere(z.k, { skillId: e.target.value || null })} data-testid="blatt-faehigkeit">
                      <option value="">Keine (zählt nicht für den Lernstand)</option>
                      {bereiche.map(([area, list]) => (
                        <optgroup key={area} label={area}>
                          {list.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[13px] text-ink-2">Antwort auf dem Blatt</span>
                    <input className="input" value={z.antwort} onChange={(e) => aendere(z.k, { antwort: e.target.value })} maxLength={200} placeholder="freiwillig" />
                  </label>
                  {(z.bewertung === "teilweise" || z.bewertung === "falsch") && (
                    <label className="grid gap-1 sm:col-span-2">
                      <span className="text-[13px] text-ink-2">Was war falsch</span>
                      <input className="input" value={z.fehler} onChange={(e) => aendere(z.k, { fehler: e.target.value })} maxLength={200} placeholder="z. B. Exponenten addiert statt multipliziert" data-testid="blatt-fehlertext" />
                    </label>
                  )}
                </div>
                {z.pruefen && (
                  <button type="button" className="btn btn-secondary btn-sm justify-self-start" onClick={() => aendere(z.k, {})} data-testid="blatt-passt">
                    <Check size={14} aria-hidden /> Passt so
                  </button>
                )}
              </li>
            ))}
          </ol>
          {zeilen.length < MAX_ZEILEN && (
            <button type="button" className="btn btn-ghost justify-self-start" onClick={() => setZeilen([...zeilen, leereZeile(zeilen.length + 1)])} data-testid="blatt-zeile-neu">
              <Plus size={16} aria-hidden /> Aufgabe hinzufügen
            </button>
          )}

          <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-[auto_auto_1fr] sm:items-end">
            <div className="grid gap-1.5">
              <span className="text-[14px] font-semibold">Punkte gesamt</span>
              <span className="flex items-center gap-2 text-[14px] text-ink-2">
                <span className="w-20">
                  <input className="input num text-center" inputMode="decimal" value={gesamtFeld ?? (summe != null ? punkteText(summe) : "")} placeholder="–" onChange={(e) => setGesamtFeld(e.target.value)} aria-label="Erreichte Punkte gesamt" data-testid="blatt-gesamt" />
                </span>
                von
                <span className="w-20">
                  <input className="input num text-center" inputMode="decimal" value={maxFeld ?? (maxSumme != null ? punkteText(maxSumme) : "")} placeholder="–" onChange={(e) => setMaxFeld(e.target.value)} aria-label="Mögliche Punkte gesamt" data-testid="blatt-gesamt-max" />
                </span>
              </span>
            </div>
            <label className="grid gap-1.5">
              <span className="text-[14px] font-semibold">Note</span>
              {art === "pruefung" ? (
                <span className="w-44">
                  <select className="input" value={note != null ? String(note) : ""} onChange={(e) => setNoteFeld(e.target.value)} data-testid="blatt-note">
                    <option value="">Keine</option>
                    {NOTEN.map((n) => (
                      <option key={n.note} value={n.note}>
                        {n.note} {n.label}
                      </option>
                    ))}
                  </select>
                </span>
              ) : (
                <span className="flex h-[40px] items-center text-[15px]" data-testid="blatt-note-vorschlag">
                  {schluessel ? `${schluessel.note} ${schluessel.label}` : "–"}
                </span>
              )}
            </label>
            <p className="text-[13px] text-ink-3 sm:pb-2">
              {art === "pruefung" ? "Die Note vom Blatt zählt. Vorgeschlagen ist sie nach deinem Notenschlüssel." : "Nach deinem Notenschlüssel, nur zur Orientierung."}
            </p>
          </div>

          {speicherFehler && (
            <p role="alert" className="rounded-xl bg-red-wash px-4 py-3 text-[14px] text-red" data-testid="blatt-speicherfehler">
              {speicherFehler}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" className="btn btn-primary btn-lg" onClick={uebernehmen} disabled={speichern || !zeilen.some((z) => z.aufgabe.trim()) || (art === "pruefung" && !testWahl)} data-testid="blatt-uebernehmen">
              <Check size={18} aria-hidden /> {speichern ? "Wird gespeichert …" : "Ins Profil übernehmen"}
            </button>
            <p className="text-[13px] text-ink-3">
              {art === "pruefung" && !testWahl ? "Bitte oben die Prüfung wählen oder neu eintragen." : offen ? `${offen} gelb markierte ${offen === 1 ? "Zeile" : "Zeilen"} noch prüfen.` : "Kommt in den Lernstand und in den Lernverlauf."}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
