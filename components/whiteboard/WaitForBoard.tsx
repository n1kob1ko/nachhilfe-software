"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Shown on the tablet before the unit starts; opens the board by itself as soon as the teacher starts it. */
export function WaitForBoard({ name, backHref }: { name: string; backHref: string }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [router]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
      <p className="text-[22px] font-semibold">Hallo {name}!</p>
      <p className="max-w-[40ch] text-[16px] text-ink-2">Die Tafel öffnet sich von selbst, sobald deine Nachhilfestunde beginnt.</p>
      <span className="relative mt-2 flex h-3 w-3" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-40 motion-reduce:hidden" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
      </span>
      <a href={backHref} className="link mt-4 text-[15px]">
        Zu meinen Übungen
      </a>
    </div>
  );
}
