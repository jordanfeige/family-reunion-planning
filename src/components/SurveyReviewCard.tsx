"use client";

import { formatLocationLabel, type LocationOption } from "@/lib/locations";
import { formatWeekendLabel } from "@/lib/weekends";

export function SurveyReviewCard({
  tripName,
  name,
  adultCount,
  kidCount,
  selectedSlots,
  selectedLocations,
  locations,
  notes,
  email,
  onEmailChange,
  sendEmailCopy,
  onSendEmailCopyChange,
}: {
  tripName: string;
  name: string;
  adultCount: number;
  kidCount: number;
  selectedSlots: Set<string>;
  selectedLocations: Set<string>;
  locations: LocationOption[];
  notes: string;
  email: string;
  onEmailChange: (value: string) => void;
  sendEmailCopy: boolean;
  onSendEmailCopyChange: (checked: boolean) => void;
}) {
  const locationLabels = locations
    .filter((l) => selectedLocations.has(l.id))
    .map((l) => formatLocationLabel(l));

  const weekendLabels = Array.from(selectedSlots).map((s) => formatWeekendLabel(s));

  return (
    <div
      className="card"
      style={{
        padding: "1rem 1.1rem",
        background: "rgba(94, 234, 212, 0.08)",
        border: "1px solid rgba(31, 74, 61, 0.15)",
      }}
    >
      <h3 style={{ margin: "0 0 0.35rem", color: "var(--color-fjord)", fontSize: "1.05rem" }}>
        Review your responses
      </h3>
      <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.9rem" }}>
        Confirm everything looks right for <strong>{tripName}</strong> before you send.
      </p>

      <dl className="survey-review-list">
        <div className="survey-review-row">
          <dt>Name</dt>
          <dd>{name || "—"}</dd>
        </div>
        <div className="survey-review-row">
          <dt>Party</dt>
          <dd>
            {adultCount} adult{adultCount === 1 ? "" : "s"}
            {kidCount > 0 ? `, ${kidCount} kid${kidCount === 1 ? "" : "s"}` : ""}
          </dd>
        </div>
        {locationLabels.length > 0 ? (
          <div className="survey-review-row">
            <dt>Locations</dt>
            <dd>
              <ul className="survey-review-tags">
                {locationLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {weekendLabels.length > 0 ? (
          <div className="survey-review-row">
            <dt>Weekends</dt>
            <dd>
              <ul className="survey-review-tags">
                {weekendLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {notes.trim() ? (
          <div className="survey-review-row">
            <dt>Notes</dt>
            <dd style={{ whiteSpace: "pre-wrap" }}>{notes.trim()}</dd>
          </div>
        ) : null}
      </dl>

      <div className="divider" style={{ margin: "1rem 0" }} />

      <label
        className="choice-card"
        style={{ display: "block", marginBottom: sendEmailCopy ? "0.75rem" : 0 }}
      >
        <input
          type="checkbox"
          name="send_email_copy"
          value="1"
          checked={sendEmailCopy}
          onChange={(e) => onSendEmailCopyChange(e.target.checked)}
        />
        <span className="choice-card-body">
          <span className="choice-check" aria-hidden />
          <span>
            <strong>Email me a copy</strong>
            <span className="muted" style={{ display: "block", fontSize: "0.85rem", fontWeight: 400 }}>
              Get a summary of what you selected in your inbox
            </span>
          </span>
        </span>
      </label>

      {sendEmailCopy ? (
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="review_email">Email address</label>
          <input
            id="review_email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            required={sendEmailCopy}
          />
          {!email.trim() && (
            <small>Add an email above, or uncheck to skip the copy.</small>
          )}
        </div>
      ) : null}
    </div>
  );
}
