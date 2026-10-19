import type { ChangeEventHandler, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { Skill } from "@/lib/repo";

/**
 * Pieces of „Stoff zuordnen“ (lib/lehrplan.ts stoffVorschlag), used by the exam form on the profile and by the
 * Vorbereitung: per topic of the Stoff a row with the suggested skills as chips, the sure ones ticked. Form fields
 * (read by zuordnungAus in app/curriculum-actions.ts): `stoff_thema` per row in order, `stoff_<i>` the ticked
 * skills of row i, `stoff_auto_<i>` what was ticked as a suggestion.
 */
export function StoffZeile({ topic, index, auto, children }: { topic: string; index: number; auto: string[]; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-3" data-testid="stoff-zeile">
      <input type="hidden" name="stoff_thema" value={topic} />
      <input type="hidden" name={`stoff_auto_${index}`} value={auto.join(",")} />
      <p className="text-[14px] font-medium sm:pt-2">{topic}</p>
      <div className="flex min-w-0 flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/**
 * The chips of a row: the ticked suggestions in view, the other suggestions behind „Andere“ so a long Stoff stays
 * short. Without a ticked one all suggestions are in view.
 */
export function StoffWahl({ sichtbar, weitere }: { sichtbar: ReactNode[]; weitere: ReactNode[] }) {
  if (!sichtbar.length) return <>{weitere}</>;
  return (
    <>
      {sichtbar}
      {weitere.length > 0 && (
        <details className="group w-full">
          <summary className="inline-flex min-h-[32px] cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-accent [&::-webkit-details-marker]:hidden">
            <ChevronDown size={14} aria-hidden className="transition-transform group-open:rotate-180" /> Andere ({weitere.length})
          </summary>
          <div className="mt-1 flex flex-wrap gap-1.5">{weitere}</div>
        </details>
      )}
    </>
  );
}

/** The Thema most ticked skills belong to: chips of it need not repeat it. */
export function hauptThema(rows: { skills: { id: string; area: string }[]; best: string[] }[]): string | null {
  const count = new Map<string, number>();
  for (const r of rows) for (const s of r.skills) if (r.best.includes(s.id)) count.set(s.area, (count.get(s.area) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** A suggested skill to tick. Controlled (`checked`, `onChange`) in the exam form, `defaultChecked` on the server. */
export function StoffChip({
  name,
  value,
  label,
  area,
  checked,
  defaultChecked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  area?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <label className="flex min-h-[38px] min-w-0 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13.5px] has-checked:border-accent has-checked:bg-accent-wash">
      <input type="checkbox" name={name} value={value} checked={checked} defaultChecked={defaultChecked} onChange={onChange} className="shrink-0 accent-[var(--accent)]" />
      <span className="min-w-0">
        {label}
        {area && <span className="text-ink-3"> · {area}</span>}
      </span>
    </label>
  );
}

/** Any skill of the student's level, by Thema: for a topic without a suggestion or one more skill. */
export function FaehigkeitWaehlen({ name, pool, label, placeholder = "Fähigkeit wählen …" }: { name: string; pool: Skill[]; label: string; placeholder?: string }) {
  const areas = [...new Set(pool.map((s) => s.area))];
  const names = new Map(pool.map((s) => [s.id, s.name]));
  return (
    <select name={name} defaultValue="" aria-label={label} className="input max-w-full sm:max-w-[26rem]">
      <option value="">{placeholder}</option>
      {areas.map((area) => (
        <optgroup key={area} label={area}>
          {pool
            .filter((s) => s.area === area)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.parent_id ? `${names.get(s.parent_id) ?? ""} › ${s.name}` : s.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}
