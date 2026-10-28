import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { loadDemoData } from "@/app/actions";
import { AlteAnker } from "@/components/heute/AlteAnker";
import { SchuelerKarte } from "@/components/heute/SchuelerKarte";
import { SchuelerWahl } from "@/components/heute/SchuelerWahl";
import { Restzeit } from "@/components/Elapsed";
import { Empty, SectionTitle, formatTime } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { heuteKarten, naechsterPunkt, tagesplan } from "@/lib/heute";
import { expectedSubject } from "@/lib/learning";
import { bisBeginnLabel, zeitfenster } from "@/lib/planung/heute";
import { ZEITZONE, wienerDatum, wienerMinuten } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { offeneAbschluesse } from "@/lib/situation";
import { listUnits, platzFuerEinheit, runningUnits } from "@/lib/units";
import { zuErledigen } from "@/lib/zu-erledigen";

export const metadata = { title: "Heute" };

const firstName = (n: string) => n.split(" ")[0];

/**
 * **Heute** (niko, 25.10.2026: „Eine Ansicht. Eine aktuelle Aufgabe. Eine wichtigste Aktion.“): die heutigen Schüler,
 * jeder auf einer kurzen Karte aus der automatischen Vorbereitung (lib/heute.ts: Thema, Warum, was bereitliegt,
 * Schwierigkeiten, Prüfung; ohne KI gerechnet) und einem Knopf „Einheit starten“. Fehlende KI-Briefings bereitet die
 * App im Hintergrund vor, wenn es erlaubt ist; die Seite wartet nie darauf. Läuft eine Einheit, steht sie oben mit
 * „Zum Unterricht“, ihr Schüler unten nur noch als eine Zeile; die anderen Schüler bleiben darunter, damit ein
 * zweiter gleichzeitig starten kann. Heute leitet nie um (sonst käme man während einer
 * Einheit nie hierher); wohin die Lehrkraft gehört, entscheidet `/jetzt`.
 *
 * Was früher hier stand (Kennzahlen, Zu erledigen, Vorbereitung 7 Tage, Zuletzt verwendet, Meine Woche), steht unter
 * Erweitert › Übersicht (`/mehr/uebersicht`); `/?tab=woche` und die alten Anker `#offen`, `#vorbereitung` führen dorthin.
 */
