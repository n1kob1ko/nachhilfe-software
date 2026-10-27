"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardPaste, FileText, FileUp, PenLine, Plus, Sparkles, Trash2, TriangleAlert, X } from "lucide-react";
import { shrinkImage } from "@/components/shrink-image";
import { uebernimmProbeAction } from "@/app/probe-extern-actions";
import {
  fehlerVorUebernehmen,
  liesLoesungMitNummern,
  liesTextMitNummern,
  MAX_DATEIEN,
  nummerText,
  punkteVon,
  zeilenAusLesung,
  type ProbeZeile,
} from "@/lib/probe-extern-regeln";
import { punkteText } from "@/lib/probeschularbeit-regeln";

/** Mirrors lib/materials.ts (kept here so the browser does not load server code). */
const MAX_FOTO = 5 * 1024 * 1024;
const MAX_PDF = 10 * 1024 * 1024;
const FOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Feld = "angabe" | "loesung";
type Skill = { id: string; name: string; area: string };
type Gespeichert = { id: number; name: string; pdf: boolean };
type Lesung = { titel: string; zeilen: ProbeZeile[]; hinweise: string[]; quelle: { angabe: "text" | "ki" | null; loesung: "text" | "ki" | null }; offen: { angabe: number; loesung: number } };
/** a row of the check view; pText keeps what is typed („2,“) until it is a number */
type Zeile = ProbeZeile & { k: number; pText?: string };

let naechster = 1;
const FELD: Record<Feld, { titel: string; text: string }> = {
  angabe: { titel: "Angabe", text: "Die Aufgaben, wie der Schüler sie bekommt." },
  loesung: { titel: "Musterlösung", text: "Sehr empfohlen. Ohne sie bewertest nur du." },
};
const QUELLE: Record<"text" | "ki", string> = { text: "aus dem Text des PDFs", ki: "mit KI gelesen" };

/**
 * Eigene Probeschularbeit hochladen (lib/probe-extern.ts): zwei Felder (Angabe, Musterlösung), dann eine Prüfansicht mit einer
 * Zeile je Teilaufgabe (Aufgabe, Teilaufgabe, Text, Punkte, Musterlösung, Fähigkeit) und den Seiten daneben. Unsichere Zeilen
 * stehen oben und brauchen „Passt so“; erst „Übernehmen“ legt die Übung an. Lesen mit KI nur auf Tippen, mit den Kosten
 * daneben und dem Haken „kein Name“. Ohne KI dieselbe Ansicht, leer oder aus dem Text eines PDFs, zum Eintragen oder Einfügen.
 */
