"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Reloads the server data every few seconds while the tab is visible, so new results show up by themselves. */
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
