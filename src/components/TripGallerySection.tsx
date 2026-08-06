import {
  deleteGalleryItemAction,
} from "@/app/actions/trips";
import { GalleryUploader } from "@/components/GalleryUploader";
import { SoftImage } from "@/components/SoftImage";
import type { GalleryItem } from "@/lib/supabase/mappers";

export function TripGallerySection({
  slug,
  unlocked,
  gallery,
}: {
  slug: string;
  unlocked: boolean;
  gallery: GalleryItem[];
}) {
  if (!unlocked) {
    return (
      <div
        className="card"
        style={{
          padding: "1.25rem",
          background: "rgba(28, 61, 90, 0.04)",
          border: "1px dashed rgba(28, 61, 90, 0.2)",
        }}
      >
        <p className="pill" style={{ marginBottom: "0.5rem" }}>
          Not open yet
        </p>
        <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
          Publish your trip plan in the <strong>Blueprint</strong> step first. Once
          family can see the final itinerary, this gallery unlocks for post-trip photos
          and videos.
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0 }}>
        The plan is live—now capture the reunion. Upload photos and clips your crew can
        revisit anytime.
      </p>
      <GalleryUploader slug={slug} />
      <div className="divider" />
      <div
        className="grid-2"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
      >
        {gallery.length === 0 ? (
          <p className="muted">No photos yet—be the first to add one after the trip.</p>
        ) : (
          gallery.map((item) => (
            <figure
              key={item.id}
              style={{
                margin: 0,
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                border: "1px solid rgba(28,61,90,0.1)",
                background: "var(--card)",
              }}
            >
              {item.mediaType === "video" ? (
                <video src={item.url} controls style={{ width: "100%", display: "block" }} />
              ) : (
                <SoftImage
                  src={item.url}
                  alt={item.caption ?? ""}
                  letter={item.caption ?? "G"}
                  className="gallery-soft-image"
                />
              )}
              <figcaption style={{ padding: "0.65rem", fontSize: "0.85rem" }}>
                {item.caption ?? <span className="muted">No caption</span>}
                <form action={deleteGalleryItemAction} style={{ marginTop: "0.5rem" }}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="item_id" value={item.id} />
                  <button type="submit" className="btn btn-secondary" style={{ fontSize: "0.8rem" }}>
                    Remove
                  </button>
                </form>
              </figcaption>
            </figure>
          ))
        )}
      </div>
      <div className="divider" />
      <h3 style={{ marginTop: 0, color: "var(--color-fjord)" }}>After the trip</h3>
      <ul className="muted" style={{ lineHeight: 1.6, margin: 0, paddingLeft: "1.1rem" }}>
        <li>
          <strong>Shared album:</strong> export or sync your gallery as a backup for
          everyone who could not make it.
        </li>
        <li>
          <strong>Thank-yous:</strong> note who hosted, cooked, or drove—easy to add in
          captions here.
        </li>
      </ul>
    </div>
  );
}
