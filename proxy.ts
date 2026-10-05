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
  // everything except the login page, the student area and static files
  matcher: ["/((?!login|lernen|excalidraw-assets|_next/static|_next/image|favicon.ico|icon|.*\\.(?:png|svg|ico|webmanifest)$).*)"],
};