export default async function HeutePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const teacher = await requireTeacher();
  const sp = await searchParams;
  // „Meine Woche“ ist umgezogen; alte Links (auch die Terminanfragen) kommen mit allen Angaben an
  if (sp.tab === "woche") {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) for (const x of [v ?? []].flat()) q.append(k, x);
    redirect(`/mehr/uebersicht?${q.toString()}`);
  }
  const now = new Date();
  const students = repo.listStudents();
  if (students.length === 0) {
    return (
      <>
        <Greeting name={teacher.name} date={now} />
        <Empty
          title="Noch keine Schüler angelegt"
          action={
            <>
              <Link href="/schueler/neu" className="btn btn-primary btn-lg">
                <Plus size={18} aria-hidden /> Ersten Schüler anlegen
              </Link>
              <form action={loadDemoData}>
                <button className="btn btn-secondary btn-lg">Mit Beispiel-Schülern ausprobieren</button>
              </form>
            </>
          }
        >
          Lege einen Schüler an. Danach startest du hier mit einem Klick die erste Einheit.
        </Empty>
      </>
    );
  }

  const byId = new Map(students.map((s) => [s.id, s]));
  const running = runningUnits(teacher.id);
  const punkte = tagesplan(teacher.id, now);
  const karten = heuteKarten(teacher.id, punkte, now, { kiVorbereiten: true });
  // der nächste Schüler: sein Knopf ist der Hauptknopf, solange keine Einheit läuft
  const naechster = naechsterPunkt(punkte, now);
  const jetzt = wienerMinuten(now);
  const heute = new Set(punkte.map((p) => p.studentId));
  // „Anderen Schüler starten“: wer heute keinen Platz hat, die zuletzt unterrichteten zuerst
  const zuletzt = [...new Set(listUnits({ teacherId: teacher.id }).map((u) => u.student_id))];
  const andere = [...new Set([...zuletzt, ...students.map((s) => s.id)])].filter((id) => byId.has(id) && !heute.has(id) && !running.some((u) => u.student_id === id)).map((id) => byId.get(id)!);

  // eine ruhige Zeile zu Erweitert: was offen ist, ohne es hier aufzulisten
  const todos = zuErledigen(teacher.id, wienerDatum(now), now).offen.length;
  // offene Abschlüsse der letzten 14 Tage, auch automatisch beendete (lib/situation.ts): eine leise Zeile nach /abschluss
  const abschluesse = offeneAbschluesse(teacher.id, { now });

  return (
    <>
      <AlteAnker />
      <Greeting name={teacher.name} date={now} />

      {running.length > 0 && (
        <div className="mb-8 grid gap-3">
          {running.map((u) => {
            // der Platz im Wochenplan liefert das geplante Ende: „09:40–11:20 · noch 38 min“
            const platz = platzFuerEinheit(u);
            const fenster = platz ? zeitfenster(platz, now) : null;
            return (
              <section key={u.id} className="buehne px-5 py-5 md:px-7" aria-label="Laufende Einheit" data-testid="laeuft-karte">
                <div className="relative z-10 flex flex-wrap items-center gap-x-6 gap-y-4">
                  <div className="min-w-0 flex-1">
                    <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold text-white">
                      <span className="h-2 w-2 rounded-full bg-white" aria-hidden /> läuft
                    </p>
                    <h2 className="mt-2 text-[24px] leading-tight font-semibold md:text-[28px]">Unterricht mit {firstName(u.student_name)}</h2>
                    <p className="buehne-meta mt-1 text-[15px]">
                      {fenster ? <span className="num">{fenster.label}</span> : <>seit <span className="num">{formatTime(u.started_at)}</span></>}
                      {fenster?.restMinuten !== null && fenster?.restMinuten !== undefined && (
                        <>
                          {" · "}
                          <Restzeit rest={fenster.restMinuten} ab={now.getTime()} />
                        </>
                      )}
                      {u.subject && ` · ${u.subject}`}
                    </p>
                  </div>
                  <Link href={`/einheiten/${u.id}`} className="btn btn-primary btn-lg w-full sm:w-auto">
                    Zum Unterricht <ArrowRight size={18} aria-hidden />
                  </Link>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <section id="heute" className="scroll-mt-4" aria-label="Heute">
        <SectionTitle>{heute.size > 0 ? `Heute: ${heute.size} Schüler` : "Heute"}</SectionTitle>
        {punkte.length === 0 ? (
          <div className="panel grid gap-2 px-5 py-5">
            <p className="text-[15px] text-ink-2">Heute ist niemand eingeplant. Mit wem arbeitest du jetzt?</p>
            <SchuelerWahl students={andere} offen />
          </div>
        ) : (
          <ul className="grid gap-3">
            {punkte.map((p) => (
              <SchuelerKarte
                key={p.key}
                p={p}
                student={byId.get(p.studentId)}
                karte={karten.get(p.key)}
                fach={p.fach || expectedSubject(p.studentId, now.getTime(), karten.get(p.key)?.fach)}
                haupt={running.length === 0 && naechster?.key === p.key}
                oben={running.some((u) => u.id === p.einheitId)}
                wann={naechster?.key === p.key && p.startMin > jetzt ? bisBeginnLabel(p.startMin - jetzt) : null}
              />
            ))}
          </ul>
        )}
      </section>

      {punkte.length > 0 && andere.length > 0 && (
        <div className="mt-6">
          <SchuelerWahl students={andere} />
        </div>
      )}

      {(todos > 0 || abschluesse.length > 0) && (
        <p className="mt-6 flex flex-wrap gap-x-5 border-t border-line pt-2 text-[14px] text-ink-2" data-testid="heute-hinweise">
          {abschluesse.length > 0 && (
            <Link href="/abschluss" className="inline-flex min-h-[44px] items-center font-medium text-accent hover:underline">
              {abschluesse.length === 1 ? `Abschluss mit ${firstName(abschluesse[0].studentName)} offen` : `${abschluesse.length} Abschlüsse offen`}
            </Link>
          )}
          {todos > 0 && (
            <Link href="/mehr/uebersicht#offen" className="inline-flex min-h-[44px] items-center font-medium text-accent hover:underline">
              {todos === 1 ? "1 Sache zu erledigen" : `${todos} Dinge zu erledigen`}
            </Link>
          )}
        </p>
      )}
    </>
  );
}

function Greeting({ name, date }: { name: string; date: Date }) {
  return (
    <header className="mb-6">
      <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] md:text-[32px]">Hallo, {firstName(name)}</h1>
      <p className="mt-1 text-[15px] text-ink-2">{date.toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long", timeZone: ZEITZONE })}</p>
    </header>
  );
}
