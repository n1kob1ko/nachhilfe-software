"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, FileText, Sparkles, X } from "lucide-react";
import { shrinkImage } from "@/components/shrink-image";
import { uebernimmVonPapierAction } from "@/app/text-actions";
import { centText, MAX_HANDSCHRIFT_SEITEN, offeneStellen, UNLESBAR, type HandschriftVorschlag } from "@/lib/handschrift-regeln";

/** Mirrors lib/materials.ts (kept here so the browser does not load server code). */
const MAX_FOTO = 5 * 1024 * 1024;
const MAX_PDF = 10 * 1024 * 1024;
const FOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Handwriting needs more pixels than a Stoffzettel. */
const MAX_SIDE = 2400;

type Seite = { file: File; url: string | null };
const woerter = (s: string) => s.split(/\s+/).filter((w) => w && w !== "|").length;

/**
 * Handgeschriebenen Text einlesen (lib/handschrift.ts): the photographed pages on one side, the text on the other.
 * The KI writes the text down word for word, with every mistake; the teacher compares it with the photo, fixes what
 * it read wrongly and only then takes it over. Without KI the teacher types it into the same field.
 * Nothing is saved before „Als Text übernehmen“; the photos never leave this page except for the reading.
 */
export function HandschriftEinlesen({
  textId,
  name,
  kiGrund,
  kosten,
  vorhanden,
  fertig: schonFertig,
}: {
  textId: number;
  name: string;
  kiGrund: string | null;
  kosten: { grundCent: number; seiteCent: number };
  vorhanden: { text: string; words: number };
  fertig: boolean;
}) {
  const router = useRouter();
  const [seiten, setSeiten] = useState<Seite[]>([]);
  const [gezeigt, setGezeigt] = useState(0);
  const [keinName, setKeinName] = useState(false);
  const [busy, setBusy] = useState<null | "vorbereiten" | "lesen">(null);
  const [seit, setSeit] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [text, setText] = useState(vorhanden.text);
  const [hinweise, setHinweise] = useState<string[]>([]);
  const [gelesen, setGelesen] = useState(false);
  const [fertig, setFertig] = useState(true);
  const [speichern, startSpeichern] = useTransition();
  const [speicherFehler, setSpeicherFehler] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const feld = useRef<HTMLTextAreaElement>(null);
  const geaendert = text !== vorhanden.text;

  useEffect(() => () => seiten.forEach((s) => s.url && URL.revokeObjectURL(s.url)), [seiten]);
  useEffect(() => {
    if (busy !== "lesen") return;
    const start = Date.now();
    setSeit(0);
    const id = setInterval(() => setSeit(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);
  // a read or typed text is not lost by closing the tab by mistake
  useEffect(() => {
    if (!geaendert || speichern) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [geaendert, speichern]);

  async function waehle(files: FileList | null) {
    if (!files?.length) return;
    setFehler(null);
    const frei = MAX_HANDSCHRIFT_SEITEN - seiten.length;
    if (files.length > frei) {
      setFehler(`Höchstens ${MAX_HANDSCHRIFT_SEITEN} Seiten auf einmal.`);
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
      const small = pdf ? file : await shrinkImage(file, MAX_SIDE);
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
    if (neu.length) {
      setGezeigt(seiten.length);
      setSeiten((s) => [...s, ...neu]);
    }
  }

  function entferne(i: number) {
    setSeiten((s) => s.filter((_, j) => j !== i));
    setGezeigt((g) => Math.max(0, g >= i ? g - 1 : g));
  }

  async function lesen() {
    if (busy || !seiten.length) return;
    if (geaendert && text.trim() && !window.confirm("Der Text im Feld wird durch die neue Abschrift ersetzt. Weiter?")) return;
    setFehler(null);
    const fd = new FormData();
    fd.set("text", String(textId));
    fd.set("keine_namen", keinName ? "1" : "");
    for (const s of seiten) fd.append("seite", s.file, s.file.name);
    setBusy("lesen");
    try {
      const res = await fetch("/material/handschrift", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { vorschlag?: HandschriftVorschlag; error?: string };
      if (res.ok && data.vorschlag) {
        setText(data.vorschlag.text);
        setHinweise(data.vorschlag.hinweise);
        setGelesen(true);
        requestAnimationFrame(() => feld.current?.focus());
      } else setFehler(data.error ?? (res.status === 401 ? "Du bist abgemeldet. Bitte neu anmelden." : "Das ging nicht. Bitte noch einmal versuchen."));
    } catch {
      setFehler("Keine Verbindung. Die Fotos sind noch hier, bitte noch einmal versuchen.");
    }
    setBusy(null);
  }

  function uebernehmen() {
    setSpeicherFehler(null);
    startSpeichern(async () => {
      const out = await uebernimmVonPapierAction(textId, text, fertig);
      if ("error" in out) setSpeicherFehler(out.error);
      else router.push(out.href);
    });
  }

  const offen = offeneStellen(text);
  const kostet = kosten.grundCent + Math.max(1, seiten.length) * kosten.seiteCent;
  const bild = seiten[Math.min(gezeigt, seiten.length - 1)];

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start" data-testid="handschrift">
      {/* 1 · Fotos */}
      <section className="panel grid gap-4 px-5 py-5 md:px-6 lg:sticky lg:top-4" aria-labelledby="hs-fotos">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="hs-fotos" className="text-[17px] font-semibold">
            Seiten fotografieren
          </h2>
          <span className="num text-[13px] text-ink-3">
            {seiten.length} von {MAX_HANDSCHRIFT_SEITEN}
          </span>
        </div>

        {bild && (
          <div className="overflow-hidden rounded-xl border border-line bg-panel">
            {bild.url ? (
              <a href={bild.url} target="_blank" rel="noreferrer" title="Foto groß ansehen">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen photo */}
                <img src={bild.url} alt={`Seite ${gezeigt + 1}`} className="max-h-[50vh] w-full bg-surface object-contain lg:max-h-[70vh]" data-testid="hs-bild" />
              </a>
            ) : (
              <span className="flex min-h-[160px] w-full flex-col items-center justify-center gap-2 px-3 py-6 text-center text-[13px] text-ink-2">
                <FileText size={28} aria-hidden />
                <span className="break-all">{bild.file.name}</span>
              </span>
            )}
          </div>
        )}
        {seiten.length > 0 && (
          <ul className="flex flex-wrap gap-2" data-testid="hs-seitenliste">
            {seiten.map((s, i) => (
              <li key={s.url ?? `${s.file.name}${i}`} className="relative">
                <button
                  type="button"
                  onClick={() => setGezeigt(i)}
                  className={`flex h-[72px] w-[56px] items-center justify-center overflow-hidden rounded-lg border bg-surface ${i === gezeigt ? "border-accent ring-2 ring-accent/30" : "border-line"}`}
                  aria-label={`Seite ${i + 1} zeigen`}
                  aria-current={i === gezeigt}
                >
                  {s.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen photo
                    <img src={s.url} alt="" className="h-full w-full object-cover object-top" />
                  ) : (
                    <FileText size={20} className="text-accent" aria-hidden />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => entferne(i)}
                  disabled={busy !== null}
                  className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-ink-2 hover:text-red"
                  aria-label={`Seite ${i + 1} entfernen`}
                >
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {seiten.length < MAX_HANDSCHRIFT_SEITEN && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy !== null}
            className={`flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line bg-panel px-5 text-center transition-colors hover:border-ink-3 ${seiten.length ? "min-h-[56px] py-3" : "min-h-[150px] flex-col py-6"}`}
            data-testid="hs-waehlen"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-accent shadow-[var(--shadow-card)]" aria-hidden>
              <Camera size={22} />
            </span>
            <span className="grid gap-0.5">
              <span className="text-[16px] font-semibold">{busy === "vorbereiten" ? "Fotos werden vorbereitet …" : seiten.length ? "Weitere Seite" : "Seiten fotografieren oder auswählen"}</span>
              {!seiten.length && <span className="text-[13px] text-ink-2">Jede Seite gerade, hell und ganz im Bild. Auch ein PDF geht.</span>}
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
          data-testid="hs-datei"
        />

        {kiGrund ? (
          <p className="rounded-xl bg-amber-wash px-4 py-3 text-[14px] text-amber" role="status" data-testid="hs-ki-aus">
            {kiGrund}
          </p>
        ) : (
          <>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-panel px-4 py-3 text-[15px]">
              <input type="checkbox" checked={keinName} onChange={(e) => setKeinName(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" data-testid="hs-keine-namen" />
              <span>Auf den Fotos steht kein echter Name, auch nicht oben im Kopf des Blatts (oder er ist abgedeckt).</span>
            </label>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => void lesen()} disabled={busy !== null || !keinName || !seiten.length} data-testid="hs-lesen">
                <Sparkles size={18} aria-hidden /> {busy === "lesen" ? "KI liest …" : gelesen ? "Noch einmal lesen" : "Mit KI lesen"}
              </button>
              <span className="num text-[13px] text-ink-3" data-testid="hs-kosten">
                {kostet <= 0 ? "kostenlos" : `Schätzung: ${centText(kostet)}${seiten.length > 1 ? ` für ${seiten.length} Seiten` : " je Seite"}`}
              </span>
            </div>
          </>
        )}
        {fehler && (
          <p role="alert" className="rounded-xl bg-red-wash px-4 py-3 text-[14px] text-red" data-testid="hs-fehler">
            {fehler}
          </p>
        )}
        <p className="text-[13px] text-ink-3" role="status" aria-live="polite">
          {busy === "lesen" ? (
            <span className="num">Die KI schreibt Wort für Wort ab. Das dauert meist unter einer Minute ({seit} s).</span>
          ) : kiGrund ? (
            "Du kannst den Text rechts selbst abtippen. Die Fotos helfen dir dabei und werden nicht gespeichert."
          ) : (
            "Die KI sieht nur die Fotos, keinen Namen aus der App. Die Fotos werden nicht gespeichert. Zählt zum monatlichen KI-Budget."
          )}
        </p>
      </section>

      {/* 2 · Text */}
      <section className="panel grid gap-4 px-5 py-5 md:px-6" aria-labelledby="hs-text">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="hs-text" className="text-[17px] font-semibold">
            Text von {name}
          </h2>
          <span className="num text-[13px] text-ink-3" data-testid="hs-woerter">
            {woerter(text).toLocaleString("de-AT")} Wörter
          </span>
        </div>
        {gelesen ? (
          <div className="grid gap-1 rounded-xl bg-amber-wash px-4 py-3 text-[14px] text-amber" role="status" data-testid="hs-hinweise">
            <p className="font-semibold">Wortgetreu abgeschrieben, mit allen Fehlern. Bitte Zeile für Zeile mit dem Foto vergleichen und nur verbessern, was die KI falsch gelesen hat.</p>
            {hinweise.length > 0 && (
              <ul className="grid gap-0.5">
                {hinweise.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-[14px] text-ink-2">
            {kiGrund ? "Tipp den Text genau so ab, wie er auf dem Papier steht, mit allen Fehlern." : "Nach dem Lesen steht der Text hier. Du kannst ihn auch selbst abtippen, genau so, wie er auf dem Papier steht, mit allen Fehlern."} Jeder Absatz und jede eigene Zeile (Absender, Datum, Anrede, Grußformel) steht in einer eigenen Zeile.
          </p>
        )}
        <textarea
          ref={feld}
          className="input"
          // .input sets the height and line height of a textarea; a page of handwriting needs room
          rows={18}
          style={{ lineHeight: 1.6 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          aria-label={`Text von ${name}`}
          placeholder={"Sehr geehrte Frau …,\n\nich habe auf Ihrer Homepage gelesen, …"}
          data-testid="hs-feld"
        />
        {offen > 0 && (
          <p className="text-[14px] text-amber" data-testid="hs-offen">
            {offen === 1 ? `Noch 1 Stelle mit ${UNLESBAR}.` : `Noch ${offen} Stellen mit ${UNLESBAR}.`} Bitte mit dem Foto vergleichen und ergänzen, sonst sieht die Korrektur sie als Fehler.
          </p>
        )}
        {vorhanden.words > 0 && (
          <p className="text-[14px] text-ink-2">Der Text hat schon {vorhanden.words.toLocaleString("de-AT")} Wörter. Beim Übernehmen wird er ersetzt; die jetzige Fassung bleibt unter „Frühere Fassungen“.</p>
        )}
        {!schonFertig && (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[15px]">
            <input type="checkbox" checked={fertig} onChange={(e) => setFertig(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--accent)]" data-testid="hs-fertig" />
            Text als fertig markieren
          </label>
        )}
        {speicherFehler && (
          <p role="alert" className="rounded-xl bg-red-wash px-4 py-3 text-[14px] text-red" data-testid="hs-speicherfehler">
            {speicherFehler}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button type="button" className="btn btn-primary btn-lg" onClick={uebernehmen} disabled={speichern || busy !== null || !text.trim() || !geaendert} data-testid="hs-uebernehmen">
            <Check size={18} aria-hidden /> {speichern ? "Wird übernommen …" : "Als Text übernehmen"}
          </button>
          <span className="text-[13px] text-ink-3">Erst jetzt wird gespeichert. Danach gehen Korrektur, Bewertung und Druck wie bei jedem Text.</span>
        </div>
      </section>
    </div>
  );
}
