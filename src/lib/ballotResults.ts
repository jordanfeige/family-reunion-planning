import {
  venuesForPublicShowcase,
  type VenueCategory,
  type VenueOption,
} from "@/lib/venues";

export type BallotVoteRow = {
  optionId: string;
  vote: "up" | "down";
};

export type OptionVoteTally = {
  optionId: string;
  up: number;
  down: number;
  net: number;
};

export function tallyBallotVotes(votes: BallotVoteRow[]): Map<string, OptionVoteTally> {
  const map = new Map<string, OptionVoteTally>();

  for (const row of votes) {
    const current = map.get(row.optionId) ?? {
      optionId: row.optionId,
      up: 0,
      down: 0,
      net: 0,
    };
    if (row.vote === "up") current.up += 1;
    else current.down += 1;
    current.net = current.up - current.down;
    map.set(row.optionId, current);
  }

  return map;
}

export function sortOptionsByVotes(
  options: VenueOption[],
  tallies: Map<string, OptionVoteTally>,
): VenueOption[] {
  return [...options].sort((a, b) => {
    const netA = tallies.get(a.id)?.net ?? 0;
    const netB = tallies.get(b.id)?.net ?? 0;
    if (netB !== netA) return netB - netA;
    const upA = tallies.get(a.id)?.up ?? 0;
    const upB = tallies.get(b.id)?.up ?? 0;
    return upB - upA;
  });
}

/** Ballot-eligible venues first (vote order), then the rest (e.g. passed), for planner shortlist. */
export function sortPlannerCategoryVenues(
  venues: VenueOption[],
  category: VenueCategory,
  tallies: Map<string, OptionVoteTally> | undefined,
): VenueOption[] {
  const all = venues.filter((v) => v.category === category);
  if (!tallies) return all;
  const visible = venuesForPublicShowcase(all);
  const visibleIds = new Set(visible.map((v) => v.id));
  const rest = all.filter((v) => !visibleIds.has(v.id));
  return [...sortOptionsByVotes(visible, tallies), ...sortOptionsByVotes(rest, tallies)];
}

export function categoryVoteRollup(
  ballotVisibleOptions: VenueOption[],
  tallies: Map<string, OptionVoteTally>,
): {
  totalUp: number;
  totalDown: number;
  leader: { venue: VenueOption; tally: OptionVoteTally } | null;
} {
  let totalUp = 0;
  let totalDown = 0;
  for (const v of ballotVisibleOptions) {
    const t = tallies.get(v.id);
    if (t) {
      totalUp += t.up;
      totalDown += t.down;
    }
  }
  const sorted = sortOptionsByVotes(ballotVisibleOptions, tallies);
  const top = sorted[0];
  if (!top) {
    return { totalUp, totalDown, leader: null };
  }
  const tally = tallies.get(top.id) ?? {
    optionId: top.id,
    up: 0,
    down: 0,
    net: 0,
  };
  return { totalUp, totalDown, leader: { venue: top, tally } };
}

export function countDistinctVoters(votes: { voterKey: string }[]): number {
  return new Set(votes.map((v) => v.voterKey)).size;
}
