"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, FileText, Plus, Sparkles, X } from "lucide-react";
import { addExamAction, suggestSkillsAction, type TopicSuggestion } from "@/app/curriculum-actions";
import { shrinkImage } from "@/components/shrink-image";
import { hauptThema, StoffChip, StoffWahl, StoffZeile } from "@/components/StoffZuordnung";
import { Reveal } from "@/components/ui";
import { PRUEFUNGSARTEN } from "@/lib/pruefungsarten";
import type { Erkannt, StoffzettelVorschlag } from "@/lib/stoffzettel";

/** Mirrors lib/materials.ts and lib/pruefungsstoff.ts (kept here so the browser does not load server code). */
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_DATEIEN = 8;
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** A chosen file; `gesendet` once it is stored as material. */
type Zettel = { key: string; file: File; url: string | null; gesendet: boolean };

/**
 * Quick entry of a Schularbeit/test: Art, Fach, Datum, Stoff. While the Stoff is typed (or read from the Stoffzettel),
 * each topic gets its matching skills as chips, the sure ones ticked (lib/lehrplan.ts stoffVorschlag); they are linked
 * with „Eintragen“, so the teacher sees and can change them first. A result can be added right away.
 *
 * Stoffzettel (lib/stoffzettel.ts): one or more photos or a PDF (the sheet, a table of contents, more pages) are stored
 * as the student's material and saved with the Schularbeit. With KI the teacher can have them read together (after the
 * tick „kein Name“, lib/pruefungsstoff.ts): Art, Fach, Datum, Bezeichnung and Stoff are filled in, every field stays
 * editable, and nothing is saved before „Eintragen“. After a reading the skills come from the recognised Prüfungsstoff
 * (sure ones linked, unclear ones confirmed in „Erkannt“), so the chips per topic are not shown.
 */
