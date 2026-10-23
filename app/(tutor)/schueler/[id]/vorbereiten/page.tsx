import Link from "next/link";
import { notFound } from "next/navigation";
import { BookMarked, CheckCircle2 } from "lucide-react";
import { entferneVorschlagAction, vorbereitenAction, vorschlagZeigenAction } from "@/app/cockpit-actions";
import { PaketAuswahl } from "@/components/cockpit/Cockpit";
import { KeinPaket, VorschlagWarum } from "@/components/cockpit/Vorbereitung";
import { StatusPill } from "@/components/LernpaketStatus";
import { SchuelerWorteKarte } from "@/components/SchuelerNotiz";
import { PageHeader } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { vorbereitung } from "@/lib/cockpit";
import { paketWahl } from "@/lib/cockpit-vorschlag";
import { kostenSchaetzung } from "@/lib/lernpaket-ki";
import { getLernpaket } from "@/lib/lernpakete";
import { datumLabel, tagAddieren, wienerDatum } from "@/lib/planung/zeit";
import * as repo from "@/lib/repo";
import { schuelerWorte } from "@/lib/schueler-notiz";
import { runningUnitForStudent } from "@/lib/units";
import { autoWahl, kiVorgabe, kommendeTermine, ohnePaketMarkiert, schuelerBasis, VORAUS_TAGE, wuenscheFuer } from "@/lib/vorbereitung-auto";

export const metadata = { title: "Einheit vorbereiten" };

/**
 * „Einheit vorbereiten“ aus dem Tagesplan der Startseite: das Lernpaket für die Einheit eines Schülers an einem
 * Tag (heute oder einer der nächsten sieben, `?datum=`) wählen, bevor sie beginnt. Hat der Lehrer keines gewählt,
 * steht der Vorschlag der App da (lib/vorbereitung-auto.ts, ohne KI); „Entfernen“ nimmt ihn für den Tag weg.
 * Beim Start steht das Paket im Cockpit schon gewählt da (lib/cockpit.ts).
 */
