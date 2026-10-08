import { headers } from "next/headers";
import QRCode from "qrcode";
import { TabletSmartphone } from "lucide-react";
import { createPairCodeAction, renameDeviceAction, revokeDeviceAction } from "@/app/device-actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { PairQr } from "@/components/device/PairQr";
import { Info } from "@/components/Info";
import { PageHeader, Pill, Reveal } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { baseUrl } from "@/lib/base-url";
import { canManageDevice, listDevices, openPairCode } from "@/lib/devices";
import { tabletOnline } from "@/lib/live";
import { listTeachers } from "@/lib/repo";

export const metadata = { title: "Schülergeräte" };

function lastSeen(iso: string | null, now = Date.now()) {
  if (!iso) return "noch nie";
  const min = Math.round((now - Date.parse(iso)) / 60_000);
  if (min < 2) return "gerade eben";
  if (min < 60) return `vor ${min} min`;
  if (min < 24 * 60) return `vor ${Math.round(min / 60)} ${Math.round(min / 60) === 1 ? "Stunde" : "Stunden"}`;
  return new Date(iso).toLocaleDateString("de-AT", { day: "numeric", month: "short" });
}

/** One tablet per teacher: it shows whoever the teacher is teaching right now. */
export default async function DevicesPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const teacher = await requireTeacher();
  const sp = await searchParams;
  const devices = listDevices(teacher.is_admin ? null : teacher.id);
  const teachers = teacher.is_admin ? listTeachers().filter((t) => t.active) : [teacher];
  const codeFor = Number(sp.code) && (teacher.is_admin || Number(sp.code) === teacher.id) ? Number(sp.code) : null;
  const code = codeFor ? openPairCode(codeFor) : null;
  const h = await headers();
  const base = baseUrl({ host: h.get("x-forwarded-host") ?? h.get("host"), proto: h.get("x-forwarded-proto") });
  const deviceUrl = `${base.url}/geraet`;
  const qr = code ? await QRCode.toString(deviceUrl, { type: "svg", margin: 2, errorCorrectionLevel: "M" }) : "";
  const minutesLeft = code ? Math.max(1, Math.round((Date.parse(code.expiresAt) - Date.now()) / 60_000)) : 0;

  return (
    <>
      <PageHeader
        title="Schülergeräte"
        back={{ href: "/mehr", label: "Mehr" }}
        info="Jeder Lehrer hat ein festes Schüler-Tablet. Es zeigt automatisch den Schüler der laufenden Einheit dieses Lehrers und danach wieder „Bereit für die nächste Einheit“."
      />

      {code && codeFor && (
        <section className="mb-8 max-w-[760px] rounded-[24px] bg-accent-wash px-6 py-6" aria-label="Verbindungscode">
          <AutoRefresh seconds={4} />
          <div className="grid gap-6 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-8">
            <PairQr svg={qr} url={deviceUrl} code={code.code} />
            <div>
              <p className="text-[15px] font-semibold text-ink-2">
                Verbindungscode{teachers.length > 1 && ` für ${teachers.find((t) => t.id === codeFor)?.name}`}
              </p>
              <p className="num mt-1 text-[48px] leading-none font-semibold tracking-[0.12em]" data-testid="pair-code">
                {code.code}
              </p>
              <ol className="mt-4 list-decimal space-y-1 pl-5 text-[15px]">
                <li>QR-Code mit der Tablet-Kamera scannen. Ohne Kamera am Tablet die Adresse unter dem QR-Code eingeben.</li>
                <li>Code eingeben. Fertig, das Tablet bleibt verbunden.</li>
              </ol>
              <p className="mt-3 text-[13px] text-ink-2">Gültig noch {minutesLeft} min, nur einmal verwendbar.</p>
              {base.localOnly && (
                <p className="mt-3 text-[13px] text-ink-2" role="note">
                  Diese Adresse funktioniert nur auf diesem Computer. Öffne die App über die Netzwerk-Adresse des Computers, dann passt auch der QR-Code.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="max-w-[760px]">
        {devices.length === 0 ? (
          <div className="panel flex flex-col items-start gap-3 px-5 py-6">
            <TabletSmartphone size={28} className="text-ink-3" aria-hidden />
            <p className="font-semibold">Noch kein Schüler-Tablet verbunden</p>
          </div>
        ) : (
          <ul className="panel divide-y divide-line">
            {devices.map((d) => {
              const online = tabletOnline(d.teacher_id);
              const mine = canManageDevice(teacher, d);
              return (
                <li key={d.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <TabletSmartphone size={22} className="shrink-0 text-ink-2" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{d.name}</p>
                      <p className="text-[13px] text-ink-2">
                        {d.teacher_name} · zuletzt aktiv {lastSeen(d.last_seen_at)}
                      </p>
                    </div>
                    <Pill tone={online ? "green" : "neutral"}>{online ? "online" : "offline"}</Pill>
                  </div>
                  {mine && (
                    <Reveal label="Umbenennen oder trennen" className="mt-1 pl-[38px]">
                      <div className="flex flex-wrap items-end gap-3">
                        <form action={renameDeviceAction.bind(null, d.id)} className="flex flex-wrap items-end gap-2">
                          <label className="field">
                            <span className="label">Name</span>
                            <input className="input" name="name" defaultValue={d.name} maxLength={60} />
                          </label>
                          <button className="btn btn-secondary">Speichern</button>
                        </form>
                        <form action={revokeDeviceAction.bind(null, d.id)}>
                          <button className="btn btn-danger">Verbindung trennen</button>
                        </form>
                      </div>
                    </Reveal>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <form action={createPairCodeAction} className="mt-6 flex flex-wrap items-end gap-3">
          {teachers.length > 1 && (
            <label className="field">
              <span className="label">Für</span>
              <select className="input" name="teacher_id" defaultValue={teacher.id}>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="btn btn-primary btn-lg">
            <TabletSmartphone size={18} aria-hidden /> {devices.some((d) => d.teacher_id === teacher.id) ? "Neues Tablet verbinden" : "Tablet verbinden"}
          </button>
          <Info label="Was passiert beim Verbinden?">Du bekommst einen 6-stelligen Code, der 10 Minuten gilt. Am Tablet einmal eingeben, danach bleibt es mit dir verbunden, bis jemand die Verbindung trennt.</Info>
        </form>
      </section>
    </>
  );
}
