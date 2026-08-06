"use client";

import { useEffect, useState } from "react";

/**
 * Image with letter fallback — never shows a broken-image glyph.
 * Photo fades in on load; stays hidden on error / missing src.
 */
export function SoftImage({
  src,
  alt = "",
  letter,
  className,
  width,
  height,
}: {
  src?: string | null;
  alt?: string;
  letter: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const resolved = typeof src === "string" ? src.trim() : "";
  const [state, setState] = useState<"loading" | "ready" | "error">(
    resolved ? "loading" : "error",
  );
  const glyph = (letter.trim().charAt(0) || "?").toUpperCase();

  useEffect(() => {
    setState(resolved ? "loading" : "error");
  }, [resolved]);

  return (
    <div
      className={["soft-image", className].filter(Boolean).join(" ")}
      style={
        width && height
          ? { width, height }
          : undefined
      }
    >
      <span className="soft-image-fallback" aria-hidden>
        {glyph}
      </span>
      {resolved && state !== "error" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={resolved}
          src={resolved}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          className={
            state === "ready" ? "soft-image-photo is-ready" : "soft-image-photo"
          }
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
        />
      ) : null}
    </div>
  );
}
