"use client";

import { useEffect, useRef, useState } from "react";
import { pruefeEinzelterminAction } from "@/app/actions";

/**
 * Prüft eine von Hand geplante Einheit vor dem Speichern auf Überschneidung (Plan 3.3), damit das Formular bei
 * einer Absage stehen bleibt und nichts Getipptes verloren geht. Das Speichern prüft trotzdem selbst
 * (`saveLessonAction`); ohne JavaScript kommt die Absage dort als `?fehler=`.
 */
export function EinzelterminPruefung({ fehler }: { fehler?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [meldung, setMeldung] = useState(fehler ?? "");
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    // nach einer Absage beim Speichern (?fehler=) steht die Meldung beim Knopf: dorthin
    if (ref.current && !ref.current.hidden) ref.current.scrollIntoView({ block: "center" });
    let geprueft = false;
    const beimSenden = async (e: SubmitEvent) => {
      if (geprueft) {
        geprueft = false;
        return;
      }
      e.preventDefault();
      const fehlerText = await pruefeEinzelterminAction(new FormData(form));
      setMeldung(fehlerText ?? "");
      if (fehlerText) {
        ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      geprueft = true;
      form.requestSubmit(e.submitter instanceof HTMLElement ? e.submitter : undefined);
    };
    form.addEventListener("submit", beimSenden, { capture: true });
    return () => form.removeEventListener("submit", beimSenden, { capture: true });
  }, []);
  return (
    <p ref={ref} role="alert" hidden={!meldung} className="rounded-2xl px-4 py-3 text-[14px] text-red" style={{ background: "var(--red-wash)" }}>
      {meldung}
    </p>
  );
}
