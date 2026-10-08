import { NextResponse } from "next/server";
import { LAPTOP_COOKIE, signOutLaptop } from "@/lib/laptop";
import { currentLaptop } from "@/lib/laptop-context";
import { notifyTablet, pushLive } from "@/lib/live";

export const dynamic = "force-dynamic";

/**
 * "Abmelden" on the laptop, and the clean-up after the access ended: the session ends, the cookie is
 * removed and the browser drops its cached copies of the laptop pages.
 */
export async function POST(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return new Response("Nicht erlaubt.", { status: 403 });
  const session = await currentLaptop();
  if (session && signOutLaptop(session.id)) {
    notifyTablet(session.teacher_id, "laptop");
    pushLive(session.unit_id);
  }
  const res = new NextResponse(null, { status: 303, headers: { Location: "/mitmachen?abgemeldet=1", "Cache-Control": "no-store", "Clear-Site-Data": '"cache"' } });
  res.cookies.set(LAPTOP_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/mitmachen",
    maxAge: 0,
  });
  return res;
}
