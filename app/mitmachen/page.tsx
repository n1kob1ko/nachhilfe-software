import { CheckCircle2, ChevronRight, Laptop, ListChecks, NotebookPen, PenLine, ShieldCheck } from "lucide-react";
import { JoinForm } from "@/components/laptop/JoinForm";
import { DRAFT_PREFIX } from "@/components/laptop/drafts";
import { LaptopLive } from "@/components/laptop/LaptopLive";
import { LeaveButton } from "@/components/laptop/LeaveButton";
import { EndedCleanup, JoinCleanup } from "@/components/laptop/LocalDrafts";
import { Solver } from "@/components/Solver";
import { TextEditor } from "@/components/text/TextEditor";
import { laptopEndReason, laptopState, type EndReason } from "@/lib/laptop";
import { currentLaptop, laptopContext } from "@/lib/laptop-context";
import { markDelivered, parseView, pushLive, unitAssignments, unitText } from "@/lib/live";
import { MAX_TRIES } from "@/lib/service";
import { clientTasks } from "@/lib/solver-tasks";
import { textDoc, textsForStudent, textsForUnit, wordsLabel } from "@/lib/texts";

const first = (n: string) => n.split(" ")[0];

const ENDED: Record<EndReason, { title: string; text: string }> = {
  einheit: { title: "Die Einheit ist beendet", text: "Danke fürs Mitmachen! Deine Arbeit ist gespeichert." },
  lehrer: { title: "Der Zugang wurde beendet", text: "Deine Arbeit bis hierher ist gespeichert." },
  abgemeldet: { title: "Du bist abgemeldet", text: "Auf diesem Gerät ist nichts mehr von der Einheit gespeichert." },
  ersetzt: { title: "Ein anderes Gerät wurde verbunden", text: "Die Einheit geht auf dem anderen Gerät weiter." },
  abgelehnt: { title: "Die Verbindung wurde nicht bestätigt", text: "Frag nach einem neuen Zugangscode, wenn du mitmachen sollst." },
  abgelaufen: { title: "Die Anfrage ist abgelaufen", text: "Frag nach einem neuen Zugangscode." },
};

/**
 * The student's own laptop for one unit. It shows exactly one of four things: the code entry, the
 * wait for the teacher's confirmation (with the check number), the work area of the unit, or the end.
 * The work area only ever shows what was sent in this unit to this student.
 */
