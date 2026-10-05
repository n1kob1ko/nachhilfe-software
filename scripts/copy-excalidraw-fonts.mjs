// Copies the whiteboard fonts into public/, so the board works without loading anything from a CDN.
// Runs after `npm install`. The large CJK font (Xiaolai) is skipped: German and math need only Latin glyphs.
import fs from "node:fs";
import path from "node:path";

const src = path.join(process.cwd(), "node_modules/@excalidraw/excalidraw/dist/prod/fonts");
const dst = path.join(process.cwd(), "public/excalidraw-assets/fonts");
if (!fs.existsSync(src)) process.exit(0);
fs.rmSync(dst, { recursive: true, force: true });
for (const family of fs.readdirSync(src)) {
  if (family === "Xiaolai") continue;
  fs.cpSync(path.join(src, family), path.join(dst, family), { recursive: true });
}
