import { hasData, seedDemo } from "../lib/demo";

if (hasData() && !process.argv.includes("--force")) {
  console.log("Die Datenbank enthält bereits Schüler. Mit --force trotzdem Demo-Daten hinzufügen.");
} else {
  seedDemo();
  console.log("Demo-Daten angelegt.");
}
