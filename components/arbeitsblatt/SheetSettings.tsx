"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import {
  FIELD_LABEL,
  optionsQuery,
  SOLUTION_LABEL,
  SPACE_LABEL,
  type FieldKind,
  type SheetOptions,
  type SolutionMode,
  type Space,
} from "@/lib/arbeitsblatt";

type Props = {
  options: SheetOptions;
  defaultTitle: string;
  /** page path; extra query pairs (e.g. the chosen library entries) are kept */
  path: string;
  extra: [string, string][];
  back: { href: string; label: string };
  taskCount: number;
};

const CHECKS: [keyof SheetOptions, string][] = [
  ["name", "Name"],
  ["date", "Datum"],
  ["subject", "Fach"],
  ["klasse", "Schulart/Klasse"],
  ["topic", "Thema"],
  ["skill", "Fähigkeit"],
  ["numbers", "Aufgaben nummerieren"],
  ["pages", "Seitenzahlen"],
];

/** Settings beside the preview. Every change reloads the sheet; printing is one click. */
export function SheetSettings({
  options,
  defaultTitle,
  path,
  extra,
  back,
  taskCount,
}: Props) {
  const router = useRouter();
  const [o, setO] = useState(options);
  const [pending, start] = useTransition();
  const apply = (next: SheetOptions) => {
    setO(next);
    const q = optionsQuery(next, defaultTitle, extra);
    start(() => router.replace(q ? `${path}?${q}` : path, { scroll: false }));
  };
  const set = <K extends keyof SheetOptions>(k: K, v: SheetOptions[K]) =>
    apply({
      ...o,
      [k]: v,
      ...(k === "solutions" && v !== "lehrer" ? { fassung: "schueler" } : {}),
    });

  return (
    <div className="ab-controls no-print" aria-busy={pending}>
      <Link
        href={back.href}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-medium text-ink-2 hover:text-accent"
      >
        <ArrowLeft size={16} aria-hidden /> {back.label}
      </Link>
      <h1 className="mt-1 text-[20px] font-semibold">Arbeitsblatt</h1>
      <p className="mb-4 text-[13px] text-ink-3">
        A4 · {taskCount} {taskCount === 1 ? "Aufgabe" : "Aufgaben"}
      </p>

      {o.solutions === "lehrer" && (
        <div
          className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-panel p-1"
          role="group"
          aria-label="Fassung"
        >
          {(["schueler", "lehrer"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={o.fassung === f}
              onClick={() => set("fassung", f)}
              className={`min-h-[44px] rounded-lg text-[14px] font-semibold ${o.fassung === f ? "bg-surface shadow-sm" : "text-ink-2"}`}
            >
              {f === "schueler" ? "Schülerblatt" : "Lehrerfassung"}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary btn-lg w-full"
        onClick={() => window.print()}
        disabled={pending}
      >
        <Printer size={18} aria-hidden />{" "}
        {o.fassung === "lehrer" ? "Lehrerfassung drucken" : "Drucken / PDF"}
      </button>
      <p className="mt-2 mb-6 text-[12px] text-ink-3">
        Im Druckfenster „Als PDF speichern“ wählen, um eine PDF-Datei zu
        bekommen.
      </p>

      <div className="grid gap-4">
        <label className="field">
          <span className="label">Titel</span>
          <input
            className="input"
            defaultValue={o.title}
            key={o.title}
            maxLength={140}
            onBlur={(e) =>
              e.target.value.trim() !== o.title &&
              set("title", e.target.value.trim() || defaultTitle)
            }
            onKeyDown={(e) =>
              e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()
            }
          />
        </label>
        <label className="field">
          <span className="label">Lösungen</span>
          <select
            className="input"
            value={o.solutions}
            onChange={(e) => set("solutions", e.target.value as SolutionMode)}
          >
            {(Object.keys(SOLUTION_LABEL) as SolutionMode[]).map((k) => (
              <option key={k} value={k}>
                {SOLUTION_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            <span className="label">Platz</span>
            <select
              className="input"
              value={o.space}
              onChange={(e) => set("space", e.target.value as Space)}
            >
              {(Object.keys(SPACE_LABEL) as Space[]).map((k) => (
                <option key={k} value={k}>
                  {SPACE_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Rechenfeld</span>
            <select
              className="input"
              value={o.field}
              onChange={(e) => set("field", e.target.value as FieldKind)}
            >
              {(Object.keys(FIELD_LABEL) as FieldKind[]).map((k) => (
                <option key={k} value={k}>
                  {FIELD_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend className="label mb-1">Anzeigen</legend>
          <div className="grid grid-cols-2 gap-x-3">
            {CHECKS.map(([k, label]) => (
              <label
                key={k}
                className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px]"
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                  checked={Boolean(o[k])}
                  onChange={(e) => set(k, e.target.checked as never)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
