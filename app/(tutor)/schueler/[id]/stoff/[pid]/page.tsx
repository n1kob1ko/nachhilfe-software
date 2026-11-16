import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ClipboardCheck, FileText, Loader2, Pencil, Presentation, Printer, RotateCcw, ShieldAlert } from "lucide-react";
import { nochmalStoffpaketAction, uebernimmStoffpaketAction, verwirfStoffpaketAction } from "@/app/stoffpaket-actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { TabletSend } from "@/components/device/TabletSend";
import { FormKnopf } from "@/components/FormKnopf";
import { LernzettelInhalt } from "@/components/Lernzettel";
import { MathText } from "@/components/MathText";
import { FolieVorschau } from "@/components/praesentation/KiVorschlag";
import { PageHeader, Pill, Reveal } from "@/components/ui";
import { budget } from "@/lib/ai/config";
import { requireTeacher } from "@/lib/auth";
import { getPraesEntwurf } from "@/lib/praesentation-ki";
import { getPraesentation } from "@/lib/praesentationen";
import * as repo from "@/lib/repo";
import { blaetterVon, getStoffpaket, kostenUsd } from "@/lib/stoffpaket";
import { runningUnitForStudent } from "@/lib/units";

export const metadata = { title: "Stoff vorbereiten" };

const BLATT_HILFE = {
  vorbereitung: "Zum Einstieg: zeigt, was schon sitzt. Ein Versuch, keine Tipps.",
  uebung: "Zum Üben, mit Hilfen.",
  test: "Wie eine Schularbeit: ein Versuch, keine Tipps, mit Lösungen für dich.",
} as const;

/**
 * Ein Lauf von „Stoff vorbereiten“ (lib/stoffpaket.ts): solange er läuft, was gerade passiert (die Seite lädt sich neu); dann
 * alles in einer Vorschau mit „Alles übernehmen“ oder „Verwerfen“; danach die Blätter zum Senden und Drucken.
 */
