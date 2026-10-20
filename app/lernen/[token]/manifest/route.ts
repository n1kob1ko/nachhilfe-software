import { getStudentByToken } from "@/lib/repo";

export const dynamic = "force-dynamic";

/**
 * Das Web-App-Manifest der Schüler-App: „Zum Home-Bildschirm“ öffnet danach genau diesen Link,
 * nicht die Anmeldung der Lehrer. Pro Schüler, weil der Link der Zugang ist.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!getStudentByToken(token)) return new Response("Nicht gefunden", { status: 404 });
  const start = `/lernen/${encodeURIComponent(token)}`;
  const manifest = {
    id: start,
    name: "Lernheft",
    short_name: "Lernheft",
    description: "Deine Übungen und Termine bei MC Dream Education.",
    lang: "de",
    start_url: start,
    // start_url muss im Scope liegen, deshalb ohne Schrägstrich am Ende
    scope: start,
    display: "standalone",
    background_color: "#f5f8fc",
    theme_color: "#f5f8fc",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
