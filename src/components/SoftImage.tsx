"use client";

import { useEffect, useState } from "react";

/**
 * §7 SoftImage — letter block always present; photo fades in on load, hidden on error.
 * Never a bare <img> elsewhere.
 */
export function SoftImage({
  src,
  alt = "",
  letter,
  className,
  width,
  height,
  attribution,
  attributionHref,
}: {
  src?: string | null;
  alt?: string;
  letter: string;
  className?: string;
  width?: number;
  height?: number;
  /** Mandatory for CC BY / BY-SA Commons photos. */
  attribution?: string | null;
  attributionHref?: string | null;
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
    <div className="soft-image-wrap">
      <div
        className={["soft-image", className].filter(Boolean).join(" ")}
        style={width && height ? { width, height } : undefined}
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
      {attribution && state === "ready" ? (
        attributionHref ? (
          <a
            className="soft-image-attr"
            href={attributionHref}
            target="_blank"
            rel="noreferrer noopener"
          >
            {attribution}
          </a>
        ) : (
          <p className="soft-image-attr">{attribution}</p>
        )
      ) : null}
    </div>
  );
}
