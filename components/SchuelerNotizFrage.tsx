"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, MessageSquareText, PenLine } from "lucide-react";
import { notizSpeichernAction, notizUeberspringenAction, wunschSpeichernAction, type NotizState } from "@/app/schueler-notiz-actions";
import { NOTIZ_AUSWAHL, NOTIZ_TEXT_MAX, notizLabel, type NotizWahl } from "@/lib/schueler-notiz-auswahl";

type Props = {
  token: string;
  unitId: number;
  /** „heute“, „gestern“ oder „am Dienstag, 20. Oktober“ */
  wann: string;
  notiz: { auswahl: NotizWahl[]; text: string; uebersprungen: boolean } | null;
};

const zurEinheit = (wann: string) => (wann === "heute" || wann === "gestern" ? `von ${wann}` : wann);

/**
 * „Was war heute schwer?“ in der Schüler-App, nach einer Einheit: einmal als Frage, danach als die eigene Notiz
 * zum Ändern (bis die nächste Einheit beginnt) oder, übersprungen, als Link zum Schreiben.
 */
export function SchuelerNotizFrage({ token, unitId, wann, notiz }: Props) {
  const hat = Boolean(notiz && (notiz.auswahl.length || notiz.text));
  const [offen, setOffen] = useState(false);
  const [fertig, setFertig] = useState(false);

  if (!notiz) {
    return (
      <section className="panel mt-8 px-5 py-5 md:px-6" aria-labelledby="notiz-frage" data-testid="notiz-frage">
        <h2 id="notiz-frage" className="flex items-center gap-2 text-[19px] font-semibold">
          <MessageSquareText size={19} className="shrink-0 text-accent" aria-hidden /> Was war {wann} schwer?
        </h2>
        <p className="mt-1 text-[15px] text-ink-2">Tipp an, was passt, oder schreib es kurz auf. Das hilft bei deiner nächsten Einheit.</p>
        <NotizForm token={token} unitId={unitId} notiz={null} ueberspringen fertig={() => setFertig(true)} />
      </section>
    );
  }

  if (!hat && !offen) {
    return (
      <p className="mt-6">
        <button type="button" className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-semibold text-accent" onClick={() => setOffen(true)}>
          <PenLine size={16} aria-hidden /> Notiz zur Einheit {zurEinheit(wann)} schreiben
        </button>
      </p>
    );
  }

  return (
    <section className="panel mt-8 px-5 py-5 md:px-6" aria-labelledby="notiz-eigene" data-testid="notiz-eigene">
      <h2 id="notiz-eigene" className="flex items-center gap-2 text-[17px] font-semibold">
        <MessageSquareText size={18} className="shrink-0 text-accent" aria-hidden /> {hat ? `Deine Notiz zur Einheit ${zurEinheit(wann)}` : `Was war ${wann} schwer?`}
      </h2>
      {fertig && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[15px] font-medium text-green" role="status">
          <Check size={16} aria-hidden /> Danke, gespeichert.
        </p>
      )}
      {offen ? (
        <NotizForm
          token={token}
          unitId={unitId}
          notiz={notiz}
          fertig={() => {
            setOffen(false);
            setFertig(true);
          }}
        />
      ) : (
        <>
          {notiz.auswahl.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {notiz.auswahl.map((w) => (
                <li key={w} className="rounded-full bg-accent-wash px-3 py-1 text-[14px] font-medium text-accent">
                  {notizLabel(w)}
                </li>
              ))}
            </ul>
          )}
          {notiz.text && <p className="mt-3 text-[16px] whitespace-pre-line">{notiz.text}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setOffen(true);
                setFertig(false);
              }}
            >
              <PenLine size={14} aria-hidden /> Ändern
            </button>
            <span className="text-[13px] text-ink-3">Du kannst sie bis zur nächsten Einheit ändern.</span>
          </div>
        </>
      )}
    </section>
  );
}