export default async function LaptopPage({ searchParams }: { searchParams: Promise<{ abgemeldet?: string }> }) {
  const session = await currentLaptop();
  if (!session) {
    const signedOut = (await searchParams).abgemeldet === "1";
    return (
      <Centered>
        <JoinCleanup />
        <Mark />
        {signedOut ? (
          <>
            <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-[-0.02em]">Du bist abgemeldet</h1>
            <p className="mt-2 mb-8 text-[15px] text-ink-2">Auf diesem Gerät ist nichts mehr von der Einheit gespeichert. Du kannst das Fenster schließen.</p>
            <p className="mb-3 text-[15px] font-semibold">Nochmal verbinden?</p>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-[-0.02em]">Bei der Einheit mitmachen</h1>
            <p className="mt-2 mb-6 text-[15px] text-ink-2">Gib den Zugangscode ein, den du gerade gezeigt bekommst. Danach bestätigt deine Lehrerin oder dein Lehrer die Verbindung.</p>
          </>
        )}
        <div className="w-full text-left">
          <JoinForm />
        </div>
        <p className="mt-6 inline-flex items-center gap-2 text-[13px] text-ink-3">
          <ShieldCheck size={15} aria-hidden /> Kein Konto nötig. Der Zugang gilt nur für diese Einheit.
        </p>
      </Centered>
    );
  }

  const state = laptopState(session);
  if (state === "wartet") {
    return (
      <LaptopLive state="wartet" view="">
        <Centered>
          <Mark />
          <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-[-0.02em]">Warte auf Bestätigung</h1>
          <p className="mt-2 text-[15px] text-ink-2">Sag deiner Lehrerin oder deinem Lehrer diese Prüfzahl:</p>
          <p className="num mt-4 text-[64px] leading-none font-semibold tracking-[0.1em]" data-testid="check-code">
            {session.check_code}
          </p>
          <p className="mt-4 text-[14px] text-ink-2">Die Seite geht von selbst weiter.</p>
          <div className="mt-8">
            <LeaveButton textIds={[]} label="Abbrechen" />
          </div>
        </Centered>
      </LaptopLive>
    );
  }

  const ctx = state === "aktiv" ? await laptopContext() : null;
  if (!ctx) {
    const reason = laptopEndReason(session) ?? "einheit";
    const e = ENDED[reason];
    // only a laptop that was confirmed may still hand in copies of its texts (lib/laptop.ts laptopMayWrite)
    const textIds = session.approved_at ? textsForStudent(session.student_id).map((t) => t.id) : [];
    return (
      <Centered>
        <Mark />
        <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-[-0.02em]" data-testid="laptop-ended">
          {e.title}
        </h1>
        <p className="mt-2 text-[15px] text-ink-2">{e.text}</p>
        <EndedCleanup textIds={textIds} />
        <a href="/mitmachen" className="btn btn-secondary mt-8">
          Neu verbinden
        </a>
      </Centered>
    );
  }

  const { unit, student } = ctx;
  const name = first(student.name);
  const list = unitAssignments(unit.id);
  const texts = textsForUnit(unit.id);
  const view = parseView(unit.device_view);
  const current = view.kind === "aufgabe" ? list.find((a) => a.id === view.assignmentId) : undefined;
  const text = view.kind === "text" ? unitText(unit, view.textId) : null;
  // what is on the screen now has arrived; the teacher's status switches from "nicht angekommen"
  let arrived = false;
  for (const a of current ? [current] : view.kind === "start" || view.kind === "tafel" ? list : []) arrived = markDelivered(a.id) || arrived;
  if (arrived) pushLive(unit.id);

  let content: React.ReactNode;
  if (text) {
    content = (
      <TextEditor
        key={text.id}
        textId={text.id}
        saveUrl={`/mitmachen/text/${text.id}`}
        backupPrefix={DRAFT_PREFIX}
        initial={{ body: textDoc(text), version: text.version, updatedAt: text.updated_at }}
        title={text.title}
        prompt={text.prompt}
        meta={[text.subject, text.topic].filter(Boolean).join(" · ")}
      />
    );
  } else if (current) {
    content = (
      <Solver
        key={`${current.id}-${current.solutions_visible}`}
        token=""
        via="laptop"
        homeHref="/mitmachen/ansicht?zu=start"
        assignmentId={current.id}
        title={current.title}
        tasks={clientTasks(current)}
        maxTries={MAX_TRIES}
      />
    );
  } else {
    content = (
      <div className="panel flex flex-col items-center px-6 py-14 text-center">
        <Laptop size={34} strokeWidth={1.75} className="text-accent" aria-hidden />
        <p className="mt-4 text-[19px] font-semibold">{list.length || texts.length ? "Wähle links, woran du arbeitest." : `Gleich geht's los. ${first(unit.teacher_name)} schickt dir eine Aufgabe.`}</p>
        {view.kind === "tafel" && <p className="mt-1 text-[15px] text-ink-2">Gerade ist das Whiteboard am Tablet dran.</p>}
      </div>
    );
  }

  const openTexts = texts.filter((t) => t.status !== "fertig");
  const doneTexts = texts.filter((t) => t.status === "fertig");
  const open = list.filter((a) => !a.completed_at);
  const done = list.filter((a) => a.completed_at);
  const item = (href: string, on: boolean, icon: React.ReactNode, title: string, sub: string, finished: boolean) => (
    <li key={href} className="min-w-0">
      <a
        href={href}
        aria-current={on ? "page" : undefined}
        className={`flex min-h-[56px] items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${on ? "bg-surface shadow-[var(--shadow-card)]" : "hover:bg-surface/70"}`}
      >
        <span className="shrink-0 text-accent">{finished ? <CheckCircle2 size={18} className="text-green" aria-hidden /> : icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{title}</span>
          <span className="num block text-[13px] text-ink-2">{sub}</span>
        </span>
        {!on && <ChevronRight size={16} className="shrink-0 text-ink-3" aria-hidden />}
      </a>
    </li>
  );

  return (
    <LaptopLive state="aktiv" view={unit.device_view}>
      {/* keyed by unit: nothing of another unit is ever kept on screen */}
      <div key={unit.id} className="mx-auto max-w-[1240px] px-5 py-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Mark small />
            <div>
              <p className="text-[22px] leading-tight font-semibold">{name}</p>
              <p className="flex items-center gap-2 text-[14px] text-ink-2">
                {unit.subject && <span>{unit.subject}</span>}
                <span className="inline-flex items-center gap-1.5 font-semibold text-green">
                  <span className="h-2 w-2 rounded-full bg-green" aria-hidden /> Einheit mit {first(unit.teacher_name)}
                </span>
              </p>
            </div>
          </div>
          <LeaveButton textIds={texts.map((t) => t.id)} />
        </header>
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
          <nav aria-label="Deine Aufgaben" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <p className="mb-2 flex items-center gap-2 px-3 text-[13px] font-semibold text-ink-3">
              <ListChecks size={15} aria-hidden /> Deine Aufgaben
            </p>
            {list.length + texts.length === 0 ? (
              <p className="px-3 text-[14px] text-ink-2">Noch nichts da.</p>
            ) : (
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
                {/* the open text counts its words in the editor itself */}
                {openTexts.map((t) => item(`/mitmachen/ansicht?zu=text:${t.id}`, text?.id === t.id, <PenLine size={18} aria-hidden />, t.title, [t.topic || "Textarbeit", text?.id === t.id ? "" : wordsLabel(t.words)].filter(Boolean).join(" · "), false))}
                {open.map((a) => item(`/mitmachen/ansicht?zu=aufgabe:${a.id}`, current?.id === a.id, <NotebookPen size={18} aria-hidden />, a.title, `${a.done_count} von ${a.task_count} erledigt`, false))}
                {doneTexts.map((t) => item(`/mitmachen/ansicht?zu=text:${t.id}`, text?.id === t.id, null, t.title, `fertig · ${wordsLabel(t.words)}`, true))}
                {done.map((a) => item(`/mitmachen/ansicht?zu=aufgabe:${a.id}`, current?.id === a.id, null, a.title, `fertig · ${a.correct_count} von ${a.task_count} richtig`, true))}
              </ul>
            )}
          </nav>
          <main className="min-w-0">{content}</main>
        </div>
      </div>
    </LaptopLive>
  );
}

function Mark({ small }: { small?: boolean }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-card)] ${small ? "h-11 w-11" : "h-14 w-14"}`}>
      <NotebookPen size={small ? 20 : 26} strokeWidth={1.75} className="text-accent" aria-hidden />
    </span>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-screen max-w-[460px] flex-col items-center justify-center px-6 py-10 text-center">{children}</main>;
}
