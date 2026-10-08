import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: the real session check happens in lib/auth.ts.
export function proxy(request: NextRequest) {
  if (!request.cookies.get("lernheft_session")?.value) {
    const url = new URL("/login", request.url);
    if (request.nextUrl.pathname !== "/") url.searchParams.set("weiter", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // everything except the login page, the health check, the student areas (link, tablet and own laptop), material files (they check
  // the session themselves; uploads can be larger than the proxy's body limit) and static files
  matcher: ["/((?!login|health|lernen|geraet|mitmachen|material/|excalidraw-assets|_next/static|_next/image|favicon.ico|icon|.*\\.(?:png|svg|ico|webmanifest)$).*)"],
};
