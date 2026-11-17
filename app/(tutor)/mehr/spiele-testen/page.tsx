import { headers } from "next/headers";
import QRCode from "qrcode";
import { Gamepad2, RotateCcw } from "lucide-react";
import { spieleTestenAction, testSpielstandLoeschenAction } from "@/app/spiele-testen-actions";
import { FormKnopf } from "@/components/FormKnopf";
import { PageHeader, Reveal } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { baseUrl } from "@/lib/base-url";
import { SCHOOL_TYPES, klassenLabel } from "@/lib/school";
import { testRunden, testSchuelerVon } from "@/lib/spiele-testen";

export const metadata = { title: "Spiele testen" };
export const dynamic = "force-dynamic";

/**
 * Mehr › Spiele testen (niko 2026-11-17): Klasse wählen, „Spiele öffnen“, und die Lehrkraft spielt in der Schüler-App
 * mit ihrem unsichtbaren Test-Schüler (lib/spiele-testen.ts). Nichts davon zählt bei einem echten Schüler.
 */
export default async function SpieleTestenPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const me = await requireTeacher();
  const sp = await searchParams;
  const test = testSchuelerVon(me.id);
  const runden = test ? testRunden(test.id) : 0;
  const gewaehlt = test?.klasse ? `${test.school_type}:${test.klasse}` : "Gymnasium:1";
  const pfad = test ? `/lernen/${test.access_token}/spiele` : null;
  let qr = "";
  if (pfad) {
    const h = await headers();
    const base = baseUrl({ host: h.get("x-forwarded-host") ?? h.get("host"), proto: h.get("x-forwarded-proto") });
    qr = await QRCode.toString(`${base.url}${pfad}`, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
  }

  return (
    <>
      <PageHeader
        title="Spiele testen"
        back={{ href: "/mehr", label: "Erweitert" }}
        info="Du spielst in der Schüler-App mit deinem eigenen Test-Schüler. Er steht in keiner Liste, nicht in Bestenliste oder Liga, und nichts zählt bei einem echten Schüler."
      />

      {sp.ok && (
        <p className="mb-6 max-w-[560px] rounded-2xl bg-green-wash px-4 py-3 text-[14px] text-green" role="status">
          {sp.ok}
        </p>
      )}

      <section className="panel grid max-w-[560px] gap-5 px-5 py-5" data-testid="spiele-testen">
        <form action={spieleTestenAction} className="flex flex-wrap items-end gap-3">
          <label className="field min-w-[220px] flex-1">
            <span className="label">Klasse</span>
            <select className="input" name="klasse" defaultValue={gewaehlt}>
              {SCHOOL_TYPES.map((t) => (
                <optgroup key={t.name} label={t.name}>
                  {Array.from({ length: t.classes }, (_, i) => i + 1).map((k) => (
                    <option key={k} value={`${t.name}:${k}`}>
                      {klassenLabel(t.name, k)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <FormKnopf className="btn btn-primary btn-lg" icon={<Gamepad2 size={18} aria-hidden />}>
            Spiele öffnen
          </FormKnopf>
        </form>

        <ul className="grid gap-1.5 text-[14px] text-ink-2">
          <li>✓ Alle Spiele in Mathe, Deutsch und Englisch, mit Fragen für diese Klasse.</li>
          <li>✓ Zählt bei keinem Schüler, nicht im Lernstand, nicht in Bestenliste oder Liga.</li>
          <li>✓ Oben in der Schüler-App führt „Zurück“ wieder hierher.</li>
        </ul>

        {test && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 text-[14px]">
            <span className="text-ink-2">
              {runden ? `${runden} ${runden === 1 ? "Runde" : "Runden"} gespielt` : "Noch keine Runde gespielt"}
            </span>
            {runden > 0 && (
              <form action={testSpielstandLoeschenAction}>
                <FormKnopf className="btn btn-ghost btn-sm" icon={<RotateCcw size={15} aria-hidden />}>
                  Spielstand löschen
                </FormKnopf>
              </form>
            )}
          </div>
        )}

        {qr && (
          <Reveal label="Am Handy testen">
            <div className="flex flex-wrap items-center gap-5">
              <div
                role="img"
                aria-label="QR-Code zu den Spielen"
                className="w-[160px] rounded-2xl bg-white p-3 shadow-[var(--shadow-card)] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qr }}
              />
              <p className="max-w-[30ch] text-[14px]">Mit der Handy-Kamera scannen. Die Klasse ist die zuletzt gewählte.</p>
            </div>
          </Reveal>
        )}
      </section>
    </>
  );
}
