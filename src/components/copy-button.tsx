"use client";

import { useState } from "react";

export function CopyButton({ text, children }: { text?: string | null; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn secondary"
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text || "");
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
      disabled={!text}
    >
      {copied ? "已复制" : children}
    </button>
  );
}
