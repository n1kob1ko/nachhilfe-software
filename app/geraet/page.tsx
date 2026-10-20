import { ArrowLeftRight, Laptop, PenLine, Presentation } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { chooseDeviceUnitAction } from "@/app/device-actions";
import { BrandMark } from "@/components/Brand";
import { DeviceLive } from "@/components/device/DeviceLive";
import { PairForm } from "@/components/device/PairForm";
import { Solver } from "@/components/Solver";
import { StudentQuickRound } from "@/components/StudentQuickRound";
import { WhiteboardLoader } from "@/components/whiteboard/WhiteboardLoader";
import { deviceContext } from "@/lib/device-context";
import { touchDevice } from "@/lib/devices";
import { activeLaptop } from "@/lib/laptop";
import { markDelivered, parseView, pushLive, unitAssignments, unitText } from "@/lib/live";
import { isMinitest, showsQuickRound } from "@/lib/quick-round";
import * as repo from "@/lib/repo";
import { triesFor } from "@/lib/service";
import { clientTasks } from "@/lib/solver-tasks";
import { TextEditor } from "@/components/text/TextEditor";
import { StudentCorrection } from "@/components/text/correction/StudentCorrection";
import { storyForEditor } from "@/lib/picture-story";
import { auftragFor } from "@/lib/schreibauftrag-store";
import { textDoc, textsForUnit, wordsLabel } from "@/lib/texts";
import { runningUnits } from "@/lib/units";
import { shortNames } from "@/lib/vornamen";
import { ensureBoardForUnit } from "@/lib/whiteboard";

/**
 * The student tablet. It belongs to a teacher and shows exactly one of four things:
 * the pairing screen, "Bereit für die nächste Einheit", „Wer arbeitet an diesem Gerät?“ (two units of
 * its teacher run and none is chosen here yet, D26), or the running unit it shows.
 * Nothing of a previous student is ever rendered: everything below comes from that unit.
 */
