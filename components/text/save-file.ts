/**
 * "Als Datei sichern": a text that has not reached the server yet goes into a file on this device
 * (the browser's downloads), so nothing is lost when the window has to be closed while offline.
 */
import { plainText, type TextDoc } from "@/lib/text-doc";

export function saveTextFile(title: string, body: TextDoc, at = new Date()) {
  const day = at.toLocaleDateString("sv-SE", { timeZone: "Europe/Vienna" });
  const time = at.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" });
  const name = `${title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().replace(/\s+/g, "-").slice(0, 60) || "Text"}-${day}-${time.replace(":", "")}.txt`;
  const content = `${title}\nNicht gespeicherter Entwurf, gesichert am ${day} um ${time}\n\n${plainText(body)}\n`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
