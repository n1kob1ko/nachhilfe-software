import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, ChevronDown, CircleDashed, Minus } from "lucide-react";
import { Info } from "@/components/Info";
import type { Trend } from "@/lib/analysis";
import { masteryStatus, STATUS_THRESHOLDS, statusTone } from "@/lib/mastery";

export function PageHeader({ title, subtitle, actions, back, info }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string }; info?: React.ReactNode }) {
  return (
    <header className="mb-8">
      {back && (
        <Link href={back.href} className="no-print mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-ink-3 hover:text-ink">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] text-balance">
            {title}
            {info && (
              <span className="ml-1.5">
                <Info label={`Info zu ${typeof title === "string" ? title : "dieser Seite"}`}>{info}</Info>
              </span>
            )}
          </h1>
          {subtitle && <div className="mt-1.5 text-ink-2">{subtitle}</div>}
        </div>
        {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionTitle({ children, action, id }: { children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2" id={id}>
      <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{children}</h2>
      {action}
    </div>
  );
}

const TREND = {
  up: { icon: ArrowUpRight, text: "steigt", cls: "text-green" },
  flat: { icon: ArrowRight, text: "stabil", cls: "text-ink-2" },
  down: { icon: ArrowDownRight, text: "sinkt", cls: "text-red" },
  none: { icon: Minus, text: "zu wenig Daten", cls: "text-ink-3" },
} as const;

export function TrendBadge({ trend, delta, compact }: { trend: Trend; delta?: number | null; compact?: boolean }) {
  const t = TREND[trend];
  const Icon = t.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[13px] font-medium ${t.cls}`} title={`Fortschritt ${t.text}`}>
      <Icon size={16} strokeWidth={2} aria-hidden />
      {!compact && <span>{t.text}</span>}
      {delta != null && trend !== "none" && (
        <span className="num">
          ({delta > 0 ? "+" : ""}
          {delta})
        </span>
      )}
    </span>
  );
}

/** Status word of a Lernstand (lib/mastery.ts): sicher · gut · üben · kritisch · nicht getestet. */
export function masteryLevel(m: number | null) {
  const label = masteryStatus(m);
  const look = {
    sicher: { cls: "text-green", icon: CheckCircle2 },
    gut: { cls: "text-ink-2", icon: CheckCircle2 },
    "üben": { cls: "text-amber", icon: CircleDashed },
    kritisch: { cls: "text-red", icon: AlertTriangle },
    "nicht getestet": { cls: "text-ink-3", icon: CircleDashed },
  }[label];
  return { label, ...look };
}

/** "Kürzen 91 % · sicher" as a compact chip. */
export function StatusChip({ mastery }: { mastery: number | null }) {
  const label = masteryStatus(mastery);
  return (
    <Pill tone={statusTone(label)}>
      {mastery !== null && <span className="num">{Math.round(mastery * 100)}&nbsp;% · </span>}
      {label}
    </Pill>
  );
}

export function LevelTag({ mastery }: { mastery: number | null }) {
  const l = masteryLevel(mastery);
  const Icon = l.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-semibold whitespace-nowrap ${l.cls}`}>
      <Icon size={13} strokeWidth={2.25} aria-hidden />
      {l.label}
    </span>
  );
}

/** Horizontal magnitude bar: one hue, value labelled at the tip. */
export function MasteryBar({ value, size = "md" }: { value: number | null; size?: "sm" | "md" }) {
  const h = size === "sm" ? 6 : 8;
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-full overflow-hidden rounded-full bg-[var(--bar-track)]" style={{ height: h }}>
        {value !== null && (
          <div
            className="absolute inset-y-0 left-0 rounded-r-[4px] bg-[var(--bar)]"
            style={{ width: `${Math.max(2, Math.round(value * 100))}%`, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
          />
        )}
        {/* threshold ticks at "gut" (70 %) and "sicher" (85 %) */}
        <div className="absolute inset-y-0 w-px bg-[var(--surface)]" style={{ left: `${STATUS_THRESHOLDS.gut * 100}%` }} />
        <div className="absolute inset-y-0 w-px bg-[var(--surface)]" style={{ left: `${STATUS_THRESHOLDS.sicher * 100}%` }} />
      </div>
      <span className="num w-11 shrink-0 text-right text-[13px] font-semibold text-ink">{value === null ? "–" : `${Math.round(value * 100)}\u00a0%`}</span>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mx-auto mt-1.5 max-w-[52ch] text-[14px] text-ink-2">{children}</div>}
      {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Pill({ children, tone = "neutral", title }: { children: React.ReactNode; tone?: "neutral" | "accent" | "red" | "amber" | "green"; title?: string }) {
  const cls = {
    neutral: "bg-panel text-ink-2",
    accent: "bg-accent-wash text-accent",
    red: "bg-red-wash text-red",
    amber: "bg-amber-wash text-amber",
    green: "bg-green-wash text-green",
  }[tone];
  return (
    <span title={title} className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

export function formatDate(s: string | number, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  const d = typeof s === "number" ? new Date(s) : new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s) ? s.replace(" ", "T") + "Z" : s);
  return d.toLocaleDateString("de-AT", opts);
}
export function formatTime(s: string) {
  return new Date(s).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
}
export function formatDuration(sec: number | null) {
  if (sec === null) return "–";
  if (sec < 60) return `${sec} s`;
  return `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, "0")} s`;
}

/** Same disclosure everywhere: a quiet "Details anzeigen"-style toggle, content below on demand. */
export function Reveal({ label, children, className = "" }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <details className={`reveal ${className}`}>
      <summary>
        <ChevronDown size={15} aria-hidden className="reveal-chevron" />
        {label}
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  );
}

/** Shows the first `limit` items; the rest sit behind "+n mehr". */
export function More({ items, limit = 3, empty = "–", className = "space-y-1" }: { items: React.ReactNode[]; limit?: number; empty?: React.ReactNode; className?: string }) {
  if (!items.length) return <p className="text-[14px] text-ink-3">{empty}</p>;
  const rest = items.slice(limit);
  return (
    <div>
      <ul className={className}>
        {items.slice(0, limit).map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
      {rest.length > 0 && (
        <Reveal label={`${rest.length} mehr`}>
          <ul className={className}>
            {rest.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </Reveal>
      )}
    </div>
  );
}
