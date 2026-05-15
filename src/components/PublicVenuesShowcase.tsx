import { LinkPreviewCard, VenueLinkButtons } from "@/components/LinkPreviewCard";
import {
  primaryVenueUrl,
  VENUE_BOOKING_STATUS_LABELS,
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
}: {
  venues: VenueOption[];
  selectedVenueId: string | null;
  locationTitle: string | null;
}) {
  const visible = venuesForPublicShowcase(venues);
  if (visible.length === 0) return null;

  const baseCamp = selectedVenueId
    ? visible.find((v) => v.id === selectedVenueId)
    : null;

  const grouped: Record<VenueCategory, VenueOption[]> = {
    stay: [],
    eat: [],
    area: [],
  };
  for (const v of visible) {
    if (baseCamp && v.id === baseCamp.id) continue;
    grouped[v.category].push(v);
  }

  return (
    <section className="stack public-venues-showcase" aria-labelledby="public-venues-heading">
      <div>
        <h2 id="public-venues-heading" style={{ color: "var(--color-fjord)", margin: "0 0 0.35rem" }}>
          Where we&apos;re staying &amp; eating
        </h2>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          {locationTitle
            ? `Planner picks near ${locationTitle}. Use the links to view details and book on each site.`
            : "Planner picks for the reunion. Use the links to view details and book on each site."}
        </p>
      </div>

      {baseCamp ? (
        <article className="card public-venue-hero">
          <p className="pill">Home base</p>
          <PublicVenueCard venue={baseCamp} hero />
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
                  <PublicVenueCard venue={venue} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function PublicVenueCard({ venue, hero }: { venue: VenueOption; hero?: boolean }) {
  const primary = primaryVenueUrl(venue);
  const status = venue.bookingStatus ?? "idea";

  return (
    <div className={`public-venue-card${hero ? " public-venue-card--hero" : ""}`}>
      <div className="public-venue-card-head">
        <h4 style={{ margin: 0, color: "var(--color-fjord)" }}>{venue.title}</h4>
        {!hero ? (
          <span className="venue-category-pill">{VENUE_CATEGORY_LABELS[venue.category]}</span>
        ) : null}
        {status === "booked" ? (
          <span className="venue-base-camp-badge">Booked</span>
        ) : null}
      </div>
      {venue.summary ? (
        <p className="muted" style={{ margin: "0.5rem 0", lineHeight: 1.45 }}>
          {venue.summary}
        </p>
      ) : null}
      {status !== "idea" && status !== "booked" ? (
        <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.82rem" }}>
          Status: {VENUE_BOOKING_STATUS_LABELS[status]}
        </p>
      ) : null}
      <VenueLinkButtons venue={venue} />
      {primary ? <LinkPreviewCard url={primary} compact={!hero} /> : null}
    </div>
  );
}
