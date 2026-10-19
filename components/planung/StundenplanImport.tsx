"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarPlus, Camera, Check, ImagePlus, Loader2, RefreshCw, ScanText, X } from "lucide-react";
import { Pill } from "@/components/ui";
import { shrinkImage } from "@/components/shrink-image";
import { stundenplanEintragenAction, stundenplanPruefenAction } from "@/app/planung-actions";
import type { FotoVorschlag, ImportErgebnis, VorschlagZeile } from "@/lib/planung/stundenplan-foto";
import { minutenLabel } from "@/lib/planung/zeit";

/** Mirrors lib/planung/stundenplan-foto.ts (kept here so the browser does not load server code). */
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

type Lehrer = { id: number; name: string };
type Schueler = { id: number; name: string; teacher_id: number | null };
type Woche = { start: string; label: string; status: "leer" | "entwurf" | "veroeffentlicht" };

type Zeile = VorschlagZeile & { an: boolean; von: number; bis: number };
type Foto = {
  id: number;
  file: File;
  url: string;
  zustand: "wartet" | "liest" | "fertig" | "fehler";
  fehler?: string;
  buchstabe: string | null;
  teacherId: number | null;
  rasterVomFoto: boolean;
  unsicher: string[];
  zeilen: Zeile[];
};
type Pruefung = { status: Woche["status"]; vorhanden: number; fehler: Map<string, string>; allgemein: string | null };

