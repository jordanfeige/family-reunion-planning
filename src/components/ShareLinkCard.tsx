import Link from "next/link";

import { CopyButton } from "@/components/CopyButton";

export function ShareLinkCard({
  url,
  title = "Share link",
  hint = "Anyone with the link can respond.",
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
      <div className="share-link-row">
        <p className="share-link-card-url" title={url}>
          {url}
        </p>
        <CopyButton text={url} label="Copy" className="btn-primary btn-sm share-link-copy" />
      </div>
      <p className="muted share-link-card-hint">{hint}</p>
      {previewHref ? (
        <p style={{ margin: "0.65rem 0 0" }}>
          <Link href={previewHref} target="_blank" rel="noreferrer">
            Preview survey
          </Link>
        </p>
      ) : null}
    </div>
  );
}
