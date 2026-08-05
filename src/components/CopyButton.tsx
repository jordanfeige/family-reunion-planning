"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);

  const hasTone =
    className?.includes("btn-primary") ||
    className?.includes("btn-secondary") ||
    className?.includes("btn-berry");

  return (
    <button
      type="button"
      className={["btn", hasTone ? null : "btn-secondary", className]
        .filter(Boolean)
        .join(" ")}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
    >
      {done ? "Copied!" : label}
    </button>
  );
}