function NotizForm({ token, unitId, notiz, ueberspringen, fertig }: { token: string; unitId: number; notiz: Props["notiz"]; ueberspringen?: boolean; fertig?: () => void }) {
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set(notiz?.auswahl ?? []));
  const [state, action, pending] = useActionState(async (prev: NotizState, f: FormData) => {
    const out = await notizSpeichernAction(token, unitId, prev, f);
    if (out && "ok" in out) fertig?.();
    return out;
  }, null);
  const [skipping, skip] = useTransition();
  const [skipFehler, setSkipFehler] = useState<string | null>(null);
  const tippe = (k: string, an: boolean) =>
    setAuswahl((cur) => {
      const neu = new Set(cur);
      if (!an) neu.delete(k);
      else if (k === "nichts") return new Set(["nichts"]);
      else {
        neu.delete("nichts");
        neu.add(k);
      }
      return neu;
    });
  const fehler = (state && "fehler" in state ? state.fehler : null) ?? skipFehler;
  return (
    <form action={action} className="mt-4 grid gap-4">
      <fieldset>
        <legend className="sr-only">Was war schwer?</legend>
        <div className="flex flex-wrap gap-2">
          {NOTIZ_AUSWAHL.map(([k, label]) => (
            <label
              key={k}
              className="drueck inline-flex min-h-[44px] cursor-pointer items-center rounded-full border border-line-strong bg-surface px-4 text-[15px] font-medium transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-on-fill has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-bright"
            >
              <input type="checkbox" name="auswahl" value={k} className="sr-only" checked={auswahl.has(k)} onChange={(e) => tippe(k, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span className="label">Was genau? (freiwillig)</span>
        <textarea name="text" className="input min-h-[84px]" defaultValue={notiz?.text ?? ""} maxLength={NOTIZ_TEXT_MAX} placeholder="z. B. das Kürzen bei den Brüchen" />
      </label>
      {fehler && (
        <p className="text-[15px] text-red" role="alert">
          {fehler}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pending || skipping}>
          {pending ? "Wird gespeichert …" : "Speichern"}
        </button>
        {ueberspringen && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending || skipping}
            onClick={() =>
              skip(async () => {
                const out = await notizUeberspringenAction(token, unitId);
                setSkipFehler(out && "fehler" in out ? out.fehler : null);
              })
            }
          >
            Überspringen
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * „Für nächstes Mal“ in der Schüler-App, jederzeit: was drankommen soll oder was er in der Schule gerade nicht
 * versteht. Änderbar, bis die nächste Einheit beginnt; leer gespeichert ist es weg.
 */
export function NaechstesMal({ token, text }: { token: string; text: string | null }) {
  const [offen, setOffen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: NotizState, f: FormData) => {
    const out = await wunschSpeichernAction(token, prev, f);
    if (out && "ok" in out) setOffen(false);
    return out;
  }, null);
  const fehler = state && "fehler" in state ? state.fehler : null;
  return (
    <section className="panel mt-8 px-5 py-5 md:px-6" aria-labelledby="naechstes-mal" data-testid="naechstes-mal">
      <h2 id="naechstes-mal" className="flex items-center gap-2 text-[18px] font-semibold">
        <PenLine size={18} className="shrink-0 text-accent" aria-hidden /> Für nächstes Mal
      </h2>
      {offen ? (
        <form action={action} className="mt-3 grid gap-3">
          <label className="field">
            <span className="label">Was soll drankommen? Was verstehst du in der Schule gerade nicht?</span>
            <textarea
              name="text"
              className="input min-h-[96px]"
              defaultValue={text ?? ""}
              maxLength={NOTIZ_TEXT_MAX}
              placeholder="z. B. Wir haben die vier Fälle begonnen. Den 3. und 4. Fall verstehe ich nicht."
              autoFocus
            />
          </label>
          {fehler && (
            <p className="text-[15px] text-red" role="alert">
              {fehler}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" disabled={pending}>
              {pending ? "Wird gespeichert …" : "Speichern"}
            </button>
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setOffen(false)}>
              Abbrechen
            </button>
          </div>
        </form>
      ) : text ? (
        <>
          <p className="mt-2 text-[16px] whitespace-pre-line">{text}</p>
          {state && "ok" in state && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[15px] font-medium text-green" role="status">
              <Check size={16} aria-hidden /> Danke, gespeichert.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOffen(true)}>
              <PenLine size={14} aria-hidden /> Ändern
            </button>
            <span className="text-[13px] text-ink-3">Du kannst es bis zur nächsten Einheit ändern.</span>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-[15px] text-ink-2">Was soll drankommen? Was verstehst du in der Schule gerade nicht? Schreib es auf, dann ist es bei der Vorbereitung deiner nächsten Einheit dabei.</p>
          <button type="button" className="btn btn-secondary mt-3" onClick={() => setOffen(true)}>
            Aufschreiben
          </button>
        </>
      )}
    </section>
  );
}