export default async function DevicePage() {
  const ctx = await deviceContext();
  if (!ctx) return <Pairing />;
  touchDevice(ctx.device.id);
  const { device, unit, student, choices } = ctx;
  const teacherFirst = device.teacher_name.split(" ")[0];

  if (choices.length > 0) {
    const names = shortNames(choices.map((u) => u.student_name));
    return (
      <DeviceLive unitId={null} choosing>
        <Centered>
          <BrandMark height={64} />
          <h1 className="mt-6 text-[30px] font-semibold tracking-[-0.02em]">Wer arbeitet an diesem Gerät?</h1>
          <p className="mt-2 text-[16px] text-ink-2">Tippe auf deinen Namen.</p>
          <div className="mt-8 grid w-full max-w-[520px] gap-4 sm:grid-cols-2">
            {choices.map((u, i) => (
              <form key={u.id} action={chooseDeviceUnitAction}>
                <input type="hidden" name="unit_id" value={u.id} />
                <button className="panel flex min-h-[120px] w-full flex-col items-center justify-center gap-1 px-5 py-6 transition-colors hover:border-accent">
                  <span className="text-[26px] font-semibold">{names[i]}</span>
                  {u.subject && <span className="text-[15px] text-ink-2">{u.subject}</span>}
                </button>
              </form>
            ))}
          </div>
          <p className="mt-8 text-[14px] text-ink-3">Verbunden mit {teacherFirst}</p>
        </Centered>
      </DeviceLive>
    );
  }

  if (!unit || !student) {
    return (
      <DeviceLive unitId={null}>
        <Centered>
          <BrandMark height={80} />
          <h1 className="mt-6 text-[30px] font-semibold tracking-[-0.02em]">Bereit für die nächste Einheit</h1>
          <p className="mt-2 text-[16px] text-ink-2">Verbunden mit {teacherFirst}</p>
        </Centered>
      </DeviceLive>
    );
  }

  const first = student.name.split(" ")[0];
  // two units of the teacher run (D26): the student can hand the tablet over („Wechseln“ asks again)
  const twoRunning = runningUnits(device.teacher_id).length > 1;
  const list = unitAssignments(unit.id);
  const view = parseView(unit.device_view);
  // the student works on their own laptop in this unit: exercises and texts are there, the tablet only offers the board
  const onLaptop = Boolean(activeLaptop(unit.id)) && view.kind !== "tafel";
  const current = view.kind === "aufgabe" && !onLaptop ? list.find((a) => a.id === view.assignmentId) : undefined;
  // what is on the screen now has arrived; the teacher's status switches from "nicht angekommen"
  let arrived = false;
  for (const a of onLaptop ? [] : current ? [current] : view.kind === "start" ? list : []) arrived = markDelivered(a.id) || arrived;
  if (arrived) pushLive(unit.id);

  // a Textarbeit of this student: written here, saved continuously
  const text = view.kind === "text" && !onLaptop ? unitText(unit, view.textId) : null;

  let content: React.ReactNode;
  if (onLaptop) {
    content = (
      <div className="panel flex flex-col items-center px-6 py-12 text-center">
        <Laptop size={36} strokeWidth={1.75} className="text-accent" aria-hidden />
        <p className="mt-4 text-[20px] font-semibold">{first} arbeitet am eigenen Laptop</p>
        <p className="mt-1 text-[15px] text-ink-2">Übungen und Texte erscheinen dort. Das Whiteboard geht weiterhin hier.</p>
      </div>
    );
  } else if (text) {
    const story = storyForEditor(text.id, "/geraet/bild");
    const auftrag = auftragFor(text.id);
    content = (
      <>
        <a href="/geraet/ansicht?zu=start" className="mb-3 inline-flex min-h-[44px] items-center text-[15px] font-medium text-ink-2">
          ← Alle Aufgaben
        </a>
        <StudentCorrection textId={text.id} large />
        <TextEditor
          key={text.id}
          textId={text.id}
          saveUrl={`/geraet/text/${text.id}`}
          initial={{ body: textDoc(text), version: text.version, updatedAt: text.updated_at }}
          title={text.title}
          prompt={text.prompt}
          meta={[text.subject, text.topic].filter(Boolean).join(" · ")}
          large
          pictures={story?.pictures}
          targetWords={story?.targetWords ?? auftrag?.target}
          auftrag={auftrag ?? undefined}
          handIn={(story || auftrag) && text.status !== "fertig" ? { url: `/geraet/text/${text.id}/abgeben`, home: "/geraet/ansicht?zu=start" } : undefined}
        />
      </>
    );
  } else if (view.kind === "tafel") {
    ensureBoardForUnit(unit.id);
    content = <WhiteboardLoader role="schueler" endpoint="/geraet/tafel" query={`?einheit=${unit.id}`} studentName={student.name} backHref="/geraet/ansicht?zu=start" />;
  } else if (current) {
    // Schnellrunde (lib/quick-round.ts): derselbe Abgabeweg wie sonst, nur der Ablauf ist ein anderer
    const tasks = clientTasks(current);
    content = showsQuickRound(current.mode, tasks) ? (
      <StudentQuickRound
        key={`${current.id}-schnell`}
        token=""
        via="geraet"
        homeHref="/geraet/ansicht?zu=start"
        assignmentId={current.id}
        title={current.title}
        tasks={tasks}
      />
    ) : (
      <Solver
        key={`${current.id}-${current.solutions_visible}`}
        token=""
        via="geraet"
        homeHref="/geraet/ansicht?zu=start"
        assignmentId={current.id}
        title={current.title}
        tasks={tasks}
        maxTries={triesFor(current.mode)}
        test={isMinitest(current.mode)}
        probe={Boolean(repo.getWorksheet(current.worksheet_id)?.probe_test_id)}
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
      <div key={unit.id} className={`mx-auto px-4 py-5 has-[.lesen-breit]:max-w-[1320px] ${text && storyForEditor(text.id, "") ? "max-w-[1240px]" : "max-w-[860px]"}`}>
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 text-[24px] leading-tight font-semibold">
              {first}
              {twoRunning && (
                <form action={chooseDeviceUnitAction}>
                  <button className="btn btn-ghost btn-sm" title="Ein anderer Schüler arbeitet an diesem Gerät">
                    <ArrowLeftRight size={15} aria-hidden /> Wechseln
                  </button>
                </form>
              )}
            </div>
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
      <BrandMark height={72} />
      <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-[-0.02em]">Dieses Tablet mit einem Lehrer verbinden</h1>
      <p className="mt-2 mb-6 text-[15px] text-ink-2">Am Lehrergerät: Mehr › Schülergeräte › „Neues Tablet verbinden“. Den Code hier eingeben.</p>
      <PairForm />
    </main>
  );
}
