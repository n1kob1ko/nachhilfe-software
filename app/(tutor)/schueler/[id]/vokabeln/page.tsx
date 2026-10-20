import { ListPlus, Pencil, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Empty, PageHeader, formatDate } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { getStudent } from "@/lib/repo";
import { listenVon } from "@/lib/vokabellisten";

export const metadata = { title: "Vokabellisten" };

/** Eigene Vokabellisten eines Schülers: anlegen, ändern, daraus eine Übung erstellen (lib/vokabellisten.ts). */
export default async function Vokabellisten({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ gespeichert?: string; geloescht?: string }> }) {
  await requireTeacher();
  const { id } = await params;
  const sp = await searchParams;
  const student = getStudent(Number(id));
  if (!student) notFound();
  const first = student.name.split(" ")[0];
  const listen = listenVon(student.id);
  const gespeichert = listen.find((l) => l.id === Number(sp.gespeichert));
  const neu = `/schueler/${student.id}/vokabeln/neu`;
  return (
    <>
      <PageHeader
        title={`Vokabellisten von ${first}`}
        info="Eigene Wortlisten, zum Beispiel aus dem Schulbuch oder für die nächste Schularbeit. Geübt wird Deutsch → Englisch, Englisch → Deutsch, mit Auswahl und mit einer Lücke im Beispielsatz. Die App prüft die Antworten ohne KI."
        back={{ href: `/schueler/${student.id}?tab=uebungen`, label: student.name }}
        actions={
          listen.length > 0 && (
            <Link href={neu} className="btn btn-primary">
              <ListPlus size={16} aria-hidden /> Neue Liste
            </Link>
          )
        }
      />
      {(gespeichert || sp.geloescht) && (
        <p className="mb-6 max-w-[900px] rounded-2xl bg-green-wash px-4 py-3 text-[14px] text-green" role="status">
          {gespeichert ? (
            <>
              „{gespeichert.title}“ ist gespeichert.{" "}
              <Link href={`/uebungen/neu?schueler=${student.id}&vokabeln=${gespeichert.id}`} className="font-semibold underline">
                Übung daraus erstellen
              </Link>
            </>
          ) : (
            "Die Liste ist gelöscht."
          )}
        </p>
      )}
      {listen.length === 0 ? (
        <Empty
          title={`Noch keine Vokabelliste für ${first}`}
          action={
            <Link href={neu} className="btn btn-primary">
              <ListPlus size={16} aria-hidden /> Erste Liste anlegen
            </Link>
          }
        >
          Tipp die Wörter ein oder füg sie aus einer Tabelle ein. Fertige Themenlisten wie Familie, Tiere oder Freizeit findest du beim Übung erstellen unter Englisch › Vocabulary.
        </Empty>
      ) : (
        <ul className="grid max-w-[900px] gap-3" data-testid="vokabellisten">
          {listen.map((l) => (
            <li key={l.id} className="panel flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold [overflow-wrap:anywhere]">{l.title}</p>
                <p className="text-[13px] text-ink-3">
                  {l.woerter} {l.woerter === 1 ? "Wort" : "Wörter"} · geändert am {formatDate(l.updated_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/schueler/${student.id}/vokabeln/${l.id}`} className="btn btn-secondary btn-sm">
                  <Pencil size={14} aria-hidden /> Bearbeiten
                </Link>
                <Link href={`/uebungen/neu?schueler=${student.id}&vokabeln=${l.id}`} className="btn btn-primary btn-sm">
                  <Sparkles size={14} aria-hidden /> Übung erstellen
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
