import Link from "next/link";

import { CopyButton } from "@/components/CopyButton";

export function ShareLinkCard({
  url,
  title = "Family plan link",
  hint,
  previewHref,
}: {
  url: string;
  title?: string;
  hint?: string;
  previewHref?: string;
}) {
  return (
    <div className="share-link-card">
      <p className="share-link-card-title">{title}</p>
      <p className="share-link-card-url" title={url}>
        {url}
      </p>
      <div className="share-link-card-actions">
        <CopyButton text={url} label="Copy" className="btn-sm" />
        {previewHref ? (
          <Link
            className="btn btn-secondary btn-sm"
            href={previewHref}
            target="_blank"
            rel="noreferrer"
          >
            Preview
          </Link>
        ) : (
          <a className="btn btn-secondary btn-sm" href={url} target="_blank" rel="noreferrer">
            Open
          </a>
        )}
      </div>
      {hint ? <p className="muted share-link-card-hint">{hint}</p> : null}
    </div>
  );
}
