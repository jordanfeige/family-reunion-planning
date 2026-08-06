"use client";

import { useState } from "react";

/**
 * Image with letter fallback — never shows a broken-image glyph.
 * Photo fades in on load; stays hidden on error.
 */
export function SoftImage({
  src,
  alt = "",
  letter,
  className,
  width,
  height,
}: {
  src: string;
  alt?: string;
  letter: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const glyph = (letter.trim().charAt(0) || "?").toUpperCase();

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
      {state !== "error" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
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
