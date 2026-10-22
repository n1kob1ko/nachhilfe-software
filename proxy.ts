import { NextResponse, type NextRequest } from "next/server";
import { proxyEntscheidung } from "@/lib/praesentation-host";

// Optimistic check only: the real session check happens in lib/auth.ts.
// Before it: the presentation address answers only with deck files, the app's address never with them
// (lib/praesentation-host.ts, docs/praesentation-format.md).
export function proxy(request: NextRequest) {
  const e = proxyEntscheidung({
    host: request.headers.get("host"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    pfad: request.nextUrl.pathname,
    angemeldet: Boolean(request.cookies.get("lernheft_session")?.value),
  });
  if (e === "nicht-gefunden") return new NextResponse("Nicht gefunden.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  if (e === "anmelden") {
    const url = new URL("/login", request.url);
    if (request.nextUrl.pathname !== "/") url.searchParams.set("weiter", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // everything except the login page, the health check, the student areas (link, tablet and own laptop), material files and feedback (they
    // check the session themselves; uploads can be larger than the proxy's body limit) and static files (the same list as OFFENE_PFADE in
    // lib/praesentation-host.ts)
    "/((?!login|health|lernen|geraet|mitmachen|material/|feedback/|excalidraw-assets|_next/static|_next/image|favicon.ico|icon|.*\\.(?:png|svg|ico|webmanifest)$).*)",
    // and every request without a teacher session, so the presentation address (where that cookie never is) answers nothing but deck files
    { source: "/(.*)", missing: [{ type: "cookie", key: "lernheft_session" }] },
  ],
};
