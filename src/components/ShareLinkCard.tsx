import Link from "next/link";

import { CopyButton } from "@/components/CopyButton";

function displayUrl(url: string) {
  try {
    const u = new URL(url);
    const path = `${u.pathname}${u.search}`;
    if (path.length <= 28) return `${u.host}${path}`;
    return `${u.host}${path.slice(0, 14)}…${path.slice(-10)}`;
  } catch {
    if (url.length <= 42) return url;
    return `${url.slice(0, 22)}…${url.slice(-12)}`;
  }
}

export function ShareLinkCard({
  url,
  title = "Share link",
  hint = "Anyone with the link can respond.",
  previewHref,
  meta,
  metaTone = "ok",
  copyLabel = "Copy",
  copyClassName = "btn-primary",
  bare = false,
}: {
  url: string;
  title?: string;
  hint?: string;
  previewHref?: string;
  meta?: string;
  metaTone?: "ok" | "warn";
  copyLabel?: string;
  copyClassName?: string;
  /** Hide the card title — page already has a step heading. */
  bare?: boolean;
}) {
  return (
    <div className={`share-link-card${bare ? " share-link-card--bare" : ""}`}>
      {!bare ? (
        <div className="share-link-card-head">
          <p className="share-link-card-title">{title}</p>
          {meta ? (
            <p
              className={`share-link-card-meta${metaTone === "warn" ? " is-warn" : ""}`}
            >
              {meta}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="share-link-row">
        <p className="share-link-card-url" title={url}>
          {displayUrl(url)}
        </p>
        <CopyButton
          text={url}
          label={copyLabel}
          className={`${copyClassName} btn-sm share-link-copy`}
        />
      </div>
      <div className="share-link-card-foot">
        <p className="muted share-link-card-hint">{hint}</p>
        {previewHref ? (
          <Link
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className="share-link-preview"
          >
            Preview
          </Link>
        ) : null}
      </div>
    </div>
  );
}
