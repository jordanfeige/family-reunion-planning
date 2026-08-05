import { FormattedDateTime } from "@/components/FormattedDateTime";
import {
  aggregateConfirmations,
  filterConfirmationsForPlan,
  type TripConfirmationRow,
} from "@/lib/confirmations";
import type { SurveyResponse } from "@/lib/supabase/mappers";
import { partyAdults, partyKids } from "@/lib/partyCount";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

type AttendeeRow = {
  id: string;
  name: string;
  status: "rsvp_yes" | "opened" | "declined";
  detail?: string;
};

function buildAttendeeRows(
  confirmations: TripConfirmationRow[],
  surveyResponses: SurveyResponse[],
): AttendeeRow[] {
  const confirmedEmails = new Set(
    confirmations
      .map((c) => c.respondentEmail?.trim().toLowerCase())
      .filter(Boolean) as string[],
  );
  const confirmedNames = new Set(
    confirmations.map((c) => c.respondentName.trim().toLowerCase()),
  );

  const rows: AttendeeRow[] = confirmations.map((c) => ({
    id: c.id,
    name: c.respondentName,
    status: c.status === "confirmed" ? "rsvp_yes" : "declined",
    detail:
      c.status === "confirmed"
        ? `${partyAdults(c)} adult${partyAdults(c) === 1 ? "" : "s"}${
            partyKids(c) > 0
              ? `, ${partyKids(c)} kid${partyKids(c) === 1 ? "" : "s"}`
              : ""
          }`
        : undefined,
  }));

  for (const r of surveyResponses) {
    const email = r.respondentEmail?.trim().toLowerCase();
    const nameKey = r.respondentName.trim().toLowerCase();
    if ((email && confirmedEmails.has(email)) || confirmedNames.has(nameKey)) {
      continue;
    }
    rows.push({
      id: `survey-${r.id}`,
      name: r.respondentName,
      status: "opened",
    });
  }

  return rows;
}

export function PlanConfirmationSnapshot({
  confirmations,
  weekendFriday,
  locationId,
  locationTitle,
  weekendLabel,
  surveyResponses = [],
  ballotVoterCount = 0,
  ballotOptionCount = 0,
  ballotLeadingTitle,
  ballotLeadingPct = 0,
  ballotClosesLabel = "Friday",
  addSomeoneSlot,
  sendRail,
  nudge,
}: {
  confirmations: TripConfirmationRow[];
  weekendFriday: string | null;
  locationId: string | null;
  locationTitle: string | null;
  weekendLabel: string | null;
  surveyResponses?: SurveyResponse[];
  ballotVoterCount?: number;
  ballotOptionCount?: number;
  ballotLeadingTitle?: string | null;
  ballotLeadingPct?: number;
  ballotClosesLabel?: string;
  addSomeoneSlot?: React.ReactNode;
  sendRail?: React.ReactNode;
  nudge?: string | null;
}) {
  if (!weekendFriday || !locationId) {
    return (
      <div className="share-rsvp-empty card">
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Lock a location and weekend in Decision, publish, then share the plan link—final
          RSVPs appear here.
        </p>
      </div>
    );
  }

  const forPlan = filterConfirmationsForPlan(
    confirmations,
    weekendFriday,
    locationId,
  );
  const totals = aggregateConfirmations(forPlan);
  const attendees = buildAttendeeRows(forPlan, surveyResponses);
  const comments = surveyResponses
    .filter((r) => r.notes?.trim())
    .slice(0, 6);

  const voteTotal = Math.max(ballotOptionCount, ballotVoterCount, 1);

  return (
    <div className="share-rsvp-layout">
      <div className="share-rsvp-main">
        <section className="share-rsvp-section" aria-labelledby="whos-in-heading">
          <div className="share-rsvp-section-head">
            <h3 id="whos-in-heading" className="share-rsvp-heading">
              Who&apos;s in
            </h3>
            {addSomeoneSlot}
          </div>
          {attendees.length === 0 ? (
            <p className="muted share-rsvp-empty-copy">
              No replies yet—share your plan link so family can RSVP.
            </p>
          ) : (
            <ul className="share-rsvp-attendees">
              {attendees.map((row) => (
                <li key={row.id} className="share-rsvp-attendee">
                  <span className="share-rsvp-avatar" aria-hidden="true">
                    {initials(row.name)}
                  </span>
                  <div className="share-rsvp-attendee-body">
                    <strong>{row.name}</strong>
                    {row.detail ? (
                      <span className="muted share-rsvp-attendee-detail">{row.detail}</span>
                    ) : null}
                  </div>
                  <span
                    className={`share-rsvp-status-chip is-${row.status.replace("_", "-")}`}
                  >
                    {row.status === "rsvp_yes"
                      ? "RSVP'd yes"
                      : row.status === "declined"
                        ? "Can't make it"
                        : "Opened, no reply"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {ballotOptionCount > 0 ? (
          <section className="share-rsvp-section" aria-labelledby="vote-heading">
            <h3 id="vote-heading" className="share-rsvp-heading">
              Vote: which place?
            </h3>
            <p className="share-rsvp-vote-meta">
              {ballotVoterCount} of {voteTotal} votes in · closes {ballotClosesLabel}
            </p>
            {ballotLeadingTitle ? (
              <div className="share-rsvp-vote-bar">
                <div
                  className="share-rsvp-vote-bar-fill"
                  style={{ width: `${Math.min(100, Math.max(8, ballotLeadingPct))}%` }}
                />
                <span className="share-rsvp-vote-bar-label">{ballotLeadingTitle}</span>
              </div>
            ) : null}
          </section>
        ) : null}

        {comments.length > 0 ? (
          <section className="share-rsvp-section" aria-labelledby="comments-heading">
            <h3 id="comments-heading" className="share-rsvp-heading">
              Comments
            </h3>
            <ul className="share-rsvp-comments">
              {comments.map((r) => (
                <li key={r.id} className="share-rsvp-comment">
                  <p className="share-rsvp-comment-meta">
                    <strong>{r.respondentName}</strong>
                    {r.submittedAt ? (
                      <>
                        {" · "}
                        <FormattedDateTime value={r.submittedAt} />
                      </>
                    ) : null}
                  </p>
                  <p className="share-rsvp-comment-bubble">{r.notes}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="share-rsvp-section share-rsvp-totals" aria-label="RSVP totals">
          <p className="pill share-rsvp-totals-chip">
            Final RSVP · {locationTitle ?? "Plan"} · {weekendLabel}
          </p>
          <div className="share-rsvp-totals-row">
            <div>
              <div className="share-rsvp-totals-number">{totals.totalPeople}</div>
              <div className="muted share-rsvp-totals-label">people confirmed</div>
            </div>
            <div className="muted share-rsvp-totals-breakdown">
              <div>
                <strong>{totals.confirmedHouseholds}</strong> yes ·{" "}
                <strong>{totals.declinedHouseholds}</strong> no
              </div>
              <div>
                {totals.totalAdults} adults · {totals.totalKids} kids
              </div>
            </div>
          </div>
        </section>

        {nudge ? <p className="share-rsvp-nudge">{nudge}</p> : null}
      </div>

      {sendRail ? <aside className="share-rsvp-rail">{sendRail}</aside> : null}
    </div>
  );
}
