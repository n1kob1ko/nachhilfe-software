import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { BookOpenText, CalendarClock, Camera, CheckCircle2, ExternalLink, Images, PenLine, Plus, Printer, ScanLine, Square } from "lucide-react";
import { levelFor } from "@/lib/text-correction-rules";
import { bestaetigeDokuAction, endUnitAction } from "@/app/session-actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { BoardThumbs } from "@/components/BoardThumbs";
import { Unterricht } from "@/components/cockpit/Ablauf";
import { AblaufRueckblick } from "@/components/cockpit/Cockpit";
import { CopyLink } from "@/components/CopyLink";
import { Elapsed, Restzeit } from "@/components/Elapsed";
import { UnitDocForm } from "@/components/UnitDocForm";
import { EinschaetzungKarte } from "@/components/Einschaetzung";
import { CancelUnit } from "@/components/UnitControl";
import { UnitReportView } from "@/components/UnitReportView";
import { UnitSummary } from "@/components/UnitSummary";
import { UnitBriefView } from "@/components/UnitBriefView";
import { RunningUnitTexts, UnitDocuments } from "@/components/text/UnitTexts";
import { getText } from "@/lib/texts";
import { FamilyNote } from "@/components/FamilyNote";
import { Info } from "@/components/Info";
import { aiEnabled } from "@/lib/ai";
import { latestInsight } from "@/lib/ai/insights";
import { unitBrief } from "@/lib/summary";
import { ABSCHLUSS_FELDER, hatSichereErgebnisse, karteDerEinheit, quelleText } from "@/lib/abschluss";
import { AbschlussFeld } from "@/components/AbschlussFeld";
import { Pill, Reveal, SectionTitle, formatDate, formatTime } from "@/components/ui";
import { LiveStatus } from "@/components/device/LiveStatus";
import { liveSnapshot, studentDevice } from "@/lib/live";
import { baseUrl } from "@/lib/base-url";
import { autoFelderVon, leseEinschaetzung } from "@/lib/einschaetzung";
import { buildUnitReport, readReport } from "@/lib/learning";
import { mappeFuerEinheit, mappeHatInhalt } from "@/lib/mappe";
import { letzterStoff, minitestDerEinheit } from "@/lib/minitest";
import { LERNKONTROLLE } from "@/lib/quick-round";
import { MinitestKarte } from "@/components/MinitestKarte";
import { SchuelerNotizAnzeige } from "@/components/SchuelerNotiz";
import { hatInhalt, notizZuEinheit } from "@/lib/schueler-notiz";
import * as repo from "@/lib/repo";
import { requireTeacher } from "@/lib/auth";
import { zeitfenster } from "@/lib/planung/heute";
import { dayOf, pruefungsHinweise } from "@/lib/exams";
import { papierZeile } from "@/lib/blatt-regeln";
import { papierArbeit } from "@/lib/papier-einheit";
import { ZuBewertenListe } from "@/components/ZuBewerten";
import { zuBewerten, zuBewertenTitel } from "@/lib/zu-bewerten";

/** Textfarbe je Erinnerungsstufe (lib/exams.ts STAGE_TONE) */
const TON_TEXT = { neutral: "text-ink", amber: "text-amber", red: "text-red" } as const;
import { canManageUnit, getUnit, platzFuerEinheit, runningUnits, unitDurationMs, type UnitView } from "@/lib/units";

export const metadata = { title: "Einheit" };

const first = (n: string) => n.split(" ")[0];

/**
 * D16: „geplant 100 min · tatsächlich 85 min“. Die **geplante Dauer** kommt aus dem
 * Wochenplan-Platz, mit dem sich die Einheit verknüpft hat (`platzFuerEinheit`, D17); die
 * **Dauer** ist die echte Zeit von Start bis Ende. Ohne Platz steht nur die echte Dauer da —
 * abgerechnet wird ohnehin nur sie (`lib/billing.ts`).
 */
function dauerLabel(geplanteDauer: number | null, minutes: number, estimated: boolean): string {
  const echteDauer = `${estimated ? "ca. " : ""}${minutes} min`;
  return geplanteDauer === null ? echteDauer : `geplant ${geplanteDauer} min · tatsächlich ${echteDauer}`;
}

