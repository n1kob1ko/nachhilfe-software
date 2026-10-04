import { StudentForm } from "@/components/StudentForm";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Neuer Schüler" };

export default function NewStudent() {
  return (
    <>
      <PageHeader title="Neuer Schüler" back={{ href: "/schueler", label: "Schüler" }} />
      <StudentForm />
    </>
  );
}
