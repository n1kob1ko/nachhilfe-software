import fs from "node:fs";
import path from "node:path";
import { appVersion } from "@/lib/app-version";
import { db, dbPath } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * For the host's health check: the database answers and its folder is writable. No details go out, only the build
 * version, which open pages compare with their own (components/NeueVersion.tsx).
 */
export function GET() {
  try {
    db().prepare("SELECT 1").get();
    const file = dbPath();
    if (file !== ":memory:") fs.accessSync(path.dirname(file), fs.constants.W_OK);
    return Response.json({ ok: true, version: appVersion() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
