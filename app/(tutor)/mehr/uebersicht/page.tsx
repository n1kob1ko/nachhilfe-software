import Link from "next/link";
import { BookMarked, CheckCircle2, ChevronDown } from "lucide-react";
import { TodoListe } from "@/components/heute/TodoListe";
import { entferneVorschlagAction, vorschlagZeigenAction } from "@/app/cockpit-actions";
import { KeinPaket, VorschlagWarum } from "@/components/cockpit/Vorbereitung";
import { antwortLehrerAction, stelleLehrerAnfrageAction } from "@/app/terminanfrage-actions";
import { AnfrageMeldung, AnfragenListe, TerminAendern } from "@/components/planung/Terminanfragen";
import { Avatar } from "@/components/Art";
import { Wochenplan } from "@/components/planung/Wochenplan";
import { SectionTitle } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { naechsterPunkt, tagesplan } from "@/lib/heute";
import { leseRegeln } from "@/lib/planung/regeln";
import { anfragbareTermine, anfragenFuerLehrer } from "@/lib/planung/terminanfragen";
import { wochenUebersicht } from "@/lib/planung/uebersicht";
import { wienerDatum, wienerWochenstart } from "@/lib/planung/zeit";
import { klassenLabel } from "@/lib/school";
import { listUnits, runningUnits } from "@/lib/units";
import { zuErledigen } from "@/lib/zu-erledigen";
import { kostenSchaetzung } from "@/lib/lernpaket-ki";
import { naechsteEinheiten, VORAUS_TAGE, type NaechsteEinheit } from "@/lib/vorbereitung-auto";

export const metadata = { title: "Übersicht" };

const firstName = (n: string) => n.split(" ")[0];

/** Die Adresse dieser Seite; „Meine Woche“ ist `?tab=woche` (früher `/?tab=woche`, das leitet hierher). */
const PFAD = "/mehr/uebersicht";
const WOCHE = `${PFAD}?tab=woche`;

/**
 * Erweitert › Übersicht: was früher unter der Begrüßung der Startseite stand (niko, 25.10.2026: „Alles andere kommt
 * nach Erweitert und wird nie gelöscht“). Kennzahlen, **Zu erledigen** mit Abhaken, **Vorbereitung: nächste 7 Tage**
 * und **Zuletzt verwendet**; mit `?tab=woche` **Meine Woche**: die eigene **veröffentlichte** Woche des Lehrers, nur
 * lesend (D23), mit den Terminanfragen. Entwürfe und fremde Wochen sieht nur die Verwaltung unter /planung.
 */
