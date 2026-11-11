"use server";

import { revalidatePath } from "next/cache";
import * as repo from "@/lib/repo";
import {
  beendeVokabelRunde,
  pruefeVokabelKarte,
  starteVokabelRunde,
  type VokabelAntwort,
  type VokabelKarte,
  type VokabelRundenEnde,
} from "@/lib/vokabel-training";

// ---------- Schülerseite: Vokabeln üben (lib/vokabel-training.ts) ----------
// Der geheime Link ist der einzige Schlüssel. Die Lösungen bleiben auf dem Server; jede Antwort prüft er an der
// Karte, die er beim Start der Runde gespeichert hat.

type Fehler = { fehler: string };
const LINK_UNGUELTIG: Fehler = { fehler: "Dieser Link gilt nicht mehr." };

export async function vokabelRundeStartenAction(
  token: string,
  listeId: number,
): Promise<{ rundeId: number; karten: VokabelKarte[] } | Fehler> {
  const student = repo.getStudentByToken(token);
  if (!student) return LINK_UNGUELTIG;
  return (
    starteVokabelRunde(student.id, Number(listeId)) ?? {
      fehler: "Diese Liste gibt es nicht mehr oder sie hat keine Wörter.",
    }
  );
}

export async function vokabelPruefenAction(
  token: string,
  rundeId: number,
  i: number,
  gegeben: string,
  selbst?: boolean,
): Promise<VokabelAntwort | Fehler> {
  const student = repo.getStudentByToken(token);
  if (!student) return LINK_UNGUELTIG;
  const out = pruefeVokabelKarte(
    student.id,
    Number(rundeId),
    Number(i),
    String(gegeben ?? "").slice(0, 200),
    { selbst: typeof selbst === "boolean" ? selbst : undefined },
  );
  return (
    out ?? { fehler: "Diese Runde gibt es nicht mehr. Starte bitte eine neue." }
  );
}

export async function vokabelRundeBeendenAction(
  token: string,
  rundeId: number,
): Promise<VokabelRundenEnde | Fehler> {
  const student = repo.getStudentByToken(token);
  if (!student) return LINK_UNGUELTIG;
  const out = beendeVokabelRunde(student.id, Number(rundeId));
  if (!out) return { fehler: "Diese Runde gibt es nicht mehr." };
  revalidatePath(`/lernen/${token}`, "layout");
  revalidatePath(`/schueler/${student.id}/vokabeln`);
  return out;
}
