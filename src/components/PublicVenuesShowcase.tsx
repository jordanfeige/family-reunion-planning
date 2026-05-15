import { LinkPreviewCard, VenueLinkButtons } from "@/components/LinkPreviewCard";
import type { OptionVoteTally } from "@/lib/ballotResults";
import { formatVenuePrice } from "@/lib/venuePrices";
import {
  primaryVenueUrl,
  VENUE_CATEGORY_LABELS,
  VENUE_CATEGORIES,
  venuesForPublicShowcase,
  type VenueCategory,
  type VenueOption,
} from "@/lib/venues";

export function PublicVenuesShowcase({
  venues,
  selectedVenueId,
  locationTitle,
  tallies,
  showVoteResults,
}: {
  venues: VenueOption[];
  selectedVenueId: string | null;
  locationTitle: string | null;
  tallies?: Map<string, OptionVoteTally>;
  showVoteResults?: boolean;
}) {
  const visible = venuesForPublicShowcase(venues);
  if (visible.length === 0) return null;

  const baseCamp = selectedVenueId
    ? visible.find((v) => v.id === selectedVenueId)
    : null;

  const grouped: Record<VenueCategory, VenueOption[]> = {
    stay: [],
    eat: [],
    do: [],
  };
  for (const v of visible) {
    if (baseCamp && v.id === baseCamp.id) continue;
    grouped[v.category].push(v);
  }

  return (
    <section className="stack public-venues-showcase" aria-labelledby="public-venues-heading">
      <div>
        <h2 id="public-venues-heading" style={{ color: "var(--color-fjord)", margin: "0 0 0.35rem" }}>
          Where we&apos;re staying, eating &amp; what we&apos;re doing
        </h2>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          {locationTitle
            ? `Options near ${locationTitle}.`
            : "Trip options from your planners."}
          {showVoteResults
            ? " Totals show group 👍 and 👎—individual votes stay private."
            : " Use the links to view details and book on each site."}
        </p>
      </div>

      {baseCamp ? (
        <article className="card public-venue-hero">
          <p className="pill">Home base</p>
          <PublicVenueCard
            venue={baseCamp}
            hero
            tally={tallies?.get(baseCamp.id)}
            showVoteResults={showVoteResults}
          />
        </article>
      ) : null}

      {VENUE_CATEGORIES.map((category) => {
        const items = grouped[category];
        if (items.length === 0) return null;
        return (
          <div key={category}>
            <h3 className="venue-options-group-title">{VENUE_CATEGORY_LABELS[category]}</h3>
            <ul className="public-venue-list">
              {items.map((venue) => (
                <li key={venue.id}>
                  <PublicVenueCard
                    venue={venue}
                    tally={tallies?.get(venue.id)}
                    showVoteResults={showVoteResults}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function PublicVenueCard({
  venue,
  hero,
  tally,
  showVoteResults,
}: {
  venue: VenueOption;
  hero?: boolean;
  tally?: OptionVoteTally;
  showVoteResults?: boolean;
}) {
  const primary = primaryVenueUrl(venue);

  return (
    <div className={`public-venue-card${hero ? " public-venue-card--hero" : ""}`}>
      <div className="public-venue-card-head">
        <h4 style={{ margin: 0, color: "var(--color-fjord)" }}>{venue.title}</h4>
        {!hero ? (
          <span className="venue-category-pill">{VENUE_CATEGORY_LABELS[venue.category]}</span>
        ) : null}
      </div>
      <p className="ballot-vote-price" style={{ margin: "0.35rem 0" }}>
        {formatVenuePrice(venue)}
      </p>
      {venue.summary ? (
        <p className="muted" style={{ margin: "0 0 0.5rem", lineHeight: 1.45 }}>
          {venue.summary}
        </p>
      ) : null}
      {showVoteResults && tally && (tally.up > 0 || tally.down > 0) ? (
        <p className="public-vote-tally" style={{ margin: "0 0 0.5rem", fontSize: "0.88rem" }}>
          Group vote: <strong>👍 {tally.up}</strong>
          <span className="muted"> · 👎 {tally.down}</span>
          {tally.net !== 0 ? (
            <span className="muted"> · net {tally.net >= 0 ? `+${tally.net}` : tally.net}</span>
          ) : null}
        </p>
      ) : null}
      <VenueLinkButtons venue={venue} />
      {primary ? <LinkPreviewCard url={primary} compact={!hero} /> : null}
    </div>
  );
}
