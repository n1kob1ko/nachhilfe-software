import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Plus } from "lucide-react";
import { loadDemoData } from "@/app/actions";
import { AlteAnker } from "@/components/heute/AlteAnker";
import { SchuelerKarte } from "@/components/heute/SchuelerKarte";
import { SchuelerWahl } from "@/components/heute/SchuelerWahl";
import { TodoListe } from "@/components/heute/TodoListe";
import { Avatar } from "@/components/Art";
import { Restzeit } from "@/components/Elapsed";
import { Empty, MasteryBar, TrendBadge, formatTime } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { meineWoche, schuelerFortschritt, type SchuelerFortschritt, type TagBalken } from "@/lib/dashboard";
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
 * **Heute** als Dashboard (niko, 01.11.2026: „Die Heute-Seite soll wie ein Dashboard aussehen“, mit meiner Woche, wie
 * sich die Schüler verbessert haben und den Dingen zu erledigen; die Farben bleiben). Oben vier Kennzahlen (heute, diese
 * Woche, zu erledigen, verbessert), darunter Karten:
 *
 * - **Heute**: die heutigen Schüler, jeder auf einer kurzen Karte aus der automatischen Vorbereitung (lib/heute.ts) mit
 *   „Einheit starten“; ohne Plan die Schülerwahl. Fehlende KI-Briefings bereitet die App im Hintergrund vor.
 * - **Zu erledigen** (lib/zu-erledigen.ts): die ersten fünf offenen Punkte mit Abhaken, offene Abschlüsse zuerst.
 * - **Meine Woche** (lib/dashboard.ts): je Tag gehaltene und noch geplante Einheiten als Balken.
 * - **Fortschritt deiner Schüler** (lib/dashboard.ts): Lernstand und Veränderung der letzten vier Wochen.
 *
 * Läuft eine Einheit, steht sie ganz oben auf der Bühne mit „Zum Unterricht“. Heute leitet nie um; wohin die Lehrkraft
 * gehört, entscheidet `/jetzt`. Die volle Liste „Zu erledigen“, die Vorbereitung der nächsten Tage und der Wochenplan
 * bleiben unter Erweitert › Übersicht (`/mehr/uebersicht`).
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

  // offene Abschlüsse der letzten 14 Tage, auch automatisch beendete (lib/situation.ts): oben in „Zu erledigen“
  const abschluesse = offeneAbschluesse(teacher.id, { now });
  const offen = zuErledigen(teacher.id, wienerDatum(now), now).offen;
  const ueberfaellig = offen.filter((p) => p.zustand === "ueberfaellig").length;
  const woche = meineWoche(teacher.id, now);
  const fortschritt = schuelerFortschritt(teacher.id, now.getTime());

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

      <ul className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Auf einen Blick" data-testid="kennzahlen">
        <Kennzahl
          voll={running.length === 0}
          wort="Heute"
          wert={String(punkte.length)}
          zusatz={naechster ? `als Nächstes ${naechster.zeit.split("–")[0]} ${firstName(naechster.studentName)}` : punkte.length > 0 ? (punkte.length === 1 ? "Einheit" : "Einheiten") : "niemand eingeplant"}
          href="#heute"
        />
        <Kennzahl wort="Diese Woche" wert={String(woche.gehalten + woche.geplant)} zusatz={`${woche.gehalten} gehalten · ${woche.geplant} geplant`} href="#woche" />
        <Kennzahl
          wort="Zu erledigen"
          wert={String(offen.length + abschluesse.length)}
          zusatz={offen.length + abschluesse.length === 0 ? "nichts offen" : ueberfaellig ? `davon ${ueberfaellig} überfällig` : abschluesse.length ? `davon ${abschluesse.length} Abschluss` : "offen"}
          href="#zu-erledigen"
        />
        <Kennzahl wort="Verbessert" wert={String(fortschritt.besser)} zusatz={`von ${fortschritt.liste.length} Schülern · 4 Wochen`} href="#fortschritt" />
      </ul>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Karte id="heute" titel={heute.size > 0 ? `Heute: ${heute.size} Schüler` : "Heute"} className="md:col-span-2">
          {punkte.length === 0 ? (
            <>
              <p className="text-[15px] text-ink-2">Heute ist niemand eingeplant. Mit wem arbeitest du jetzt?</p>
              <SchuelerWahl students={andere} offen />
            </>
          ) : (
            <>
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
              {andere.length > 0 && (
                <div className="mt-4">
                  <SchuelerWahl students={andere} />
                </div>
              )}
            </>
          )}
        </Karte>

        <Karte
          id="zu-erledigen"
          titel="Zu erledigen"
          action={
            offen.length > 5 ? (
              <Link href="/mehr/uebersicht#offen" className="link text-[14px] font-medium">
                Alle {offen.length}
              </Link>
            ) : null
          }
          testid="heute-hinweise"
        >
          {offen.length === 0 && abschluesse.length === 0 ? (
            <p className="flex items-center gap-2 text-[15px] text-ink-2">
              <CheckCircle2 size={18} className="text-green" aria-hidden /> Nichts offen.
            </p>
          ) : (
            <div className="-mx-5 -mb-4">
              {abschluesse.length > 0 && (
                <Link href="/abschluss" className="flex min-h-[52px] items-center gap-3 border-b border-line px-5 py-2 text-[14px] font-medium text-accent hover:bg-panel/60">
                  <CheckCircle2 size={19} className="shrink-0" aria-hidden />
                  {abschluesse.length === 1 ? `Abschluss mit ${firstName(abschluesse[0].studentName)} offen` : `${abschluesse.length} Abschlüsse offen`}
                </Link>
              )}
              <TodoListe punkte={offen.slice(0, 5)} rahmen={false} />
            </div>
          )}
        </Karte>

        <Karte
          id="woche"
          titel="Meine Woche"
          action={
            <Link href="/mehr/uebersicht?tab=woche" className="link text-[14px] font-medium">
              Wochenplan
            </Link>
          }
        >
          <WochenBalken balken={woche.balken} label={woche.label} />
        </Karte>

        <Karte
          id="fortschritt"
          titel="Fortschritt deiner Schüler"
          className="md:col-span-2"
          action={
            <Link href="/schueler" className="link text-[14px] font-medium">
              Alle Schüler
            </Link>
          }
        >
          <Fortschritt f={fortschritt} />
        </Karte>
      </div>
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

