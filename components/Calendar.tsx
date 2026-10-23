import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Play, Sparkles } from "lucide-react";
import { Avatar } from "@/components/Art";

export const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Colour of a subject in calendars and tags (same pastel family as the overview tiles); the values are tokens so the dark mode can swap them. */
export function subjectTone(subject: string | null | undefined) {
  const s = (subject ?? "").toLowerCase();
  if (s.startsWith("mathe")) return { bg: "var(--tile-lilac)", fg: "var(--mathe-fg)", soft: "var(--mathe-soft)" };
  if (s.startsWith("deutsch")) return { bg: "var(--tile-peach)", fg: "var(--deutsch-fg)", soft: "var(--deutsch-soft)" };
  if (s.startsWith("engl")) return { bg: "var(--tile-mint)", fg: "var(--englisch-fg)", soft: "var(--englisch-soft)" };
  return { bg: "var(--tile-pink)", fg: "var(--sonst-fg)", soft: "var(--sonst-soft)" };
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
              aria-label={`${d.toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long" })}${has ? ", mit Einheiten" : ""}`}
              className="group flex flex-col items-center py-0.5"
            >
              <span
                className={`num flex h-9 w-9 items-center justify-center rounded-full text-[14px] transition-colors ${
                  isToday
                    ? "bg-accent font-semibold text-on-fill"
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
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface/80 text-[11px] font-bold" style={{ color: tone.fg }} aria-hidden>
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

/**
 * Ein Punkt des **Tagesplans** auf der Startseite (D17). Die Zeile kommt entweder aus einem
 * veröffentlichten Wochenplan-Platz (`geplante_einheiten`, mit geplanter Dauer und Raum) oder aus
 * einer von Hand geplanten Einheit, für die es keinen Platz im Wochenplan gibt
 * (`lessons.status = 'geplant'`, siehe docs/planung.md).
 */
export type TagesplanPunkt = {
  /** stabiler React-Schlüssel (Platz- oder Dokumentationszeile) */
  key: string;
  /** "14:00–15:40" beim Platz, "14:00" bei einer Zeile ohne Platz */
  zeit: string;
  studentId: number;
  studentName: string;
  /** Raum · Gebäude, "online" oder "Raum noch offen"; bei einer Zeile ohne Platz das Fach */
  ort: string;
  /** das Thema der Dokumentationszeile; beim Platz leer (die Dauer steht schon in der Zeit) */
  hinweis: string;
  /** die nächste Prüfung, wenn sie nahe ist: „Schularbeit Mathematik in 3 Tagen“ (lib/exams.ts) */
  pruefung?: { text: string; tone: "neutral" | "amber" | "red" } | null;
  /** die Einheit, die diesen Platz schon hat — dann führt die Zeile dorthin statt zu starten */
  einheitId: number | null;
  einheitStatus: "gestartet" | "beendet" | "abgebrochen" | null;
  /** vergangener veröffentlichter Platz ohne Einheit (D17) */
  nichtStattgefunden: boolean;
  /** von Hand geplant, ohne Platz im Wochenplan */
  ohnePlatz: boolean;
  /** die Dokumentation ist fertig: nur noch ansehen */
  erledigt: boolean;
  /** das Tagesbriefing dieses Schülers (lib/briefing.ts); null, wo es nicht mehr hilft */
  briefingHref?: string | null;
  /** „Einheit vorbereiten“: das Lernpaket für heute wählen (lib/cockpit.ts); `paket` ist das gewählte */
  vorbereiten?: { href: string; paket: string | null } | null;
};

/**
 * Der **Tagesplan**: heute, in der Reihenfolge des Tages. Jede offene Zeile startet mit einem Klick
 * die Einheit; sie verknüpft sich dabei mit ihrem Platz im Wochenplan (`lib/units.ts`, D17) und
 * läuft ohne Platz wie bisher ungeplant.
 *
 * `starten` ist die Server Action der Startseite (als Eigenschaft übergeben, damit diese Datei
 * nichts aus `app/` importieren muss).
 */
/** Textfarbe je Erinnerungsstufe der Prüfung (lib/exams.ts STAGE_TONE) */
const TON_TEXT = { neutral: "text-ink", amber: "text-amber", red: "text-red" } as const;

export function Tagesplan({ punkte, starten }: { punkte: TagesplanPunkt[]; starten: (studentId: number) => Promise<void> }) {
  return (
    <ul className="panel divide-y divide-line">
      {punkte.map((p) => (
        <li key={p.key} className={`flex min-h-[60px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 ${p.nichtStattgefunden ? "text-ink-3" : ""}`}>
          {/* breit genug für „02:00–03:40“ in einer Zeile */}
          <span className="num w-[106px] shrink-0 text-[16px] font-semibold">{p.zeit}</span>
          <Avatar name={p.studentName} size={34} />
          {/* the name keeps room; the actions move to their own line when the row gets narrow */}
          <Link href={`/schueler/${p.studentId}`} className="min-w-[8.5rem] flex-1">
            <span className="block truncate font-semibold">{p.studentName}</span>
            <span className="block truncate text-[13px] text-ink-2">
              {p.ort}
              {p.hinweis && ` · ${p.hinweis}`}
            </span>
            {/* eigene Zeile, damit sie in der schmalen Spalte nicht mit „…“ endet */}
            {p.pruefung && <span className={`block text-[13px] leading-snug font-semibold ${TON_TEXT[p.pruefung.tone]}`}>{p.pruefung.text}</span>}
          </Link>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            {p.nichtStattgefunden && <span className="text-[13px] text-ink-3">nicht stattgefunden</span>}
            {p.ohnePlatz && !p.nichtStattgefunden && <span className="text-[13px] text-ink-3">ohne Wochenplan-Platz</span>}
            {p.erledigt && (
              <span className="inline-flex items-center gap-1 text-[13px] font-medium text-green">
                <CheckCircle2 size={15} aria-hidden /> erledigt
              </span>
            )}
            {p.briefingHref && (
              <Link href={p.briefingHref} className="btn btn-secondary btn-sm">
                <Sparkles size={14} aria-hidden /> Briefing
              </Link>
            )}
            {p.vorbereiten && (
              <Link href={p.vorbereiten.href} className="btn btn-secondary btn-sm" title={p.vorbereiten.paket ? `Lernpaket: ${p.vorbereiten.paket}` : "Lernpaket für heute wählen"}>
                {p.vorbereiten.paket ? <CheckCircle2 size={14} className="text-green" aria-hidden /> : <ClipboardList size={14} aria-hidden />} {p.vorbereiten.paket ? "Vorbereitet" : "Vorbereiten"}
              </Link>
            )}
            {p.einheitId !== null ? (
              <Link href={`/einheiten/${p.einheitId}`} className="btn btn-secondary btn-sm">
                {p.einheitStatus === "gestartet" ? "Zur laufenden Einheit" : "Zur Einheit"}
              </Link>
            ) : p.erledigt ? null : (
              <form action={starten.bind(null, p.studentId)}>
                <button className="btn btn-primary btn-sm">
                  <Play size={14} aria-hidden /> Einheit starten
                </button>
              </form>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