/**
 * One page per unit, in two states (niko, 25.10.2026: Heute · Unterricht · Abschluss):
 * running → **Unterricht**: der geführte Unterricht, Schritt für Schritt (components/cockpit/Ablauf.tsx); Übungen,
 *   Fortschritt und alle Werkzeuge darunter unter „Weitere Werkzeuge“ (`?bereich=uebungen|fortschritt|cockpit`);
 * ended → **Abschluss**: vier Felder aus den Daten (lib/abschluss.ts) und „Dokumentation bestätigen“; die ganze
 *   Dokumentation, automatisch geschrieben (lib/einschaetzung.ts) und änderbar, unter „Mehr Details“ und „Ändern“.
 */
export default async function UnitPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ bereits?: string; fremd?: string; bereich?: string; gesendet?: string; ki?: string; text?: string; minitest?: string; cockpit?: string; aendern?: string; details?: string; ausfuehrlich?: string; folien?: string; papier?: string; knopf?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const teacher = await requireTeacher();
  const unit = getUnit(Number(id));
  if (!unit) notFound();
  const mayManage = canManageUnit(teacher, unit);
  const student = repo.getStudent(unit.student_id)!;
  const lesson = repo.getLessonForUnit(unit.id);
  const running = unit.status === "gestartet";
  // D16/D17: der Wochenplan-Platz dieser Einheit — er liefert die geplante Dauer
  const platz = platzFuerEinheit(unit);
  // geplant „14:00–15:40“ und, solange sie läuft, „noch 38 min“ (niko, 21.10.2026)
  const fenster = platz ? zeitfenster(platz) : null;
  // naht eine Prüfung, steht sie in der Kopfzeile der laufenden Einheit (niko, 21.10.2026)
  const pruefung = running ? pruefungsHinweise(dayOf(new Date()), { studentId: student.id }).get(student.id) : undefined;

  const sent = sp.gesendet ? repo.getWorksheet(Number(sp.gesendet)) : null;
  const startedText = sp.text ? getText(Number(sp.text)) : null;
  // nach „Arbeit fotografieren“ › „Übernehmen“ (lib/papier-einheit.ts): was übernommen wurde, in einer Zeile
  const papier = sp.papier && running ? papierArbeit(Number(sp.papier), unit.id) : null;
  const notices = (
    <>
      {sent && running && (
        <div role="status" className="mb-6 rounded-2xl bg-green-wash px-4 py-3 text-[15px] font-medium text-green" data-testid="gesendet">
          <p className="flex items-center gap-2">
            <CheckCircle2 size={18} className="shrink-0" aria-hidden /> „{sent.title}“ ist an {first(student.name)} gesendet. Die Ergebnisse erscheinen unten, sobald {first(student.name)} arbeitet.
          </p>
          {/* Anpassung im Unterricht: die KI hat nicht geantwortet, die Aufgaben kamen aus dem Generator */}
          {sp.ki === "ersatz" && <p className="mt-1 text-[14px] font-normal text-ink-2">Die KI hat gerade nicht geantwortet. Dafür kamen die Aufgaben aus dem Generator, ohne Kosten.</p>}
          {/* ohne Schülergerät: am Lernlink bereit, und zum Drucken */}
          {studentDevice(unit) === null && (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] font-normal text-ink-2">
              Kein Schülergerät verbunden: die Übung liegt am Lernlink bereit.
              <Link href={`/arbeitsblatt/${sent.id}`} target="_blank" className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-accent hover:underline" data-testid="gesendet-drucken">
                <Printer size={15} aria-hidden /> Zum Drucken öffnen
              </Link>
            </p>
          )}
        </div>
      )}
      {papier && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-2xl bg-green-wash px-4 py-3 text-[15px] font-medium text-green" data-testid="papier-uebernommen">
          <CheckCircle2 size={18} className="shrink-0" aria-hidden /> Übernommen. {papierZeile(papier)}.
        </p>
      )}
      {startedText && running && startedText.student_id === student.id && (
        <div role="status" className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl bg-green-wash px-4 py-3 text-[15px] font-medium text-green">
          <CheckCircle2 size={18} aria-hidden /> „{startedText.title}“ ist am {studentDevice(unit) === "laptop" ? "Laptop" : "Tablet"} von {first(student.name)} geöffnet.
          <Link href={`/texte/${startedText.id}`} className="ml-auto font-semibold underline underline-offset-2">
            Mitlesen
          </Link>
        </div>
      )}
      {sp.bereits && running && (
        <div role="alert" className="mb-6 rounded-2xl bg-amber-wash px-4 py-3 text-[15px]">
          Mit {student.name} läuft schon seit <span className="num">{formatTime(unit.started_at)}</span> eine Einheit
          {unit.teacher_id !== teacher.id ? ` (von ${unit.teacher_name})` : ""}. Es wurde keine zweite gestartet.
        </div>
      )}
      {sp.minitest && running && (
        <div role="alert" className="mb-6 rounded-2xl bg-amber-wash px-4 py-3 text-[15px]">
          Minitest: {sp.minitest}
        </div>
      )}
      {sp.fremd && (
        <div role="alert" className="mb-6 rounded-2xl bg-amber-wash px-4 py-3 text-[15px] font-semibold">
          Diese Einheit gehört {unit.teacher_name}. Nur {unit.teacher_name} oder die Verwaltung kann sie beenden oder ergänzen.
        </div>
      )}
    </>
  );

  if (running) {
    // geführter Unterricht (components/cockpit/Ablauf.tsx) ist der Normalfall; Übungen und Fortschritt bleiben als
    // eigene Ansicht über „Weitere Werkzeuge“ (?bereich=…), ?bereich=cockpit öffnet die Werkzeuge
    const area = !mayManage ? (sp.bereich === "fortschritt" ? "fortschritt" : "uebungen") : sp.bereich === "uebungen" ? "uebungen" : sp.bereich === "fortschritt" ? "fortschritt" : "unterricht";
    // zwei Schüler zugleich (D26): ein Tippen wechselt in den Unterricht des anderen
    const meine = mayManage ? runningUnits(teacher.id) : [];
    const wechsel = meine.length > 1 && meine.some((u) => u.id === unit.id) ? meine : [];
    return (
      <>
        <AutoRefresh seconds={30} />
        <header className="sticky top-0 z-20 -mx-4 mb-5 bg-paper/95 px-4 pt-1 pb-3 backdrop-blur md:-mx-8 md:px-8" data-testid="unterricht-kopf">
          {wechsel.length > 0 && (
            <nav aria-label="Schüler wechseln" className="mb-2 flex flex-wrap gap-1.5" data-testid="schueler-wechsel">
              {wechsel.map((u) => (
                <Link
                  key={u.id}
                  href={`/einheiten/${u.id}`}
                  aria-current={u.id === unit.id ? "page" : undefined}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition-colors ${u.id === unit.id ? "bg-ink text-surface" : "bg-surface text-ink shadow-[var(--shadow-card)] hover:bg-panel"}`}
                >
                  <span className={`h-2 w-2 rounded-full ${u.id === unit.id ? "bg-green" : "bg-ink-3"}`} aria-hidden />
                  {first(u.student_name)}
                  {u.subject && <span className={`text-[13px] font-normal ${u.id === unit.id ? "text-surface/80" : "text-ink-3"}`}>{u.subject}</span>}
                </Link>
              ))}
            </nav>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="relative flex h-3 w-3 shrink-0" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-40 motion-reduce:hidden" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-green" />
            </span>
            <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.02em] md:text-[28px]">
              {first(student.name)}
              {unit.subject && <span className="font-normal text-ink-2"> · {unit.subject}</span>}
            </h1>
            {fenster?.restMinuten !== null && fenster?.restMinuten !== undefined ? (
              <span className="rounded-full bg-accent-wash px-2.5 py-0.5 text-[15px] font-semibold text-accent">
                <Restzeit rest={fenster.restMinuten} ab={Date.now()} />
              </span>
            ) : (
              <span className="num text-[15px] text-ink-2">
                läuft seit <Elapsed since={unit.started_at} />
              </span>
            )}
            {unit.teacher_id !== teacher.id && <span className="text-[15px] text-ink-2">{unit.teacher_name}</span>}
            {pruefung && (
              <Link href={`/schueler/${student.id}/pruefung/${pruefung.test.id}`} className={`inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold ${TON_TEXT[pruefung.tone]}`}>
                <CalendarClock size={16} aria-hidden /> {pruefung.text}
              </Link>
            )}
            {mayManage && (
              <form action={endUnitAction.bind(null, unit.id)} className="ml-auto">
                <button className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-ink px-4 text-[15px] font-semibold text-surface transition-colors hover:bg-ink-2">
                  <Square size={17} aria-hidden /> Einheit beenden
                </button>
              </form>
            )}
          </div>
          {!mayManage && <p className="mt-2 text-[14px] text-ink-2">Diese Einheit gehört {unit.teacher_name}. Du kannst mitlesen, aber nicht beenden.</p>}
        </header>
        {notices}
        {area === "unterricht" ? (
          <>
            <LiveStatus unitId={unit.id} initial={liveSnapshot(unit.id)!} join={await joinInfo()} kompakt />
            <Unterricht unit={unit} student={student} fehler={sp.cockpit} teacherId={teacher.id} werkzeugeOffen={sp.bereich === "cockpit"} ausfuehrlich={sp.ausfuehrlich ? Number(sp.ausfuehrlich) : null} folien={sp.folien ? Number(sp.folien) : null} knopf={sp.knopf ?? null} />
          </>
        ) : (
          <>
            {mayManage && (
              <Link href={`/einheiten/${unit.id}`} className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-[15px] font-semibold text-accent hover:underline" data-testid="zurueck-unterricht">
                ← Zurück zum Unterricht
              </Link>
            )}
            {mayManage && <LiveStatus unitId={unit.id} initial={liveSnapshot(unit.id)!} join={await joinInfo()} />}
            {area === "uebungen" ? <UnitExercisesArea unit={unit} student={student} mayManage={mayManage} /> : <UnitProgressArea unit={unit} studentName={student.name} />}
            {mayManage && (
              <div className="mt-14 border-t border-line pt-5">
                <CancelUnit unitId={unit.id} />
              </div>
            )}
          </>
        )}
      </>
    );
  }

  // ended or cancelled
  const report = lesson ? readReport(lesson) : null;
  const brief = lesson && unit.status === "beendet" ? unitBrief(lesson.id) : null;
  const minutes = Math.round(unitDurationMs(unit) / 60_000);
  const date = formatDate(unit.started_at, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const facts = (
    <p className="mt-1 text-[15px] text-ink-2">
      {date} · <span className="num">{formatTime(unit.started_at)}</span>–<span className="num">{unit.ended_at ? formatTime(unit.ended_at) : "?"}</span> ·{" "}
      <span className="num">{dauerLabel(platz?.geplante_dauer ?? null, minutes, unit.end_estimated === 1)}</span> · {unit.teacher_name}
      {unit.ended_by === "automatisch" && " · automatisch beendet"}
      {unit.ended_by === "automatisch" && unit.end_reason && <span className="block text-[13px]">Grund: {unit.end_reason}</span>}
    </p>
  );
  const back = (
    <Link href={`/schueler/${student.id}?tab=lernverlauf`} className="no-print mb-3 inline-flex min-h-[36px] items-center gap-1 text-[14px] font-medium text-ink-2 hover:text-ink pointer-coarse:min-h-[44px]">
      ← Lernverlauf von {student.name}
    </Link>
  );

  if (unit.status === "abgebrochen") {
    return (
      <>
        {back}
        <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Einheit mit {student.name} abgebrochen</h1>
        {facts}
        {unit.end_reason && <p className="mt-4 text-[15px]">Grund: {unit.end_reason}</p>}
        <p className="mt-2 text-[14px] text-ink-2">Wird nicht abgerechnet, keine Dokumentation.</p>
      </>
    );
  }

  const einschaetzung = lesson ? leseEinschaetzung(lesson) : null;
  const auto = lesson ? autoFelderVon(lesson) : new Set<string>();
  const frisch = lesson && !lesson.reviewed_at;
  const mappe = mappeFuerEinheit(unit.id);
  // „Was war heute schwer?“, vom Schüler nach dieser Einheit geschrieben (lib/schueler-notiz.ts)
  const notiz = notizZuEinheit(unit.id);
  // der Abschluss (lib/abschluss.ts): vier Felder aus den Daten, deinen Beobachtungen und dem, was im Unterricht getippt
  // wurde, jede Zeile mit ihrer Quelle; Textarbeiten nur mit übernommener Note, nie ein Vorschlag der KI
  const karte = lesson ? karteDerEinheit(unit.id, lesson, brief) : null;
  // „Ändern“ (?aendern=1): das Formular der Dokumentation unter der Karte
  const aendern = sp.aendern && mayManage ? lesson : null;
  // Gemeinsame Bewertung (lib/zu-bewerten.ts): was noch auf dich wartet, gleich über „Dokumentation bestätigen“
  const offen = lesson ? zuBewerten({ unitId: unit.id }) : [];
  return (
    <>
      {notices}
      {back}
      <header className="mb-6">
        {frisch && (
          <p className="inline-flex items-center gap-2 text-[15px] font-semibold text-green">
            <CheckCircle2 size={18} aria-hidden /> Einheit beendet und automatisch dokumentiert
          </p>
        )}
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Abschluss mit {student.name}</h1>
        {facts}
      </header>
      <div className="grid max-w-[820px] gap-8">
        {lesson && karte ? (
          <section className="panel px-5 py-5 sm:px-6" aria-label="Abschluss" data-testid="abschluss-karte">
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {ABSCHLUSS_FELDER.map(([feld, label]) => {
                const zeilen = karte[feld];
                // „Gut verstanden“ ohne sicheres Ergebnis (lib/abschluss.ts gutVerstanden): das sagt die Karte, deine Beobachtungen darunter
                const keineSicheren = feld === "gut" && !hatSichereErgebnisse(zeilen);
                return (
                  <AbschlussFeld key={feld} lessonId={mayManage ? lesson.id : null} feld={feld} label={label} text={zeilen.map((z) => z.text).join("\n")}>
                    {keineSicheren && (
                      <p className="text-ink-2" data-testid="keine-sicheren">
                        Keine sicheren Ergebnisse –{" "}
                        {mayManage ? (
                          <Link href={`/einheiten/${unit.id}?aendern=1#aendern`} className="font-medium text-accent underline-offset-2 hover:underline">
                            bei Bedarf ergänzen
                          </Link>
                        ) : (
                          "bei Bedarf ergänzen"
                        )}
                      </p>
                    )}
                    {zeilen.length > 0 ? (
                      <ul className={`grid gap-1 ${keineSicheren ? "mt-1" : ""}`}>
                        {zeilen.map((z, i) => (
                          <li key={i} className={z.von === "lehrer" || z.von === "beobachtung" ? "text-ink-2" : ""}>
                            {z.text}
                            {/* woher die Zeile kommt, leise */}
                            <span className="ml-1.5 text-[12px] whitespace-nowrap text-ink-3" data-testid="quelle">
                              {quelleText(z)}
                            </span>
                            {z.link && mayManage && (
                              <>
                                {" "}
                                <Link href={z.link.href} className="inline-flex min-h-[44px] items-center font-semibold text-accent underline-offset-2 hover:underline" data-testid="abschluss-text-link">
                                  {z.link.label}
                                </Link>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      !keineSicheren && <span className="text-ink-3">Nichts erfasst</span>
                    )}
                  </AbschlussFeld>
                );
              })}
            </dl>
            {offen.length > 0 && (
              <div id="zu-bewerten" className="mt-6 grid scroll-mt-24 gap-3 border-t border-line pt-4" data-testid="abschluss-zu-bewerten">
                <div className="grid gap-1">
                  <h2 className="text-[17px] font-semibold">{zuBewertenTitel(offen)}</h2>
                  <p className="text-[14px] text-ink-2">
                    Sie zählen erst nach deiner Bewertung: nicht für „Gut verstanden“, nicht für „Noch schwierig“, nicht für den Lernstand. Bestätigen geht trotzdem; die Dokumentation sagt dann „Bewertung offen“.
                  </p>
                </div>
                <ZuBewertenListe zeilen={offen} bewerten={mayManage} />
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
              {lesson.reviewed_at ? (
                <>
                  <p className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-green" data-testid="bestaetigt">
                    <CheckCircle2 size={17} aria-hidden /> Bestätigt am {formatDate(lesson.reviewed_at, { day: "numeric", month: "long" })}
                  </p>
                  <Link href="/" className="btn btn-secondary">
                    Zurück zu Heute
                  </Link>
                </>
              ) : mayManage ? (
                <form action={bestaetigeDokuAction.bind(null, lesson.id)}>
                  <button className="btn btn-primary btn-lg" data-testid="doku-bestaetigen">
                    <CheckCircle2 size={18} aria-hidden /> Dokumentation bestätigen
                  </button>
                </form>
              ) : (
                <p className="text-[14px] text-ink-2">Noch nicht bestätigt. Das macht {unit.teacher_name}.</p>
              )}
              {mayManage && !aendern && (
                <Link href={`/einheiten/${unit.id}?aendern=1#aendern`} className="btn btn-ghost" data-testid="doku-aendern">
                  <PenLine size={16} aria-hidden /> Ändern
                </Link>
              )}
            </div>
          </section>
        ) : (
          <p className="text-[15px] text-ink-2">Zu dieser Einheit gibt es keine Dokumentation.</p>
        )}
        {aendern && (
          <section id="aendern" aria-label="Dokumentation ändern" className="scroll-mt-4">
            <SectionTitle action={<Link href={`/einheiten/${unit.id}`} className="text-[14px] font-medium text-ink-2 hover:text-ink">Schließen</Link>}>Dokumentation ändern</SectionTitle>
            <UnitDocForm lesson={aendern} student={student} weiter="jetzt" />
          </section>
        )}
        {/* „Mehr Details“ (?details=1): alles Übrige der Dokumentation, erst auf Tippen */}
        {!sp.details ? (
          <Link href={`/einheiten/${unit.id}?details=1#details`} className="panel flex min-h-[52px] flex-wrap items-center gap-x-2 px-4 py-2 sm:px-5" data-testid="mehr-details-link">
            <span className="text-[16px] font-semibold">Mehr Details</span>
            <span className="text-[13.5px] text-ink-3">Mappe drucken, Einschätzung, Dokumentation, Aufgaben, Whiteboard</span>
          </Link>
        ) : (
          <section id="details" aria-label="Mehr Details" className="scroll-mt-4" data-testid="mehr-details">
            <SectionTitle action={<Link href={`/einheiten/${unit.id}`} className="text-[14px] font-medium text-ink-2 hover:text-ink">Schließen</Link>}>Mehr Details</SectionTitle>
            <div className="grid gap-10 pt-1">
              {mappe && mappeHatInhalt(mappe) && (
                <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Link href={`/arbeitsblatt/einheit/${unit.id}`} className="btn btn-secondary btn-lg" data-testid="mappe-link">
                    <Printer size={18} aria-hidden /> Mappe drucken
                  </Link>
                  <span className="text-[14px] text-ink-3">Alles aus der Einheit mit den Antworten, als PDF für die Schulmappe</span>
                </div>
              )}
              {hatInhalt(notiz) && <SchuelerNotizAnzeige notiz={notiz} name={first(student.name)} />}
              {lesson && <EinschaetzungKarte e={einschaetzung} lesson={lesson} auto={auto} />}
              {brief && lesson && <BriefSection brief={brief} lesson={lesson} mayManage={mayManage} />}
              {lesson && (
                <section>
                  <SectionTitle
                    action={
                      lesson.reviewed_at ? (
                        <span className="inline-flex items-center gap-1 text-[13px] font-medium text-green">
                          <CheckCircle2 size={14} aria-hidden /> von dir gesehen am {formatDate(lesson.reviewed_at, { day: "numeric", month: "short" })}
                        </span>
                      ) : (
                        <Pill>automatisch</Pill>
                      )
                    }
                  >
                    Dokumentation
                  </SectionTitle>
                  <DocView lesson={lesson} auto={auto} />
                </section>
              )}
              {report && (
                <section>
                  <SectionTitle>Automatisch erfasst</SectionTitle>
                  <UnitSummary r={report} />
                  {report.tasks.length > 0 && (
                    <details className="mt-3">
                      <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-[14px] font-semibold text-accent">Alle Aufgaben und Fähigkeiten anzeigen</summary>
                      <div className="mt-3">
                        <UnitReportView r={report} />
                      </div>
                    </details>
                  )}
                </section>
              )}
              <AblaufRueckblick unitId={unit.id} />
              <UnitDocuments unitId={unit.id} />
              <section>
                <SectionTitle>Whiteboard</SectionTitle>
                <BoardThumbs unitId={unit.id} max={8} alwaysLink />
              </section>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

/** The six questions after the unit, from the data, and the optional note for parents or the student. */
function BriefSection({ brief, lesson, mayManage }: { brief: NonNullable<ReturnType<typeof unitBrief>>; lesson: repo.Lesson; mayManage: boolean }) {
  return (
    <section aria-label="Auf einen Blick">
      <SectionTitle>
        <span>
          Auf einen Blick
          <Info label="Woher kommen diese Angaben?">Aus den gespeicherten Daten der Einheit, ohne KI: Aufgaben, Fehlerarten, Empfehlung, Hausübungen und Prüfungstermine. Deine Notizen aus der Dokumentation sind markiert.</Info>
        </span>
      </SectionTitle>
      <UnitBriefView brief={brief} />
      <UnitAISummary unitId={lesson.unit_id ?? null} />
      {(mayManage || lesson.family_note) && (
        <details className="reveal mt-4" open={Boolean(lesson.family_note) || undefined}>
          <summary>Notiz für Eltern oder Schüler{lesson.family_note ? "" : " schreiben"}</summary>
          <div className="pt-3">
            {mayManage ? (
              <FamilyNote lessonId={lesson.id} initial={lesson.family_note ?? ""} source={lesson.family_note_source ?? ""} ai={aiEnabled()} />
            ) : (
              <p className="whitespace-pre-line text-[15px]">{lesson.family_note}</p>
            )}
          </div>
        </details>
      )}
    </section>
  );
}

/**
 * The KI's view of the ended unit (written in the background when the unit ended): only a suggestion, here under „Mehr
 * Details“. It never fills the four fields of the Abschluss, the documentation or the Lernstand (lib/abschluss.ts).
 */
function UnitAISummary({ unitId }: { unitId: number | null }) {
  const s = unitId ? latestInsight(unitId, "einheit") : null;
  if (!s) return null;
  return (
    <div className="mt-4 rounded-2xl bg-panel px-4 py-3" data-testid="ki-vorschlag">
      <p className="text-[13px] font-semibold text-ink-2">Vorschlag der KI</p>
      <p className="text-[12.5px] text-ink-3">Nicht geprüft. Steht nicht im Abschluss und nicht in der Dokumentation.</p>
      <p className="mt-1 text-[15px]">{s.data.summary}</p>
      {s.data.next_steps.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-[14px] text-ink-2">
          {s.data.next_steps.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      {s.data.homework && <p className="mt-2 text-[14px] text-ink-2">Hausübung: {s.data.homework}</p>}
    </div>
  );
}

/** Exercises inside a running unit: the student's link, the exercises with live results, and one way to add a new one. */
function UnitExercisesArea({ unit, student, mayManage }: { unit: UnitView; student: repo.Student; mayManage: boolean }) {
  // answers waiting for the teacher's grade count nowhere yet, but the exercise is shown with them
  const toReview = repo.pendingReviews({ unitId: unit.id });
  const attempts = [...repo.listAttemptsForUnit(unit.id), ...toReview];
  const lastBy = new Map<number, string>();
  for (const a of attempts) if (!lastBy.has(a.assignment_id) || a.created_at > lastBy.get(a.assignment_id)!) lastBy.set(a.assignment_id, a.created_at);
  const rows = repo.listAssignments(unit.student_id).filter((a) => !a.completed_at || lastBy.has(a.id));
  const name = first(student.name);
  const device = studentDevice(unit);
  const paired = device !== null;
  // Minitest zum Start: solange noch nichts beantwortet ist, oder als Zeile, wenn er nur gedruckt wurde
  const minitest = mayManage ? minitestDerEinheit(unit.id) : null;
  const stoff = mayManage && !minitest && attempts.length === 0 ? letzterStoff(student.id, unit.id) : null;
  const gedruckt = minitest && !minitest.assignment ? { worksheet: minitest.worksheet, tasks: repo.listTasks(minitest.worksheet.id).length } : null;
  return (
    <div className="grid gap-10">
      {(stoff || gedruckt) && <MinitestKarte unitId={unit.id} name={name} geraet={device} stoff={stoff} gedruckt={gedruckt} />}
      <section>
        <div className="mb-4 grid gap-3">
          <h2 className="text-[20px] font-semibold">Übungen für {name}</h2>
          {mayManage && (
            // the main way first; on the phone one under the other, all the same width
            <div className="btn-reihe grid gap-2 sm:flex sm:flex-wrap">
              <Link href={`/uebungen/neu?schueler=${student.id}`} className="btn btn-primary btn-lg">
                <Plus size={18} aria-hidden /> Neue Übung erstellen
              </Link>
              <Link href={`/einheiten/${unit.id}/foto`} className="btn btn-secondary btn-lg" data-testid="foto-vom-stoff">
                <Camera size={18} aria-hidden /> Foto vom Stoff
              </Link>
              {/* auf Papier gelöst: fotografieren und wie am Gerät bewerten (lib/papier-einheit.ts) */}
              <Link href={`/einheiten/${unit.id}/papier`} className="btn btn-secondary btn-lg" data-testid="arbeit-fotografieren-uebungen">
                <ScanLine size={18} aria-hidden /> Arbeit fotografieren
              </Link>
              <Link href={`/einheiten/${unit.id}/text`} className="btn btn-secondary btn-lg">
                <PenLine size={18} aria-hidden /> Textarbeit starten
              </Link>
              <Link href={`/einheiten/${unit.id}/bildgeschichte`} className="btn btn-secondary btn-lg" data-testid="bildgeschichte-erstellen">
                <Images size={18} aria-hidden /> Bildgeschichte erstellen
              </Link>
              {/* Oberstufe: a Schreibauftrag of the SRDP (Leserbrief, Erörterung, Textinterpretation …) on a whole Textbeilage with line numbers */}
              {levelFor(student.school_type, student.klasse).band === "oberstufe" && (
                <Link href={`/einheiten/${unit.id}/schreibauftrag`} className="btn btn-secondary btn-lg" data-testid="schreibauftrag-erstellen">
                  <BookOpenText size={18} aria-hidden /> Schreibauftrag
                </Link>
              )}
            </div>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="panel px-5 py-5 text-[15px] text-ink-2">Noch keine Übung gesendet.</p>
        ) : (
          <ul className="panel divide-y divide-line">
            {rows.map((a) => {
              const done = Boolean(a.completed_at);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {a.title}
                      {a.mode === "test" && (
                        <span className="ml-2 align-middle">
                          <Pill tone="accent">{a.probe_test_id ? "Probeschularbeit" : a.note === LERNKONTROLLE ? "Lernkontrolle" : "Minitest"}</Pill>
                        </span>
                      )}
                    </span>
                    <span className="num block text-[14px] text-ink-2">
                      {a.done_count} von {a.task_count} Aufgaben bearbeitet
                      {lastBy.has(a.id) ? ` · zuletzt ${formatTime(lastBy.get(a.id)!)}` : a.started_at ? "" : ` · ${name} hat noch nicht begonnen`}
                    </span>
                  </span>
                  {toReview.some((x) => x.assignment_id === a.id) && <Pill tone="amber">{toReview.filter((x) => x.assignment_id === a.id).length} zu bewerten</Pill>}
                  {done ? <Pill tone="green">fertig</Pill> : !a.delivered_at && !a.started_at && a.unit_id === unit.id && paired && <Pill tone="red">nicht angekommen</Pill>}
                  <Link href={`/schueler/${student.id}/ergebnis/${a.id}`} className={`btn ${done ? "btn-primary" : "btn-secondary"}`}>
                    Ergebnis ansehen
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <RunningUnitTexts unitId={unit.id} studentId={student.id} deviceView={unit.device_view} device={mayManage ? device : null} name={name} />
      <Reveal label={`Ohne Tablet: Link für das Gerät von ${name}`}>
        <p className="mb-2 text-[14px] text-ink-2">Nur nötig, wenn {name} nicht am Schüler-Tablet arbeitet. Auf dem Link sieht {name} die gesendeten Übungen.</p>
        <div className="flex max-w-[620px] flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <CopyLink path={`/lernen/${student.access_token}`} />
          </div>
          <a href={`/lernen/${student.access_token}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
            <ExternalLink size={14} aria-hidden /> Ansicht öffnen
          </a>
        </div>
      </Reveal>
    </div>
  );
}

function UnitProgressArea({ unit, studentName }: { unit: UnitView; studentName: string }) {
  const report = buildUnitReport(unit);
  return (
    <section className="grid max-w-[900px] gap-4">
      <h2 className="text-[20px] font-semibold">Fortschritt in dieser Einheit</h2>
      {report.tasksDone === 0 ? (
        <p className="panel px-5 py-5 text-[15px] text-ink-2">{first(studentName)} hat in dieser Einheit noch keine Aufgabe am Gerät bearbeitet.</p>
      ) : (
        <>
          <UnitSummary r={report} />
          <details>
            <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-[14px] font-semibold text-accent">Alle Aufgaben und Fähigkeiten anzeigen</summary>
            <div className="mt-3">
              <UnitReportView r={report} />
            </div>
          </details>
        </>
      )}
    </section>
  );
}

/** The documentation as the teacher would have written it; the scales stand in the Einschätzung above. */
function DocView({ lesson, auto }: { lesson: repo.Lesson; auto: Set<string> }) {
  const rows: [string, string, string | null][] = [
    ["Zusammenfassung", lesson.summary, null],
    ["Nächstes Lernziel", lesson.next_steps, "next_steps"],
    ["Wiederholen", lesson.review_topics, "review_topics"],
    ["Beobachtungen", lesson.tutor_notes, null],
    ["Hausübung", lesson.homework_note, null],
  ];
  return (
    <dl className="panel grid gap-x-6 gap-y-3 px-5 py-4 text-[15px] sm:grid-cols-[180px_minmax(0,1fr)]">
      {rows.map(([k, v, feld]) => (
        <div key={k} className="contents">
          <dt className="text-ink-2">
            {k}
            {feld && v && auto.has(feld) && <span className="ml-1.5 rounded-full bg-panel px-1.5 text-[11px] font-medium text-ink-3">automatisch</span>}
          </dt>
          <dd className="whitespace-pre-line">{v || "–"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Address and QR code for "Eigenes Gerät verbinden". The QR code holds only the address, never the code. */
async function joinInfo() {
  const h = await headers();
  const base = baseUrl({ host: h.get("x-forwarded-host") ?? h.get("host"), proto: h.get("x-forwarded-proto") });
  const url = `${base.url}/mitmachen`;
  return { url, qr: await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" }) };
}
