"use client";

import { useEffect, useState } from "react";

import type { LinkPreview } from "@/lib/linkPreview";
import { primaryVenueUrl, type VenueOption } from "@/lib/venues";

export function LinkPreviewCard({
  url,
  compact,
}: {
  url: string;
  compact?: boolean;
}) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    void (async () => {
      try {
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error("preview failed");
        const data = (await res.json()) as LinkPreview;
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  let hostname = url;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // keep raw url
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`link-preview-card${compact ? " link-preview-card--compact" : ""}`}
    >
      {!compact && preview?.image && !error ? (
        <div
          className="link-preview-image"
          style={{ backgroundImage: `url(${preview.image})` }}
        />
      ) : null}
      <div className="link-preview-body">
        {loading ? (
          <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
            Loading preview…
          </p>
        ) : (
          <>
            <p className="link-preview-site">{preview?.siteName ?? hostname}</p>
            <p className="link-preview-title">
              {preview?.title ?? (error ? "Open site" : hostname)}
            </p>
            {!compact && preview?.description ? (
              <p className="link-preview-desc muted">{preview.description}</p>
            ) : null}
            <span className="link-preview-cta">Open in new tab →</span>
          </>
        )}
      </div>
    </a>
  );
}

export function VenueLinkButtons({ venue }: { venue: VenueOption }) {
  const primary = primaryVenueUrl(venue);
  return (
    <div className="venue-link-buttons">
      {venue.bookingUrl && venue.bookingUrl !== venue.mapsUrl ? (
        <a
          href={venue.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-sm"
        >
          {venue.sourceLabel ? `Book on ${venue.sourceLabel}` : "Book / visit"}
        </a>
      ) : null}
      {venue.websiteUrl && venue.websiteUrl !== venue.bookingUrl ? (
        <a
          href={venue.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary btn-sm"
        >
          Website
        </a>
      ) : null}
      {venue.mapsUrl ? (
        <a
          href={venue.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary btn-sm"
        >
          Map
        </a>
      ) : null}
      {!venue.bookingUrl && !venue.websiteUrl && !venue.mapsUrl && primary ? (
        <a
          href={primary}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-sm"
        >
          View on map
        </a>
      ) : null}
    </div>
  );
}
