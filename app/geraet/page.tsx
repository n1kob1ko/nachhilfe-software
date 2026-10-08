import { NotebookPen, PenLine, Presentation } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { DeviceLive } from "@/components/device/DeviceLive";
import { PairForm } from "@/components/device/PairForm";
import { Solver } from "@/components/Solver";
import { WhiteboardLoader } from "@/components/whiteboard/WhiteboardLoader";
import { deviceContext } from "@/lib/device-context";
import { touchDevice } from "@/lib/devices";
import { markDelivered, parseView, pushLive, unitAssignments, unitText } from "@/lib/live";
import { MAX_TRIES } from "@/lib/service";
import { clientTasks } from "@/lib/solver-tasks";
import { TextEditor } from "@/components/text/TextEditor";
import { textDoc, textsForUnit, wordsLabel } from "@/lib/texts";
import { ensureBoardForUnit } from "@/lib/whiteboard";

/**
 * The student tablet. It belongs to a teacher and shows exactly one of three things:
 * the pairing screen, "Bereit für die nächste Einheit", or the running unit of its teacher.
 * Nothing of a previous student is ever rendered: everything below comes from the running unit.
 */
export default async function DevicePage() {
  const ctx = await deviceContext();
  if (!ctx) return <Pairing />;
  touchDevice(ctx.device.id);
  const { device, unit, student } = ctx;
  const teacherFirst = device.teacher_name.split(" ")[0];

  if (!unit || !student) {
    return (
      <DeviceLive unitId={null}>
        <Centered>
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-card)]">
            <NotebookPen size={30} strokeWidth={1.75} className="text-accent" aria-hidden />
          </span>
          <h1 className="mt-6 text-[30px] font-semibold tracking-[-0.02em]">Bereit für die nächste Einheit</h1>
          <p className="mt-2 text-[16px] text-ink-2">Verbunden mit {teacherFirst}</p>
        </Centered>
      </DeviceLive>
    );
  }

  const first = student.name.split(" ")[0];
  const list = unitAssignments(unit.id);
  const view = parseView(unit.device_view);
  const current = view.kind === "aufgabe" ? list.find((a) => a.id === view.assignmentId) : undefined;
  // what is on the screen now has arrived; the teacher's status switches from "nicht angekommen"
  let arrived = false;
  for (const a of current ? [current] : view.kind === "start" ? list : []) arrived = markDelivered(a.id) || arrived;
  if (arrived) pushLive(unit.id);

  // a Textarbeit of this student: written here, saved continuously
  const text = view.kind === "text" ? unitText(unit, view.textId) : null;

  let content: React.ReactNode;
  if (text) {
    content = (
      <>
        <a href="/geraet/ansicht?zu=start" className="mb-3 inline-flex min-h-[44px] items-center text-[15px] font-medium text-ink-2">
          ← Alle Aufgaben
        </a>
        <TextEditor
          key={text.id}
          textId={text.id}
          saveUrl={`/geraet/text/${text.id}`}
          initial={{ body: textDoc(text), version: text.version, updatedAt: text.updated_at }}
          title={text.title}
          prompt={text.prompt}
          meta={[text.subject, text.topic].filter(Boolean).join(" · ")}
          large
        />
      </>
    );
  } else if (view.kind === "tafel") {
    ensureBoardForUnit(unit.id);
    content = <WhiteboardLoader role="schueler" endpoint="/geraet/tafel" query={`?einheit=${unit.id}`} studentName={student.name} backHref="/geraet/ansicht?zu=start" />;
  } else if (current) {
    content = (
      <Solver
        key={`${current.id}-${current.solutions_visible}`}
        token=""
        via="geraet"
        homeHref="/geraet/ansicht?zu=start"
        assignmentId={current.id}
        title={current.title}
        tasks={clientTasks(current)}
        maxTries={MAX_TRIES}
      />
    );
  } else {
    const open = list.filter((a) => !a.completed_at);
    const texts = textsForUnit(unit.id).filter((t) => t.status !== "fertig");
    content = open.length || texts.length ? (
      <ul className="space-y-3">
        {texts.map((t) => (
          <li key={`t${t.id}`}>
            <a href={`/geraet/ansicht?zu=text:${t.id}`} className="panel flex min-h-[72px] items-center gap-4 px-5 py-4 transition-colors hover:border-accent">
              <PenLine size={22} className="shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold">{t.title}</span>
                <span className="num block text-[14px] text-ink-2">
                  {[t.topic, wordsLabel(t.words)].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="btn btn-primary">
                {t.words > 0 ? "Weiterschreiben" : "Schreiben"} <ChevronRight size={16} aria-hidden />
              </span>
            </a>
          </li>
        ))}
        {open.map((x) => (
          <li key={x.id}>
            <a href={`/geraet/ansicht?zu=aufgabe:${x.id}`} className="panel flex min-h-[72px] items-center gap-4 px-5 py-4 transition-colors hover:border-accent">
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold">{x.title}</span>
                <span className="num block text-[14px] text-ink-2">
                  {x.done_count} von {x.task_count} erledigt
                </span>
              </span>
              <span className="btn btn-primary">
                {x.done_count > 0 ? "Weiter" : "Starten"} <ChevronRight size={16} aria-hidden />
              </span>
            </a>
          </li>
        ))}
      </ul>
    ) : (
      <p className="panel px-6 py-10 text-center text-[17px] text-ink-2">Gleich geht&apos;s los. {teacherFirst} schickt dir eine Aufgabe.</p>
    );
  }

  return (
    <DeviceLive unitId={unit.id}>
      {/* keyed by unit: a new student never sees anything left over from the previous one */}
      <div key={unit.id} className="mx-auto max-w-[860px] px-4 py-5">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[24px] leading-tight font-semibold">{first}</p>
            <p className="flex items-center gap-2 text-[14px] text-ink-2">
              {unit.subject && <span>{unit.subject}</span>}
              <span className="inline-flex items-center gap-1.5 font-semibold text-green">
                <span className="h-2 w-2 rounded-full bg-green" aria-hidden /> Einheit läuft
              </span>
            </p>
          </div>
          <nav className="flex gap-1 rounded-full bg-panel p-1" aria-label="Ansicht">
            <a
              href="/geraet/ansicht?zu=start"
              aria-current={view.kind !== "tafel" ? "page" : undefined}
              className={`flex min-h-[48px] items-center rounded-full px-5 text-[15px] font-semibold ${view.kind !== "tafel" ? "bg-surface shadow-[var(--shadow-card)]" : "text-ink-2"}`}
            >
              Aufgaben
            </a>
            <a href="/geraet/ansicht?zu=tafel" className="flex min-h-[48px] items-center gap-2 rounded-full px-5 text-[15px] font-semibold text-ink-2">
              <Presentation size={18} aria-hidden /> Whiteboard
            </a>
          </nav>
        </header>
        {content}
      </div>
    </DeviceLive>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">{children}</main>;
}

function Pairing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[440px] flex-col justify-center px-6 py-10">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface shadow-[var(--shadow-card)]">
        <NotebookPen size={26} strokeWidth={1.75} className="text-accent" aria-hidden />
      </span>
      <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-[-0.02em]">Dieses Tablet mit einem Lehrer verbinden</h1>
      <p className="mt-2 mb-6 text-[15px] text-ink-2">Am Lehrergerät: Mehr › Schülergeräte › „Neues Tablet verbinden“. Den Code hier eingeben.</p>
      <PairForm />
    </main>
  );
}