/** Eine Kennzahl oben; `voll`: die erste Karte in Blau (nur ohne laufende Einheit, damit es eine Bühne bleibt). */
function Kennzahl({ wort, wert, zusatz, href, voll = false }: { wort: string; wert: string; zusatz: string; href: string; voll?: boolean }) {
  return (
    <li className="min-w-0">
      <Link href={href} className={`kennzahl drueck block h-full transition-colors hover:border-line-strong ${voll ? "kennzahl-voll" : ""}`}>
        <span className="kennzahl-wort">{wort}</span>
        <span className="kennzahl-wert">{wert}</span>
        <span className="kennzahl-zusatz">{zusatz}</span>
      </Link>
    </li>
  );
}

/** Eine Karte des Dashboards: Titel links, eine leise Aktion rechts, darunter der Inhalt. */
function Karte({ id, titel, action, className = "", testid, children }: { id: string; titel: string; action?: React.ReactNode; className?: string; testid?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={`panel min-w-0 scroll-mt-4 px-5 pt-4 pb-4 ${className}`} aria-label={titel} data-testid={testid}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{titel}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Meine Woche als Balken: unten voll die gehaltenen Einheiten, darüber schraffiert die noch geplanten; der heutige Tag
 * in Blau. Jede Säule hat eine graue Spur, damit leere Tage sichtbar bleiben.
 */
function WochenBalken({ balken, label }: { balken: TagBalken[]; label: string }) {
  const max = Math.max(3, ...balken.map((t) => t.gehalten + t.geplant));
  const H = 132;
  return (
    <div data-testid="wochen-balken">
      <p className="mb-3 text-[13px] text-ink-3">{label}</p>
      <ol className="flex items-end justify-between gap-2" aria-label="Einheiten je Tag">
        {balken.map((t) => {
          const summe = t.gehalten + t.geplant;
          const hG = (t.gehalten / max) * H;
          const hP = (t.geplant / max) * H;
          return (
            <li key={t.tag} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" aria-label={`${t.kurz}: ${t.gehalten} gehalten, ${t.geplant} geplant`}>
              <span className={`num text-[13px] font-semibold ${summe ? (t.heute ? "text-accent" : "text-ink") : "text-ink-3"}`}>{summe}</span>
              <span className="relative flex w-full max-w-[40px] flex-col justify-end overflow-hidden rounded-full bg-[var(--bar-track)]" style={{ height: H }}>
                {t.geplant > 0 && <span className="wochen-geplant block w-full" style={{ height: hP }} />}
                {t.gehalten > 0 && <span className={`block w-full ${t.heute ? "bg-accent" : "bg-[var(--bar)]"}`} style={{ height: hG }} />}
              </span>
              <span className={`text-[13px] ${t.heute ? "rounded-full bg-accent px-2 font-semibold text-on-fill" : "text-ink-2"}`}>{t.kurz}</span>
            </li>
          );
        })}
      </ol>
      {balken.every((t) => t.gehalten + t.geplant === 0) && <p className="mt-3 text-[14px] text-ink-2">Diese Woche noch keine Einheit.</p>}
      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--bar)]" aria-hidden /> gehalten
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="wochen-geplant h-2.5 w-2.5 rounded-full" aria-hidden /> geplant
        </span>
      </p>
    </div>
  );
}

