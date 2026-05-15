import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  clearPrimaryVenueAction,
  refreshVenueLinksAction,
  setPrimaryVenueAction,
  updateVenueDetailsAction,
} from "@/app/actions/trips";
import { auth } from "@/auth";
import { LinkPreviewCard, VenueLinkButtons } from "@/components/LinkPreviewCard";
import {
  findLocationById,
  normalizeLocationOptions,
} from "@/lib/locations";
import { formatVenuePrice, PRICE_TYPES, PRICE_UNITS } from "@/lib/venuePrices";
import {
  findVenueById,
  normalizeVenueOptions,
  primaryVenueUrl,
  VENUE_BOOKING_STATUS_LABELS,
  VENUE_BOOKING_STATUSES,
  VENUE_CATEGORY_LABELS,
} from "@/lib/venues";
import { getTripForOrganizer } from "@/lib/supabase/queries";

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ slug: string; venueId: string }>;
}) {
  const { slug, venueId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/t/${slug}/venues/${venueId}`)}`);
  }

  const access = await getTripForOrganizer(slug, session.user.id);
  if (!access) notFound();

  const { trip } = access;
  const venues = normalizeVenueOptions(trip.venueOptions ?? []);
  const venue = findVenueById(venues, venueId);
  if (!venue) notFound();

  const locationTitle = trip.selectedLocationId
    ? findLocationById(
        normalizeLocationOptions(trip.locationOptions ?? []),
        trip.selectedLocationId,
      )?.title ?? null
    : null;

  const isBaseCamp = trip.selectedVenueId === venue.id;
  const previewUrl = primaryVenueUrl(venue);

  return (
    <div className="shell" style={{ maxWidth: "720px" }}>
      <p style={{ margin: "0 0 1rem" }}>
        <Link href={`/t/${slug}`} className="muted" style={{ fontSize: "0.9rem" }}>
          ← Back to trip planner
        </Link>
      </p>

      <header style={{ marginBottom: "1rem" }}>
        <p className="pill">{VENUE_CATEGORY_LABELS[venue.category]}</p>
        <h1 style={{ color: "var(--color-fjord)", margin: "0.35rem 0" }}>{venue.title}</h1>
        {locationTitle ? (
          <p className="muted" style={{ margin: 0 }}>
            Near {locationTitle}
          </p>
        ) : null}
        {isBaseCamp ? (
          <p style={{ margin: "0.5rem 0 0" }}>
            <span className="venue-base-camp-badge">Home base for this trip</span>
          </p>
        ) : null}
      </header>

      {venue.summary ? (
        <p style={{ lineHeight: 1.5, margin: "0 0 0.5rem" }}>{venue.summary}</p>
      ) : null}
      <p className="ballot-vote-price" style={{ margin: "0 0 1rem" }}>
        {formatVenuePrice(venue)}
      </p>

      <VenueLinkButtons venue={venue} />

      {previewUrl ? (
        <div style={{ marginTop: "1rem" }}>
          <LinkPreviewCard url={previewUrl} />
        </div>
      ) : null}

      <div className="divider" style={{ margin: "1.5rem 0" }} />

      <form action={updateVenueDetailsAction} className="stack card" style={{ padding: "1rem" }}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="venue_id" value={venue.id} />

        <h2 style={{ margin: 0, fontSize: "1rem", color: "var(--color-fjord)" }}>
          Planner details
        </h2>
        <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
          Family sees this place on the shared plan. Booking still happens on the property&apos;s
          site.
        </p>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="price_type">Price type</label>
            <select id="price_type" name="price_type" defaultValue={venue.priceType ?? "unknown"}>
              {PRICE_TYPES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="price_unit">Price unit</label>
            <select id="price_unit" name="price_unit" defaultValue={venue.priceUnit ?? "per_night"}>
              {PRICE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="price_min">Price min ($)</label>
            <input
              id="price_min"
              name="price_min"
              type="number"
              step="1"
              defaultValue={venue.priceMin ?? ""}
            />
          </div>
          <div className="field">
            <label htmlFor="price_max">Price max ($)</label>
            <input
              id="price_max"
              name="price_max"
              type="number"
              step="1"
              defaultValue={venue.priceMax ?? ""}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="price_notes">Price notes</label>
          <input
            id="price_notes"
            name="price_notes"
            defaultValue={venue.priceNotes ?? ""}
            placeholder="Cleaning fee, plus tax…"
          />
        </div>

        <div className="field">
          <label htmlFor="booking_status">Booking status</label>
          <select
            id="booking_status"
            name="booking_status"
            defaultValue={venue.bookingStatus ?? "idea"}
          >
            {VENUE_BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {VENUE_BOOKING_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="planner_notes">Planner notes</label>
          <textarea
            id="planner_notes"
            name="planner_notes"
            defaultValue={venue.plannerNotes ?? ""}
            placeholder="Deposit amount, contact person, room block code…"
          />
        </div>

        <div className="field">
          <label htmlFor="booking_url">Booking / listing URL</label>
          <input
            id="booking_url"
            name="booking_url"
            type="url"
            defaultValue={venue.bookingUrl ?? ""}
            placeholder="https://…"
          />
        </div>

        <div className="field">
          <label htmlFor="website_url">Official website</label>
          <input
            id="website_url"
            name="website_url"
            type="url"
            defaultValue={venue.websiteUrl ?? ""}
            placeholder="https://…"
          />
        </div>

        <div className="field">
          <label htmlFor="maps_url">Map URL</label>
          <input
            id="maps_url"
            name="maps_url"
            type="url"
            defaultValue={venue.mapsUrl ?? ""}
            placeholder="https://maps…"
          />
        </div>

        <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>

      <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" }}>
        <form action={refreshVenueLinksAction}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="venue_id" value={venue.id} />
          <button type="submit" className="btn btn-secondary btn-sm">
            Refresh links automatically
          </button>
        </form>

        {venue.category === "stay" && !isBaseCamp ? (
          <form action={setPrimaryVenueAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="venue_id" value={venue.id} />
            <button type="submit" className="btn btn-berry btn-sm">
              Set as home base
            </button>
          </form>
        ) : null}

        {isBaseCamp ? (
          <form action={clearPrimaryVenueAction}>
            <input type="hidden" name="slug" value={slug} />
            <button type="submit" className="btn btn-secondary btn-sm">
              Clear home base
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
