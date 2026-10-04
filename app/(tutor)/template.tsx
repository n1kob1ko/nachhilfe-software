import { requireTeacher } from "@/lib/auth";

/** Templates render on every navigation, so the session is checked on every page of the tutor area. */
export default async function TutorTemplate({ children }: { children: React.ReactNode }) {
  await requireTeacher();
  return children;
}
