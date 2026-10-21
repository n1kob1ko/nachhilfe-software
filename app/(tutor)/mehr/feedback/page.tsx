import Link from "next/link";
import { Check, RotateCcw } from "lucide-react";
import { feedbackStatusAction } from "@/app/feedback-actions";
import { FeedbackButton } from "@/components/FeedbackButton";
import { TextKopieren } from "@/components/TextKopieren";
import { Empty, PageHeader, Pill, Reveal, formatDate } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { FEEDBACK_ARTEN, feedbackAlsText, feedbackZahlen, kurzerBrowser, listFeedback, type Feedback, type FeedbackStatus } from "@/lib/feedback";

export const metadata = { title: "Feedback" };

const navChip = (on: boolean) => `inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[14px] font-medium whitespace-nowrap ${on ? "bg-accent text-on-fill" : "bg-panel text-ink-2 hover:text-ink"}`;
const ART_TON = { fehler: "red", wunsch: "accent", sonstiges: "neutral" } as const;
const wann = (iso: string) => formatDate(iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Mehr › Feedback: what the teachers sent with the feedback button (lib/feedback.ts). The Verwaltung sees
 * everyone's, ticks points off and copies the open ones as one text; a teacher sees what they sent and
 * whether it is done.
 */
export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const teacher = await requireTeacher();
  const admin = !!teacher.is_admin;
  const status: FeedbackStatus = (await searchParams).status === "erledigt" ? "erledigt" : "offen";
  const mine = admin ? undefined : teacher.id;
  const zahlen = feedbackZahlen(mine);
  const list = listFeedback({ status, teacherId: mine });
  const offene = admin && status === "offen" ? list : [];

  return (
    <>
      <PageHeader
        title="Feedback"
        back={{ href: "/mehr", label: "Mehr" }}
        info={
          admin
            ? "Alles, was Lehrkräfte mit dem Feedback-Knopf geschickt haben. Seite, Bildschirm und Fehler im Browser kommen von selbst mit. „Offene kopieren“ gibt alle offenen Punkte als einen Text, zum Weitergeben."
            : "Was du mit dem Feedback-Knopf geschickt hast. Die Verwaltung hakt es ab, sobald es erledigt ist."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {offene.length > 0 && <TextKopieren text={feedbackAlsText(offene)} label="Offene kopieren" />}
            <FeedbackButton />
          </div>
        }
      />

      <nav aria-label="Stand" className="-mt-2 mb-6 flex gap-1.5">
        <Link href="/mehr/feedback" aria-current={status === "offen" ? "page" : undefined} className={navChip(status === "offen")}>
          Offen <span className="num">{zahlen.offen}</span>
        </Link>
        <Link href="/mehr/feedback?status=erledigt" aria-current={status === "erledigt" ? "page" : undefined} className={navChip(status === "erledigt")}>
          Erledigt <span className="num">{zahlen.erledigt}</span>
        </Link>
      </nav>

      {list.length === 0 ? (
        <Empty title={status === "offen" ? "Kein offenes Feedback" : "Noch nichts erledigt"}>
          Feedback schickst du mit dem Sprechblasen-Knopf neben dem Dunkelmodus, auf jeder Seite und im Whiteboard.
        </Empty>
      ) : (
        <ul className="max-w-[860px] space-y-3">
          {list.map((f) => (
            <Punkt key={f.id} f={f} admin={admin} />
          ))}
        </ul>
      )}
    </>
  );
}

function Punkt({ f, admin }: { f: Feedback; admin: boolean }) {
  const geraet = [f.bildschirm, f.modus, kurzerBrowser(f.browser)].filter(Boolean).join(" · ");
  return (
    <li className="rounded-[18px] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13.5px]">
        <Pill tone={ART_TON[f.art]}>{FEEDBACK_ARTEN[f.art]}</Pill>
        {admin && <span className="font-semibold">{f.teacher_name || "Lehrkraft"}</span>}
        <span className="num text-ink-3">{wann(f.created_at)}</span>
        {f.status === "erledigt" && f.erledigt_at && <Pill tone="green">erledigt {formatDate(f.erledigt_at, { day: "numeric", month: "short" })}</Pill>}
      </div>

      <p className="mt-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">{f.text}</p>

      {f.bild && (
        <a href={`/feedback/${f.id}/bild`} target="_blank" rel="noopener" className="mt-3 inline-block" title="Screenshot groß öffnen">
          {/* eslint-disable-next-line @next/next/no-img-element -- served by a route that checks the session */}
          <img src={`/feedback/${f.id}/bild`} alt="Screenshot zum Feedback" loading="lazy" className="max-h-44 max-w-full rounded-lg border border-line object-contain" />
        </a>
      )}

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
          {f.seite && (
            <span className="min-w-0 break-all">
              Seite:{" "}
              {f.seite.startsWith("/") ? (
                <Link href={f.seite} className="font-medium text-accent hover:underline">
                  {f.seite}
                </Link>
              ) : (
                f.seite
              )}
            </span>
          )}
          {geraet && <span>{geraet}</span>}
        </div>
        {admin && (
          <form action={feedbackStatusAction.bind(null, f.id, f.status === "offen" ? "erledigt" : "offen")} className="ml-auto">
            <button className="btn btn-secondary btn-sm">
              {f.status === "offen" ? <Check size={14} aria-hidden /> : <RotateCcw size={14} aria-hidden />}
              {f.status === "offen" ? "Erledigt" : "Wieder öffnen"}
            </button>
          </form>
        )}
      </div>

      {admin && f.fehler.length > 0 && (
        <Reveal label={`${f.fehler.length} Fehler im Browser`} className="mt-2">
          <ul className="space-y-1 font-mono text-[12.5px] break-all text-ink-2">
            {f.fehler.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </Reveal>
      )}
    </li>
  );
}
