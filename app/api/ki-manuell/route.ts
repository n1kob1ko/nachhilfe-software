/**
 * The manual KI mode's little API: what is parked, and the pasted answer back.
 *
 * A route handler and not a server action on purpose: the action that triggered the KI call stays
 * open while the teacher copies and pastes, and the browser must be able to poll this endpoint in the
 * meantime. Answers (POST) settle the parked request; the waiting action then finishes by itself.
 */
import { NextResponse } from "next/server";
import { answerManual, cancelManual, pendingManual } from "@/lib/ai/providers/manual";
import { kiModus } from "@/lib/ai/modus";
import { requireTeacher } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireTeacher();
  return NextResponse.json({ manuell: kiModus() === "manual", anfragen: pendingManual() });
}

export async function POST(request: Request) {
  await requireTeacher();
  let body: { id?: unknown; antwort?: unknown };
  try {
    body = (await request.json()) as { id?: unknown; antwort?: unknown };
  } catch {
    return NextResponse.json({ ok: false, fehler: "Die Anfrage war nicht lesbar." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  const antwort = typeof body.antwort === "string" ? body.antwort : "";
  if (!id) return NextResponse.json({ ok: false, fehler: "Es fehlt die Kennung der Anfrage." }, { status: 400 });
  return NextResponse.json(answerManual(id, antwort));
}

export async function DELETE(request: Request) {
  await requireTeacher();
  const id = new URL(request.url).searchParams.get("id") ?? "";
  return NextResponse.json({ ok: id ? cancelManual(id) : false });
}
