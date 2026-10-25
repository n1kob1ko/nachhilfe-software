import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth";
import { lageFuer, lageHref } from "@/lib/situation";

export const dynamic = "force-dynamic";

/**
 * Wohin die Lehrkraft jetzt gehört (lib/situation.ts): läuft eine eigene Einheit, in den Unterricht; ist heute eine
 * Einheit beendet und ihre Dokumentation offen, zum Abschluss; sonst zu Heute. Nach der Anmeldung, am Logo und nach
 * „Dokumentation bestätigen“. Heute (`/`) selbst leitet nie um, sonst käme man während einer Einheit nie hin.
 */
export default async function JetztPage() {
  const teacher = await requireTeacher();
  redirect(lageHref(lageFuer(teacher.id)));
}
