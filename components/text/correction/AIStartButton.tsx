"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ShieldCheck, Sparkles, X } from "lucide-react";
import { startAICorrectionAction, startThoroughRecheckAction, type StartState } from "@/app/correction-actions";
import { Info } from "@/components/Info";
import { WasFehlt } from "@/components/text/bewertung/WasFehlt";
import type { AufgabeVorschau } from "@/lib/schreibauftrag-bewertung";
import { parseNames } from "@/lib/name-detection";
import { maskText, namePattern } from "@/lib/text-correction-core";

export type AIPreview = {
  /** "Anthropic" */
  provider: string;
  model: string;
  enabled: boolean;
  /** why the KI cannot run (no key, too short, too long) */
  blocked: string | null;
  words: number;
  /** estimated cost in US dollars: one request, and the two of „gründlich“ */
  costUsd: number;
  costThoroughUsd: number;
  /** what is preselected (AI_TEXT_METHOD) */
  method: "einfach" | "gruendlich";
  /** the paragraphs as they are sent, the names of the student and the teachers replaced (the further names are replaced here) */
  masked: string[];
  /** whose names are replaced */
  hidden: string;
  /** further names: those the app found in the text (and those the teacher added before) */
  names: string[];
  /** the ones ticked at first */
  kept: string[];
  /** Bildgeschichte: the teacher's short descriptions of the pictures (sent instead of the pictures) */
  pictures?: string[] | null;
};

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" disabled={disabled || pending} data-testid="ki-senden">
      <Sparkles size={16} aria-hidden /> {pending ? "Wird gestartet …" : "An die KI senden"}
    </button>
  );
}

/**
 * „Korrigieren“: nothing is sent before the teacher has seen what goes out, to whom, and ticked the box. Without a key
 * (or for a text that is too short or long) the button explains why it is off. With `aufgabe` the same click also
 * starts „Aufgabe erfüllt?“ (lib/schreibauftrag-bewertung.ts): the dialog adds what goes out for it, what is missing
 * („Was fehlt“, from the app) and its cost to the sum.
 */