export function ExamForm({ studentId, subjects, weitere = [], today, kiLiest }: { studentId: number; subjects: string[]; weitere?: string[]; today: string; kiLiest: boolean }) {
  const [kind, setKind] = useState<string>(PRUEFUNGSARTEN[0]);
  const [subject, setSubject] = useState(subjects[0] ?? "Mathematik");
  const [extraFach, setExtraFach] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("");
  const [titleShown, setTitleShown] = useState(false);
  const [topics, setTopics] = useState("");
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  // ticks the teacher changed, per topic; the other topics keep the suggestion
  const [wahl, setWahl] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const [zettel, setZettel] = useState<Zettel[]>([]);
  const [materialIds, setMaterialIds] = useState<number[]>([]);
  const [erkannt, setErkannt] = useState<Erkannt | null>(null);
  const [keinName, setKeinName] = useState(false);
  const [busy, setBusy] = useState<null | "vorbereiten" | "anhaengen" | "lesen">(null);
  const [seit, setSeit] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweise, setHinweise] = useState<string[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!topics.trim()) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => start(async () => setSuggestions(await suggestSkillsAction(studentId, subject, topics))), 350);
    return () => clearTimeout(t);
  }, [topics, subject, studentId]);

  useEffect(() => () => zettel.forEach((z) => (z.url ? URL.revokeObjectURL(z.url) : undefined)), [zettel]);
  useEffect(() => {
    if (busy !== "lesen") return;
    const begin = Date.now();
    setSeit(0);
    const id = setInterval(() => setSeit(Math.round((Date.now() - begin) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const ticked = (s: TopicSuggestion) => wahl[s.topic] ?? s.best;
  const toggle = (s: TopicSuggestion, id: string) => setWahl((w) => ({ ...w, [s.topic]: ticked(s).includes(id) ? ticked(s).filter((x) => x !== id) : [...ticked(s), id] }));
  const anzahl = new Set(suggestions.flatMap(ticked)).size;
  const thema = hauptThema(suggestions);
  const chip = (sg: TopicSuggestion, i: number) => (s: TopicSuggestion["skills"][number]) => (
    <StoffChip key={s.id} name={`stoff_${i}`} value={s.id} label={s.name} area={s.area === thema ? undefined : s.area} checked={ticked(sg).includes(s.id)} onChange={() => toggle(sg, s.id)} />
  );
  // the student's subjects first, then „Weitere Fächer“ from the Fächerliste (Mehr › Fächer)
  const faecher = extraFach && !subjects.includes(extraFach) && !weitere.includes(extraFach) ? [...subjects, extraFach] : subjects;

  function entfernen() {
    setZettel([]);
    setMaterialIds([]);
    setErkannt(null);
    setKeinName(false);
    setFehler(null);
    setHinweise(null);
  }

  /** Adds the chosen files (photos made smaller in the browser), at most MAX_DATEIEN together. */
  async function waehle(files: File[]) {
    if (!files.length) return;
    setFehler(null);
    setHinweise(null);
    setErkannt(null);
    const platz = MAX_DATEIEN - zettel.length;
    if (files.length > platz) setFehler(`Höchstens ${MAX_DATEIEN} Fotos oder PDFs zusammen.`);
    const neu: Zettel[] = [];
    setBusy("vorbereiten");
    for (const file of files.slice(0, Math.max(0, platz))) {
      const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (!pdf && !file.type.startsWith("image/")) {
        setFehler("Bitte Fotos oder PDFs wählen.");
        continue;
      }
      const small = pdf ? file : await shrinkImage(file);
      if (!pdf && !TYPES.includes(small.type)) {
        setFehler("Dieses Bildformat geht nicht. Bitte ein JPG, PNG oder WebP wählen.");
        continue;
      }
      if (small.size > MAX_BYTES) {
        setFehler(`Eine Datei ist zu groß (höchstens ${MAX_BYTES / 1024 / 1024} MB).`);
        continue;
      }
      neu.push({ key: `${Date.now()}-${neu.length}-${small.name}`, file: small, url: pdf ? null : URL.createObjectURL(small), gesendet: false });
    }
    setBusy(null);
    if (!neu.length) return;
    const alle = [...zettel, ...neu];
    setZettel(alle);
    // without KI there is nothing to decide: the sheets are attached right away
    if (!kiLiest) await senden(false, alle);
  }

  /** Removes one chosen file; a stored one stays the student's material but is not attached. */
  function ohne(key: string) {
    const i = zettel.findIndex((z) => z.key === key);
    if (i < 0) return;
    const z = zettel[i];
    if (z.url) URL.revokeObjectURL(z.url);
    setZettel(zettel.filter((x) => x.key !== key));
    // stored files keep their order: the i-th stored file is this one
    if (z.gesendet) setMaterialIds((ids) => ids.filter((_, j) => j !== zettel.slice(0, i).filter((x) => x.gesendet).length));
    setErkannt(null);
    setHinweise(null);
  }

  /**
   * Stores the sheets (once) and, with `lesen`, has the KI read all of them together. Sheets that are stored already go
   * by their ids, so a second try does not upload them again. Returns the material ids, or null after an error.
   */
  async function senden(lesen: boolean, liste: Zettel[] = zettel): Promise<number[] | null> {
    if (busy) return null;
    setFehler(null);
    const fd = new FormData();
    fd.set("schueler", String(studentId));
    fd.set("fach", subject);
    for (const id of materialIds) fd.append("material", String(id));
    const offen = liste.filter((z) => !z.gesendet);
    for (const z of offen) fd.append("datei", z.file, z.file.name);
    if (!materialIds.length && !offen.length) return null;
    if (lesen) {
      fd.set("lesen", "1");
      fd.set("keine_namen", keinName ? "1" : "0");
    }
    setBusy(lesen ? "lesen" : "anhaengen");
    try {
      const res = await fetch("/material/stoffzettel", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { materialien?: number[]; vorschlag?: StoffzettelVorschlag & { erkannt?: Erkannt }; error?: string };
      const ids = Array.isArray(data.materialien) && data.materialien.length ? data.materialien : materialIds;
      if (Array.isArray(data.materialien) && data.materialien.length) {
        setMaterialIds(data.materialien);
        if (data.materialien.length >= materialIds.length + offen.length) setZettel(liste.map((z) => ({ ...z, gesendet: true })));
      }
      if (res.ok && data.vorschlag) uebernehmen(data.vorschlag);
      if (!res.ok) setFehler(data.error ?? (res.status === 401 ? "Du bist abgemeldet. Bitte neu anmelden." : "Das ging nicht. Bitte noch einmal versuchen."));
      setBusy(null);
      return res.ok || ids.length ? ids : null;
    } catch {
      setFehler("Keine Verbindung. Die Zettel sind noch hier, bitte noch einmal versuchen.");
      setBusy(null);
      return null;
    }
  }

  function uebernehmen(v: StoffzettelVorschlag & { erkannt?: Erkannt }) {
    if (v.art) setKind(v.art);
    if (v.fach) {
      if (!subjects.includes(v.fach) && !weitere.includes(v.fach)) setExtraFach(v.fach);
      setSubject(v.fach);
    }
    // no date on the sheet: today is almost never the day of the Schularbeit, so the field is emptied to be filled in
    if (v.datum) setDate(v.datum);
    else setDate((d) => (d === today ? "" : d));
    if (v.titel) {
      setTitle(v.titel);
      setTitleShown(true);
    }
    if (v.themen.length) setTopics(v.themen.join(", "));
    setHinweise(v.hinweise);
    setErkannt(v.erkannt ?? null);
  }

  function zuruecksetzen() {
    formRef.current?.reset();
    setKind(PRUEFUNGSARTEN[0]);
    setSubject(subjects[0] ?? "Mathematik");
    setExtraFach(null);
    setDate(today);
    setTitle("");
    setTitleShown(false);
    setTopics("");
    setWahl({});
    entfernen();
  }

  const gewaehlt = zettel.length > 0 || materialIds.length > 0;
  const alleGesendet = gewaehlt && zettel.every((z) => z.gesendet);
  return (
    <form
      ref={formRef}
      action={async (fd) => {
        // chosen sheets that were not sent yet go along now
        let ids = materialIds;
        if (zettel.some((z) => !z.gesendet)) {
          ids = (await senden(false)) ?? [];
          if (!ids.length) return;
        }
        if (ids.length) fd.set("material_id", String(ids[0]));
        if (erkannt) fd.set("lesung_id", String(erkannt.lesung));
        // with a reading the action goes on to „Erkannt“
        await addExamAction(fd);
        zuruecksetzen();
      }}
      className="panel grid gap-3 px-4 py-4"
      aria-label="Prüfung eintragen"
    >
      <input type="hidden" name="student_id" value={studentId} />

      <div className="grid gap-2" data-testid="stoffzettel">
        {!gewaehlt ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInput.current?.click()} disabled={busy !== null} data-testid="stoffzettel-waehlen">
              <Camera size={15} aria-hidden /> {busy === "vorbereiten" ? "Wird vorbereitet …" : "Stoffzettel"}
            </button>
            <span className="text-[12.5px] text-ink-3">
              {kiLiest ? `Fotos oder PDF, bis zu ${MAX_DATEIEN}, z. B. Stoffzettel und Inhaltsverzeichnis. Die KI liest alles zusammen.` : "Fotos oder PDF. Bleiben bei der Schularbeit."}
            </span>
          </div>
        ) : (
          <div className="grid gap-3 rounded-xl bg-panel p-3">
            <ul className="grid gap-2" data-testid="stoffzettel-liste">
              {zettel.map((z, i) => (
                <li key={z.key} className="flex items-center gap-3">
                  {z.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen photo
                    <img src={z.url} alt={`Gewähltes Blatt ${i + 1}`} className="h-12 w-12 shrink-0 rounded-lg bg-surface object-cover object-top" />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface text-accent" aria-hidden>
                      <FileText size={20} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{z.file.name}</p>
                    <p className="num text-[12.5px] text-ink-3">
                      {Math.max(1, Math.round(z.file.size / 1024))} KB{z.gesendet && " · angehängt"}
                    </p>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={() => ohne(z.key)} disabled={busy !== null} aria-label={`Blatt ${i + 1} entfernen`} data-testid="stoffzettel-entfernen">
                    <X size={16} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-3">
              {zettel.length < MAX_DATEIEN && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInput.current?.click()} disabled={busy !== null} data-testid="stoffzettel-mehr">
                  <Plus size={15} aria-hidden /> Weiteres Blatt
                </button>
              )}
              {alleGesendet && materialIds[0] && (
                <span data-testid="stoffzettel-angehaengt">
                  <a href={`/material/${materialIds[0]}/datei`} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                    ansehen
                  </a>{" "}
                  · wird mit der Schularbeit gespeichert
                </span>
              )}
            </div>
            {kiLiest && !hinweise && (
              <>
                <label className="flex cursor-pointer items-start gap-2.5 text-[14px]">
                  <input type="checkbox" checked={keinName} onChange={(e) => setKeinName(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--accent)]" data-testid="stoffzettel-keine-namen" />
                  <span>Auf den Blättern steht kein Name (oder er ist abgedeckt).</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void senden(true)} disabled={!keinName || busy !== null} data-testid="stoffzettel-lesen">
                    <Sparkles size={15} aria-hidden /> {busy === "lesen" ? "KI liest …" : zettel.length > 1 ? "Alle zusammen lesen" : "Lesen und ausfüllen"}
                  </button>
                  {!alleGesendet && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void senden(false)} disabled={busy !== null} data-testid="stoffzettel-anhaengen">
                      {busy === "anhaengen" ? "Wird angehängt …" : "Nur anhängen"}
                    </button>
                  )}
                  {busy === "lesen" && (
                    <span className="num text-[12.5px] text-ink-3" role="status">
                      meist unter einer Minute ({seit} s)
                    </span>
                  )}
                </div>
              </>
            )}
        {!kiLiest && busy === "anhaengen" && <p className="text-[12.5px] text-ink-3">Wird angehängt …</p>}
            {hinweise && (
              <div className="grid gap-1 rounded-lg bg-amber-wash px-3 py-2 text-[13px] text-amber" role="status" data-testid="stoffzettel-hinweise">
                <p className="font-semibold">Von der KI ausgefüllt. Bitte prüfen.</p>
                {erkannt && (
                  <p className="text-ink" data-testid="stoffzettel-erkannt">
                    Erkannt: <span className="num">{erkannt.punkte}</span> Punkte{erkannt.dokumente.length ? ` aus ${[...new Set(erkannt.dokumente)].join(" und ")}` : ""}.{" "}
                    <span className="num">{erkannt.sicher}</span> sicher zugeordnet
                    {erkannt.unklar > 0 && (
                      <>
                        , <span className="num">{erkannt.unklar}</span> kurz bestätigen
                      </>
                    )}
                    {erkannt.keine > 0 && (
                      <>
                        , <span className="num">{erkannt.keine}</span> ohne passende Fähigkeit (bleiben gespeichert)
                      </>
                    )}
                    {erkannt.ausgeschlossen > 0 && (
                      <>
                        , <span className="num">{erkannt.ausgeschlossen}</span> ausgeschlossen
                      </>
                    )}
                    {erkannt.offen > 0 && (
                      <>
                        , <span className="num">{erkannt.offen}</span> noch zu klären
                      </>
                    )}
                    . Nach „Eintragen“ siehst du alles.{!erkannt.neu && " Schon einmal gelesen, kostet nichts."}
                  </p>
                )}
                {hinweise.length > 0 && (
                  <ul className="grid gap-0.5">
                    {hinweise.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
        {fehler && (
          <p role="alert" className="rounded-lg bg-red-wash px-3 py-2 text-[13px] text-red" data-testid="stoffzettel-fehler">
            {fehler}
          </p>
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
            void waehle([...(e.currentTarget.files ?? [])]);
            e.currentTarget.value = "";
          }}
          data-testid="stoffzettel-datei"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <select className="input" name="kind" aria-label="Art" value={kind} onChange={(e) => setKind(e.target.value)}>
          {PRUEFUNGSARTEN.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <select className="input" name="subject" aria-label="Fach" value={subject} onChange={(e) => setSubject(e.target.value)}>
          {faecher.map((s) => (
            <option key={s}>{s}</option>
          ))}
          {weitere.length > 0 && (
            <optgroup label="Weitere Fächer">
              {weitere.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </optgroup>
          )}
        </select>
        <input className="input col-span-2 sm:col-span-1" type="date" name="date" required value={date} onChange={(e) => setDate(e.target.value)} aria-label="Datum" />
      </div>
      {titleShown && <input className="input" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Bezeichnung, z. B. 2. Schularbeit" aria-label="Bezeichnung" autoComplete="off" />}
      <input className="input" name="topics" value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="Stoff, z. B. Brüche, Prozent, Sachaufgaben" aria-label="Stoff" autoComplete="off" />
      {suggestions.length > 0 && !erkannt && (
        <div className="grid" aria-live="polite" data-testid="stoff-vorschlaege">
          <p className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
            <Sparkles size={13} aria-hidden /> Fähigkeiten zum Stoff: was passt, ist angehakt. Antippen zum Ändern.
          </p>
          <div className="divide-y divide-line">
            {suggestions.map((sg, i) => (
              <StoffZeile key={`${i}-${sg.topic}`} topic={sg.topic} index={i} auto={sg.best}>
                <StoffWahl sichtbar={sg.skills.filter((s) => sg.best.includes(s.id)).map(chip(sg, i))} weitere={sg.skills.filter((s) => !sg.best.includes(s.id)).map(chip(sg, i))} />
                {sg.skills.length === 0 && <p className="text-[12.5px] text-ink-3 sm:pt-2">Kein Vorschlag. Bleibt als Stoff gespeichert, zuordnen kannst du ihn später in der Vorbereitung.</p>}
              </StoffZeile>
            ))}
          </div>
          <p className="text-[12.5px] text-ink-3">
            <span className="num">{anzahl}</span> {anzahl === 1 ? "Fähigkeit wird" : "Fähigkeiten werden"} mit „Eintragen“ verknüpft.
          </p>
        </div>
      )}
      {pending && suggestions.length === 0 && !erkannt && <p className="text-[12.5px] text-ink-3">Suche passende Fähigkeiten …</p>}
      <Reveal label="Schon geschrieben? Ergebnis eintragen">
        <div className="grid grid-cols-3 gap-3">
          <input className="input num" name="grade" type="number" min={1} max={5} placeholder="Note" aria-label="Note" />
          <input className="input num" name="points" inputMode="decimal" placeholder="Punkte" aria-label="Punkte" />
          <input className="input num" name="max_points" inputMode="decimal" placeholder="von" aria-label="Höchstpunkte" />
        </div>
      </Reveal>
      <button className="btn btn-primary justify-self-start" disabled={busy !== null}>
        Eintragen
      </button>
    </form>
  );
}
