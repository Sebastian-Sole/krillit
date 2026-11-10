"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "copied" | "failed";

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers, or no clipboard permission: fall back to a hidden textarea.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

/**
 * Copies `text` on click. With `auto`, it also tries once on mount; browsers may refuse that
 * when it isn't right after a click, in which case the button just waits to be pressed.
 */
export default function CopyButton({ text, auto = false, className = "btn copy-btn" }: { text: string; auto?: boolean; className?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = (next: Status) => {
    setStatus(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 2500);
  };

  useEffect(() => {
    if (auto) copy(text).then((ok) => ok && show("copied"));
    return () => clearTimeout(timer.current);
    // Only once, when the code first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button type="button" className={className} onClick={() => copy(text).then((ok) => show(ok ? "copied" : "failed"))} aria-live="polite">
      {status === "copied" ? "Copied ✓" : status === "failed" ? "Couldn't copy, select it instead" : "Copy code"}
    </button>
  );
}
