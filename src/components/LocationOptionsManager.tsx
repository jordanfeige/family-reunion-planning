"use client";

import {
  addLocationOptionAction,
  deleteLocationOptionAction,
} from "@/app/actions/trips";
import { ManualAddDrawer } from "@/components/ManualAddDrawer";
import type { LocationOption } from "@/lib/locations";
import { formatLocationLabel } from "@/lib/locations";

export function LocationOptionsManager({
  slug,
  locations,
}: {
  slug: string;
  locations: LocationOption[];
}) {
  return (
    <div className="stack" style={{ marginTop: "1rem" }}>
      <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
        These appear on the family survey for multi-select voting. Use{" "}
        <strong>Add manually</strong> or publish from the AI location brainstorm above.
      </p>

      <ManualAddDrawer title="Add location" triggerLabel="Add manually">
        {({ close }) => (
          <form
            className="stack"
            action={async (formData) => {
              await addLocationOptionAction(formData);
              close();
            }}
          >
            <input type="hidden" name="slug" value={slug} />
            <div className="grid-2">
              <div className="field">
                <label htmlFor="loc_title">Destination name</label>
                <input
                  id="loc_title"
                  name="title"
                  required
                  placeholder="Bergen & nearby fjords"
                />
              </div>
              <div className="field">
                <label htmlFor="loc_summary">Short pitch (optional)</label>
                <input
                  id="loc_summary"
                  name="summary"
                  placeholder="Easy flights, great food, mild summer weather"
                />
              </div>
            </div>
            <button type="submit" className="btn btn-berry" style={{ alignSelf: "flex-start" }}>
              Add to survey
            </button>
          </form>
        )}
      </ManualAddDrawer>

      {locations.length > 0 ? (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }} className="stack">
          {locations.map((loc) => (
            <li
              key={loc.id}
              style={{
                border: "1px solid rgba(28,61,90,0.1)",
                borderRadius: "var(--radius-md)",
                padding: "0.75rem 1rem",
                background: "#fff",
              }}
            >
              <div className="row" style={{ justifyContent: "space-between", gap: "0.75rem" }}>
                <div>
                  <strong style={{ color: "var(--color-fjord)" }}>{loc.title}</strong>
                  {loc.summary ? (
                    <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
                      {loc.summary}
                    </p>
                  ) : null}
                  <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.8rem" }}>
                    Survey label: {formatLocationLabel(loc)}
                  </p>
                </div>
                <form action={deleteLocationOptionAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="location_id" value={loc.id} />
                  <button
                    type="submit"
                    className="btn btn-secondary"
                    style={{ fontSize: "0.85rem", flexShrink: 0 }}
                  >
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          No locations on the survey yet—brainstorm with the AI, then click &quot;Add to survey&quot;
          on its reply.
        </p>
      )}
    </div>
  );
}
