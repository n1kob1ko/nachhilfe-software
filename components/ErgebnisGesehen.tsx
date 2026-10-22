"use client";

import { useEffect } from "react";
import { ergebnisGesehenAction } from "@/app/zu-erledigen-actions";

/**
 * Merkt sich, dass der Lehrer dieses Ergebnis geöffnet hat (lib/zu-erledigen.ts). Erst im Browser, nicht
 * beim Rendern auf dem Server: ein Vorabladen des Links zählt so nicht als „gesehen“.
 */
export function ErgebnisGesehen({ assignmentId }: { assignmentId: number }) {
  useEffect(() => {
    void ergebnisGesehenAction(assignmentId).catch(() => {});
  }, [assignmentId]);
  return null;
}
