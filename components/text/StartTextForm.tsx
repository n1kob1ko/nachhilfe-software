"use client";

import { useActionState, useState } from "react";
import { Camera, PenLine } from "lucide-react";
import { startTextAction, type StartTextState } from "@/app/text-actions";

type Props = { unitId: number; subject: string; subjects: string[]; kinds: string[]; device: "laptop" | "tablet" | null; name: string };

/** Titel, Fach, Textsorte and Aufgabenstellung of a new Textarbeit; it opens on the tablet by default. */
export function StartTextForm({ unitId, subject, subjects, kinds, device, name }: Props) {
  const [state, action, pending] = useActionState<StartTextState, FormData>(startTextAction.bind(null, unitId), null);
  const [wo, setWo] = useState<"geraet" | "papier">("geraet");
  return (
    <form action={action} className="grid gap-5">
      <label className="field">
        <span className="label">Titel</span>
        <input className="input" name="title" required maxLength={140} autoFocus placeholder="z. B. Mein aufregender Ausflug" />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="field">
          <span className="label">Fach</span>
          <input className="input" name="subject" list="text-subjects" maxLength={60} defaultValue={subject} />
          <datalist id="text-subjects">
            {subjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span className="label">Textsorte</span>
          <input className="input" name="topic" list="text-kinds" maxLength={80} placeholder="z. B. Erlebniserzählung" />
          <datalist id="text-kinds">
            {kinds.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </label>
      </div>
      <label className="field">
        <span className="label">Aufgabenstellung</span>
        <textarea className="input" name="prompt" rows={4} maxLength={4000} placeholder="z. B. Erzähle von einem Ausflug, bei dem etwas Unerwartetes passiert ist. Achte auf Einleitung, Höhepunkt und Schluss." />
      </label>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="label mb-2">Wo schreibt {name}?</legend>
        {(
          [
            ["geraet", "Am Gerät", device ? `Am ${device === "laptop" ? "Laptop" : "Tablet"} von ${name} oder hier.` : "Hier an diesem Gerät."],
            ["papier", "Auf Papier", "Danach fotografierst du die Seiten und übernimmst den Text."],
          ] as const
        ).map(([wert, label, text]) => (
          <label
            key={wert}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-line-hover has-[:checked]:border-accent has-[:checked]:bg-accent-wash has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
          >
            <input type="radio" name="wo" value={wert} checked={wo === wert} onChange={() => setWo(wert)} className="mt-1 h-[18px] w-[18px] shrink-0 accent-[var(--accent)]" data-testid={`text-wo-${wert}`} />
            <span className="grid gap-0.5">
              <span className="text-[15px] font-semibold">{label}</span>
              <span className="text-[13px] text-ink-2">{text}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {wo === "papier" ? (
        <p className="text-[14px] text-ink-2">Nach dem Start öffnet sich „Vom Foto übernehmen“. Ohne KI tippst du den Text dort selbst ab.</p>
      ) : device ? (
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[15px]">
          <input type="checkbox" name="tablet" value="1" defaultChecked className="h-5 w-5 accent-[var(--accent)]" />
          Gleich am {device === "laptop" ? "Laptop" : "Tablet"} von {name} öffnen
        </label>
      ) : (
        <p className="text-[14px] text-ink-2">Kein Schülergerät verbunden: Der Text öffnet sich hier, {name} schreibt an diesem Gerät.</p>
      )}
      {state?.error && (
        <p className="text-[14px] text-red" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <button className="btn btn-primary btn-lg" disabled={pending}>
          {wo === "papier" ? <Camera size={18} aria-hidden /> : <PenLine size={18} aria-hidden />} {pending ? "Wird gestartet …" : wo === "papier" ? "Starten und Fotos übernehmen" : "Textarbeit starten"}
        </button>
      </div>
    </form>
  );
}