export function AIStartButton({
  textId,
  preview,
  label = "Mit KI korrigieren",
  variant = "primary",
  recheck,
  aufgabe,
}: {
  textId: number;
  preview: AIPreview;
  label?: string;
  variant?: "primary" | "secondary";
  /** „Gründlich nachprüfen“ of this correction instead of a new start */
  recheck?: number;
  /** „Aufgabe erfüllt?“ with the same click, when it is not done for this version yet */
  aufgabe?: AufgabeVorschau;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [ok, setOk] = useState(false);
  const [method, setMethod] = useState(recheck ? "gruendlich" : preview.method);
  const [kept, setKept] = useState(preview.kept);
  const [extra, setExtra] = useState("");
  // the text exactly as it goes out: the further names the teacher keeps and adds replaced as on the server
  const pattern = useMemo(() => namePattern([...kept, ...parseNames(extra)]), [kept, extra]);
  const shown = useMemo(() => preview.masked.map((m) => maskText(m, pattern).masked), [preview.masked, pattern]);
  const shownPictures = useMemo(() => preview.pictures?.map((c) => maskText(c, pattern).masked) ?? null, [preview.pictures, pattern]);
  const [state, action] = useActionState<StartState, FormData>(recheck ? startThoroughRecheckAction.bind(null, recheck) : startAICorrectionAction.bind(null, textId), null);
  const off = !preview.enabled || Boolean(preview.blocked);
  const centsOf = (usd: number) => Math.max(1, Math.round(usd * 100));
  const sprache = centsOf(method === "gruendlich" ? preview.costThoroughUsd : preview.costUsd);
  // „Aufgabe erfüllt?“ goes along only when there is something to check and it is not done for this version
  const mitAufgabe = Boolean(aufgabe && !recheck && aufgabe.pruefbar && !aufgabe.schonDa && !aufgabe.grund);
  const aufgabeCents = mitAufgabe && aufgabe ? centsOf(aufgabe.costUsd) : 0;
  const cents = sprache + aufgabeCents;
  return (
    <>
      <button type="button" className={`btn ${variant === "primary" ? "btn-primary" : "btn-secondary"} w-full sm:w-auto`} disabled={off} onClick={() => dialog.current?.showModal()} data-testid="ki-korrigieren">
        <Sparkles size={16} aria-hidden /> {label}
      </button>
      {off && <p className="mt-1.5 text-[13px] text-ink-2">{preview.blocked ?? "Die KI ist nicht eingerichtet (kein API-Schlüssel). Du kannst den Text selbst korrigieren."}</p>}
      {state?.error && (
        <p className="mt-1.5 text-[13px] text-red" role="alert">
          {state.error}
        </p>
      )}
      <dialog ref={dialog} className="m-auto w-[min(620px,calc(100vw-24px))] rounded-3xl border border-line bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-black/30" aria-labelledby={`ki-titel-${textId}`} data-testid="ki-freigabe">
        <form action={action} className="grid gap-4 px-6 py-5">
          {mitAufgabe && <input type="hidden" name="aufgabe" value="1" />}
          <div className="flex items-start justify-between gap-3">
            <h2 id={`ki-titel-${textId}`} className="text-[20px] font-semibold">
              Text an die KI senden?
            </h2>
            <button type="button" className="btn btn-ghost -mr-3 !px-3" aria-label="Schließen" onClick={() => dialog.current?.close()}>
              <X size={18} aria-hidden />
            </button>
          </div>
          <div className="grid gap-3 text-[15px]">
            <div>
              <p className="font-semibold">Gesendet wird</p>
              <ul className="mt-1 list-disc pl-5 text-ink-2">
                <li>
                  der Text dieser Fassung (<span className="num">{preview.words.toLocaleString("de-AT")}</span> Wörter); {preview.hidden} werden durch [Name] ersetzt
                </li>
                <li>Fach, Schulstufe, Textsorte und Aufgabenstellung</li>
                {preview.pictures && <li>die kurzen Bildbeschreibungen ({preview.pictures.length} Bilder), nicht die Bilder selbst</li>}
                {mitAufgabe && aufgabe && (
                  <li data-testid="ki-aufgabe-gesendet">
                    für „Aufgabe und Note“: die {aufgabe.punkte.length === 1 ? "Aufgabenstellung als ein Auftrag" : `${aufgabe.punkte.length} Arbeitsaufträge`}
                    {aufgabe.vorlage ? `, ${aufgabe.vorlage}` : ""}
                    {aufgabe.art === "schreibauftrag" ? " und der Erwartungshorizont" : ""}
                  </li>
                )}
              </ul>
            </div>
            <div>
              <p className="font-semibold">Nicht gesendet</p>
              <p className="text-ink-2">Name des Schülers, Notizen, Lernverlauf, Noten{preview.pictures ? ", die Bilder" : ""}.</p>
            </div>
            {aufgabe && !recheck && (
              <div className="grid gap-2" data-testid="ki-aufgabe">
                <p className="font-semibold">Aufgabe und Note</p>
                {aufgabe.schonDa ? (
                  <p className="text-[14px] text-ink-2">Für diese Fassung schon geprüft. Sie wird nicht noch einmal gesendet.</p>
                ) : aufgabe.grund && aufgabe.pruefbar ? (
                  <p className="text-[14px] text-ink-2">Wird diesmal nicht geprüft: {aufgabe.grund}</p>
                ) : mitAufgabe ? (
                  <p className="text-[14px] text-ink-2">Die KI prüft je Arbeitsauftrag, ob er erfüllt ist, und schlägt eine Stufe je Kriterium und eine Note vor. Sie gilt erst, wenn du sie übernimmst. Der Text wird nicht umgeschrieben.</p>
                ) : null}
                {!aufgabe.schonDa && <WasFehlt zeilen={aufgabe.zeilen} titel="Was fehlt" />}
              </div>
            )}
            <p className="rounded-xl bg-panel px-4 py-3 text-[14px]">
              Empfänger: <b>{preview.provider}</b> · Modell <span className="font-mono text-[13px]">{preview.model}</span>
              {mitAufgabe && aufgabe && aufgabe.model !== preview.model && (
                <>
                  {" "}
                  (Aufgabe: <b>{aufgabe.provider}</b> · <span className="font-mono text-[13px]">{aufgabe.model}</span>)
                </>
              )}{" "}
              · etwa <span className="num" data-testid="ki-kosten">{cents}</span> US-Cent
              {mitAufgabe && (
                <span className="text-ink-2">
                  {" "}
                  (Sprache <span className="num">{sprache}</span>, Aufgabe <span className="num">{aufgabeCents}</span>)
                </span>
              )}
              <Info label="Info zum Datenschutz" align="right">
                Der Anbieter verarbeitet den Text, um die Korrektur zu erstellen. Vor dem Einsatz mit echten Schülertexten müssen Auftragsverarbeitung, Bedingungen des Anbieters und die Einwilligung (bzw. Rechtsgrundlage) geklärt sein. Ohne KI kannst du jederzeit selbst korrigieren.
              </Info>
            </p>
            {recheck ? (
              <p className="text-[14px] text-ink-2">
                Die KI prüft den Text Satz für Satz, eine zweite Anfrage kontrolliert jeden Vorschlag. Offene KI-Vorschläge werden ersetzt, deine Entscheidungen bleiben.
              </p>
            ) : (
              <fieldset className="grid gap-2" data-testid="ki-verfahren">
                <legend className="mb-1 font-semibold">{aufgabe ? "Prüfung der Sprache" : "Prüfung"}</legend>
                {(
                  [
                    ["einfach", "Normal", "eine Anfrage", preview.costUsd],
                    ["gruendlich", "Gründlich", "Satz für Satz, dann prüft eine zweite Anfrage jeden Vorschlag", preview.costThoroughUsd],
                  ] as const
                ).map(([v, name, what, usd]) => (
                  <label key={v} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-2">
                    <input type="radio" name="method" value={v} checked={method === v} onChange={() => setMethod(v)} className="h-5 w-5 shrink-0 accent-[var(--accent)]" />
                    <span>
                      <b>{name}</b> <span className="text-ink-2">· {what} · etwa <span className="num">{centsOf(usd)}</span> US-Cent</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            <div data-testid="ki-namen">
              <input type="hidden" name="names" value="1" />
              <p className="font-semibold">Weitere Namen</p>
              {preview.names.length ? (
                <>
                  <p className="text-[14px] text-ink-2">Werden auch durch [Name] ersetzt. Ist ein Wort kein Name, nimm das Häkchen weg.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {preview.names.map((n) => (
                      <label key={n} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-line px-3 text-[14px]">
                        <input
                          type="checkbox"
                          name="name"
                          value={n}
                          checked={kept.includes(n)}
                          onChange={(e) => setKept((k) => (e.target.checked ? [...k, n] : k.filter((x) => x !== n)))}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                        {n}
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[14px] text-ink-2">Die App hat keine weiteren Namen gefunden.</p>
              )}
              <input
                name="extra"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                className="input mt-2"
                placeholder="Fehlt ein Name? Hier eintragen, mit Komma getrennt"
                aria-label="Weitere Namen eintragen"
                data-testid="ki-namen-extra"
              />
              <p className="mt-1.5 text-[14px] text-amber">Die App kann Namen übersehen und erkennt keine Orte oder Adressen. Bitte den gesendeten Text durchsehen.</p>
              {mitAufgabe && aufgabe?.vorlage && aufgabe.art !== "bildgeschichte" && (
                <p className="mt-1.5 text-[14px] text-ink-2">Für „Aufgabe erfüllt?“ bleiben Namen stehen, die auch in {aufgabe.vorlage} vorkommen, damit sich Zitate daraus finden lassen.</p>
              )}
            </div>
            <details className="reveal">
              <summary>Gesendeten Text ansehen</summary>
              <div className="mt-2 max-h-[240px] overflow-y-auto rounded-xl border border-line px-4 py-3 text-[14px] whitespace-pre-wrap" data-testid="ki-vorschau">
                {shown.map((m, i) => (
                  <p key={i} className="mb-2">
                    {m}
                  </p>
                ))}
                {shownPictures && (
                  <div className="mt-3 border-t border-line pt-2 text-ink-2" data-testid="ki-vorschau-bilder">
                    {shownPictures.map((c, i) => (
                      <p key={i}>{c}</p>
                    ))}
                  </div>
                )}
              </div>
            </details>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-line-strong px-4 py-2">
              <input type="checkbox" name="consent" value="1" className="h-5 w-5 shrink-0 accent-[var(--accent)]" checked={ok} onChange={(e) => setOk(e.target.checked)} data-testid="ki-einwilligung" />
              <span>
                <ShieldCheck size={16} className="mr-1 inline text-green" aria-hidden />
                Ich habe den Text geprüft und gebe ihn für diese Korrektur frei.
              </span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Submit disabled={!ok} />
            <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()}>
              Abbrechen
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