export function ProbeExtern({
  studentId,
  testId,
  titelVorschlag,
  skills,
  kiGrund: kiGrundAnfang,
}: {
  studentId: number;
  testId: number;
  titelVorschlag: string;
  skills: Skill[];
  kiGrund: string | null;
}) {
  const router = useRouter();
  const [dateien, setDateien] = useState<Record<Feld, File[]>>({ angabe: [], loesung: [] });
  const [gespeichert, setGespeichert] = useState<Record<Feld, Gespeichert[]>>({ angabe: [], loesung: [] });
  const [keinName, setKeinName] = useState(false);
  const [busy, setBusy] = useState<null | "vorbereiten" | "hochladen" | "lesen">(null);
  const [seit, setSeit] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [lesung, setLesung] = useState<Omit<Lesung, "zeilen"> | null>(null);
  const [kosten, setKosten] = useState<string | null>(null);
  const [kiGrund, setKiGrund] = useState<string | null>(kiGrundAnfang);
  const [zeilen, setZeilen] = useState<Zeile[] | null>(null);
  const [titel, setTitel] = useState(titelVorschlag);
  const [gelesen, setGelesen] = useState<"ki" | "text" | "hand">("hand");
  const [speichern, startSpeichern] = useTransition();
  const [speicherFehler, setSpeicherFehler] = useState<string | null>(null);
  const [einfuegen, setEinfuegen] = useState<Record<Feld, string>>({ angabe: "", loesung: "" });
  const input = { angabe: useRef<HTMLInputElement>(null), loesung: useRef<HTMLInputElement>(null) };
  const pruefen = useRef<HTMLElement>(null);

  const erlaubt = useMemo(() => new Set(skills.map((s) => s.id)), [skills]);
  const bereiche = useMemo(() => {
    const m = new Map<string, Skill[]>();
    for (const s of skills) m.set(s.area, [...(m.get(s.area) ?? []), s]);
    return [...m];
  }, [skills]);

  useEffect(() => {
    if (busy !== "lesen") return;
    const start = Date.now();
    setSeit(0);
    const id = setInterval(() => setSeit(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  async function waehle(feld: Feld, files: FileList | null) {
    if (!files?.length) return;
    setFehler(null);
    const frei = MAX_DATEIEN - dateien[feld].length - gespeichert[feld].length;
    if (files.length > frei) setFehler(`Höchstens ${MAX_DATEIEN} Dateien je Feld.`);
    setBusy("vorbereiten");
    const neu: File[] = [];
    for (const file of [...files].slice(0, Math.max(0, frei))) {
      const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (!pdf && !file.type.startsWith("image/")) {
        setFehler("Bitte PDFs oder Fotos wählen.");
        continue;
      }
      const klein = pdf ? file : await shrinkImage(file, 2400);
      if (!pdf && !FOTO_TYPES.includes(klein.type)) {
        setFehler("Dieses Bildformat geht nicht. Bitte JPG, PNG oder WebP wählen.");
        continue;
      }
      if (klein.size > (pdf ? MAX_PDF : MAX_FOTO)) {
        setFehler(pdf ? "Ein PDF ist zu groß (höchstens 10 MB)." : "Ein Foto ist zu groß (höchstens 5 MB).");
        continue;
      }
      neu.push(klein);
    }
    setBusy(null);
    if (neu.length) setDateien((d) => ({ ...d, [feld]: [...d[feld], ...neu] }));
  }

  /** Sends new files (and the ids of stored ones); with `ki` the KI reads what the app could not. */
  async function senden(ki: boolean) {
    if (busy) return;
    setFehler(null);
    const fd = new FormData();
    fd.set("schueler", String(studentId));
    fd.set("pruefung", String(testId));
    fd.set("materialien_angabe", gespeichert.angabe.map((g) => g.id).join(","));
    fd.set("materialien_loesung", gespeichert.loesung.map((g) => g.id).join(","));
    if (ki) {
      fd.set("ki", "1");
      fd.set("keine_namen", keinName ? "1" : "");
    }
    for (const feld of ["angabe", "loesung"] as const) for (const f of dateien[feld]) fd.append(feld, f, f.name);
    setBusy(ki ? "lesen" : "hochladen");
    try {
      const res = await fetch("/material/probe-extern", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (data.seiten) setGespeichert(data.seiten);
      if (Array.isArray(data.angabe) || Array.isArray(data.loesung)) setDateien({ angabe: [], loesung: [] });
      if (res.ok && data.lesung) {
        const l = data.lesung as Lesung;
        setLesung({ titel: l.titel, hinweise: l.hinweise, quelle: l.quelle, offen: l.offen });
        setKosten(data.kosten ?? null);
        setKiGrund(data.kiGrund ?? kiGrundAnfang);
        // what the teacher already typed stays, unless something was read
        if (l.zeilen.length || !zeilen) setZeilen(l.zeilen.map((z) => ({ ...z, k: naechster++ })));
        if (l.zeilen.length) setGelesen(l.quelle.angabe === "ki" || l.quelle.loesung === "ki" ? "ki" : "text");
        if (l.titel && titel === titelVorschlag) setTitel(l.titel);
        requestAnimationFrame(() => pruefen.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      } else setFehler(data.error ?? (res.status === 401 ? "Du bist abgemeldet. Bitte neu anmelden." : "Das ging nicht. Bitte noch einmal versuchen."));
    } catch {
      setFehler("Keine Verbindung. Die Dateien sind noch hier, bitte noch einmal versuchen.");
    }
    setBusy(null);
  }

  /** Text pasted from a PDF (or typed with numbers): the same rules as the app's own reading of a PDF, without KI. */
  function textUebernehmen() {
    const a = liesTextMitNummern(einfuegen.angabe.split("\n"));
    if (!a.aufgaben.length) return setFehler("Im eingefügten Text der Angabe stehen keine Nummern (1., 2. oder Aufgabe 1, dazu a), b)).");
    const l = einfuegen.loesung.trim() ? liesLoesungMitNummern(einfuegen.loesung.split("\n")) : null;
    const v = zeilenAusLesung(a, l, { erlaubt });
    setFehler(null);
    setZeilen(v.zeilen.map((z) => ({ ...z, k: naechster++ })));
    setLesung((x) => ({ titel: v.titel, hinweise: v.hinweise, quelle: x?.quelle ?? { angabe: null, loesung: null }, offen: x?.offen ?? { angabe: 0, loesung: 0 } }));
    setGelesen("text");
  }

  const aendere = (k: number, teil: Partial<Zeile>) => setZeilen((zs) => zs && zs.map((z) => (z.k === k ? { ...z, ...teil } : z)));
  // the text before the parts belongs to the whole task: changed in one row, changed in all rows of that task
  const aendereEinleitung = (z: Zeile, text: string) => setZeilen((zs) => zs && zs.map((x) => (x.k === z.k || (x.aufgabe === z.aufgabe && x.einleitung === z.einleitung) ? { ...x, einleitung: text } : x)));
  const neueZeile = () => {
    const letzte = zeilen?.[zeilen.length - 1];
    setZeilen((zs) => [...(zs ?? []), { k: naechster++, aufgabe: letzte ? String((Number(letzte.aufgabe) || 0) + 1) : "1", teil: "", einleitung: "", text: "", punkte: null, loesung: "", skillId: null, unsicher: false, grund: "" }]);
  };

  const fehlerListe = zeilen ? fehlerVorUebernehmen(zeilen, erlaubt) : [];
  const summe = zeilen?.reduce((s, z) => s + (punkteVon(z.punkte) ?? 0), 0) ?? 0;
  const ohneLoesung = zeilen?.filter((z) => !z.loesung.trim()).length ?? 0;
  const ohnePunkte = zeilen?.filter((z) => punkteVon(z.punkte) == null).length ?? 0;
  const gelb = zeilen?.filter((z) => z.unsicher).length ?? 0;
  const hochgeladen = gespeichert.angabe.length > 0;
  const neueDateien = dateien.angabe.length + dateien.loesung.length > 0;
  const kiOffen = lesung && lesung.offen.angabe + lesung.offen.loesung > 0;

  function uebernehmen() {
    if (!zeilen || fehlerListe.length) return;
    setSpeicherFehler(null);
    startSpeichern(async () => {
      const out = await uebernimmProbeAction({
        studentId,
        testId,
        titel,
        zeilen: zeilen.map(({ k: _k, pText: _p, ...z }) => z),
        angabeIds: gespeichert.angabe.map((g) => g.id),
        loesungIds: gespeichert.loesung.map((g) => g.id),
        gelesen,
      });
      if ("error" in out) setSpeicherFehler(out.error);
      else router.push(out.href);
    });
  }

  return (
    <div className="grid gap-5" data-testid="probe-extern">
      {/* 1 · Dateien */}
      <section className="panel grid gap-4 px-5 py-5 md:px-6" aria-labelledby="probe-dateien">
        <h2 id="probe-dateien" className="text-[17px] font-semibold">
          Dateien
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["angabe", "loesung"] as const).map((feld) => {
            const anzahl = dateien[feld].length + gespeichert[feld].length;
            return (
              <div key={feld} className="grid content-start gap-2 rounded-xl border border-line bg-surface px-4 py-3" data-testid={`probe-feld-${feld}`}>
                <div>
                  <p className="text-[15px] font-semibold">{FELD[feld].titel}</p>
                  <p className="text-[13px] text-ink-2">{FELD[feld].text}</p>
                </div>
                {anzahl > 0 && (
                  <ul className="grid gap-1 text-[14px]">
                    {gespeichert[feld].map((g) => (
                      <li key={g.id} className="flex min-w-0 items-center gap-1.5">
                        <Check size={14} className="shrink-0 text-green" aria-hidden />
                        <a href={`/material/${g.id}/datei`} target="_blank" rel="noreferrer" className="min-w-0 truncate font-medium text-accent hover:underline">
                          {g.name}
                        </a>
                      </li>
                    ))}
                    {dateien[feld].map((f, i) => (
                      <li key={`${f.name}${i}`} className="flex min-w-0 items-center gap-1.5">
                        <FileText size={14} className="shrink-0 text-ink-3" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        <button type="button" onClick={() => setDateien((d) => ({ ...d, [feld]: d[feld].filter((_, j) => j !== i) }))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-3 hover:text-red" aria-label={`${f.name} entfernen`}>
                          <X size={15} aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {anzahl < MAX_DATEIEN && (
                  <button type="button" className="btn btn-secondary btn-sm justify-self-start" onClick={() => input[feld].current?.click()} disabled={busy !== null} data-testid={`probe-waehlen-${feld}`}>
                    <FileUp size={15} aria-hidden /> {anzahl ? "Weitere Datei" : "PDF oder Fotos wählen"}
                  </button>
                )}
                <input
                  ref={input[feld]}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    void waehle(feld, e.currentTarget.files);
                    e.currentTarget.value = "";
                  }}
                  data-testid={`probe-datei-${feld}`}
                />
              </div>
            );
          })}
        </div>
        {fehler && (
          <p role="alert" className="rounded-xl bg-red-wash px-4 py-3 text-[14px] text-red" data-testid="probe-fehler">
            {fehler}
          </p>
        )}
        {(neueDateien || !hochgeladen) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <button type="button" className="btn btn-primary" onClick={() => void senden(false)} disabled={busy !== null || (!dateien.angabe.length && !hochgeladen)} data-testid="probe-hochladen">
              <FileUp size={17} aria-hidden /> {busy === "hochladen" ? "Wird hochgeladen …" : "Hochladen"}
            </button>
            <span className="text-[13px] text-ink-3">Ein PDF mit Text liest die App selbst, ohne KI.</span>
          </div>
        )}
      </section>

      {/* 2 · Prüfen */}
      {hochgeladen && zeilen && (
        <section ref={pruefen} className="grid scroll-mt-24 gap-4" aria-labelledby="probe-pruefen" data-testid="probe-pruefen">
          <div className="panel grid gap-3 px-5 py-4 md:px-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="probe-pruefen" className="text-[17px] font-semibold">
                Prüfen
              </h2>
              {lesung && (
                <span className="text-[13px] text-ink-2" data-testid="probe-quelle">
                  Angabe {lesung.quelle.angabe ? QUELLE[lesung.quelle.angabe] : "noch nicht gelesen"}
                  {gespeichert.loesung.length > 0 && ` · Musterlösung ${lesung.quelle.loesung ? QUELLE[lesung.quelle.loesung] : "noch nicht gelesen"}`}
                </span>
              )}
            </div>
            {kiOffen && !kiGrund && (
              <div className="grid gap-2 rounded-xl bg-panel px-4 py-3">
                <label className="flex cursor-pointer items-start gap-3 text-[15px]">
                  <input type="checkbox" checked={keinName} onChange={(e) => setKeinName(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" data-testid="probe-keine-namen" />
                  <span>Auf den Seiten steht kein Name, oder er ist abgedeckt.</span>
                </label>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <button type="button" className="btn btn-primary" onClick={() => void senden(true)} disabled={busy !== null || !keinName} data-testid="probe-ki-lesen">
                    <Sparkles size={17} aria-hidden /> {busy === "lesen" ? "KI liest …" : "Mit KI lesen"}
                  </button>
                  {kosten && (
                    <span className="num text-[14px] text-ink-2" data-testid="probe-kosten">
                      {kosten}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-ink-3" role="status" aria-live="polite">
                  {busy === "lesen" ? <span className="num">Die KI schreibt Angabe und Musterlösung ab. Das dauert meist ein bis zwei Minuten ({seit} s).</span> : "Eine Anfrage je Datei-Feld, nur für das, was die App nicht selbst lesen konnte."}
                </p>
              </div>
            )}
            {kiOffen && kiGrund && (
              <p className="rounded-xl bg-amber-wash px-4 py-3 text-[14px] text-amber" role="status" data-testid="probe-ki-aus">
                {kiGrund}
              </p>
            )}
            {lesung && lesung.hinweise.length > 0 && (
              <ul className="grid gap-1 text-[14px] text-ink-2" data-testid="probe-hinweise">
                {lesung.hinweise.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
            <details className="reveal" data-testid="probe-einfuegen">
              <summary>
                <ClipboardPaste size={15} aria-hidden /> Text einfügen
              </summary>
              <div className="grid gap-2 pt-2">
                <p className="text-[13px] text-ink-2">Aus einem PDF kopiert oder abgetippt, mit Nummern wie auf dem Blatt (1., 2. oder Aufgabe 1, dazu a), b)). Füllt die Tabelle neu, ohne KI.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["angabe", "loesung"] as const).map((feld) => (
                    <label key={feld} className="grid gap-1">
                      <span className="text-[13.5px] font-semibold">{FELD[feld].titel}</span>
                      <textarea className="input min-h-[120px] text-[14px]" value={einfuegen[feld]} onChange={(e) => setEinfuegen((x) => ({ ...x, [feld]: e.target.value }))} data-testid={`probe-einfuegen-${feld}`} />
                    </label>
                  ))}
                </div>
                <div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={textUebernehmen} disabled={!einfuegen.angabe.trim()} data-testid="probe-einfuegen-uebernehmen">
                    In die Tabelle
                  </button>
                </div>
              </div>
            </details>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
            {/* the pages beside the rows */}
            <aside className="panel grid gap-3 px-4 py-4 lg:sticky lg:top-4" aria-label="Seiten" data-testid="probe-seiten">
              {(["angabe", "loesung"] as const).map((feld) =>
                gespeichert[feld].length ? (
                  <div key={feld} className="grid gap-2">
                    <p className="text-[13.5px] font-semibold text-ink-2">{FELD[feld].titel}</p>
                    {gespeichert[feld].map((g) =>
                      g.pdf ? (
                        <div key={g.id} className="grid gap-1">
                          <object data={`/material/${g.id}/datei`} type="application/pdf" className="hidden h-[420px] w-full rounded-lg border border-line bg-surface lg:block" aria-label={g.name} />
                          <a href={`/material/${g.id}/datei`} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] min-w-0 items-center gap-1.5 text-[14px] font-semibold text-accent hover:underline">
                            <FileText size={15} className="shrink-0" aria-hidden /> <span className="truncate">{g.name}</span>
                          </a>
                        </div>
                      ) : (
                        <a key={g.id} href={`/material/${g.id}/datei`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-line">
                          {/* eslint-disable-next-line @next/next/no-img-element -- the stored page of this student, teacher only */}
                          <img src={`/material/${g.id}/datei`} alt={`${FELD[feld].titel}: ${g.name}`} className="w-full bg-surface object-contain" />
                        </a>
                      ),
                    )}
                  </div>
                ) : null,
              )}
            </aside>

            <div className="grid gap-3">
              {zeilen.length === 0 && (
                <p className="panel px-5 py-4 text-[14px] text-ink-2" data-testid="probe-leer">
                  Noch keine Teilaufgaben. {kiOffen && !kiGrund ? "Mit KI lesen, Text einfügen oder Zeile für Zeile eintragen." : "Text einfügen oder Zeile für Zeile eintragen, die Seiten stehen daneben."}
                </p>
              )}
              <ol className="grid gap-3" data-testid="probe-zeilen">
                {zeilen.map((z, i) => {
                  const erste = i === 0 || zeilen[i - 1].aufgabe !== z.aufgabe || zeilen[i - 1].einleitung !== z.einleitung;
                  return (
                    <li key={z.k} className={`panel grid gap-3 px-4 py-4 ${z.unsicher ? "ring-2 ring-amber" : ""}`} data-testid="probe-zeile" data-unsicher={z.unsicher ? "1" : undefined}>
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="grid gap-1">
                          <span className="text-[12.5px] font-semibold text-ink-2">Aufgabe</span>
                          <input className="input num w-[4.5rem]" inputMode="numeric" value={z.aufgabe} onChange={(e) => aendere(z.k, { aufgabe: e.target.value })} data-testid="probe-aufgabe" />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-[12.5px] font-semibold text-ink-2">Teil</span>
                          <input className="input w-[4rem]" value={z.teil} maxLength={3} onChange={(e) => aendere(z.k, { teil: e.target.value })} data-testid="probe-teil" />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-[12.5px] font-semibold text-ink-2">Punkte</span>
                          <input
                            className={`input num w-[5rem] ${punkteVon(z.punkte) == null ? "border-amber" : ""}`}
                            inputMode="decimal"
                            value={z.pText ?? (z.punkte != null ? punkteText(z.punkte) : "")}
                            onChange={(e) => aendere(z.k, { pText: e.target.value, punkte: punkteVon(e.target.value) })}
                            data-testid="probe-punkte"
                          />
                        </label>
                        <span className="num pb-2.5 text-[14px] font-semibold text-ink-2">{z.aufgabe ? nummerText({ aufgabe: z.aufgabe.trim(), teil: z.teil.trim() }) : "?"}</span>
                        <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => setZeilen((zs) => zs && zs.filter((x) => x.k !== z.k))} aria-label={`Teilaufgabe ${nummerText(z)} entfernen`}>
                          <Trash2 size={15} aria-hidden />
                        </button>
                      </div>
                      {z.unsicher && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-amber-wash px-3 py-2 text-[14px] text-ink">
                          <TriangleAlert size={16} className="shrink-0 text-amber" aria-hidden />
                          <span className="min-w-0 flex-1">{z.grund || "Unsicher."}</span>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => aendere(z.k, { unsicher: false })} data-testid="probe-passt">
                            <Check size={15} aria-hidden /> Passt so
                          </button>
                        </div>
                      )}
                      {(z.einleitung || (erste && z.teil)) && (
                        <label className="grid gap-1">
                          <span className="text-[12.5px] font-semibold text-ink-2">Text der Aufgabe {z.aufgabe} vor den Teilaufgaben</span>
                          <textarea className="input min-h-[60px] text-[14px]" value={z.einleitung} onChange={(e) => aendereEinleitung(z, e.target.value)} />
                        </label>
                      )}
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="grid gap-1">
                          <span className="text-[12.5px] font-semibold text-ink-2">Text</span>
                          <textarea className="input min-h-[84px] text-[14px]" value={z.text} onChange={(e) => aendere(z.k, { text: e.target.value })} data-testid="probe-text" />
                        </label>
                        <label className="grid gap-1">
                          <span className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-ink-2">
                            Musterlösung
                            {!z.loesung.trim() && <span className="rounded-full bg-amber-wash px-2 py-0.5 text-[12px] font-semibold text-amber" data-testid="probe-loesung-fehlt">Lösung fehlt</span>}
                          </span>
                          <textarea className="input min-h-[84px] text-[14px]" value={z.loesung} onChange={(e) => aendere(z.k, { loesung: e.target.value })} placeholder="Ohne Lösung bewertest nur du." data-testid="probe-loesung" />
                        </label>
                      </div>
                      <label className="grid gap-1">
                        <span className="text-[12.5px] font-semibold text-ink-2">
                          Fähigkeit {z.skillVorschlag && z.skillId && <span className="font-normal text-ink-3">(Vorschlag)</span>}
                        </span>
                        <select className="input text-[14px]" value={z.skillId ?? ""} onChange={(e) => aendere(z.k, { skillId: e.target.value || null, skillVorschlag: false })} data-testid="probe-faehigkeit">
                          <option value="">Keine (zählt nicht für den Lernstand)</option>
                          {bereiche.map(([area, liste]) => (
                            <optgroup key={area} label={area}>
                              {liste.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                    </li>
                  );
                })}
              </ol>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={neueZeile} data-testid="probe-zeile-dazu">
                  <Plus size={15} aria-hidden /> Teilaufgabe dazu
                </button>
                {ohnePunkte > 0 && zeilen.length > 0 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setZeilen((zs) => zs && zs.map((z) => (punkteVon(z.punkte) == null ? { ...z, punkte: 1, pText: undefined } : z)))} data-testid="probe-punkte-eins">
                    <PenLine size={15} aria-hidden /> Fehlende Punkte: je 1
                  </button>
                )}
              </div>

              <div className="panel grid gap-3 px-5 py-4">
                <label className="grid gap-1.5">
                  <span className="text-[14px] font-semibold">Titel</span>
                  <input className="input" value={titel} onChange={(e) => setTitel(e.target.value)} maxLength={100} autoComplete="off" data-testid="probe-titel" />
                </label>
                <p className="num text-[14px] text-ink-2" data-testid="probe-summe">
                  {zeilen.length} {zeilen.length === 1 ? "Teilaufgabe" : "Teilaufgaben"} · {punkteText(summe)} Punkte
                  {ohneLoesung > 0 && ` · ${ohneLoesung} ohne Lösung`}
                  {gelb > 0 && ` · ${gelb} unsicher`}
                </p>
                {fehlerListe.length > 0 && zeilen.length > 0 && (
                  <p className="text-[14px] text-amber" data-testid="probe-noch">
                    {fehlerListe[0]}
                  </p>
                )}
                {speicherFehler && (
                  <p role="alert" className="rounded-xl bg-red-wash px-4 py-3 text-[14px] text-red">
                    {speicherFehler}
                  </p>
                )}
                <div>
                  <button type="button" className="btn btn-primary btn-lg" onClick={uebernehmen} disabled={speichern || fehlerListe.length > 0} data-testid="probe-uebernehmen">
                    <Check size={18} aria-hidden /> {speichern ? "Wird übernommen …" : "Übernehmen"}
                  </button>
                </div>
                <p className="text-[13px] text-ink-3">Erst jetzt entsteht die Probeschularbeit für die Schularbeit. Die Musterlösung sieht nur du.</p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
