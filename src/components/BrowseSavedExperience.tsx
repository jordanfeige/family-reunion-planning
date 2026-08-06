"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BrowseTabBar } from "@/components/BrowseTabBar";
import {
  formatCostDollars,
} from "@/lib/browseIdeas";
import {
  readPersistedKept,
  type PersistedKeptIdea,
} from "@/lib/browseLocal";
import { APP_NAME } from "@/lib/brand";

function durationLabel(mins: number): string {
  if (mins >= 60 * 24) {
    const nights = Math.max(1, Math.round(mins / (60 * 24)));
    return nights === 1 ? "1 night" : `${nights} nights`;
  }
  if (mins >= 60) {
    const h = Math.round((mins / 60) * 10) / 10;
    return h === 1 ? "1 hr" : `${h} hr`;
  }
  return `${mins} min`;
}

export function BrowseSavedExperience() {
  const [items, setItems] = useState<PersistedKeptIdea[]>([]);

  useEffect(() => {
    setItems(readPersistedKept());
  }, []);

  return (
    <div className="browse-page browse-page--r12 browse-saved-page">
      <header className="browse-head browse-head--compact">
        <div className="browse-head-brand">
          <p className="browse-brand">{APP_NAME}</p>
          <p className="browse-eyebrow">Saved</p>
        </div>
      </header>

      <h1 className="browse-title">Kept ideas</h1>
      <p className="browse-lede">
        Ideas you hearted on Browse — kept on this device.
      </p>

      {items.length === 0 ? (
        <div className="browse-saved-empty">
          <p>Nothing saved yet. Swipe right on Browse to keep ideas here.</p>
          <Link href="/browse" className="btn btn-berry">
            Go to Browse
          </Link>
        </div>
      ) : (
        <ul className="browse-saved-list">
          {items.map((item, i) => (
            <li key={`${item.id}-${item.keptAt}`} className="browse-ceremony-row">
              <span className="browse-ceremony-letter" aria-hidden>
                {String.fromCharCode(65 + (i % 26))}
              </span>
              <div className="browse-ceremony-copy">
                <strong>{item.title}</strong>
                <span>{item.blurb}</span>
              </div>
              <div className="browse-ceremony-meta">
                <span>{formatCostDollars(item.estCostUsd)}</span>
                <span>{durationLabel(item.durationMins)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <BrowseTabBar />
    </div>
  );
}
