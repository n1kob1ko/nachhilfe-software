import Link from "next/link";
import { ArrowRight, BookMarked, CalendarClock, Check, CheckCircle2, ChevronDown, FileCheck2, NotebookPen, PenLine, Play, Plus, Presentation } from "lucide-react";
import { loadDemoData } from "@/app/actions";
import { startUnitAction } from "@/app/session-actions";
import { abhakenAction } from "@/app/zu-erledigen-actions";
import { entferneVorschlagAction, vorschlagZeigenAction } from "@/app/cockpit-actions";
import { KeinPaket, VorschlagWarum } from "@/components/cockpit/Vorbereitung";
import { Avatar, SubjectArt } from "@/components/Art";
import { Tagesplan, type TagesplanPunkt } from "@/components/Calendar";
import { Elapsed, Restzeit } from "@/components/Elapsed";
import { StudentFocus } from "@/components/StudentFocus";
import { Wochenplan } from "@/components/planung/Wochenplan";
import { Empty, Pill, SectionTitle, formatDate, formatTime } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { activeMaterial, materialLabel } from "@/lib/current-material";
import { bisBeginnLabel, heutigeEinheiten, zeitfenster } from "@/lib/planung/heute";
import { leseRegeln } from "@/lib/planung/regeln";
import { wochenUebersicht } from "@/lib/planung/uebersicht";
import { ZEITZONE, minutenLabel, tagAddieren, wienerDatum, wienerMinuten, wienerWochenstart } from "@/lib/planung/zeit";
import { klassenLabel } from "@/lib/school";
import { getUnit, listUnits, platzFuerEinheit, runningUnits } from "@/lib/units";
import { vorbereitung } from "@/lib/cockpit";
import { getLernpaket, listLernpakete } from "@/lib/lernpakete";
import { pruefungsHinweise, STAGE_LABEL } from "@/lib/exams";
import { ZUSTAND_LABEL, ZUSTAND_TONE, zuErledigen, type Punkt } from "@/lib/zu-erledigen";
import { kostenSchaetzung } from "@/lib/lernpaket-ki";
import { naechsteEinheiten, VORAUS_TAGE, type NaechsteEinheit } from "@/lib/vorbereitung-auto";

const parseLocal = (s: string) => new Date(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s) && !/Z|[+-]\d{2}:?\d{2}$/.test(s) ? s.replace(" ", "T") : s);
const firstName = (n: string) => n.split(" ")[0];

/**
 * Der Ort eines Platzes im Tagesplan: Raumname und Gebäude. „Online“ als Gebäudename wäre neben
 * dem Hinweis „online“ nur doppelt und wird weggelassen; ohne Raum steht „Raum noch offen“.
 */
const ortLabel = (raum: string | null, gebaeude: string | null, online: boolean): string => {
  if (!raum) return online ? "online" : "Raum noch offen";
  const zusatz = gebaeude && gebaeude.toLowerCase() !== (online ? "online" : "vor ort") ? ` · ${gebaeude}` : "";
  return `${raum}${zusatz}${online ? " · online" : ""}`;
};

/**
 * The start page answers one question: what do I do now? A running unit, or the big
 * "Einheit starten" button; below it only today, recently used students and open to-dos.
 *
 * Mit `?tab=woche` steht hier **Meine Woche**: die eigene **veröffentlichte** Woche des Lehrers,
 * nur lesend (D23). Entwürfe und fremde Wochen sieht nur die Verwaltung unter /planung.
 */

/** Das Thema zum Bild der Bühne: der aktuelle Stoff des Schülers (Thema und Unterthema). */
const bildThema = (studentId: number) => {
  const m = activeMaterial(studentId)[0];
  return m ? `${m.topic} ${materialLabel(m)}` : null;
};

