import { requireTeacher } from "@/lib/auth";

/** Templates render on every navigation, so the session is checked on every page of the tutor area. */
export default async function TutorTemplate({ children }: { children: React.ReactNode }) {
  await requireTeacher();
  // jede Seite blendet kurz ein (Bewegung, Regel 1); die Leiste links und unten bleibt stehen
  return <div className="seite-rein">{children}</div>;
}
