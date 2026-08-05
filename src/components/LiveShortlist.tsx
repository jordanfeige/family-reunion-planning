"use client";

import { placeRegionLine, placeStillUrl } from "@/lib/placeImages";
import type { PlacesDraftItem } from "@/lib/placesDraft";

export function LiveShortlist({
  places,
  onToggle,
  onConfirm,
  confirmLabel = "These feel right",
  confirmDisabled,
  confirmBusy,
  emptyHint = "As you chat, destinations appear here with a scenic still.",
}: {
  places: PlacesDraftItem[];
  onToggle: (title: string) => void;
  onConfirm: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  confirmBusy?: boolean;
  emptyHint?: string;
}) {
  const selected = places.filter((p) => p.selected !== false);

  return (
    <aside className="live-shortlist" aria-label="Live shortlist">
      <header className="live-shortlist-head">
        <h3 className="live-shortlist-title">Live shortlist</h3>
        <p className="live-shortlist-sub">Based on your answers so far.</p>
      </header>

      {places.length === 0 ? (
        <div className="live-shortlist-empty">
          <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
            {emptyHint}
          </p>
        </div>
      ) : (
        <ul className="live-shortlist-list">
          {places.map((place) => {
            const checked = place.selected !== false;
            const region = placeRegionLine(place.summary);
            return (
              <li key={place.title}>
                <label className={`live-shortlist-card${checked ? " is-checked" : ""}`}>
                  <div className="live-shortlist-media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={placeStillUrl(place.title, place.summary)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="live-shortlist-meta">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(place.title)}
                      aria-label={`Include ${place.title}`}
                    />
                    <span>
                      <strong className="live-shortlist-name">{place.title}</strong>
                      {region ? (
                        <span className="live-shortlist-region">{region}</span>
                      ) : null}
                    </span>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        className="btn btn-berry live-shortlist-cta"
        disabled={confirmDisabled || confirmBusy || selected.length === 0}
        onClick={onConfirm}
      >
        {confirmBusy
          ? "Saving…"
          : selected.length
            ? `${confirmLabel} →`
            : `${confirmLabel} →`}
      </button>
    </aside>
  );
}
