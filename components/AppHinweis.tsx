"use client";

import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const KEY = "lernheft-app-hinweis";

/**
 * „DreamStudy als App“ auf dem Handy des Schülers: mit Install-Knopf, wo der Browser ihn anbietet
 * (Android, Chrome), sonst ein Satz, wie es geht (iPhone: Teilen › Zum Home-Bildschirm). Nicht in der
 * installierten App und nicht, nachdem der Schüler ihn ausgeblendet hat.
 */
export function AppHinweis() {
  const [art, setArt] = useState<null | "knopf" | "iphone" | "menue">(null);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const installiert = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    let aus = false;
    try {
      aus = localStorage.getItem(KEY) === "aus";
    } catch {
      // ohne Speicher: der Hinweis kommt eben wieder
    }
    if (installiert || aus) return;
    const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const handy = window.matchMedia("(pointer: coarse)").matches;
    if (iphone) setArt("iphone");
    else if (handy) setArt("menue");
    const vorschlag = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
      setArt("knopf");
    };
    const fertig = () => setArt(null);
    window.addEventListener("beforeinstallprompt", vorschlag);
    window.addEventListener("appinstalled", fertig);
    return () => {
      window.removeEventListener("beforeinstallprompt", vorschlag);
      window.removeEventListener("appinstalled", fertig);
    };
  }, []);

  if (!art) return null;
  const ausblenden = () => {
    setArt(null);
    try {
      localStorage.setItem(KEY, "aus");
    } catch {
      // nur für diesen Besuch ausgeblendet
    }
  };
  return (
    <section className="panel mt-8 flex items-start gap-4 px-5 py-4" aria-label="DreamStudy als App" data-testid="app-hinweis">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-wash text-accent" aria-hidden>
        <Smartphone size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-semibold">DreamStudy als App</p>
        <p className="mt-0.5 text-[14px] text-ink-2">
          {art === "iphone"
            ? "Tippe in Safari unten auf Teilen und dann auf „Zum Home-Bildschirm“. Dann siehst du deine Termine und Übungen mit einem Tipp."
            : art === "menue"
              ? "Tippe im Browser-Menü auf „Zum Startbildschirm hinzufügen“. Dann siehst du deine Termine und Übungen mit einem Tipp."
              : "Leg dir DreamStudy auf den Startbildschirm. Dann siehst du deine Termine und Übungen mit einem Tipp."}
        </p>
        {art === "knopf" && prompt && (
          <button
            type="button"
            className="btn btn-primary mt-3"
            onClick={async () => {
              await prompt.prompt();
              const { outcome } = await prompt.userChoice;
              if (outcome === "accepted") setArt(null);
              setPrompt(null);
            }}
            data-testid="app-installieren"
          >
            Installieren
          </button>
        )}
      </div>
      <button type="button" onClick={ausblenden} className="btn btn-ghost btn-sm min-w-[44px] !px-2" aria-label="Hinweis ausblenden">
        <X size={16} aria-hidden />
      </button>
    </section>
  );
}