const uhr = (min: number) => minutenLabel(min);
const ausUhr = (s: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const schluessel = (f: Foto, z: Zeile) => `${f.id}:${z.schluessel}`;
const vollstaendig = (f: Foto, z: Zeile) => z.an && f.teacherId !== null && z.studentId !== null && z.bis > z.von;

/**
 * Stundenplan-Fotos (lib/planung/stundenplan-foto.ts): Fotos wählen, Haken für die Vornamen, Woche wählen,
 * lesen lassen (je Foto eine Anfrage, die Fotos bleiben nur im Browser), dann jede Zeile prüfen und eintragen.
 * Jede Änderung wird gegen die Woche geprüft, ohne etwas zu speichern; Überschneidungen stehen bei der Zeile.
 */
export function StundenplanImport({ lehrer, schueler, wochen, startWoche, zuordnung }: { lehrer: Lehrer[]; schueler: Schueler[]; wochen: Woche[]; startWoche: string; zuordnung: Record<string, number> }) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [einverstanden, setEinverstanden] = useState(false);
  const [woche, setWoche] = useState(startWoche);
  const [ersetzen, setErsetzen] = useState(false);
  const [buchstaben, setBuchstaben] = useState<Record<string, number>>(zuordnung);
  const [pruefung, setPruefung] = useState<Pruefung | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [liest, setLiest] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [over, setOver] = useState(false);
  const [gross, setGross] = useState<Foto | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const naechsteId = useRef(1);
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  useEffect(() => {
    if (!gross) return;
    const zu = (e: KeyboardEvent) => e.key === "Escape" && setGross(null);
    window.addEventListener("keydown", zu);
    return () => window.removeEventListener("keydown", zu);
  }, [gross]);

  const lehrerName = useMemo(() => new Map(lehrer.map((l) => [l.id, l.name])), [lehrer]);
  const gelesen = fotos.filter((f) => f.zustand === "fertig");
  const offen = fotos.filter((f) => f.zustand === "wartet" || f.zustand === "fehler");
  const auswahl = gelesen.flatMap((f) => f.zeilen.filter((z) => vollstaendig(f, z)).map((z) => ({ f, z })));
  const ohneLehrer = gelesen.filter((f) => f.teacherId === null && f.zeilen.some((z) => z.an));
  const ohneSchueler = gelesen.flatMap((f) => f.zeilen.filter((z) => z.an && z.studentId === null)).length;
  const konflikte = auswahl.filter(({ f, z }) => pruefung?.fehler.has(schluessel(f, z))).length;
  const eintragbar = auswahl.length - konflikte;
  const wocheInfo = wochen.find((w) => w.start === woche);

  // jede Änderung: die Auswahl gegen die Woche prüfen (nichts wird gespeichert)
  const pruefAnfrage = JSON.stringify({
    woche,
    ersetzen,
    lehrer: gelesen.map((f) => f.teacherId),
    zeilen: auswahl.map(({ f, z }) => [schluessel(f, z), f.teacherId, z.studentId, z.tag, z.von, z.bis]),
  });
  useEffect(() => {
    if (!gelesen.length) return;
    let aktuell = true;
    const t = setTimeout(async () => {
      const zeilen = auswahl.map(({ f, z }) => ({ teacherId: f.teacherId!, studentId: z.studentId!, tag: z.tag, start: z.von, dauer: z.bis - z.von }));
      const lehrerIds = [...new Set(gelesen.map((f) => f.teacherId).filter((id): id is number => id !== null))];
      try {
        const r = await stundenplanPruefenAction({ woche, zeilen, ersetzen, lehrer: lehrerIds });
        if (!aktuell) return;
        const fehlerJe = new Map<string, string>();
        const e: ImportErgebnis = r.ergebnis;
        if (e.ok) e.zeilen.forEach((x, i) => !x.ok && fehlerJe.set(schluessel(auswahl[i].f, auswahl[i].z), x.fehler));
        setPruefung({ status: r.status, vorhanden: r.vorhanden, fehler: fehlerJe, allgemein: e.ok ? null : e.fehler });
      } catch {
        if (aktuell) setPruefung((p) => (p ? { ...p, allgemein: "Die Prüfung ging gerade nicht. Bitte kurz warten oder neu laden." } : p));
      }
    }, 350);
    return () => {
      aktuell = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pruefAnfrage fasst alles zusammen, was die Prüfung ändert
  }, [pruefAnfrage, gelesen.length]);

  async function hinzufuegen(liste: FileList | File[] | null | undefined) {
    if (!liste?.length) return;
    setFehler(null);
    const neue: Foto[] = [];
    for (const file of Array.from(liste)) {
      if (!file.type.startsWith("image/")) {
        setFehler("Bitte nur Fotos wählen (JPG, PNG oder WebP).");
        continue;
      }
      const klein = await shrinkImage(file);
      if (!TYPES.includes(klein.type) || klein.size > MAX_BYTES) {
        setFehler(`„${file.name}“ geht nicht: bitte ein JPG, PNG oder WebP bis 5 MB.`);
        continue;
      }
      const url = URL.createObjectURL(klein);
      urls.current.push(url);
      neue.push({ id: naechsteId.current++, file: klein, url, zustand: "wartet", buchstabe: null, teacherId: null, rasterVomFoto: false, unsicher: [], zeilen: [] });
    }
    setFotos((alt) => [...alt, ...neue].slice(0, 12));
  }

  function aendereFoto(id: number, f: (alt: Foto) => Foto) {
    setFotos((alt) => alt.map((x) => (x.id === id ? f(x) : x)));
  }

  function aendereZeile(fotoId: number, key: string, f: (alt: Zeile) => Zeile) {
    aendereFoto(fotoId, (foto) => ({ ...foto, zeilen: foto.zeilen.map((z) => (z.schluessel === key ? f(z) : z)) }));
  }

  async function lesen() {
    if (liest || !offen.length) return;
    setFehler(null);
    if (!einverstanden) {
      setFehler("Bitte zuerst bestätigen, dass die KI die Vornamen auf den Fotos lesen darf.");
      return;
    }
    setLiest(true);
    for (const foto of offen) {
      aendereFoto(foto.id, (f) => ({ ...f, zustand: "liest", fehler: undefined }));
      const form = new FormData();
      form.set("vornamen", "1");
      form.set("datei", foto.file, foto.file.name);
      try {
        const res = await fetch("/planung/stundenplan/lesen", { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as { vorschlag?: FotoVorschlag; error?: string };
        if (!res.ok || !data.vorschlag) {
          const text = data.error ?? (res.status === 401 ? "Du bist abgemeldet. Bitte neu anmelden." : "Das Foto konnte nicht gelesen werden.");
          aendereFoto(foto.id, (f) => ({ ...f, zustand: "fehler", fehler: text }));
          continue;
        }
        const v = data.vorschlag;
        const teacherId = v.teacherId ?? (v.buchstabe && buchstaben[v.buchstabe] ? buchstaben[v.buchstabe] : null);
        aendereFoto(foto.id, (f) => ({
          ...f,
          zustand: "fertig",
          buchstabe: v.buchstabe,
          teacherId,
          rasterVomFoto: v.rasterVomFoto,
          unsicher: v.unsicher,
          zeilen: v.zeilen.map((z) => ({ ...z, an: z.studentId !== null, von: z.start, bis: z.start + z.dauer })),
        }));
      } catch {
        aendereFoto(foto.id, (f) => ({ ...f, zustand: "fehler", fehler: "Keine Verbindung. Das Foto ist noch hier, bitte noch einmal lesen." }));
      }
    }
    setLiest(false);
  }

  function waehleLehrer(foto: Foto, id: number | null) {
    const b = foto.buchstabe;
    if (b && id) setBuchstaben((alt) => ({ ...alt, [b]: id }));
    // dasselbe Zeichen auf einem anderen Foto ohne Lehrer bekommt denselben
    setFotos((alt) => alt.map((x) => (x.id === foto.id || (b && id && x.buchstabe === b && x.teacherId === null) ? { ...x, teacherId: id } : x)));
  }

  async function eintragen() {
    if (speichert || !eintragbar) return;
    setFehler(null);
    setSpeichert(true);
    const ok = auswahl.filter(({ f, z }) => !pruefung?.fehler.has(schluessel(f, z)));
    try {
      const r = await stundenplanEintragenAction({
        woche,
        ersetzen: ersetzen && pruefung?.status !== "veroeffentlicht",
        zeilen: ok.map(({ f, z }) => ({ teacherId: f.teacherId!, studentId: z.studentId!, tag: z.tag, start: z.von, dauer: z.bis - z.von })),
        buchstaben,
      });
      if (r.ok) {
        window.location.assign(r.weiter);
        return;
      }
      setFehler(r.fehler);
    } catch {
      setFehler("Keine Verbindung. Es wurde nichts eingetragen, bitte noch einmal versuchen.");
    }
    setSpeichert(false);
  }

  const eigeneZuerst = (teacherId: number | null) => {
    const eigene = schueler.filter((s) => teacherId !== null && s.teacher_id === teacherId);
    const andere = schueler.filter((s) => !(teacherId !== null && s.teacher_id === teacherId));
    return { eigene, andere };
  };

  return (
    <div className="grid gap-6 md:pb-28">
      {/* 1. Fotos, Woche, Einverständnis */}
      <section className="panel grid gap-5 px-5 py-5 md:px-6" aria-label="Fotos" data-testid="sp-fotos">
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) {
                e.preventDefault();
                setOver(true);
              }
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void hinzufuegen(e.dataTransfer.files);
            }}
            disabled={liest}
            className={`flex w-full items-center gap-4 rounded-2xl border-2 border-dashed px-5 py-5 text-left transition-colors ${over ? "border-accent bg-accent-wash" : "border-line bg-panel hover:border-ink-3"}`}
            data-testid="sp-waehlen"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-accent shadow-[var(--shadow-card)]" aria-hidden>
              {fotos.length ? <ImagePlus size={22} /> : <Camera size={22} />}
            </span>
            <span className="grid gap-0.5">
              <span className="text-[16px] font-semibold">{fotos.length ? "Weitere Fotos hinzufügen" : "Fotos der Stundenpläne wählen"}</span>
              <span className="text-[14px] text-ink-2">Ein Foto je Lehrer, gerade und ganz drauf. Mehrere auf einmal gehen.</span>
            </span>
          </button>
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              void hinzufuegen(e.currentTarget.files);
              e.currentTarget.value = "";
            }}
            data-testid="sp-datei"
          />
          {fotos.length > 0 && (
            <ul className="flex flex-wrap gap-3" aria-label="Gewählte Fotos">
              {fotos.map((f, i) => (
                <li key={f.id} className="relative w-[112px]" data-testid="sp-foto">
                  <button type="button" onClick={() => setGross(f)} className="block w-full overflow-hidden rounded-xl bg-panel" aria-label={`Foto ${i + 1} groß ansehen`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen photo */}
                    <img src={f.url} alt="" className="h-[140px] w-full object-cover object-top" />
                  </button>
                  <p className="mt-1 flex items-center gap-1 text-[12px] text-ink-2">
                    {f.zustand === "liest" && <Loader2 size={13} className="animate-spin" aria-hidden />}
                    {f.zustand === "fertig" && <Check size={13} className="text-green" aria-hidden />}
                    {f.zustand === "fehler" && <AlertTriangle size={13} className="text-red" aria-hidden />}
                    <span>
                      {f.zustand === "wartet" ? `Foto ${i + 1}` : f.zustand === "liest" ? "wird gelesen …" : f.zustand === "fertig" ? `${f.zeilen.length} Felder` : "nicht gelesen"}
                    </span>
                  </p>
                  {f.zustand !== "liest" && (
                    <button
                      type="button"
                      onClick={() => setFotos((alt) => alt.filter((x) => x.id !== f.id))}
                      className="absolute top-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-ink-2 shadow-[var(--shadow-card)] hover:text-ink"
                      aria-label={`Foto ${i + 1} entfernen`}
                    >
                      <X size={15} aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {fotos.some((f) => f.zustand === "fehler") && (
            <ul className="grid gap-1 text-[14px] text-red" role="alert">
              {fotos.map((f, i) => f.zustand === "fehler" && <li key={f.id}>Foto {i + 1}: {f.fehler}</li>)}
            </ul>
          )}
        </div>

        <label className="grid max-w-[360px] gap-1.5">
          <span className="text-[14px] font-semibold">Für welche Woche</span>
          <select
            value={woche}
            onChange={(e) => {
              setWoche(e.currentTarget.value);
              setErsetzen(false);
            }}
            className="input"
            data-testid="sp-woche"
          >
            {wochen.map((w) => (
              <option key={w.start} value={w.start}>
                {w.label}
                {w.status === "veroeffentlicht" ? " (veröffentlicht)" : w.status === "entwurf" ? " (Entwurf)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-panel px-4 py-3 text-[15px]">
          <input type="checkbox" checked={einverstanden} onChange={(e) => setEinverstanden(e.currentTarget.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" data-testid="sp-vornamen" />
          <span>Die KI darf die Fotos lesen, auch die Vornamen darauf. Die Fotos werden nicht gespeichert.</span>
        </label>

        {fehler && (
          <p role="alert" className="rounded-xl bg-red-wash px-4 py-3 text-[14px] text-red" data-testid="sp-fehler">
            {fehler}
          </p>
        )}

        {offen.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" className="btn btn-primary btn-lg" onClick={lesen} disabled={liest} data-testid="sp-lesen">
              {liest ? <Loader2 size={18} className="animate-spin" aria-hidden /> : offen.some((f) => f.zustand === "fehler") ? <RefreshCw size={18} aria-hidden /> : <ScanText size={18} aria-hidden />}
              {liest ? "Fotos werden gelesen …" : offen.length === 1 ? "Foto lesen" : `${offen.length} Fotos lesen`}
            </button>
            <p className="text-[13px] text-ink-3" role="status" aria-live="polite">
              {liest ? "Die KI liest ein Foto nach dem anderen, meist unter einer Minute je Foto." : "Danach prüfst du jede Zeile, bevor etwas eingetragen wird."}
            </p>
          </div>
        )}
      </section>

      {/* 2. Vorschau je Foto */}
      {gelesen.map((f) => {
        const nr = fotos.indexOf(f) + 1;
        const { eigene, andere } = eigeneZuerst(f.teacherId);
        return (
          <section key={f.id} className="panel grid gap-4 px-5 py-5 md:px-6" aria-label={`Foto ${nr}`} data-testid="sp-vorschau">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setGross(f)} className="h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-panel" aria-label={`Foto ${nr} groß ansehen`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen photo */}
                  <img src={f.url} alt="" className="h-full w-full object-cover object-top" />
                </button>
                <div>
                  <h2 className="text-[17px] font-semibold">
                    Foto {nr}
                    {f.buchstabe && <span className="font-normal text-ink-2"> · Buchstabe {f.buchstabe}</span>}
                  </h2>
                  <p className="text-[13px] text-ink-2">
                    {f.zeilen.length === 1 ? "1 Platz gelesen" : `${f.zeilen.length} Plätze gelesen`}
                    {!f.rasterVomFoto && f.zeilen.length > 0 && " · Uhrzeiten nach dem Raster ab 08:50, je 50 Minuten"}
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-[14px]">
                <span className="font-semibold">Lehrer</span>
                <select
                  value={f.teacherId ?? ""}
                  onChange={(e) => waehleLehrer(f, e.currentTarget.value ? Number(e.currentTarget.value) : null)}
                  className={`input !w-auto min-w-[160px] ${f.teacherId === null ? "!border-amber" : ""}`}
                  data-testid="sp-lehrer"
                >
                  <option value="">Lehrer wählen</option>
                  {lehrer.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            </header>

            {f.teacherId === null && f.buchstabe && (
              <p className="rounded-xl bg-amber-wash px-4 py-2.5 text-[14px] text-amber">Wer ist {f.buchstabe}? Einmal wählen, beim nächsten Mal weiß es die App.</p>
            )}
            {f.unsicher.length > 0 && (
              <div className="rounded-xl bg-amber-wash px-4 py-2.5 text-[14px] text-amber" data-testid="sp-unsicher">
                <p className="font-semibold">Nicht sicher gelesen, bitte am Foto nachsehen:</p>
                <ul className="mt-1 list-disc pl-5">
                  {f.unsicher.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
            )}

            {f.zeilen.length === 0 ? (
              <p className="text-[15px] text-ink-2">Auf diesem Foto hat die KI keine ausgefüllten Felder gefunden.</p>
            ) : (
              <ul className="divide-y divide-line">
                {f.zeilen.map((z) => {
                  const key = schluessel(f, z);
                  const konflikt = z.an ? pruefung?.fehler.get(key) : undefined;
                  const kandidaten = schueler.filter((s) => z.kandidaten.includes(s.id));
                  return (
                    <li key={z.schluessel} className={`grid gap-2 py-3 ${z.an ? "" : "opacity-60"}`} data-testid="sp-zeile">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <label className="flex min-h-[44px] items-center gap-2">
                          <input
                            type="checkbox"
                            checked={z.an}
                            onChange={(e) => {
                              const an = e.currentTarget.checked;
                              aendereZeile(f.id, z.schluessel, (alt) => ({ ...alt, an }));
                            }}
                            className="h-5 w-5 accent-[var(--accent)]"
                            aria-label={`${z.text} eintragen`}
                            data-testid="sp-an"
                          />
                          <span className="min-w-[88px] text-[15px] font-semibold">{z.text}</span>
                        </label>
                        {z.neu && <Pill tone="accent">Neu</Pill>}
                        {z.treffer === "aehnlich" && <Pill tone="amber">ähnlich, bitte prüfen</Pill>}
                        {z.treffer === "mehrere" && <Pill tone="amber">mehrere passen</Pill>}
                        {z.treffer === "keiner" && <Pill>nicht gefunden</Pill>}
                        <span className="text-[13px] text-ink-3">{z.stunden}</span>
                      </div>
                      <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[88px_minmax(0,1fr)_minmax(0,1.4fr)]">
                        <select
                          value={z.tag}
                          onChange={(e) => {
                            const tag = Number(e.currentTarget.value);
                            aendereZeile(f.id, z.schluessel, (alt) => ({ ...alt, tag }));
                          }}
                          className="input order-1"
                          aria-label="Tag"
                          data-testid="sp-tag"
                        >
                          {TAGE.map((t, i) => (
                            <option key={t} value={i + 1}>
                              {t}
                            </option>
                          ))}
                        </select>
                        {/* am Handy: Tag und Schüler in einer Zeile, darunter die Zeit in voller Breite */}
                        <span className="order-3 col-span-2 flex min-w-0 items-center gap-2 sm:order-2 sm:col-span-1">
                          <input
                            type="time"
                            step={600}
                            value={uhr(z.von)}
                            onChange={(e) => {
                              const von = ausUhr(e.currentTarget.value);
                              if (von !== null) aendereZeile(f.id, z.schluessel, (alt) => ({ ...alt, von }));
                            }}
                            className="input num min-w-0"
                            aria-label="Beginn"
                            data-testid="sp-von"
                          />
                          <span aria-hidden>–</span>
                          <input
                            type="time"
                            step={600}
                            value={uhr(z.bis)}
                            onChange={(e) => {
                              const bis = ausUhr(e.currentTarget.value);
                              if (bis !== null) aendereZeile(f.id, z.schluessel, (alt) => ({ ...alt, bis }));
                            }}
                            className="input num min-w-0"
                            aria-label="Ende"
                            data-testid="sp-bis"
                          />
                        </span>
                        <select
                          value={z.studentId ?? ""}
                          onChange={(e) => {
                            const studentId = e.currentTarget.value ? Number(e.currentTarget.value) : null;
                            aendereZeile(f.id, z.schluessel, (alt) => ({ ...alt, studentId, an: studentId !== null ? true : alt.an }));
                          }}
                          className={`input order-2 min-w-0 sm:order-3 ${z.an && z.studentId === null ? "!border-amber" : ""}`}
                          aria-label={`Schüler für ${z.text}`}
                          data-testid="sp-schueler"
                        >
                          <option value="">Schüler wählen</option>
                          {kandidaten.length > 0 && (
                            <optgroup label="Passt zum Namen">
                              {kandidaten.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {eigene.length > 0 && (
                            <optgroup label={`Schüler von ${lehrerName.get(f.teacherId!) ?? "diesem Lehrer"}`}>
                              {eigene.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label={eigene.length ? "Andere Schüler" : "Alle Schüler"}>
                            {andere.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                      {z.an && z.bis <= z.von && <p className="text-[13px] text-red">Das Ende muss nach dem Beginn liegen.</p>}
                      {z.an && z.studentId === null && (
                        <p className="text-[13px] text-amber">{z.neu ? "Neuer Schüler: zuerst anlegen oder einen wählen." : "Bitte einen Schüler wählen oder den Haken entfernen."}</p>
                      )}
                      {konflikt && (
                        <p className="flex items-start gap-1.5 text-[13px] text-red" data-testid="sp-konflikt">
                          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden /> {konflikt}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {/* 3. Eintragen */}
      {gelesen.length > 0 && (
        <div className="md:sticky md:bottom-3 md:z-10">
          <section className="panel grid gap-3 px-5 py-4 shadow-[var(--shadow-pop)] md:px-6" aria-label="Eintragen" data-testid="sp-eintragen-leiste">
            {pruefung && pruefung.vorhanden > 0 && pruefung.status !== "veroeffentlicht" && (
              <label className="flex cursor-pointer items-start gap-3 text-[14px]">
                <input type="checkbox" checked={ersetzen} onChange={(e) => setErsetzen(e.currentTarget.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" data-testid="sp-ersetzen" />
                <span>
                  In dieser Woche {pruefung.vorhanden === 1 ? "steht schon 1 Platz" : `stehen schon ${pruefung.vorhanden} Plätze`} dieser Lehrer. Vorher löschen, damit nur die Fotos gelten.
                </span>
              </label>
            )}
            {pruefung?.status === "veroeffentlicht" && (
              <p className="text-[14px] text-ink-2">Diese Woche ist veröffentlicht: die neuen Plätze sehen Lehrer und Schüler sofort. Vorhandene Plätze bleiben stehen.</p>
            )}
            {pruefung?.allgemein && <p className="text-[14px] text-red">{pruefung.allgemein}</p>}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <p className="text-[14px] text-ink-2" role="status" aria-live="polite" data-testid="sp-zusammenfassung">
                {[
                  `${eintragbar === 1 ? "1 Platz" : `${eintragbar} Plätze`} für ${wocheInfo?.label ?? "diese Woche"}`,
                  konflikte ? `${konflikte} mit Überschneidung` : "",
                  ohneSchueler ? `${ohneSchueler} ohne Schüler` : "",
                  ohneLehrer.length ? "Lehrer fehlt" : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <button type="button" className="btn btn-primary btn-lg" onClick={eintragen} disabled={speichert || eintragbar === 0} data-testid="sp-eintragen">
                {speichert ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <CalendarPlus size={18} aria-hidden />}
                {speichert ? "Wird eingetragen …" : "In den Wochenplan eintragen"}
              </button>
            </div>
          </section>
        </div>
      )}

      {gross && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4" role="dialog" aria-modal="true" aria-label="Foto groß" onClick={() => setGross(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen photo */}
          <img src={gross.url} alt="Stundenplan-Foto" className="max-h-full max-w-full rounded-xl bg-surface object-contain" />
          <button type="button" onClick={() => setGross(null)} className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink" aria-label="Schließen">
            <X size={20} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
