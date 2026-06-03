import type { UIMessage } from "ai";

import { TripVenueChat } from "@/components/TripVenueChat";
import { VenueOptionsManager } from "@/components/VenueOptionsManager";
import type { OptionVoteTally } from "@/lib/ballotResults";
import type { VenueOption } from "@/lib/venues";

export function TripVenueSection({
  slug,
  lockedLocationTitle,
  headcount,
  venues,
  selectedVenueId,
  locationLocked,
  plannerVote,
  initialChatMessages = [],
}: {
  slug: string;
  lockedLocationTitle: string | null;
  headcount: number | null;
  venues: VenueOption[];
  selectedVenueId: string | null;
  locationLocked: boolean;
  plannerVote?: { tallies: Map<string, OptionVoteTally>; voterCount: number } | null;
  initialChatMessages?: UIMessage[];
}) {
  if (!locationLocked || !lockedLocationTitle) {
    return (
      <div
        className="card"
        style={{ padding: "1rem", background: "rgba(28, 61, 90, 0.04)" }}
      >
        <h3 style={{ margin: "0 0 0.35rem", color: "var(--color-fjord)", fontSize: "1rem" }}>
          Where to stay &amp; eat
        </h3>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>
          Lock a location above first. Then you and co-planners can shortlist resorts, rentals,
          restaurants, and gathering spots—no extra family survey.
        </p>
      </div>
    );
  }

  return (
    <div className="stack trip-venue-section">
      <div>
        <h3 style={{ margin: "0 0 0.35rem", color: "var(--color-fjord)" }}>
          Where to stay &amp; eat
        </h3>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>
          Planner shortlist inside <strong>{lockedLocationTitle}</strong>. Links are filled in
          automatically; family sees these on the shared trip plan.
        </p>
      </div>

      <TripVenueChat
        slug={slug}
        lockedLocationTitle={lockedLocationTitle}
        headcount={headcount}
        existingVenues={venues}
        initialMessages={initialChatMessages}
      />

      <div className="divider" />

      <VenueOptionsManager
        slug={slug}
        venues={venues}
        selectedVenueId={selectedVenueId}
        plannerVote={plannerVote}
      />
    </div>
  );
}
