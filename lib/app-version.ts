import fs from "node:fs";
import path from "node:path";

/**
 * The version of the running build: Next's BUILD_ID (it changes with every build, and so do the ids of the
 * Server Actions). An open page compares it with /health (components/NeueVersion.tsx); when they differ, the
 * page is older than the server and its clicks on Server Actions would fail („Failed to find Server Action“).
 */
let cache: string | null = null;
export function appVersion(): string {
  if (cache !== null) return cache;
  try {
    cache = fs.readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim() || "dev";
  } catch {
    cache = "dev";
  }
  return cache;
}
