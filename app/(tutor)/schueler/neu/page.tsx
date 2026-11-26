import { StudentForm } from "@/components/StudentForm";
import { PageHeader } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";

export const metadata = { title: "Neuer Schüler" };

export default async function NewStudent() {
  const lehrer = await requireTeacher();
  return (
    <>
      <PageHeader title="Neuer Schüler" back={{ href: "/schueler", label: "Schüler" }} />
      <StudentForm lehrerId={lehrer.id} />
    </>
  );
}
