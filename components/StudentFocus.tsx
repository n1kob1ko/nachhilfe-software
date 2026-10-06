import Link from "next/link";
import { BookOpenCheck, CalendarClock, NotebookPen, Target } from "lucide-react";
import { formatDate } from "@/components/ui";
import { activeMaterial, materialLabel } from "@/lib/current-material";
import { daysUntil, dayOf } from "@/lib/exams";
import { nextSteps } from "@/lib/recommend";
import * as repo from "@/lib/repo";

const when = (days: number) => (days === 0 ? "heute" : days === 1 ? "morgen" : `in ${days} Tagen`);

/**
 * The four things a teacher wants to know before working with a student: next exam, current material,
 * the recommended exercise and open homework. Only what exists is shown; nothing else.
 */
export function StudentFocus({ studentId }: { studentId: number }) {
  const today = dayOf(new Date());
  const exam = repo.upcomingTests(today, studentId).find((t) => daysUntil(t.date, today) <= 30);
  const material = activeMaterial(studentId)[0];
  const step = nextSteps(studentId, { today, limit: 1 })[0];
  const hw = repo
    .listHomework(studentId)
    .filter((h) => h.status === "offen")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))[0];
  const items: { key: string; icon: typeof Target; label: string; text: React.ReactNode; href: string }[] = [];
  if (exam) {
    const days = daysUntil(exam.date, today);
    items.push({ key: "p", icon: CalendarClock, label: "Nächste Prüfung", text: `${exam.title || `${exam.kind} ${exam.subject}`} ${when(days)}`, href: `/schueler/${studentId}/pruefung/${exam.id}` });
  }
  if (material) items.push({ key: "s", icon: BookOpenCheck, label: `Aktuell in ${material.subject}`, text: materialLabel(material), href: `/schueler/${studentId}?tab=stoff` });
  if (step)
    items.push({
      key: "e",
      icon: Target,
      label: "Empfohlen",
      text: (
        <>
          {step.skill.name} <span className="font-normal text-ink-3">· Übung erstellen</span>
        </>
      ),
      href: `/uebungen/neu?schueler=${studentId}&skill=${encodeURIComponent(step.skill.id)}&anzahl=${step.count}`,
    });
  if (hw) items.push({ key: "h", icon: NotebookPen, label: "Offene Hausübung", text: `${hw.description}${hw.due_date ? `, fällig ${formatDate(hw.due_date, { day: "numeric", month: "short" })}` : ""}`, href: `/schueler/${studentId}?tab=schule` });
  if (!items.length) return null;
  return (
    <ul className="mt-5 grid gap-2 sm:grid-cols-2" aria-label="Auf einen Blick">
      {items.map(({ key, icon: Icon, label, text, href }) => (
        <li key={key}>
          <Link href={href} className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-surface/80 px-3.5 py-2 hover:bg-surface">
            <Icon size={18} className="shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold text-ink-3">{label}</span>
              <span className="block truncate text-[14px] font-medium">{text}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
