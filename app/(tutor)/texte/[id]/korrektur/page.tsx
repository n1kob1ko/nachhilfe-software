import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, History, PenLine } from "lucide-react";
import { startManualCorrectionAction } from "@/app/correction-actions";
import { AIStartButton } from "@/components/text/correction/AIStartButton";
import { StoryStrip } from "@/components/text/story/StoryPictures";
import { storyForEditor } from "@/lib/picture-story";
import { CorrectionWorkspace, type View } from "@/components/text/correction/CorrectionWorkspace";
import { Pill, formatDate, formatTime } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { getSkill } from "@/lib/repo";
import { aiPreview, aiState, correctionsOfText, levelOfText, listItems, snapshotDoc } from "@/lib/text-correction";
import { getText, wordsLabel } from "@/lib/texts";

export const metadata = { title: "Korrektur" };

const first = (n: string) => n.split(" ")[0];
const when = (iso: string) => `${formatDate(iso, { day: "numeric", month: "short" })}, ${formatTime(iso)}`;
const VIEWS: View[] = ["original", "korrekturen", "endfassung"];

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ k?: string; ansicht?: string }> };

/**
 * Korrektur of a Textarbeit: the text in three views (Original, Korrekturen, Endfassung). Works without
 * KI; the KI is asked only on the teacher's click and after the consent dialog.
 */
export default async function CorrectionPage({ params, searchParams }: Params) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  await requireTeacher();
  const text = getText(Number(id));
  if (!text) notFound();
  const all = correctionsOfText(text.id);
  const current = all.find((c) => c.version === text.version) ?? null;
  const asked = sp.k ? all.find((c) => c.id === Number(sp.k)) : null;
  const c = asked ?? current ?? all[0] ?? null;
  const level = levelOfText(text);
  const name = first(text.student_name);
  const heading = [text.subject || "Deutsch", text.topic].filter(Boolean).join(" – ");
  const preview = aiPreview(text);
  const view = VIEWS.includes(sp.ansicht as View) ? (sp.ansicht as View) : "korrekturen";
  const story = storyForEditor(text.id, "/material/bildgeschichte/bild");

  const head = (
    <div className="mb-5">
      <Link href={`/texte/${text.id}`} className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-medium text-ink-2 hover:text-ink">
        ← Zum Text
      </Link>
      <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.01em]">Korrektur: {text.title}</h1>
      <p className="mt-1 text-[14px] text-ink-2">
        {[text.student_name, heading, `Maßstab ${level.label}`].join(" · ")}
        {c && (
          <>
            {" "}
            · Fassung vom <span className="num">{when(c.created_at)}</span>, <span className="num">{wordsLabel(c.words)}</span>
          </>
        )}
      </p>
      {story && story.pictures.images.length > 0 && (
        <div className="mt-3 max-w-[900px]" data-testid="korrektur-bilder">
          <StoryStrip p={{ ...story.pictures, starters: [], hints: "" }} />
        </div>
      )}
    </div>
  );

  const start = (
    <section className="panel max-w-[760px] px-6 py-6" data-testid="korrektur-start">
      <h2 className="text-[19px] font-semibold">{c ? "Die aktuelle Fassung korrigieren" : "Diesen Text korrigieren"}</h2>
      <p className="mt-1 text-[15px] text-ink-2">
        <span className="num">{wordsLabel(text.words)}</span> · Fassung vom <span className="num">{when(text.updated_at)}</span>. Die KI schlägt Korrekturen nach dem Maßstab „{level.label}“ vor. Nichts wird ohne deine Bestätigung übernommen, der Originaltext bleibt unverändert.
      </p>
      <div className="mt-4 flex flex-wrap items-start gap-3">
        <div>
          <AIStartButton textId={text.id} preview={preview} />
        </div>
        <form action={startManualCorrectionAction.bind(null, text.id)}>
          <button className="btn btn-secondary" disabled={!text.words} data-testid="selbst-korrigieren">
            <PenLine size={16} aria-hidden /> Selbst korrigieren
          </button>
        </form>
      </div>
    </section>
  );

  if (!c) {
    return (
      <>
        {head}
        {start}
      </>
    );
  }

  const state = aiState(c);
  const items = listItems(c.id);
  const skillIds = [...new Set([...items.map((i) => i.skill_id), c.recommendation_skill].filter((x): x is string => Boolean(x)))];
  const skillNames = Object.fromEntries(skillIds.map((s) => [s, getSkill(s)?.name ?? s]));
  const outdated = c.version !== text.version;
  const mayRunAI = !outdated && (state === "keine" || state === "fehler");

  return (
    <>
      {head}
      {outdated && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-amber-wash px-5 py-4 text-[15px]" role="status" data-testid="veraltet">
          <History size={18} className="shrink-0 text-amber" aria-hidden />
          <span className="min-w-0 flex-1">
            {name} hat den Text nach dieser Korrektur weitergeschrieben. Die Markierungen gehören zur Fassung vom {when(c.created_at)} und bleiben dort.
          </span>
          {current ? (
            <Link href={`/texte/${text.id}/korrektur?k=${current.id}`} className="btn btn-secondary">
              Neueste Korrektur öffnen
            </Link>
          ) : (
            <form action={startManualCorrectionAction.bind(null, text.id)}>
              <button className="btn btn-secondary" data-testid="neu-korrigieren">
                Neue Fassung korrigieren
              </button>
            </form>
          )}
        </div>
      )}
      {state === "fehler" && !outdated && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-red-wash px-5 py-4 text-[15px]" role="alert" data-testid="ki-fehler">
          <AlertTriangle size={18} className="shrink-0 text-red" aria-hidden />
          <span className="min-w-0 flex-1">
            <b>Die KI-Korrektur hat nicht geklappt.</b> {c.ai_error ?? "Die Korrektur wurde unterbrochen."} Du kannst es nochmal versuchen oder selbst korrigieren.
          </span>
        </div>
      )}
      {all.length > 1 && (
        <p className="mb-3 flex flex-wrap items-center gap-2 text-[14px] text-ink-2">
          Korrekturen:
          {all.map((x) => (
            <Link key={x.id} href={`/texte/${text.id}/korrektur?k=${x.id}`} className={`inline-flex min-h-[44px] items-center rounded-full px-3 ${x.id === c.id ? "bg-ink font-semibold text-white" : "bg-panel hover:text-ink"}`}>
              Fassung vom {when(x.created_at)}
            </Link>
          ))}
          {!current && <Pill tone="amber">aktuelle Fassung noch nicht korrigiert</Pill>}
        </p>
      )}
      <CorrectionWorkspace
        key={c.id}
        correction={{
          id: c.id,
          aiState: state,
          aiStartedAt: c.ai_started_at,
          aiLabel: c.ai_model,
          dropped: c.dropped,
          strengths: c.summary ? c.summary.split("\n").filter(Boolean) : [],
          recommendation: c.recommendation,
          recommendationSkill: c.recommendation_skill,
          shared: Boolean(c.shared_at),
        }}
        doc={snapshotDoc(c)}
        items={items}
        skillNames={skillNames}
        studentId={text.student_id}
        studentFirst={name}
        textId={text.id}
        heading={heading}
        initialView={view}
        aiStart={mayRunAI ? <AIStartButton textId={text.id} preview={preview} label={state === "fehler" ? "Nochmal mit KI versuchen" : "Zusätzlich mit KI prüfen"} variant="secondary" /> : undefined}
      />
    </>
  );
}
