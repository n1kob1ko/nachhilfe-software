import { RotateCcw, Save } from "lucide-react";
import { vorlageSpeichernAction } from "@/app/phantom-vorlage-actions";
import { FormKnopf } from "@/components/FormKnopf";
import { PhantomGesicht } from "@/components/lernen/PhantomGesicht";
import { PageHeader, Reveal } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { phantomVorlage } from "@/lib/lernspiele";
import { neuerFall, zufall } from "@/lib/phantombild";
import { ausgefuellt, PLATZHALTER, PLATZHALTER_HILFE, PRONOMEN, VORLAGE_MAX } from "@/lib/phantom-vorlage";

export const metadata = { title: "Phantombild-Vorlage" };
export const dynamic = "force-dynamic";

/**
 * Mehr › Phantombild-Vorlage (niko 2026-11-19): der Text, den die Schüler im Spiel „Phantombild › Text lernen“
 * auswendig lernen. Platzhalter in eckigen Klammern füllt das Spiel mit den Merkmalen der Person; ein Satz mit einem
 * Merkmal, das die Person nicht hat (kein Bart), fällt weg. Darunter: so sieht er für zwei Beispiel-Personen aus.
 */
export default async function PhantomVorlagePage({ searchParams }: { searchParams: Promise<{ ok?: string; fehler?: string }> }) {
  await requireTeacher();
  const sp = await searchParams;
  const v = phantomVorlage();
  const beispiele = [neuerFall(zufall(7)), neuerFall(zufall(20))];

  return (
    <>
      <PageHeader
        title="Phantombild-Vorlage"
        back={{ href: "/mehr", label: "Erweitert" }}
        info="Diesen Text lernen die Schüler im Spiel Phantombild unter „Text lernen“ auswendig. In Stufe 1 setzen sie nur die Merkmale ein, mit jeder Stufe fehlen mehr Wörter, in Stufe 5 der ganze Text."
      />
      {sp.ok && (
        <p className="mb-6 max-w-[720px] rounded-2xl bg-green-wash px-4 py-3 text-[14px] text-green" role="status">
          {sp.ok}
        </p>
      )}
      {sp.fehler && (
        <p className="mb-6 max-w-[720px] rounded-2xl bg-red-wash px-4 py-3 text-[14px] text-red" role="alert">
          {sp.fehler}
        </p>
      )}

      <section className="panel grid max-w-[720px] gap-4 px-5 py-5" data-testid="phantom-vorlage">
        <p className="text-[14px] text-ink-2">{v.eigene ? "Das ist deine eigene Vorlage." : "Das ist die Vorlage von Claude, nach dem Aufbau auf dem Arbeitsblatt (Einleitung, Hauptteil, Schluss)."} Absätze trennst du mit einer leeren Zeile.</p>
        <form action={vorlageSpeichernAction} className="grid gap-3">
          <label className="field">
            <span className="label">Vorlage</span>
            <textarea className="input min-h-[280px] font-[inherit] text-[16px] leading-relaxed" name="text" defaultValue={v.text} maxLength={VORLAGE_MAX} required />
          </label>
          <div className="flex flex-wrap gap-2">
            <FormKnopf className="btn btn-primary" icon={<Save size={17} aria-hidden />}>
              Speichern
            </FormKnopf>
            {v.eigene && (
              <FormKnopf className="btn btn-ghost" name="zurueck" value="1" icon={<RotateCcw size={16} aria-hidden />} formNoValidate>
                Vorlage von Claude nehmen
              </FormKnopf>
            )}
          </div>
        </form>

        <Reveal label="Welche Platzhalter gibt es?">
          <dl className="grid gap-x-4 gap-y-1.5 text-[14px] sm:grid-cols-[auto_1fr]">
            {PLATZHALTER.map((p) => (
              <div key={p} className="contents">
                <dt className="font-semibold">[{p}]</dt>
                <dd className="text-ink-2">{PLATZHALTER_HILFE[p]}</dd>
              </div>
            ))}
            <dt className="font-semibold">{PRONOMEN.map((p) => `[${p}]`).join(" ")}</dt>
            <dd className="text-ink-2">er/sie und sein/ihr, passend zur Person. Endungen schreibst du dahinter: [Sein]e Augen, [sein]en Hals.</dd>
          </dl>
        </Reveal>
      </section>

      <h2 className="mt-8 mb-3 text-[18px] font-semibold">So sieht der Text für zwei Personen aus</h2>
      <div className="grid max-w-[720px] gap-4">
        {beispiele.map((f) => (
          <article key={f.name} className="panel flex gap-4 px-5 py-5">
            <div className="w-[88px] shrink-0 overflow-hidden rounded-xl bg-accent-wash">
              <PhantomGesicht bau={f} titel={`Phantombild von ${f.name}`} />
            </div>
            <div className="grid gap-2 text-[15px] leading-relaxed">
              {ausgefuellt(v.text, f)
                .split("\n\n")
                .map((a, i) => (
                  <p key={i}>{a}</p>
                ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