export default async function StartPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const teacher = await requireTeacher();
  const sp = await searchParams;
  if (sp.tab === "woche") {
    return (
      <>
        <StartTabs aktiv="woche" />
        <MeineWoche teacherId={teacher.id} name={teacher.name} />
      </>
    );
  }
  const students = repo.listStudents();
  const now = new Date();
  // „heute“ in Vienna: kurz nach Mitternacht ist in UTC noch gestern
  const today = wienerDatum(now);
  const tomorrow = tagAddieren(today, 1);

  if (students.length === 0) {
    return (
      <>
        <StartTabs aktiv="start" />
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
  const todays = repo.lessonsBetween(`${today}T00:00`, `${tomorrow}T00:00`).filter((l) => l.status !== "abgesagt" && (!l.teacher_id || l.teacher_id === teacher.id));
  const next = todays.find((l) => l.status !== "abgeschlossen" && parseLocal(l.starts_at).getTime() + l.duration_min * 60_000 > now.getTime());

  /**
   * Der **Tagesplan** (D17): was heute ansteht, in der Reihenfolge des Tages. Die Liste kommt aus
   * den **veröffentlichten** Plätzen des Wochenplans (`geplante_einheiten`); dazu kommen die von
   * Hand geplanten Einheiten, für die es keinen Platz gibt (`lessons.status = 'geplant'` bleibt
   * dafür bestehen, siehe docs/planung.md) und was heute schon dokumentiert ist.
   */
  const slots = heutigeEinheiten(teacher.id);
  const jetztMinuten = wienerMinuten(now);
  const naechsterPlatz = slots.find((p) => p.unit_id === null && p.start_min + p.geplante_dauer > jetztMinuten) ?? null;
  const schuelerMitPlatz = new Set(slots.map((p) => p.student_id));
  const minutenVon = (s: string) => {
    const d = parseLocal(s);
    return d.getHours() * 60 + d.getMinutes();
  };
  // nahe Prüfungen je Schüler, damit sie im Tagesplan neben dem Raum stehen (niko, 21.10.2026)
  const pruefungen = pruefungsHinweise(today, { teacherId: teacher.id });
  const pruefungVon = (studentId: number) => {
    const p = pruefungen.get(studentId);
    return p ? { text: p.text, tone: p.tone } : null;
  };
  // „Einheit vorbereiten“: das Lernpaket für heute, das Cockpit übernimmt es beim Start (lib/cockpit.ts); nur, wenn es Pakete gibt
  const mitPaketen = listLernpakete().length > 0;
  const vorbereiten = (studentId: number, offen: boolean) => {
    if (!mitPaketen || !offen) return null;
    const v = vorbereitung(studentId, today);
    return { href: `/schueler/${studentId}/vorbereiten`, paket: v ? (getLernpaket(v.paket_id)?.title ?? null) : null };
  };
  const tagesplan: (TagesplanPunkt & { sort: number })[] = [
    ...slots.map((p) => {
      const unit = p.unit_id === null ? null : getUnit(p.unit_id);
      return {
        key: `platz-${p.id}`,
        zeit: p.zeit_label,
        studentId: p.student_id,
        studentName: p.student_name,
        ort: ortLabel(p.room_name, p.room_building, p.room_mode === "online"),
        // die Dauer steht schon in „14:00–15:40“; hier zählt, ob eine Prüfung naht
        hinweis: "",
        pruefung: pruefungVon(p.student_id),
        einheitId: p.unit_id,
        einheitStatus: unit?.status ?? null,
        nichtStattgefunden: p.nicht_stattgefunden,
        ohnePlatz: false,
        erledigt: unit?.status === "beendet",
        briefingHref: p.nicht_stattgefunden || unit?.status === "beendet" ? null : `/schueler/${p.student_id}/briefing?start=1&platz=${p.id}`,
        vorbereiten: vorbereiten(p.student_id, p.unit_id === null && !p.nicht_stattgefunden),
        sort: p.start_min,
      };
    }),
    ...todays
      .filter((l) => !schuelerMitPlatz.has(l.student_id))
      .map((l) => ({
        key: `lesson-${l.id}`,
        // Dauer 0 = ohne Uhrzeit dokumentiert (Import der Dokumentation, D27)
        zeit: l.duration_min ? formatTime(parseLocal(l.starts_at).toISOString()) : "–",
        studentId: l.student_id,
        studentName: l.student_name,
        ort: l.subject || "",
        hinweis: l.topic,
        pruefung: pruefungVon(l.student_id),
        einheitId: l.unit_id,
        einheitStatus: l.unit_id ? (getUnit(l.unit_id)?.status ?? null) : null,
        nichtStattgefunden: false,
        ohnePlatz: l.status === "geplant",
        erledigt: l.status === "abgeschlossen",
        briefingHref: l.status === "abgeschlossen" ? null : `/schueler/${l.student_id}/briefing?start=1`,
        vorbereiten: vorbereiten(l.student_id, !l.unit_id && l.status !== "abgeschlossen"),
        sort: minutenVon(l.starts_at),
      })),
  ].sort((a, b) => a.sort - b.sort);
  const schuelerHeute = new Set(tagesplan.map((p) => p.studentId)).size;

  /**
   * Was der große Knopf oben anbietet: der nächste offene Platz aus dem Wochenplan, sonst die
   * nächste von Hand geplante Einheit. Beide Wege starten dieselbe Einheit — mit Platz verknüpft
   * sie sich dabei (D17), ohne Platz läuft sie wie bisher.
   */
  // Beginn und Ende stehen groß in der Bühne und in der Kennzahl (niko, 21.10.2026: „wann der Schüler kommt und bis wann er aus hat“)
  const fokus = naechsterPlatz
    ? (() => {
        const f = zeitfenster(naechsterPlatz, now);
        return {
          studentId: naechsterPlatz.student_id,
          name: naechsterPlatz.student_name,
          von: f.von,
          bis: f.bis as string | null,
          wann: f.bisBeginn === null ? null : bisBeginnLabel(f.bisBeginn),
          zusatz: [naechsterPlatz.room_name, `${naechsterPlatz.geplante_dauer} min`].filter(Boolean).join(" · "),
          subject: byId.get(naechsterPlatz.student_id)?.subjects[0],
        };
      })()
    : next
      ? (() => {
          const start = parseLocal(next.starts_at);
          const bisBeginn = Math.round((start.getTime() - now.getTime()) / 60_000);
          return {
            studentId: next.student_id,
            name: next.student_name,
            von: formatTime(start.toISOString()),
            bis: next.duration_min ? formatTime(new Date(start.getTime() + next.duration_min * 60_000).toISOString()) : null,
            wann: bisBeginnLabel(bisBeginn),
            zusatz: next.topic || next.subject,
            subject: next.subject,
          };
        })()
      : null;

  // recently used = the students of my latest units, then everyone else
  const myUnits = listUnits({ teacherId: teacher.id });
  const recentIds = [...new Set(myUnits.map((u) => u.student_id))].filter((id) => byId.has(id));
  const ordered = [...new Set([...(fokus ? [fokus.studentId] : []), ...slots.map((p) => p.student_id), ...todays.map((l) => l.student_id), ...recentIds, ...students.map((s) => s.id)])].map((id) => byId.get(id)!);

  // Zu erledigen (lib/zu-erledigen.ts): Prüfungen, Ergebnisse, Hausübungen und abgegebene Texte, je mit Zustand
  const todos = zuErledigen(teacher.id, today, now);
  const ueberfaellig = todos.offen.filter((p) => p.zustand === "ueberfaellig").length;
  const zuBewerten = todos.offen.filter((p) => p.zustand === "wartet").length;

  // „Stunden automatisch vorbereiten“ (lib/vorbereitung-auto.ts): die nächsten 7 Tage, ohne KI; nur Vorschläge
  const naechste = naechsteEinheiten(teacher.id, now);
  const kiKosten = naechste.some((n) => n.ki) ? kostenSchaetzung().text : "";

  return (
    <>
      <StartTabs aktiv="start" />
      <Greeting name={teacher.name} date={now} />

      <Kennzahlen
        werte={[
          { wort: "Heute", wert: String(tagesplan.length), zusatz: tagesplan.length === 0 ? "keine Einheit" : tagesplan.length === 1 ? "Einheit" : `Einheiten, ${schuelerHeute} Schüler`, href: "#heute" },
          // die laufende Einheit steht in der Bühne; hier immer die Uhrzeit der nächsten geplanten Einheit (niko, 21.10.2026)
          { wort: "Als Nächstes", wert: fokus ? fokus.von : "–", zusatz: fokus ? (fokus.bis ? `${firstName(fokus.name)} · bis ${fokus.bis}` : firstName(fokus.name)) : running.length > 0 ? "nichts mehr geplant" : "nichts geplant", href: fokus ? "#heute" : undefined },
          { wort: "Zu erledigen", wert: String(todos.offen.length), zusatz: todos.offen.length === 0 ? "nichts offen" : ueberfaellig ? `davon ${ueberfaellig} überfällig` : zuBewerten ? `davon ${zuBewerten} zu bewerten` : todos.offen.some((t) => t.art === "pruefung") ? "Prüfungen und mehr" : "Hausübungen, Ergebnisse", href: "#offen" },
          { wort: "Schüler", wert: String(students.length), zusatz: `${recentIds.length} zuletzt bei dir`, href: "/schueler" },
        ]}
      />

      <div className="space-y-10">
        {running.length > 0 ? (
          running.map((u) => {
            // der Platz im Wochenplan liefert das geplante Ende: „14:00–15:40 · noch 38 min“
            const platz = platzFuerEinheit(u);
            const fenster = platz ? zeitfenster(platz, now) : null;
            return (
            <section key={u.id} className="buehne px-6 py-7 md:px-8" aria-label="Laufende Einheit">
              <div className="relative z-10 md:pr-[220px]">
                <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold text-white">
                  <span className="h-2 w-2 rounded-full bg-white" aria-hidden /> Einheit läuft
                </p>
                <h2 className="mt-3 text-[28px] leading-tight font-semibold md:text-[32px]">Einheit mit {firstName(u.student_name)}</h2>
                {fenster && (
                  <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="num text-[22px] leading-none font-semibold">{fenster.label}</span>
                    {fenster.restMinuten !== null && (
                      <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[14px] font-semibold">
                        <Restzeit rest={fenster.restMinuten} ab={now.getTime()} />
                      </span>
                    )}
                  </p>
                )}
                <p className="buehne-meta mt-1 text-[16px]">
                  seit <span className="num">{formatTime(u.started_at)}</span> (<Elapsed since={u.started_at} />){u.subject && ` · ${u.subject}`}
                </p>
                <StudentFocus studentId={u.student_id} />
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href={`/einheiten/${u.id}`} className="btn btn-primary btn-lg">
                    Zur Einheit <ArrowRight size={18} aria-hidden />
                  </Link>
                  <Link href={`/tafel/${u.id}`} className="btn btn-secondary btn-lg">
                    <Presentation size={18} aria-hidden /> Whiteboard
                  </Link>
                </div>
              </div>
              <SubjectArt subject={u.subject} topic={bildThema(u.student_id)} seed={u.student_id} className="pointer-events-none absolute -right-2 -bottom-6 hidden h-[220px] w-[220px] md:block" />
            </section>
            );
          })
        ) : (
          <section className="buehne px-6 py-7 md:px-8" aria-label="Einheit starten">
            <div className="relative z-10 md:pr-[220px]">
              {fokus ? (
                <>
                  <p className="text-[13px] font-semibold tracking-[0.06em] text-white/90 uppercase">
                    Als Nächstes{fokus.wann && <span className="num"> · {fokus.wann}</span>}
                  </p>
                  <h2 className="mt-1 text-[28px] leading-tight font-semibold md:text-[32px]">{fokus.name}</h2>
                  <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="num text-[22px] leading-none font-semibold">{fokus.bis ? `${fokus.von}–${fokus.bis}` : fokus.von}</span>
                    {fokus.zusatz && <span className="buehne-meta text-[16px]">{fokus.zusatz}</span>}
                  </p>
                  <StudentFocus studentId={fokus.studentId} />
                  <div className="mt-6 flex flex-wrap items-start gap-3">
                    <form action={startUnitAction.bind(null, fokus.studentId)}>
                      <button className="btn btn-primary btn-lg">
                        <Play size={18} aria-hidden /> Einheit mit {firstName(fokus.name)} starten
                      </button>
                    </form>
                  </div>
                  <StudentPicker students={ordered.filter((s) => s.id !== fokus.studentId)} label="Anderen Schüler wählen" />
                </>
              ) : (
                <>
                  <h2 className="text-[28px] leading-tight font-semibold md:text-[32px]">Einheit starten</h2>
                  <p className="buehne-meta mt-1 text-[16px]">Wähle den Schüler, mit dem du jetzt arbeitest.</p>
                  <StudentPicker students={ordered} open />
                </>
              )}
            </div>
            <SubjectArt subject={fokus?.subject ?? ordered[0]?.subjects[0]} topic={bildThema(fokus?.studentId ?? ordered[0]?.id ?? 0)} seed={fokus?.studentId ?? ordered[0]?.id} className="pointer-events-none absolute -right-2 -bottom-6 hidden h-[220px] w-[220px] md:block" />
          </section>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2">
          <section id="heute">
            <SectionTitle>{schuelerHeute > 0 ? `Heute: ${schuelerHeute} Schüler` : "Heute"}</SectionTitle>
            {tagesplan.length === 0 ? (
              <p className="text-[15px] text-ink-2">Heute sind keine Einheiten eingeplant.</p>
            ) : (
              <Tagesplan punkte={tagesplan.map(({ sort, ...punkt }) => punkt)} starten={startUnitAction} />
            )}
          </section>

          <section id="offen">
            <SectionTitle>Zu erledigen</SectionTitle>
            {todos.offen.length === 0 ? (
              <p className="text-[15px] text-ink-2">Nichts offen.</p>
            ) : (
              <>
                <TodoListe punkte={todos.offen.slice(0, 6)} />
                {todos.offen.length > 6 && (
                  <details className="group mt-3">
                    <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[14px] font-medium text-accent">
                      Noch {todos.offen.length - 6} weitere <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <TodoListe punkte={todos.offen.slice(6)} />
                  </details>
                )}
              </>
            )}
            {todos.erledigt.length > 0 && (
              <details className="group mt-3" data-testid="todo-erledigt">
                <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[14px] font-medium text-ink-2 hover:text-ink">
                  Erledigt <span className="num">({todos.erledigt.length})</span> <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <TodoListe punkte={todos.erledigt.slice(0, 10)} />
              </details>
            )}
          </section>
        </div>

        {naechste.length > 0 && (
          <section id="vorbereitung" aria-label="Nächste Einheiten">
            <SectionTitle>{`Vorbereitung: nächste ${VORAUS_TAGE} Tage`}</SectionTitle>
            <VorbereitungListe punkte={naechste.slice(0, 6)} kosten={kiKosten} />
            {naechste.length > 6 && (
              <details className="group mt-3">
                <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[14px] font-medium text-accent">
                  Noch {naechste.length - 6} weitere <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <VorbereitungListe punkte={naechste.slice(6)} kosten={kiKosten} />
              </details>
            )}
          </section>
        )}

        {recentIds.length > 0 && (
          <section>
            <SectionTitle action={<Link href="/schueler" className="link text-[14px] font-medium">Alle Schüler</Link>}>Zuletzt verwendet</SectionTitle>
            <ul className="flex flex-wrap gap-3">
              {recentIds.slice(0, 6).map((id) => {
                const s = byId.get(id)!;
                return (
                  <li key={id}>
                    <Link href={`/schueler/${id}`} className="panel flex min-h-[60px] items-center gap-3 py-2 pr-5 pl-2.5 hover:border-line-strong">
                      <Avatar name={s.name} size={40} />
                      <span>
                        <span className="block font-semibold">{s.name}</span>
                        <span className="block text-[13px] text-ink-2">{klassenLabel(s.school_type, s.klasse, { short: true })}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

/**
 * Je kommende Einheit eine Zeile: das Paket, das der Lehrer gewählt hat, sonst der Vorschlag der App mit „Warum“
 * und „Entfernen“, oder „Kein Paket für …“ mit „Mit KI entwerfen“ (kostet erst nach dem Klick im Formular).
 */
function VorbereitungListe({ punkte, kosten }: { punkte: NaechsteEinheit[]; kosten: string }) {
  return (
    <ul className="panel divide-y divide-line" data-testid="vorbereitung">
      {punkte.map((n) => {
        const href = `/schueler/${n.studentId}/vorbereiten${n.heute ? "" : `?datum=${n.datum}`}`;
        const w = n.wahl;
        return (
          <li key={n.key} className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3">
            <span className="num w-full shrink-0 text-[14px] leading-snug font-semibold sm:w-[106px]">
              {n.heute ? "Heute" : n.tag} <span className="font-normal text-ink-2 sm:block">{n.zeit}</span>
            </span>
            <div className="grid min-w-0 flex-1 basis-[15rem] gap-1">
              <Link href={`/schueler/${n.studentId}`} className="truncate font-semibold hover:text-accent">
                {n.studentName}
                {n.fach && <span className="font-normal text-ink-2"> · {n.fach}</span>}
              </Link>
              {w.art === "gewaehlt" && (
                <p className="flex items-center gap-1.5 text-[14px]">
                  <CheckCircle2 size={15} className="shrink-0 text-green" aria-hidden /> <span className="font-medium">{w.paket.title}</span> <span className="text-ink-3">· von dir gewählt</span>
                </p>
              )}
              {w.art === "paket" && (
                <>
                  <p className="flex items-center gap-1.5 text-[14px] font-medium">
                    <BookMarked size={15} className="shrink-0 text-accent" aria-hidden /> {w.paket.title}
                  </p>
                  <VorschlagWarum warum={w.warum} unsicher={w.unsicher} />
                  {w.luecke && n.ki && <KeinPaket klein thema={w.luecke.thema} ki={n.ki} kosten={kosten} />}
                </>
              )}
              {w.art === "kein_paket" && (
                <>
                  <KeinPaket klein thema={w.thema} ki={n.ki} kosten={kosten} entwuerfe={w.entwuerfe} />
                  <p className="text-[13px] text-ink-3">Warum dieses Thema: {w.signal.warum}</p>
                </>
              )}
              {w.art === "entfernt" && <p className="text-[14px] text-ink-2">Ohne Lernpaket</p>}
              {w.art === "ohne_signal" && <p className="text-[13px] text-ink-3">Noch kein Thema aus Prüfung, Lernstand oder letzter Einheit.</p>}
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {w.art === "paket" && (
                <form action={entferneVorschlagAction.bind(null, n.studentId)}>
                  <input type="hidden" name="datum" value={n.datum} />
                  <input type="hidden" name="ziel" value="start" />
                  <button className="btn btn-ghost btn-sm">Entfernen</button>
                </form>
              )}
              {w.art === "entfernt" && (
                <form action={vorschlagZeigenAction.bind(null, n.studentId)}>
                  <input type="hidden" name="datum" value={n.datum} />
                  <input type="hidden" name="ziel" value="start" />
                  <button className="btn btn-ghost btn-sm">Vorschlag zeigen</button>
                </form>
              )}
              <Link href={href} className="btn btn-secondary btn-sm">
                {w.art === "paket" ? "Anderes Paket" : w.art === "gewaehlt" ? "Ändern" : "Paket wählen"}
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const TODO_ICON = { pruefung: CalendarClock, ergebnis: FileCheck2, hausuebung: NotebookPen, text: PenLine };

/** Was ein Punkt in „Zu erledigen“ sagt; der Zustand steht darunter. */
function todoText(p: Punkt): React.ReactNode {
  const name = <b>{firstName(p.studentName)}</b>;
  switch (p.art) {
    case "pruefung": {
      const e = p.pruefung;
      return (
        <>
          <span className={`font-semibold ${e.stage === "bald" ? "text-red" : e.stage === "prioritaet" ? "text-amber" : ""}`}>{STAGE_LABEL[e.stage]}:</span> {e.kind} {e.subject} von {name} {e.days === 0 ? "heute" : e.days === 1 ? "morgen" : `in ${e.days} Tagen`}
        </>
      );
    }
    case "ergebnis":
      return p.zustand === "wartet" ? (
        <>
          Ergebnis von {name} bewerten: {p.titel} ({p.zuBewerten} {p.zuBewerten === 1 ? "Antwort" : "Antworten"})
        </>
      ) : (
        <>
          Ergebnis von {name} ansehen: {p.titel} ({p.richtig}/{p.aufgaben} richtig)
        </>
      );
    case "hausuebung":
      return (
        <>
          Hausübung von {name}
          {p.zustand === "erledigt" ? "" : " kontrollieren"}: {p.beschreibung}
          {p.uebung && <span className="text-ink-2"> · Übung „{p.uebung}“</span>}
        </>
      );
    case "text":
      return (
        <>
          Text von {name} {p.zustand === "erledigt" ? "abgegeben" : "ansehen"}: {p.titel}
        </>
      );
  }
}

/** Die Zeilen von „Zu erledigen“ (offen oder erledigt): Link zum Punkt, Zustand, Datum und, wo es geht, „Abhaken“. */
function TodoListe({ punkte }: { punkte: Punkt[] }) {
  return (
    <ul className="panel divide-y divide-line">
      {punkte.map((p) => {
        const Icon = p.zustand === "erledigt" ? CheckCircle2 : TODO_ICON[p.art];
        return (
          <li key={p.key} className="flex items-stretch">
            <Link href={p.href} className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-[14px] hover:bg-panel/60">
              <Icon size={19} className={`shrink-0 ${p.zustand === "erledigt" ? "text-green" : "text-accent"}`} aria-hidden />
              <span className={`min-w-0 flex-1 ${p.zustand === "erledigt" ? "text-ink-2" : ""}`}>
                {todoText(p)}
                <span className="mt-1 block">
                  <Pill tone={ZUSTAND_TONE[p.zustand]}>{ZUSTAND_LABEL[p.zustand]}</Pill>
                </span>
              </span>
              <span className="num shrink-0 text-[13px] text-ink-3">{formatDate(p.datum, { day: "numeric", month: "short" })}</span>
            </Link>
            {p.abhaken && (
              <form action={abhakenAction.bind(null, p.abhaken)} className="flex shrink-0 items-center pr-2">
                <button className="btn btn-ghost btn-sm min-h-[44px] min-w-[44px] !px-2 text-ink-3 hover:text-green" aria-label="Abhaken" title="Abhaken">
                  <Check size={18} aria-hidden />
                </button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Vier Zahlen, die den Tag auf einen Blick erklären: heute, als Nächstes, offen, Schüler. */
function Kennzahlen({ werte }: { werte: { wort: string; wert: string; zusatz: string; href?: string }[] }) {
  return (
    <ul className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Auf einen Blick">
      {werte.map((k) => {
        const inner = (
          <>
            <span className="kennzahl-wort">{k.wort}</span>
            <span className="kennzahl-wert">{k.wert}</span>
            <span className="kennzahl-zusatz">{k.zusatz}</span>
          </>
        );
        return (
          <li key={k.wort} className="min-w-0">
            {k.href ? (
              <Link href={k.href} className="kennzahl drueck block h-full transition-colors hover:border-line-strong">
                {inner}
              </Link>
            ) : (
              <div className="kennzahl h-full">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
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

/** Die zwei Tabs der Startseite: der Tagesablauf und „Meine Woche“ (die eigene veröffentlichte Woche). */
function StartTabs({ aktiv }: { aktiv: "start" | "woche" }) {
  const tabs = [
    { key: "start" as const, href: "/", label: "Start" },
    { key: "woche" as const, href: "/?tab=woche", label: "Meine Woche" },
  ];
  return (
    <nav className="no-print mb-6 flex flex-wrap gap-2" aria-label="Startseite">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} aria-current={aktiv === t.key ? "page" : undefined} className={`btn btn-sm ${aktiv === t.key ? "btn-primary" : "btn-secondary"}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * „Meine Woche“ (D23): die eigene Woche, **nur veröffentlichte** Plätze, nur zum Lesen. Gedacht als
 * kurzer Blick vom Dashboard aus — geändert wird unter Mehr › Planung (Verwaltung).
 */
async function MeineWoche({ teacherId, name }: { teacherId: number; name: string }) {
  const woche = wienerWochenstart();
  const uebersicht = wochenUebersicht(woche, { status: "veroeffentlicht", nurLehrerId: teacherId });
  return (
    <>
      <header className="mb-5">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] md:text-[32px]">Meine Woche</h1>
        <p className="mt-1 text-[15px] text-ink-2">
          {uebersicht.label} · {uebersicht.summen.einheiten} geplante Einheiten · {name} · nur veröffentlichte Plätze
        </p>
      </header>
      {uebersicht.plaetze.length === 0 ? (
        <p className="panel px-5 py-6 text-[15px] text-ink-2">
          Für dich ist diese Woche nichts veröffentlicht. Sobald die Verwaltung den Plan veröffentlicht, steht er hier.
        </p>
      ) : (
        <Wochenplan
          uebersicht={uebersicht}
          darfBearbeiten={false}
          basisPfad="/?tab=woche"
          druckHref={`/planung/drucken?woche=${woche}`}
          aktuelleWoche={woche}
          zurueck={`/?tab=woche&woche=${woche}`}
          filter={{ lehrer: 0, raum: 0, schueler: 0 }}
          meldung={{}}
          regeln={leseRegeln()}
          regelnGebrochen={false}
          dialog={{ neu: false, platzId: 0, regeln: false }}
        />
      )}
    </>
  );
}

/** One tap starts the unit: every student is its own big button. */
function StudentPicker({ students, open, label }: { students: repo.Student[]; open?: boolean; label?: string }) {
  const list = (
    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
      {students.slice(0, 8).map((s) => (
        <li key={s.id}>
          <form action={startUnitAction.bind(null, s.id)}>
            <button className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl bg-surface px-3 py-2 text-left text-ink shadow-[var(--shadow-card)] transition-colors hover:bg-panel" aria-label={`Einheit mit ${s.name} starten`}>
              <Avatar name={s.name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.name}</span>
                <span className="block truncate text-[13px] text-ink-2">{s.subjects.join(", ") || klassenLabel(s.school_type, s.klasse, { short: true })}</span>
              </span>
              <Play size={18} className="shrink-0 text-accent" aria-hidden />
            </button>
          </form>
        </li>
      ))}
      {students.length > 8 && (
        <li className="sm:col-span-2">
          <Link href="/schueler" className="link text-[14px] font-medium">
            Alle {students.length} Schüler anzeigen
          </Link>
        </li>
      )}
    </ul>
  );
  if (open) return list;
  return (
    <details className="group mt-4">
      {/* steht in der blauen Bühne: weiß, nicht blau (niko, 21.10.2026) */}
      <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[15px] font-semibold text-white/90 hover:text-white">
        {label} <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      {list}
    </details>
  );
}
