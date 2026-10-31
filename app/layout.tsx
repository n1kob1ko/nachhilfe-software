import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Outfit for headings and big numbers, Plus Jakarta Sans (tabular figures) for everything else. Both are in app/fonts
// (variable TTFs from github.com/google/fonts, OFL): the build must not need fonts.googleapis.com, whose fetch sometimes fails and then stops the whole build
const outfit = localFont({ src: "./fonts/Outfit.ttf", weight: "100 900", variable: "--font-outfit", display: "swap" });
const jakarta = localFont({ src: "./fonts/PlusJakartaSans.ttf", weight: "200 800", variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Lernheft", template: "%s · Lernheft" },
  description: "Nachhilfe-Software: Schülerprofile, Dokumentation jeder Einheit, Übungen, Fortschritt und Empfehlungen.",
};

export const viewport: Viewport = { themeColor: "#f5f8fc" };

// Dunkelmodus: die gemerkte Wahl kommt vor dem ersten Bild ans <html>, sonst blitzt die Seite kurz hell auf.
// Der Knopf dazu ist components/ThemeToggle.tsx; ohne Wahl bleibt es hell.
const THEME_SKRIPT = 'try{if(localStorage.getItem("lernheft-theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${outfit.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SKRIPT }} />
      </head>
      <body className="min-h-screen font-sans text-[15px] leading-normal">{children}</body>
    </html>
  );
}
