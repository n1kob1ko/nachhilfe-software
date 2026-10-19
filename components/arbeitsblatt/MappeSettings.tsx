"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { MAPPE_CHECKS, mappeQuery, type MappeOptionen } from "@/lib/mappe-druck";

type Props = {
  options: MappeOptionen;
  defaultTitle: string;
  path: string;
  back: { href: string; label: string };
  /** was es in dieser Einheit gibt; Häkchen für Dinge, die es nicht gibt, bleiben weg */
  inhalt: { uebungen: number; aufgaben: number; offen: number; texte: number; tafel: number };
};

/** Einstellungen neben der A4-Vorschau der Mappe (wie beim Arbeitsblatt und beim Text). */
export function MappeSettings({ options, defaultTitle, path, back, inhalt }: Props) {
  const router = useRouter();
  const [o, setO] = useState(options);
  const [pending, start] = useTransition();
  const set = <K extends keyof MappeOptionen>(k: K, v: MappeOptionen[K]) => {
    const next = { ...o, [k]: v };
    setO(next);
    const q = mappeQuery(next, defaultTitle);
    start(() => router.replace(q ? `${path}?${q}` : path, { scroll: false }));
  };
  const fehlt: Partial<Record<keyof MappeOptionen, boolean>> = {
    marks: inhalt.aufgaben === 0,
    solutions: inhalt.aufgaben === 0 || !o.marks,
    open: inhalt.offen === 0,
    texts: inhalt.texte === 0,
    board: inhalt.tafel === 0,
  };
  const teile = [
    inhalt.uebungen > 0 && `${inhalt.uebungen} ${inhalt.uebungen === 1 ? "Übung" : "Übungen"}`,
    inhalt.texte > 0 && `${inhalt.texte} ${inhalt.texte === 1 ? "Text" : "Texte"}`,
    inhalt.tafel > 0 && `${inhalt.tafel} ${inhalt.tafel === 1 ? "Whiteboard-Seite" : "Whiteboard-Seiten"}`,
  ].filter(Boolean) as string[];
  return (
    <div className="ab-controls no-print" aria-busy={pending}>
      <Link href={back.href} className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-medium text-ink-2 hover:text-accent">
        <ArrowLeft size={16} aria-hidden /> {back.label}
      </Link>
      <h1 className="mt-1 text-[20px] font-semibold">Mappe drucken</h1>
      <p className="mb-4 text-[13px] text-ink-3">A4 Hochformat{teile.length > 0 && ` · ${teile.join(", ")}`}</p>
      <button type="button" className="btn btn-primary btn-lg w-full" onClick={() => window.print()} disabled={pending} data-testid="mappe-drucken">
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
        <fieldset>
          <legend className="label mb-1">Anzeigen</legend>
          <div className="grid gap-x-3">
            {MAPPE_CHECKS.filter(([k]) => !fehlt[k]).map(([k, param, label]) => (
              <label key={k} className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px]">
                <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--accent)]" checked={o[k]} onChange={(e) => set(k, e.target.checked)} data-testid={`mappe-${param}`} />
                {label}
                {k === "open" && <span className="num text-ink-3">({inhalt.offen})</span>}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
