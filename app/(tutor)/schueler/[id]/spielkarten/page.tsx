import { Gamepad2, ListPlus, Pause, Pencil, Play } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { spielkartenAktivAction } from "@/app/spielkarten-actions";
import { Empty, PageHeader, formatDate } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { getStudent } from "@/lib/repo";
import { saetzeVon, satzStand, spielSatz } from "@/lib/spielkarten";
import { KARTEN_MIN } from "@/lib/spielkarten-text";

export const metadata = { title: "Spielkarten" };

/** Die Spielkarten eines Schülers (lib/spielkarten.ts): eigener Stoff für „Dein Stoff“ und Blockwerk in der Schüler-App. */
export default async function SpielkartenSeite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ gespeichert?: string; geloescht?: string }> }) {
  await requireTeacher();
  const { id } = await params;
  const sp = await searchParams;
  const student = getStudent(Number(id));
  if (!student) notFound();
  const first = student.name.split(" ")[0];
  const saetze = saetzeVon(student.id);
  const imSpiel = spielSatz(student.id);
  const gespeichert = saetze.find((s) => s.id === Number(sp.gespeichert));
  const neu = `/schueler/${student.id}/spielkarten/neu`;
  return (
    <>
      <PageHeader
        title={`Spielkarten von ${first}`}
        info={`Eigene Fragen zum Stoff, in jedem Fach. In der Schüler-App sind sie das Spiel „Dein Stoff“ und die Fragen im Blockwerk. Gespielt wird der zuletzt geänderte Satz, der im Spiel ist und mindestens ${KARTEN_MIN} Karten hat. Die App prüft jede Antwort ohne KI; falsche Karten kommen in der nächsten Runde wieder.`}
        back={{ href: `/schueler/${student.id}?tab=uebungen`, label: student.name }}
        actions={
          saetze.length > 0 && (
            <Link href={neu} className="btn btn-primary">
              <ListPlus size={16} aria-hidden /> Neue Karten
            </Link>
          )
        }
      />
      {(gespeichert || sp.geloescht) && (
        <p className="mb-6 max-w-[900px] rounded-2xl bg-green-wash px-4 py-3 text-[14px] text-green" role="status">
          {gespeichert
            ? gespeichert.id === imSpiel?.id
              ? `„${gespeichert.titel}“ ist gespeichert. ${first} spielt die Karten jetzt in der Schüler-App unter Spiele › Dein Stoff und im Blockwerk.`
              : `„${gespeichert.titel}“ ist gespeichert.`
            : "Die Karten sind gelöscht."}
        </p>
      )}
      {saetze.length === 0 ? (
        <Empty
          title={`Noch keine Spielkarten für ${first}`}
          action={
            <Link href={neu} className="btn btn-primary">
              <ListPlus size={16} aria-hidden /> Karten schreiben
            </Link>
          }
        >
          Schreib Fragen mit Antworten zum Stoff, zum Beispiel für den nächsten Bio-Test. Oder lade unter „Stoff vorbereiten“ ein Foto oder PDF hoch und hak „Spielkarten“ an: dann schlägt die KI die Karten vor.
        </Empty>
      ) : (
        <ul className="grid max-w-[900px] gap-3" data-testid="spielkarten-saetze">
          {saetze.map((s) => {
            const st = satzStand(s);
            const laeuft = s.id === imSpiel?.id;
            return (
              <li key={s.id} className="panel flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold [overflow-wrap:anywhere]">
                    {s.titel}
                    {laeuft && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-wash px-2 py-0.5 text-[12px] font-semibold text-green">
                        <Gamepad2 size={13} aria-hidden /> im Spiel
                      </span>
                    )}
                  </p>
                  <p className="text-[13px] text-ink-3">
                    {s.fach ? `${s.fach} · ` : ""}
                    {s.karten} {s.karten === 1 ? "Karte" : "Karten"} · geändert am {formatDate(s.updated_at)}
                    {!s.aktiv ? " · nicht im Spiel" : s.karten < KARTEN_MIN ? ` · ab ${KARTEN_MIN} Karten im Spiel` : !laeuft ? " · wartet (ein neuerer Satz ist im Spiel)" : ""}
                  </p>
                  {st.runden > 0 ? (
                    <p className="mt-1 text-[13px] text-ink-2" data-testid="spielkarten-stand">
                      {st.runden === 1 ? "1 Runde" : `${st.runden} Runden`} gespielt · {Math.round((st.richtig / st.antworten) * 100)}&nbsp;% beim ersten Versuch richtig
                      {st.schwer.length > 0 && (
                        <>
                          <br />
                          <span className="font-semibold text-amber">Oft falsch:</span> {st.schwer.map((w) => `${w.loesung} (${w.mal}×)`).join(" · ")}
                        </>
                      )}
                    </p>
                  ) : (
                    <p className="mt-1 text-[13px] text-ink-3">Noch nicht gespielt.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={spielkartenAktivAction.bind(null, s.id, !s.aktiv)}>
                    <button className="btn btn-ghost btn-sm">
                      {s.aktiv ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />} {s.aktiv ? "Aus dem Spiel nehmen" : "Ins Spiel nehmen"}
                    </button>
                  </form>
                  <Link href={`/schueler/${student.id}/spielkarten/${s.id}`} className="btn btn-secondary btn-sm">
                    <Pencil size={14} aria-hidden /> Bearbeiten
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
