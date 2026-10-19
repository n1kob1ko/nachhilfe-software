"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, FileText, Sparkles, X } from "lucide-react";
import { addExamAction, suggestSkillsAction, type TopicSuggestion } from "@/app/curriculum-actions";
import { shrinkImage } from "@/components/shrink-image";
import { Reveal } from "@/components/ui";
import { PRUEFUNGSARTEN } from "@/lib/pruefungsarten";
import type { StoffzettelVorschlag } from "@/lib/stoffzettel";

/** Mirrors lib/materials.ts (kept here so the browser does not load server code). */
const MAX_BYTES = 20 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

type Zettel = { file: File; url: string | null };

/**
 * Quick entry of a Schularbeit/test: Art, Fach, Datum, Stoff. While the Stoff is typed, matching skills
 * appear as chips to tick; nothing is linked automatically. A result can be added right away.
 *
 * Stoffzettel (lib/stoffzettel.ts): a photo or PDF of the sheet with the Stoff is stored as the student's material
 * and saved with the Schularbeit. With KI the teacher can have it read (after the tick „kein Name“): Art, Fach,
 * Datum, Bezeichnung and Stoff are filled in, every field stays editable, and nothing is saved before „Eintragen“.
 */
export function ExamForm({ studentId, subjects, today, kiLiest }: { studentId: number; subjects: string[]; today: string; kiLiest: boolean }) {
  const [kind, setKind] = useState<string>(PRUEFUNGSARTEN[0]);
  const [subject, setSubject] = useState(subjects[0] ?? "Mathematik");
  const [extraFach, setExtraFach] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("");
  const [titleShown, setTitleShown] = useState(false);
  const [topics, setTopics] = useState("");
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const [zettel, setZettel] = useState<Zettel | null>(null);
  const [materialId, setMaterialId] = useState<number | null>(null);
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

  useEffect(() => () => (zettel?.url ? URL.revokeObjectURL(zettel.url) : undefined), [zettel]);
  useEffect(() => {
    if (busy !== "lesen") return;
    const begin = Date.now();
    setSeit(0);
    const id = setInterval(() => setSeit(Math.round((Date.now() - begin) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const toggle = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const shown = suggestions.flatMap((s) => s.skills);
  const unmatched = suggestions.filter((s) => s.skills.length === 0).map((s) => s.topic);
  const faecher = extraFach && !subjects.includes(extraFach) ? [...subjects, extraFach] : subjects;

  function entfernen() {
    setZettel(null);
    setMaterialId(null);
    setKeinName(false);
    setFehler(null);
    setHinweise(null);
  }

  async function waehle(file: File | undefined) {
    if (!file) return;
    setFehler(null);
    setHinweise(null);
    setMaterialId(null);
    const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!pdf && !file.type.startsWith("image/")) {
      setFehler("Bitte ein Foto oder ein PDF wählen.");
      return;
    }
    setBusy("vorbereiten");
    const small = pdf ? file : await shrinkImage(file);
    setBusy(null);
    if (!pdf && !TYPES.includes(small.type)) {
      setFehler("Dieses Bildformat geht nicht. Bitte ein JPG, PNG oder WebP wählen.");
      return;
    }
    if (small.size > MAX_BYTES) {
      setFehler(`Die Datei ist zu groß (höchstens ${MAX_BYTES / 1024 / 1024} MB).`);
      return;
    }
    const z = { file: small, url: pdf ? null : URL.createObjectURL(small) };
    setZettel(z);
    // without KI there is nothing to decide: the sheet is attached right away
    if (!kiLiest) await senden(false, z);
  }

  /**
   * Stores the sheet (once) and, with `lesen`, has the KI read it. A sheet that is stored already goes by its id, so
   * a second try does not upload it again; `neu` is a sheet just chosen. Returns the material id, or null after an error.
   */
  async function senden(lesen: boolean, neu?: Zettel): Promise<number | null> {
    if (busy) return null;
    setFehler(null);
    const fd = new FormData();
    fd.set("schueler", String(studentId));
    fd.set("fach", subject);
    if (neu) fd.set("datei", neu.file, neu.file.name);
    else if (materialId) fd.set("material", String(materialId));
    else if (zettel) fd.set("datei", zettel.file, zettel.file.name);
    else return null;
    if (lesen) {
      fd.set("lesen", "1");
      fd.set("keine_namen", keinName ? "1" : "0");
    }
    setBusy(lesen ? "lesen" : "anhaengen");
    try {
      const res = await fetch("/material/stoffzettel", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { material?: number; vorschlag?: StoffzettelVorschlag; error?: string };
      const id = typeof data.material === "number" ? data.material : materialId;
      if (typeof data.material === "number") setMaterialId(data.material);
      if (res.ok && data.vorschlag) uebernehmen(data.vorschlag);
      if (!res.ok) setFehler(data.error ?? (res.status === 401 ? "Du bist abgemeldet. Bitte neu anmelden." : "Das ging nicht. Bitte noch einmal versuchen."));
      setBusy(null);
      return res.ok || id ? id : null;
    } catch {
      setFehler("Keine Verbindung. Der Zettel ist noch hier, bitte noch einmal versuchen.");
      setBusy(null);
      return null;
    }
  }

  function uebernehmen(v: StoffzettelVorschlag) {
    if (v.art) setKind(v.art);
    if (v.fach) {
      if (!subjects.includes(v.fach)) setExtraFach(v.fach);
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
    setChecked([]);
    entfernen();
  }

  const name = zettel?.file.name ?? "Stoffzettel";
  return (
    <form
      ref={formRef}
      action={async (fd) => {
        // a chosen sheet that was not sent yet goes along now
        let id = materialId;
        if (zettel && !id) {
          id = await senden(false);
          if (!id) return;
        }
        if (id) fd.set("material_id", String(id));
        await addExamAction(fd);
        zuruecksetzen();
      }}
      className="panel grid gap-3 px-4 py-4"
      aria-label="Prüfung eintragen"
    >
      <input type="hidden" name="student_id" value={studentId} />

      <div className="grid gap-2" data-testid="stoffzettel">
        {!zettel && !materialId ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInput.current?.click()} disabled={busy !== null} data-testid="stoffzettel-waehlen">
              <Camera size={15} aria-hidden /> {busy === "vorbereiten" ? "Wird vorbereitet …" : "Stoffzettel"}
            </button>
            <span className="text-[12.5px] text-ink-3">{kiLiest ? "Foto oder PDF. Die KI liest Fach, Datum und Stoff ab." : "Foto oder PDF. Bleibt bei der Schularbeit."}</span>
          </div>
        ) : (
          <div className="grid gap-3 rounded-xl bg-panel p-3">
            <div className="flex items-center gap-3">
              {zettel?.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen photo
                <img src={zettel.url} alt="Gewählter Stoffzettel" className="h-14 w-14 shrink-0 rounded-lg bg-surface object-cover object-top" />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface text-accent" aria-hidden>
                  <FileText size={22} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{materialId ? "Stoffzettel angehängt" : name}</p>
                <p className="text-[12.5px] text-ink-3" data-testid={materialId ? "stoffzettel-angehaengt" : undefined}>
                  {materialId ? (
                    <a href={`/material/${materialId}/datei`} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                      ansehen
                    </a>
                  ) : zettel ? (
                    <span className="num">{Math.max(1, Math.round(zettel.file.size / 1024))} KB</span>
                  ) : null}
                  {materialId && " · wird mit der Schularbeit gespeichert"}
                </p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={entfernen} disabled={busy !== null} aria-label="Stoffzettel entfernen" data-testid="stoffzettel-entfernen">
                <X size={16} aria-hidden />
              </button>
            </div>
            {kiLiest && !hinweise && (
              <>
                <label className="flex cursor-pointer items-start gap-2.5 text-[14px]">
                  <input type="checkbox" checked={keinName} onChange={(e) => setKeinName(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--accent)]" data-testid="stoffzettel-keine-namen" />
                  <span>Auf dem Zettel steht kein Name (oder er ist abgedeckt).</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void senden(true)} disabled={!keinName || busy !== null} data-testid="stoffzettel-lesen">
                    <Sparkles size={15} aria-hidden /> {busy === "lesen" ? "KI liest …" : "Lesen und ausfüllen"}
                  </button>
                  {!materialId && (
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
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void waehle(e.currentTarget.files?.[0]);
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
        </select>
        <input className="input col-span-2 sm:col-span-1" type="date" name="date" required value={date} onChange={(e) => setDate(e.target.value)} aria-label="Datum" />
      </div>
      {titleShown && <input className="input" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Bezeichnung, z. B. 2. Schularbeit" aria-label="Bezeichnung" autoComplete="off" />}
      <input className="input" name="topics" value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="Stoff, z. B. Brüche, Prozent, Sachaufgaben" aria-label="Stoff" autoComplete="off" />
      {checked.filter((id) => !shown.some((s) => s.id === id)).map((id) => (
        <input key={id} type="hidden" name="skill_ids" value={id} />
      ))}
      {(shown.length > 0 || unmatched.length > 0) && (
        <div className="grid gap-1.5" aria-live="polite">
          <p className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
            <Sparkles size={13} aria-hidden /> Passende Fähigkeiten antippen, um sie zu verknüpfen
          </p>
          <div className="flex flex-wrap gap-1.5">
            {shown
              .filter((s, i) => shown.findIndex((x) => x.id === s.id) === i)
              .map((s) => (
                <label key={s.id} className="flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] has-checked:border-accent has-checked:bg-accent-wash">
                  <input type="checkbox" name="skill_ids" value={s.id} checked={checked.includes(s.id)} onChange={() => toggle(s.id)} className="accent-[var(--accent)]" />
                  {s.name}
                  <span className="text-ink-3">· {s.area}</span>
                </label>
              ))}
          </div>
          {unmatched.length > 0 && <p className="text-[12.5px] text-ink-3">Ohne Vorschlag: {unmatched.join(", ")}. Bleibt als Stoff gespeichert.</p>}
        </div>
      )}
      {pending && shown.length === 0 && <p className="text-[12.5px] text-ink-3">Suche passende Fähigkeiten …</p>}
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