export default async function StoffpaketSeite({ params, searchParams }: { params: Promise<{ id: string; pid: string }>; searchParams: Promise<{ fehler?: string; ziel?: string }> }) {
  await requireTeacher();
  const { id, pid } = await params;
  const sp = await searchParams;
  const p = getStoffpaket(Number(pid));
  if (!p || p.student_id !== Number(id)) notFound();
  const student = repo.getStudent(p.student_id)!;
  const first = student.name.split(" ")[0];
  const back = { href: `/schueler/${student.id}/stoff`, label: "Stoff vorbereiten" };

  if (p.status === "laeuft") {
    return (
      <>
        <PageHeader title={`Stoff vorbereiten: ${student.name}`} back={back} />
        <AutoRefresh seconds={4} />
        <section className="panel grid max-w-[720px] gap-3 px-5 py-6" aria-live="polite" data-testid="stoffpaket-laeuft">
          <p className="flex items-center gap-3 text-[17px] font-semibold">
            <Loader2 size={20} className="animate-spin text-accent" aria-hidden /> Wird erstellt: {p.schritt || "Unterlagen lesen"} …
          </p>
          <p className="text-[14.5px] text-ink-2">Das dauert meist 2 bis 5 Minuten. Du kannst die Seite schließen, es läuft weiter. Unter „Stoff vorbereiten“ beim Schüler findest du es wieder.</p>
        </section>
      </>
    );
  }

  if (p.status === "fehler" || p.status === "verworfen") {
    return (
      <>
        <PageHeader title={`Stoff vorbereiten: ${student.name}`} back={back} />
        <section className="panel grid max-w-[720px] gap-3 px-5 py-5" data-testid="stoffpaket-fehler">
          <p className="text-[15.5px]">{p.status === "verworfen" ? "Verworfen. Beim Schüler ist nichts davon angekommen." : p.fehler || "Das hat nicht geklappt."}</p>
          {p.status === "fehler" && (
            <form action={nochmalStoffpaketAction.bind(null, p.id)}>
              <FormKnopf className="btn btn-primary" icon={<RotateCcw size={16} aria-hidden />}>
                Noch einmal mit denselben Fotos
              </FormKnopf>
            </form>
          )}
        </section>
      </>
    );
  }

  const blaetter = blaetterVon(p);
  const entwurf = p.praes_entwurf_id ? getPraesEntwurf(p.praes_entwurf_id) : null;
  const praes = p.praesentation_id ? getPraesentation(p.praesentation_id) : null;
  const usd = kostenUsd(p);
  const cent = Math.round((usd / budget().usdPerEur) * 100);
  const unit = runningUnitForStudent(student.id);
  const targets = unit ? [{ unitId: unit.id, student: first }] : [];
  const fertig = p.status === "fertig";
  const pruefung = p.pruefung_id ? repo.getTest(p.pruefung_id) : null;

  return (
    <>
      <PageHeader
        title={p.thema || "Stoff"}
        back={back}
        subtitle={`${p.fach} · für ${student.name}${usd > 0 ? ` · hat ${cent < 1 ? "unter 1" : cent} Cent gekostet` : ""}`}
      />
      <div className="grid max-w-[1000px] gap-6">
        {sp.fehler && (
          <p role="alert" className="rounded-2xl bg-red-wash px-4 py-3 text-[15px] text-red">
            {sp.fehler}
          </p>
        )}
        {fertig ? (
          <section className="panel grid gap-3 px-5 py-4" data-testid="stoffpaket-fertig">
            <p className="text-[15.5px]">
              Alles ist fertig. Schau es kurz durch. Mit <span className="font-semibold">„Alles übernehmen“</span> steht der Ablauf mit der Präsentation für die {unit ? "laufende" : "nächste"} Einheit bereit und der Lernzettel in {first}s App. Die Blätter schickst du dann aufs Tablet oder druckst sie.
            </p>
            <div className="flex flex-wrap gap-2">
              <form action={uebernimmStoffpaketAction.bind(null, p.id)}>
                <FormKnopf className="btn btn-primary" icon={<CheckCircle2 size={16} aria-hidden />} data-testid="stoffpaket-uebernehmen">
                  Alles übernehmen
                </FormKnopf>
              </form>
              <form action={verwirfStoffpaketAction.bind(null, p.id)}>
                <FormKnopf className="btn btn-ghost">
                  Verwerfen
                </FormKnopf>
              </form>
            </div>
          </section>
        ) : (
          <section className="panel flex flex-wrap items-center gap-3 px-5 py-4" data-testid="stoffpaket-uebernommen">
            <CheckCircle2 size={18} className="shrink-0 text-green" aria-hidden />
            <p className="min-w-0 flex-1 text-[15px]">Übernommen. {sp.ziel || "Der Lernzettel steht in der Schüler-App."}</p>
            {unit && (
              <Link href={`/einheiten/${unit.id}`} className="btn btn-secondary btn-sm">
                Zur Einheit
              </Link>
            )}
          </section>
        )}

        {p.unsicher.length > 0 && (
          <section className="grid gap-1.5 rounded-2xl bg-amber-wash px-5 py-4" aria-label="Bitte prüfen">
            <p className="flex items-center gap-2 text-[15px] font-semibold">
              <ShieldAlert size={17} aria-hidden /> Bitte prüfen
            </p>
            <ul className="grid list-disc gap-0.5 pl-6 text-[14.5px]">
              {p.unsicher.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          </section>
        )}

        {p.lernzettel && (
          <section className="panel grid gap-3 px-5 py-5" aria-label="Lernzettel">
            <div className="flex flex-wrap items-center gap-2">
              <FileText size={18} className="text-accent" aria-hidden />
              <h2 className="min-w-0 flex-1 text-[17px] font-semibold">Lernzettel</h2>
              <Link href={`/arbeitsblatt/lernzettel/${p.id}`} className="btn btn-secondary btn-sm">
                <Printer size={15} aria-hidden /> Drucken oder PDF
              </Link>
            </div>
            <Reveal label="Lernzettel ansehen">
              <div className="rounded-xl border border-line px-4 py-4 text-[15px]">
                <LernzettelInhalt z={p.lernzettel} />
              </div>
            </Reveal>
          </section>
        )}

        {blaetter
          .filter((b) => b.verlangt)
          .map((b) => {
            const tasks = b.id ? repo.listTasks(b.id) : [];
            const w = b.id ? repo.getWorksheet(b.id) : null;
            return (
              <section key={b.blatt} className="panel grid gap-3 px-5 py-5" aria-label={b.titel} data-testid={`stoffpaket-blatt-${b.blatt}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <ClipboardCheck size={18} className="text-accent" aria-hidden />
                  <h2 className="min-w-0 flex-1 text-[17px] font-semibold">
                    {b.blatt === "test" && pruefung ? `Probeschularbeit zur ${pruefung.kind || "Prüfung"} am ${Number(pruefung.date.slice(8, 10))}.${Number(pruefung.date.slice(5, 7))}.` : b.titel}
                    {b.id && <span className="font-normal text-ink-3"> · {tasks.length} Aufgaben</span>}
                  </h2>
                  {w?.status === "freigegeben" && <Pill tone="green">gesendet</Pill>}
                </div>
                {!b.id ? (
                  <p className="text-[14.5px] text-ink-2">Dafür hat die KI keine brauchbaren Aufgaben geliefert.</p>
                ) : (
                  <>
                    <p className="text-[14px] text-ink-2">{BLATT_HILFE[b.blatt]}</p>
                    <ol className="grid list-decimal gap-1 pl-6 text-[14.5px]">
                      {tasks.map((t) => (
                        <li key={t.id} className="min-w-0">
                          <span className="line-clamp-2">
                            <MathText text={t.prompt} />
                          </span>
                        </li>
                      ))}
                    </ol>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {!fertig && targets.length > 0 && <TabletSend targets={targets} worksheetId={b.id} small />}
                      <Link href={`/uebungen/${b.id}`} className="btn btn-secondary btn-sm">
                        <Pencil size={15} aria-hidden /> Ansehen und ändern
                      </Link>
                      <Link href={`/arbeitsblatt/${b.id}`} className="btn btn-secondary btn-sm">
                        <Printer size={15} aria-hidden /> Drucken
                      </Link>
                      <Link href={`/arbeitsblatt/${b.id}?loesungen=seite`} className="btn btn-ghost btn-sm">
                        Mit Lösungen drucken
                      </Link>
                    </div>
                  </>
                )}
              </section>
            );
          })}

        {p.teile.includes("praesentation") && (
          <section className="panel grid gap-3 px-5 py-5" aria-label="Präsentation" data-testid="stoffpaket-praesentation">
            <div className="flex flex-wrap items-center gap-2">
              <Presentation size={18} className="text-accent" aria-hidden />
              <h2 className="min-w-0 flex-1 text-[17px] font-semibold">Präsentation{entwurf ? <span className="font-normal text-ink-3"> · {entwurf.deck.folien.length} Folien mit Sprechtext</span> : null}</h2>
              {praes && (
                <Link href={`/mehr/praesentationen/${praes.id}`} className="btn btn-secondary btn-sm">
                  Öffnen
                </Link>
              )}
              {p.paket_id && (
                <Link href={`/mehr/lernpakete/${p.paket_id}`} className="btn btn-ghost btn-sm">
                  Ablauf ansehen
                </Link>
              )}
            </div>
            {entwurf ? (
              <Reveal label="Folien ansehen">
                <div className="grid gap-3 sm:grid-cols-2">
                  {entwurf.deck.folien.map((f, i) => (
                    <div key={i} className="grid gap-1.5">
                      <FolieVorschau f={f} nr={i + 1} />
                      {f.notiz && <p className="text-[13px] text-ink-2">Du sagst: {f.notiz}</p>}
                    </div>
                  ))}
                </div>
              </Reveal>
            ) : (
              <p className="text-[14.5px] text-ink-2">Die Präsentation konnte nicht erstellt werden. Im Ablauf kannst du sie später mit „Präsentation erstellen“ nachholen.</p>
            )}
          </section>
        )}

        {p.weggelassen.length > 0 && (
          <Reveal label={`Weggelassen (${p.weggelassen.length})`}>
            <ul className="grid list-disc gap-0.5 pl-6 text-[13.5px] text-ink-2">
              {p.weggelassen.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </Reveal>
        )}
      </div>
    </>
  );
}