/**
 * Wie sich die Schüler verbessert haben: oben die Summe (besser, stabil, gesunken in vier Wochen), darunter die ersten
 * sechs mit Lernstand, Veränderung und der Fähigkeit mit dem größten Plus; der Rest aufgeklappt.
 */
function Fortschritt({ f }: { f: ReturnType<typeof schuelerFortschritt> }) {
  if (f.liste.length === 0) return <p className="text-[15px] text-ink-2">Noch keine Schüler.</p>;
  const zeile = (s: SchuelerFortschritt) => (
    <li key={s.id}>
      <Link href={`/schueler/${s.id}?tab=fortschritt`} className="-mx-2 flex min-h-[56px] flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl px-2 py-2 hover:bg-panel/60">
        <span className="flex min-w-0 flex-1 basis-[12rem] items-center gap-3">
          <Avatar name={s.name} size={36} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{s.name}</span>
            <span className="block truncate text-[13px] text-ink-2">
              {s.besserIn ? (
                <>
                  besser in <span className="font-medium text-ink">{s.besserIn.name}</span> <span className="num text-green">+{s.besserIn.delta}</span>
                </>
              ) : s.trend === "none" ? (
                <span className="text-ink-3">noch zu wenig Daten</span>
              ) : s.trend === "down" ? (
                "zuletzt schwächer"
              ) : s.trend === "flat" ? (
                "stabil"
              ) : (
                "verbessert sich"
              )}
            </span>
          </span>
        </span>
        <span className="flex w-full items-center gap-3 sm:w-[240px]">
          <span className="min-w-0 flex-1">
            <MasteryBar value={s.stand} size="sm" />
          </span>
          <span className="w-[58px] shrink-0 text-right">{s.trend !== "none" ? <TrendBadge trend={s.trend} delta={s.delta} compact /> : <span className="text-[13px] text-ink-3">–</span>}</span>
        </span>
      </Link>
    </li>
  );
  return (
    <>
      <p className="mb-2 flex flex-wrap gap-2 text-[13px]" data-testid="fortschritt-summe">
        <span className="rounded-full bg-[var(--green-wash)] px-2.5 py-0.5 font-semibold text-green">{f.besser} verbessert</span>
        <span className="rounded-full bg-panel px-2.5 py-0.5 font-semibold text-ink-2">{f.gleich} stabil</span>
        {f.schlechter > 0 && <span className="rounded-full bg-[var(--red-wash)] px-2.5 py-0.5 font-semibold text-red">{f.schlechter} gesunken</span>}
        <span className="self-center text-ink-3">in den letzten 4 Wochen</span>
      </p>
      <ul className="divide-y divide-line">{f.liste.slice(0, 6).map(zeile)}</ul>
      {f.liste.length > 6 && (
        <details className="group mt-1">
          <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[14px] font-medium text-accent">Noch {f.liste.length - 6} weitere</summary>
          <ul className="divide-y divide-line">{f.liste.slice(6).map(zeile)}</ul>
        </details>
      )}
    </>
  );
}
