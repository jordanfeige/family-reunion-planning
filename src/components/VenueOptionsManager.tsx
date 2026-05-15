import Link from "next/link";

import {
  addVenueOptionAction,
  clearPrimaryVenueAction,
  deleteVenueOptionAction,
  setPrimaryVenueAction,
} from "@/app/actions/trips";
import { VenueLinkButtons } from "@/components/LinkPreviewCard";
import {
  VENUE_BOOKING_STATUS_LABELS,
  VENUE_CATEGORIES,
  VENUE_CATEGORY_LABELS,
  type VenueCategory,
  type VenueOption,
} from "@/lib/venues";

export function VenueOptionsManager({
  slug,
  venues,
  selectedVenueId,
}: {
  slug: string;
  venues: VenueOption[];
  selectedVenueId: string | null;
}) {
  const grouped: Record<VenueCategory, VenueOption[]> = {
    stay: [],
    eat: [],
    area: [],
  };
  for (const v of venues) {
    grouped[v.category].push(v);
  }

  return (
    <div className="stack venue-options-manager">
      <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
        Links are added automatically when you save a place. Family sees this list on the shared
        plan. Mark one <strong>Stay</strong> as home base for itinerary generation.
      </p>

      {venues.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No places saved yet—use WandrAI above or add manually.
        </p>
      ) : (
        VENUE_CATEGORIES.map((category) => {
          const items = grouped[category];
          if (items.length === 0) return null;
          return (
            <section key={category} className="venue-options-group">
              <h4 className="venue-options-group-title">
                {VENUE_CATEGORY_LABELS[category]}
              </h4>
              <ul className="venue-options-list">
                {items.map((venue) => {
                  const isBase = selectedVenueId === venue.id;
                  return (
                    <li key={venue.id} className="venue-option-card">
                      <div className="venue-option-card-main">
                        <div className="venue-option-card-head">
                          <strong>{venue.title}</strong>
                          {isBase ? (
                            <span className="venue-base-camp-badge">Base camp</span>
                          ) : null}
                        </div>
                        {venue.summary ? (
                          <p className="muted venue-option-summary">{venue.summary}</p>
                        ) : null}
                        <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.8rem" }}>
                          {VENUE_BOOKING_STATUS_LABELS[venue.bookingStatus ?? "idea"]}
                          {venue.sourceLabel ? ` · via ${venue.sourceLabel}` : null}
                        </p>
                        <VenueLinkButtons venue={venue} />
                      </div>
                      <div className="venue-option-actions">
                        <Link
                          href={`/t/${slug}/venues/${venue.id}`}
                          className="btn btn-primary btn-sm"
                        >
                          View
                        </Link>
                        {category === "stay" && !isBase ? (
                          <form action={setPrimaryVenueAction}>
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="venue_id" value={venue.id} />
                            <button type="submit" className="btn btn-secondary btn-sm">
                              Set base camp
                            </button>
                          </form>
                        ) : null}
                        {category === "stay" && isBase ? (
                          <form action={clearPrimaryVenueAction}>
                            <input type="hidden" name="slug" value={slug} />
                            <button type="submit" className="btn btn-secondary btn-sm">
                              Clear base
                            </button>
                          </form>
                        ) : null}
                        <form action={deleteVenueOptionAction}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="venue_id" value={venue.id} />
                          <button type="submit" className="btn btn-secondary btn-sm">
                            Remove
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      <form action={addVenueOptionAction} className="stack venue-options-add-form">
        <input type="hidden" name="slug" value={slug} />
        <h4 className="venue-options-group-title" style={{ margin: "0.5rem 0 0" }}>
          Add manually
        </h4>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="venue_title">Name</label>
            <input
              id="venue_title"
              name="title"
              required
              placeholder="Eagle Ridge Resort"
            />
          </div>
          <div className="field">
            <label htmlFor="venue_category">Type</label>
            <select id="venue_category" name="category" defaultValue="stay">
              {VENUE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {VENUE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="venue_summary">Notes (optional)</label>
          <textarea
            id="venue_summary"
            name="summary"
            placeholder="Sleeps 32 in 6 cabins, group pavilion, 45 min from airport"
          />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="venue_booking">Booking URL (optional)</label>
            <input id="venue_booking" name="booking_url" type="url" placeholder="https://…" />
          </div>
          <div className="field">
            <label htmlFor="venue_maps">Map link (optional)</label>
            <input id="venue_maps" name="maps_url" type="url" placeholder="https://maps…" />
          </div>
        </div>
        <button type="submit" className="btn btn-secondary" style={{ alignSelf: "flex-start" }}>
          Add to shortlist
        </button>
      </form>
    </div>
  );
}
