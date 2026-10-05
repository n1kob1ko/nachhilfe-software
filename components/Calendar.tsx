import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Colour of a subject in calendars and tags (same pastel family as the overview tiles). */
export function subjectTone(subject: string | null | undefined) {
  const s = (subject ?? "").toLowerCase();
  if (s.startsWith("mathe")) return { bg: "var(--tile-lilac)", fg: "#4b3aa8", soft: "#efecfd" };
  if (s.startsWith("deutsch")) return { bg: "var(--tile-peach)", fg: "#9b4520", soft: "#fdf0e5" };
  if (s.startsWith("engl")) return { bg: "var(--tile-mint)", fg: "#1b6f3d", soft: "#e9f7ef" };
  return { bg: "var(--tile-pink)", fg: "#a12a25", soft: "#fdeeed" };
}

/** Month grid; days with lessons get a dot, today is filled, the chosen day has a ring. Links keep it server-rendered. */
export function MonthCalendar({ month, selected, today, busy, href }: { month: string; selected: string; today: string; busy: Set<string>; href: (month: string, day?: string) => string }) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const start = new Date(y, m - 1, 1 - offset);
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const weeks = days.slice(35).every((d) => d.getMonth() !== m - 1) ? days.slice(0, 35) : days;
  const prev = dayKey(new Date(y, m - 2, 1)).slice(0, 7);
  const next = dayKey(new Date(y, m, 1)).slice(0, 7);
  const title = first.toLocaleDateString("de-AT", { month: "long", year: "numeric" });
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Link href={href(prev)} className="btn btn-ghost btn-sm !h-8 !w-8 !p-0" aria-label="Voriger Monat" scroll={false}>
          <ChevronLeft size={17} aria-hidden />
        </Link>
        <h2 className="text-[16px] font-semibold capitalize" aria-live="polite">
          {title}
        </h2>
        <Link href={href(next)} className="btn btn-ghost btn-sm !h-8 !w-8 !p-0" aria-label="Nächster Monat" scroll={false}>
          <ChevronRight size={17} aria-hidden />
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center" role="grid" aria-label={title}>
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-1 text-[12px] font-medium text-ink-3" role="columnheader">
            {d}
          </span>
        ))}
        {weeks.map((d) => {
          const k = dayKey(d);
          const inMonth = d.getMonth() === m - 1;
          const isToday = k === today;
          const isSel = k === selected;
          const has = busy.has(k);
          return (
            <Link
              key={k}
              href={href(month, k)}
              scroll={false}
              role="gridcell"
              aria-selected={isSel}
              aria-label={`${d.toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long" })}${has ? ", mit Stunden" : ""}`}
              className="group flex flex-col items-center py-0.5"
            >
              <span
                className={`num flex h-9 w-9 items-center justify-center rounded-full text-[14px] transition-colors ${
                  isToday
                    ? "bg-accent-bright font-semibold text-white shadow-[0_6px_14px_-6px_rgba(238,122,69,0.9)]"
                    : isSel
                      ? "font-semibold text-ink ring-2 ring-accent-bright"
                      : inMonth
                        ? "font-medium text-ink group-hover:bg-panel"
                        : "text-ink-3/60 group-hover:bg-panel"
                }`}
              >
                {d.getDate()}
              </span>
              <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${has ? (isToday ? "bg-accent" : "bg-accent-bright") : "bg-transparent"}`} aria-hidden />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

type PlanItem = { id: number; start: Date; minutes: number; title: string; subtitle: string; subject: string; href: string; done?: boolean };

/** One day as a timeline with a block per lesson, like a paper diary. */
export function DayPlan({ items, now }: { items: PlanItem[]; now?: Date }) {
  const HOUR = 52;
  const hours = items.flatMap((i) => [i.start.getHours(), Math.ceil(i.start.getHours() + (i.start.getMinutes() + i.minutes) / 60)]);
  // the visible window: an hour before the first lesson (8:00 on empty days), at least six hours
  const from = hours.length ? Math.max(6, Math.min(...hours) - 1) : 8;
  const to = Math.min(23, Math.max(from + 6, ...hours.map((h) => h + 1)));
  const top = (d: Date) => (d.getHours() - from + d.getMinutes() / 60) * HOUR;
  const nowTop = now && now.getHours() >= from && now.getHours() < to ? top(now) : null;
  return (
    <div className="relative" style={{ height: (to - from) * HOUR }}>
      {Array.from({ length: to - from }, (_, i) => (
        <div key={i} className="absolute inset-x-0 flex items-start gap-3" style={{ top: i * HOUR }}>
          <span className="num w-11 shrink-0 -translate-y-2 text-right text-[11.5px] text-ink-3">{pad(from + i)}:00</span>
          <span className="mt-0 h-px flex-1 bg-line" />
        </div>
      ))}
      {nowTop !== null && (
        <div className="absolute inset-x-0 z-10 flex items-center" style={{ top: nowTop }} aria-label="Jetzt">
          <span className="ml-[50px] h-2 w-2 rounded-full bg-accent-bright" />
          <span className="h-0.5 flex-1 bg-accent-bright/70" />
        </div>
      )}
      {items.map((it) => {
        const tone = subjectTone(it.subject);
        const h = Math.max(36, (it.minutes / 60) * HOUR - 4);
        return (
          <Link
            key={it.id}
            href={it.href}
            className="absolute right-0 left-[58px] flex gap-2.5 overflow-hidden rounded-2xl px-3 py-2 transition-transform hover:-translate-y-0.5"
            style={{ top: top(it.start) + 2, height: h, background: tone.bg }}
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-[11px] font-bold" style={{ color: tone.fg }} aria-hidden>
              {it.subject.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-ink">{it.title}</span>
              <span className="block truncate text-[12px]" style={{ color: tone.fg }}>
                {it.subtitle}
                {it.done && " · dokumentiert"}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
