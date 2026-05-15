"use client";

import { useEffect, useRef, useState } from "react";

/** Reveals footer once the user scrolls the step sentinel into view. */
export function useWizardFooterReveal(stepKey: string) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setRevealed(entry.isIntersecting),
      {
        root: null,
        rootMargin: "0px 0px 48px 0px",
        threshold: 0,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [stepKey]);

  return { sentinelRef, revealed };
}
