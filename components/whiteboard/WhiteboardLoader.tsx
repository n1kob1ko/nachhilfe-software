"use client";

import dynamic from "next/dynamic";
import type { WhiteboardProps } from "./Whiteboard";

// The drawing library needs the browser (canvas, pointer events), so it is never rendered on the server.
const Whiteboard = dynamic(() => import("./Whiteboard"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 z-50 flex items-center justify-center bg-white text-[15px] text-ink-2">Whiteboard wird geladen …</div>,
});

export function WhiteboardLoader(props: WhiteboardProps) {
  return <Whiteboard {...props} />;
}
