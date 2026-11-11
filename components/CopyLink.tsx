"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { IconWechsel } from "@/components/Bewegung";

export function CopyLink({ path }: { path: string }) {
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(`${window.location.origin}${path}`), [path]);
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={url} className="input num !py-1.5 text-[13px]" onFocus={(e) => e.currentTarget.select()} aria-label="Zugangslink" />
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
      >
        <IconWechsel an={copied} aus={<Copy size={14} aria-hidden />} ein={<Check size={14} aria-hidden className={copied ? "puls rounded-full text-green" : ""} />} />
        {copied ? "Kopiert" : "Kopieren"}
      </button>
    </div>
  );
}