export default async function UebersichtPage({ searchParams }: { searchParams: Promise<{ tab?: string; anfrage_ok?: string; anfrage_fehler?: string }> }) {
  const teacher = await requireTeacher();
  const sp = await searchParams;
  if (sp.tab === "woche") {
    return (
      <>
        <UebersichtTabs aktiv="woche" />
        <MeineWoche teacherId={teacher.id} name={teacher.name} isAdmin={teacher.is_admin} meldung={{ ok: sp.anfrage_ok, fehler: sp.anfrage_fehler }} />
      </>
    );
  }
  const students = repo.listStudents();
  const byId = new Map(students.map((s) => [s.id, s]));
  const now = new Date();
  const today = wienerDatum(now);
  const running = runningUnits(teacher.id);
  const punkte = tagesplan(teacher.id, now);
  const schuelerHeute = new Set(punkte.map((p) => p.studentId)).size;
  const naechster = naechsterPunkt(punkte, now);
  const myUnits = listUnits({ teacherId: teacher.id });
  const recentIds = [...new Set(myUnits.map((u) => u.student_id))].filter((id) => byId.has(id));

  // Zu erledigen (lib/zu-erledigen.ts): Prüfungen, Ergebnisse, Hausübungen und abgegebene Texte, je mit Zustand
  const todos = zuErledigen(teacher.id, today, now);
  const ueberfaellig = todos.offen.filter((p) => p.zustand === "ueberfaellig").length;
  const zuBewerten = todos.offen.filter((p) => p.zustand === "wartet").length;

  // „Stunden automatisch vorbereiten“ (lib/vorbereitung-auto.ts): die nächsten 7 Tage, ohne KI; nur Vorschläge
  const naechste = naechsteEinheiten(teacher.id, now);
  const kiKosten = naechste.some((n) => n.ki) ? kostenSchaetzung().text : "";

  return (
    <>
      <UebersichtTabs aktiv="start" />
      <header className="mb-6">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] md:text-[32px]">Übersicht</h1>
        <p className="mt-1 text-[15px] text-ink-2">Zu erledigen, Vorbereitung der nächsten {VORAUS_TAGE} Tage und deine Schüler. Den Tag selbst zeigt Heute.</p>
      </header>

      <Kennzahlen
        werte={[
          { wort: "Heute", wert: String(punkte.length), zusatz: punkte.length === 0 ? "keine Einheit" : punkte.length === 1 ? "Einheit" : `Einheiten, ${schuelerHeute} Schüler`, href: "/" },
          { wort: "Als Nächstes", wert: naechster ? naechster.zeit.split("–")[0] : "–", zusatz: naechster ? firstName(naechster.studentName) : running.length > 0 ? "nichts mehr geplant" : "nichts geplant", href: naechster ? "/" : undefined },
          { wort: "Zu erledigen", wert: String(todos.offen.length), zusatz: todos.offen.length === 0 ? "nichts offen" : ueberfaellig ? `davon ${ueberfaellig} überfällig` : zuBewerten ? `davon ${zuBewerten} zu bewerten` : todos.offen.some((t) => t.art === "pruefung") ? "Prüfungen und mehr" : "Hausübungen, Ergebnisse", href: "#offen" },
          { wort: "Schüler", wert: String(students.length), zusatz: `${recentIds.length} zuletzt bei dir`, href: "/schueler" },
        ]}
      />

      <div className="space-y-10">
        <section id="offen" className="scroll-mt-4">
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

        <section id="vorbereitung" className="scroll-mt-4" aria-label="Nächste Einheiten">
          <SectionTitle>{`Vorbereitung: nächste ${VORAUS_TAGE} Tage`}</SectionTitle>
          {naechste.length === 0 ? (
            <p className="text-[15px] text-ink-2">In den nächsten {VORAUS_TAGE} Tagen ist keine Einheit geplant, die noch vorzubereiten wäre.</p>
          ) : (
            <>
              <VorbereitungListe punkte={naechste.slice(0, 6)} kosten={kiKosten} />
              {naechste.length > 6 && (
                <details className="group mt-3">
                  <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[14px] font-medium text-accent">
                    Noch {naechste.length - 6} weitere <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <VorbereitungListe punkte={naechste.slice(6)} kosten={kiKosten} />
                </details>
              )}
            </>
          )}
        </section>

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
              {w.art === "ohne_signal" && <p className="text-[13px] text-ink-3">Noch kein Thema aus Prüfung, Schulstoff, Wunsch, Fehlern, offenen Zielen oder Wiederholung.</p>}
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {w.art === "paket" && (
                <form action={entferneVorschlagAction.bind(null, n.studentId)}>
                  <input type="hidden" name="datum" value={n.datum} />
                  <input type="hidden" name="ziel" value="uebersicht" />
                  <button className="btn btn-ghost btn-sm">Entfernen</button>
                </form>
              )}
              {w.art === "entfernt" && (
                <form action={vorschlagZeigenAction.bind(null, n.studentId)}>
                  <input type="hidden" name="datum" value={n.datum} />
                  <input type="hidden" name="ziel" value="uebersicht" />
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

/** Die zwei Tabs der Übersicht: Zu erledigen und Vorbereitung, und „Meine Woche“ (die eigene veröffentlichte Woche). */
function UebersichtTabs({ aktiv }: { aktiv: "start" | "woche" }) {
  const tabs = [
    { key: "start" as const, href: PFAD, label: "Übersicht" },
    { key: "woche" as const, href: WOCHE, label: "Meine Woche" },
  ];
  return (
    <nav className="no-print mb-6 flex flex-wrap gap-2" aria-label="Übersicht">
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
 * kurzer Blick — geändert wird unter Erweitert › Planung (Verwaltung).
 */
async function MeineWoche({ teacherId, name, isAdmin, meldung }: { teacherId: number; name: string; isAdmin: number; meldung: { ok?: string; fehler?: string } }) {
  const woche = wienerWochenstart();
  const uebersicht = wochenUebersicht(woche, { status: "veroeffentlicht", nurLehrerId: teacherId });
  // Terminanfragen (lib/planung/terminanfragen.ts): eigene und die, bei denen ich zustimmen soll; bestätigt wird unter Planung
  const ich = { id: teacherId, is_admin: isAdmin };
  const anfragen = anfragenFuerLehrer(ich);
  const termine = anfragbareTermine({ lehrer: ich });
  return (
    <>
      <header className="mb-5">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] md:text-[32px]">Meine Woche</h1>
        <p className="mt-1 text-[15px] text-ink-2">
          {uebersicht.label} · {uebersicht.summen.einheiten} geplante Einheiten · {name} · nur veröffentlichte Plätze
        </p>
      </header>
      {(anfragen.length > 0 || termine.length > 0 || meldung.ok || meldung.fehler) && (
        <section id="terminanfragen" className="mb-8 scroll-mt-4">
          <SectionTitle>Terminanfragen</SectionTitle>
          <AnfrageMeldung ok={meldung.ok} fehler={meldung.fehler} />
          {anfragen.length > 0 && (
            <div className="mt-3">
              <AnfragenListe anfragen={anfragen} antwort={(a) => antwortLehrerAction.bind(null, a.id)} zurueck={WOCHE} />
            </div>
          )}
          {termine.length > 0 && (
            <details className="group mt-3">
              <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-[14px] font-medium text-accent">
                Einen Termin verschieben oder tauschen <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <ul className="panel mt-2 divide-y divide-line">
                {termine.map((t) => (
                  <li key={t.id} className="px-4 py-3 text-[14px]">
                    <span className="num font-semibold">{t.label}</span> <span className="text-ink-2">· {t.schueler}</span>
                    <TerminAendern termin={t} aktion={stelleLehrerAnfrageAction} zurueck={WOCHE} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
      {uebersicht.plaetze.length === 0 ? (
        <p className="panel px-5 py-6 text-[15px] text-ink-2">
          Für dich ist diese Woche nichts veröffentlicht. Sobald die Verwaltung den Plan veröffentlicht, steht er hier.
        </p>
      ) : (
        <Wochenplan
          uebersicht={uebersicht}
          darfBearbeiten={false}
          basisPfad={WOCHE}
          druckHref={`/planung/drucken?woche=${woche}`}
          aktuelleWoche={woche}
          zurueck={`${WOCHE}&woche=${woche}`}
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
