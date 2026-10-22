import { ShieldAlert } from "lucide-react";
import { Pill } from "@/components/ui";
import { PAKET_STATUS, ungeprueft, type Lernpaket } from "@/lib/lernpakete";

/** Status of a package as a chip: Geprüft green, the rest quiet. */
export function StatusPill({ p }: { p: Pick<Lernpaket, "status" | "quelle" | "geprueft_am"> }) {
  return (
    <>
      <Pill tone={p.status === "geprueft" ? "green" : "neutral"}>{PAKET_STATUS[p.status]}</Pill>
      {ungeprueft(p) && (
        <Pill tone="amber" title={`${p.quelle === "ki" ? "Von der KI erstellt" : "Importiert"} und noch von niemandem geprüft`}>
          <ShieldAlert size={12} aria-hidden /> Ungeprüft
        </Pill>
      )}
    </>
  );
}
