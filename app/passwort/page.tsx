import Link from "next/link";
import { PasswordForm } from "@/components/AuthForms";
import { requireTeacher } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Passwort ändern" };

export default async function ChangePassword() {
  const t = await requireTeacher({ allowInitialPassword: true });
  const first = Boolean(t.must_change_password);
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{first ? `Willkommen, ${t.name}` : "Passwort ändern"}</h1>
        <p className="mt-1 mb-6 text-ink-2">{first ? "Bitte wähle zuerst ein eigenes Passwort. Das Startpasswort gilt danach nicht mehr." : `Angemeldet als ${t.username}.`}</p>
        <div className="panel px-5 py-5">
          <PasswordForm />
        </div>
        {!first && (
          <Link href="/" className="link mt-4 inline-block text-[14px]">
            Zurück
          </Link>
        )}
      </div>
    </main>
  );
}
