import { headers } from "next/headers";
import Link from "next/link";
import QRCode from "qrcode";
import { ExternalLink } from "lucide-react";
import { CopyLink } from "@/components/CopyLink";
import { Info } from "@/components/Info";
import { Reveal } from "@/components/ui";
import { baseUrl } from "@/lib/base-url";

/**
 * Der Link zur Schüler-App (`/lernen/[token]`): kopieren, öffnen oder als QR-Code zum Scannen mit dem
 * Handy des Schülers. Dort sieht er gesendete Übungen und seine Termine und kann ihn als App ablegen.
 */
export async function SchuelerAppLink({ token, first }: { token: string; first: string }) {
  const path = `/lernen/${token}`;
  const h = await headers();
  const base = baseUrl({ host: h.get("x-forwarded-host") ?? h.get("host"), proto: h.get("x-forwarded-proto") });
  const qr = await QRCode.toString(`${base.url}${path}`, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
  return (
    <div className="grid gap-2" data-testid="schueler-app">
      <p className="text-[14px] font-semibold">
        Schüler-App von {first}
        <Info label="Info zur Schüler-App">
          Auf diesem Link sieht {first} die gesendeten Übungen und die Termine aus dem Wochenplan. Am Handy geöffnet, legt {first} ihn als App auf den
          Home-Bildschirm.
        </Info>
      </p>
      <div className="flex w-full max-w-[520px] items-center gap-2">
        <CopyLink path={path} />
        <Link href={path} target="_blank" className="btn btn-ghost btn-sm min-w-[44px] !px-2" aria-label="Schüleransicht öffnen">
          <ExternalLink size={15} />
        </Link>
      </div>
      <Reveal label="QR-Code zum Scannen">
        <div className="flex flex-wrap items-center gap-5">
          <div
            role="img"
            aria-label="QR-Code zur Schüler-App"
            className="w-[180px] rounded-2xl bg-white p-3 shadow-[var(--shadow-card)] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
            data-testid="schueler-app-qr"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <ol className="max-w-[36ch] list-decimal space-y-1 pl-5 text-[14px]">
            <li>{first} scannt den Code mit der Handy-Kamera.</li>
            <li>Auf der Seite steht, wie {first} sie als App auf den Home-Bildschirm legt.</li>
          </ol>
        </div>
      </Reveal>
    </div>
  );
}