export default async function VorbereitenPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fehler?: string; datum?: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const sp = await searchParams;
  const student = repo.getStudent(Number(id));
  if (!student) notFound();
  const heute = wienerDatum();
  const datum = sp.datum && /^\d{4}-\d{2}-\d{2}$/.test(sp.datum) && sp.datum >= heute && sp.datum < tagAddieren(heute, VORAUS_TAGE) ? sp.datum : heute;
  const tag = datum === heute ? "heute" : datumLabel(datum);
  const v = vorbereitung(student.id, datum);
  const p = v ? getLernpaket(v.paket_id) : null;
  const entfernt = !p && ohnePaketMarkiert(student.id, datum);
  // Fach und Dauer aus dem Termin des Tages, wenn es einen gibt
  const termine = kommendeTermine(teacher.id).filter((x) => x.studentId === student.id);
  const termin = termine.find((x) => x.datum === datum);
  // was der Schüler für nächstes Mal geschrieben hat, gilt nur für seine nächste Einheit
  const naechste = !termine.length || termine[0].datum === datum;
  const auto = p || entfernt ? null : autoWahl(schuelerBasis(student, new Date()), { datum, fach: termin?.fach ?? "", wuensche: naechste ? wuenscheFuer(student.id, null) : undefined });
  const fehlt = auto?.art === "kein_paket" ? auto.signal : auto?.art === "paket" ? auto.luecke : null;
  const ki = fehlt ? kiVorgabe(fehlt, student, { fach: termin?.fach ?? "", dauer: termin?.dauer || 50, gibtSkill: (x) => Boolean(repo.getSkill(x)) }) : null;
  const kosten = ki ? kostenSchaetzung().text : "";
  const laeuft = datum === heute ? runningUnitForStudent(student.id) : null;
  const wahl = paketWahl(student.id);
  const tagFeld = <input type="hidden" name="datum" value={datum} />;
  // was der Schüler für die nächste Einheit geschrieben hat (lib/schueler-notiz.ts); passt es zu einem Paket, steht es bei „Warum heute“
  const worte = laeuft ? null : schuelerWorte(student.id, null);
  return (
    <>
      <PageHeader title={`Einheit vorbereiten: ${student.name}`} back={{ href: "/", label: "Heute" }} subtitle={`Das Lernpaket für ${tag}. Beim Start der Einheit steht es im Cockpit bereit.`} />
      <div className="grid max-w-[1100px] gap-6">
        {sp.fehler && (
          <p role="alert" className="rounded-2xl bg-red-wash px-4 py-3 text-[15px] text-red">
            {sp.fehler}
          </p>
        )}
        {laeuft && (
          <p className="rounded-2xl bg-accent-wash px-4 py-3 text-[15px]">
            Die Einheit läuft schon. Das Lernpaket wählst du jetzt im{" "}
            <Link href={`/einheiten/${laeuft.id}?bereich=cockpit`} className="font-semibold text-accent underline underline-offset-2">
              Cockpit der Einheit
            </Link>
            .
          </p>
        )}
        {p && (
          <div className="panel flex flex-wrap items-center gap-3 px-5 py-4">
            <CheckCircle2 size={18} className="text-green" aria-hidden />
            <p className="min-w-0 flex-1 text-[15px]">
              Für {tag} vorbereitet: <span className="font-semibold">{p.title}</span>
            </p>
            <form action={vorbereitenAction.bind(null, student.id)}>
              {tagFeld}
              <input type="hidden" name="paket_id" value="" />
              <button className="btn btn-ghost btn-sm">Zurücknehmen</button>
            </form>
          </div>
        )}
        {worte && <SchuelerWorteKarte worte={worte} name={student.name.split(" ")[0]} />}
        {auto?.art === "paket" && (
          <section className="panel grid gap-2 px-5 py-4" aria-label="Vorschlag der App" data-testid="vorschlag">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <BookMarked size={18} className="shrink-0 text-accent" aria-hidden />
              <p className="min-w-0 text-[15px]">
                Für {tag} vorgeschlagen: <span className="font-semibold">{auto.paket.title}</span>
              </p>
              <StatusPill p={auto.paket} />
            </div>
            <VorschlagWarum warum={auto.warum} unsicher={auto.unsicher} />
            {auto.luecke && ki && <KeinPaket klein thema={auto.luecke.thema} ki={ki} kosten={kosten} />}
            <div className="flex flex-wrap gap-2 pt-1">
              <form action={vorbereitenAction.bind(null, student.id)}>
                {tagFeld}
                <input type="hidden" name="paket_id" value={auto.paket.id} />
                <button className="btn btn-primary btn-sm">Nehmen</button>
              </form>
              <form action={entferneVorschlagAction.bind(null, student.id)}>
                {tagFeld}
                <button className="btn btn-ghost btn-sm">Entfernen</button>
              </form>
            </div>
          </section>
        )}
        {auto?.art === "kein_paket" && (
          <section className="panel grid gap-1.5 px-5 py-4" aria-label="Kein Paket">
            <KeinPaket thema={auto.thema} ki={ki} kosten={kosten} entwuerfe={auto.entwuerfe} />
            <p className="text-[13px] text-ink-3">Warum dieses Thema: {auto.signal.warum}. Die KI läuft erst, wenn du im Formular „Entwurf erstellen“ tippst.</p>
          </section>
        )}
        {entfernt && (
          <div className="panel flex flex-wrap items-center gap-3 px-5 py-4">
            <p className="min-w-0 flex-1 text-[15px] text-ink-2">Für {tag} ohne Lernpaket. Den Vorschlag der App hast du entfernt.</p>
            <form action={vorschlagZeigenAction.bind(null, student.id)}>
              {tagFeld}
              <button className="btn btn-secondary btn-sm">Vorschlag wieder zeigen</button>
            </form>
          </div>
        )}
        <PaketAuswahl wahl={wahl} action={vorbereitenAction.bind(null, student.id)} gewaehlt={p?.id ?? null} felder={{ datum }} />
      </div>
    </>
  );
}
