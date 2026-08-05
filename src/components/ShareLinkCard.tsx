import Link from "next/link";

import { CopyButton } from "@/components/CopyButton";

function displayUrl(url: string) {
  try {
    const u = new URL(url);
    const path = `${u.pathname}${u.search}`;
    if (path.length <= 36) return `${u.host}${path}`;
    return `${u.host}${path.slice(0, 18)}…${path.slice(-12)}`;
  } catch {
    if (url.length <= 48) return url;
    return `${url.slice(0, 26)}…${url.slice(-14)}`;
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
  status,
}: {
  url: string;
  title?: string;
  hint?: string;
  previewHref?: string;
  meta?: string;
  metaTone?: "ok" | "warn";
  copyLabel?: string;
  copyClassName?: string;
  bare?: boolean;
  status?: string;
}) {
  return (
    <div
      className={`share-link-card hub-panel${bare ? " share-link-card--bare" : ""}`}
    >
      {!bare ? (
        <div className="share-link-card-head">
          <div>
            <p className="share-link-card-title">{title}</p>
            <p className="muted share-link-card-hint">{hint}</p>
          </div>
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
        {status ? <p className="share-link-status">{status}</p> : null}
        {previewHref ? (
          <Link
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className="share-link-preview"
          >
            Preview survey
          </Link>
        ) : null}
      </div>
    </div>
  );
}
