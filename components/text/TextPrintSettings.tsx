"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { SPACING_LABEL, TEXT_PRINT_CHECKS, textPrintQuery, type Spacing, type TextPrintOptions } from "@/lib/text-print";

type Props = { options: TextPrintOptions; defaultTitle: string; path: string; back: { href: string; label: string }; words: number };

/** Settings beside the A4 preview of a text (the same layout as the worksheet settings). */
export function TextPrintSettings({ options, defaultTitle, path, back, words }: Props) {
  const router = useRouter();
  const [o, setO] = useState(options);
  const [pending, start] = useTransition();
  const set = <K extends keyof TextPrintOptions>(k: K, v: TextPrintOptions[K]) => {
    const next = { ...o, [k]: v };
    setO(next);
    const q = textPrintQuery(next, defaultTitle);
    start(() => router.replace(q ? `${path}?${q}` : path, { scroll: false }));
  };
  return (
    <div className="ab-controls no-print" aria-busy={pending}>
      <Link href={back.href} className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-medium text-ink-2 hover:text-accent">
        <ArrowLeft size={16} aria-hidden /> {back.label}
      </Link>
      <h1 className="mt-1 text-[20px] font-semibold">Text drucken</h1>
      <p className="mb-4 text-[13px] text-ink-3">
        A4 Hochformat · <span className="num">{words.toLocaleString("de-AT")}</span> {words === 1 ? "Wort" : "Wörter"}
      </p>
      <button type="button" className="btn btn-primary btn-lg w-full" onClick={() => window.print()} disabled={pending}>
        <Printer size={18} aria-hidden /> Drucken / PDF
      </button>
      <p className="mt-2 mb-6 text-[12px] text-ink-3">Im Druckfenster „Als PDF speichern“ wählen, um eine PDF-Datei zu bekommen.</p>
      <div className="grid gap-4">
        <label className="field">
          <span className="label">Titel</span>
          <input
            className="input"
            defaultValue={o.title}
            key={o.title}
            maxLength={140}
            onBlur={(e) => e.target.value.trim() !== o.title && set("title", e.target.value.trim() || defaultTitle)}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          />
        </label>
        <label className="field">
          <span className="label">Zeilenabstand</span>
          <select className="input" value={o.spacing} onChange={(e) => set("spacing", e.target.value as Spacing)}>
            {(Object.keys(SPACING_LABEL) as Spacing[]).map((k) => (
              <option key={k} value={k}>
                {SPACING_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="label mb-1">Anzeigen</legend>
          <div className="grid gap-x-3">
            {TEXT_PRINT_CHECKS.map(([k, , label]) => (
              <label key={k} className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px]">
                <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--accent)]" checked={o[k]} onChange={(e) => set(k, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
