import { deleteSurveyResponseAction } from "@/app/actions/trips";
import { AvailabilitySnapshot } from "@/components/AvailabilitySnapshot";
import { FormattedDateTime } from "@/components/FormattedDateTime";
import { ShareLinkCard } from "@/components/ShareLinkCard";
import { findLocationById, type LocationOption } from "@/lib/locations";
import { partyAdults, partyKids } from "@/lib/partyCount";
import type { SurveyResponse } from "@/lib/supabase/mappers";
import { formatWeekendLabel } from "@/lib/weekends";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function partyLabel(r: SurveyResponse) {
  const adults = partyAdults(r);
  const kids = partyKids(r);
  const bits = [
    `${adults} adult${adults === 1 ? "" : "s"}`,
    kids > 0 ? `${kids} kid${kids === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  return bits.join(", ");
}

export function HubSurvey({
  slug,
  surveyUrl,
  previewHref,
  placesCount,
  weekendSlots,
  locations,
  responses,
  totalAttendees,
}: {
  slug: string;
  surveyUrl: string;
  previewHref: string;
  placesCount: number;
  weekendSlots: string[];
  locations: LocationOption[];
  responses: SurveyResponse[];
  totalAttendees: number;
}) {
  const showAvailability = weekendSlots.length > 0 && responses.length > 0;

  return (
    <div className="hub-survey">
      <header className="hub-workspace-head">
        <div>
          <h2 className="hub-workspace-title">Family survey</h2>
          <p className="hub-workspace-lede">
            Share this survey with your family to gather input and preferences.
          </p>
        </div>
        {placesCount > 0 ? (
          <p className="hub-workspace-meta">
            {placesCount} place{placesCount === 1 ? "" : "s"} on survey
          </p>
        ) : (
          <p className="hub-workspace-meta is-warn">Add places first</p>
        )}
      </header>

      <div className="hub-survey-grid">
        <ShareLinkCard
          url={surveyUrl}
          title="Share link"
          hint="Anyone with the link can respond."
          previewHref={previewHref}
          copyLabel="Copy link"
          copyClassName="btn-primary"
          status={
            responses.length > 0
              ? `${responses.length} household${responses.length === 1 ? "" : "s"} replied`
              : "Ready to send to family"
          }
        />

        <section className="hub-panel" aria-label="Survey responses">
          <div className="hub-panel-head">
            <div>
              <h3 className="hub-panel-title">Responses</h3>
              <p className="hub-panel-sub">
                {responses.length === 0
                  ? "0 responses so far"
                  : `${responses.length} household${responses.length === 1 ? "" : "s"} · ${totalAttendees} people`}
              </p>
            </div>
          </div>

          {responses.length === 0 ? (
            <div className="hub-survey-empty">
              <div className="hub-survey-empty-art" aria-hidden>
                <span />
                <span />
                <span />
              </div>
              <p className="hub-survey-empty-title">No responses yet</p>
              <p className="muted hub-survey-empty-copy">
                Responses will appear here as your family completes the survey.
              </p>
            </div>
          ) : (
            <ul className="hub-survey-list">
              {responses.map((r) => {
                const placeTitles = (r.selectedLocations ?? [])
                  .map((id) => findLocationById(locations, id)?.title ?? id)
                  .filter(Boolean);
                const weekends = (r.selectedSlots ?? []).map((s) => formatWeekendLabel(s));
                return (
                  <li key={r.id} className="hub-survey-response-row">
                    <span className="hub-survey-avatar" aria-hidden>
                      {initials(r.respondentName)}
                    </span>
                    <div className="hub-survey-response-body">
                      <div className="hub-survey-response-top">
                        <p className="hub-survey-response-name">{r.respondentName}</p>
                        <span className="hub-survey-status">Completed</span>
                      </div>
                      <p className="hub-survey-response-meta">{partyLabel(r)}</p>
                      {placeTitles.length > 0 ? (
                        <p className="hub-survey-response-detail">{placeTitles.join(" · ")}</p>
                      ) : null}
                      {weekends.length > 0 ? (
                        <p className="hub-survey-response-detail">{weekends.join(" · ")}</p>
                      ) : null}
                      <FormattedDateTime
                        value={r.submittedAt}
                        className="hub-survey-response-time"
                      />
                    </div>
                    <form action={deleteSurveyResponseAction} className="hub-survey-remove">
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="response_id" value={r.id} />
                      <button type="submit" className="hub-survey-remove-btn">
                        Remove
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {showAvailability ? (
        <section className="hub-panel hub-survey-snapshot" aria-label="Weekend availability">
          <h3 className="hub-panel-title">Availability</h3>
          <AvailabilitySnapshot proposedSlots={weekendSlots} responses={responses} />
        </section>
      ) : null}
    </div>
  );
}
