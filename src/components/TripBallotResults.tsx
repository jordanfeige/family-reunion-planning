import Link from "next/link";

import { sortOptionsByVotes, type OptionVoteTally } from "@/lib/ballotResults";
import { formatVenuePrice } from "@/lib/venuePrices";
import {
  VENUE_CATEGORIES,
  VENUE_CATEGORY_LABELS,
  venuesForPublicShowcase,
  type VenueOption,
} from "@/lib/venues";

export function TripBallotResults({
  slug,
  venues,
  tallies,
  voterCount,
  selectedVenueId,
}: {
  slug: string;
  venues: VenueOption[];
  tallies: Map<string, OptionVoteTally>;
  voterCount: number;
  selectedVenueId: string | null;
}) {
  const visible = venuesForPublicShowcase(venues);
  if (visible.length === 0) return null;

  return (
    <div className="stack ballot-results">
      <h3 style={{ margin: 0, color: "var(--color-fjord)" }}>Vote results</h3>
      <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
        {voterCount} ballot{voterCount === 1 ? "" : "s"} cast. Scores are net 👍 minus 👎.
      </p>

      {VENUE_CATEGORIES.map((category) => {
        const items = sortOptionsByVotes(
          visible.filter((v) => v.category === category),
          tallies,
        );
        if (items.length === 0) return null;
        return (
          <section key={category}>
            <h4 className="venue-options-group-title">{VENUE_CATEGORY_LABELS[category]}</h4>
            <ul className="ballot-results-list">
              {items.map((venue) => {
                const t = tallies.get(venue.id) ?? { up: 0, down: 0, net: 0 };
                const isBase = selectedVenueId === venue.id;
                return (
                  <li key={venue.id} className="ballot-results-row">
                    <div className="ballot-results-row-main">
                      <Link href={`/t/${slug}/venues/${venue.id}`} style={{ fontWeight: 600 }}>
                        {venue.title}
                      </Link>
                      {isBase ? (
                        <span className="venue-base-camp-badge">Home base</span>
                      ) : null}
                      <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.85rem" }}>
                        {formatVenuePrice(venue)}
                      </p>
                    </div>
                    <div className="ballot-results-score" aria-label={`Net score ${t.net}`}>
                      <span className="ballot-results-net">{t.net >= 0 ? `+${t.net}` : t.net}</span>
                      <span className="muted" style={{ fontSize: "0.78rem" }}>
                        👍 {t.up} · 👎 {t.down}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
