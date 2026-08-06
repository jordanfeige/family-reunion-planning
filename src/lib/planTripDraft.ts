import { z } from "zod";

import { resolvePlanScale } from "@/lib/planMode";
import { placesDraftItemSchema, type PlacesDraftItem } from "@/lib/placesDraft";

/** Single source of truth for /plan conversation memory (Prompt R2). */
export const planTripDraftSchema = z.object({
  tripName: z.string().optional(),
  householdCount: z.number().int().positive().optional(),
  headcount: z.number().int().positive().optional(),
  originMetro: z.string().optional(),
  maxDriveHours: z.number().positive().optional(),
  region: z.string().optional(),
  budgetPerHouseholdUsd: z.number().int().positive().optional(),
  vibe: z.array(z.string()).optional(),
  mustHaves: z.array(z.string()).optional(),
  dateWindow: z.string().optional(),
  shortlist: z.array(placesDraftItemSchema).optional(),
  answeredQuestions: z.array(z.string()).optional(),
  rejectedIdeas: z.array(z.string()).optional(),
});

export type PlanTripDraft = z.infer<typeof planTripDraftSchema>;

export type PlanStepId = "create" | "places" | "survey";

const BASICS_FIELDS = [
  "tripName",
  "householdCount",
  "originMetro",
  "dateWindow",
] as const;

const DEST_FIELDS = [
  ...BASICS_FIELDS,
  "maxDriveHours",
  "region",
  "budgetPerHouseholdUsd",
  "vibe",
] as const;

export type DraftFieldKey =
  | (typeof DEST_FIELDS)[number]
  | "shortlist"
  | "headcount"
  | "mustHaves";

export function emptyPlanTripDraft(): PlanTripDraft {
  return {
    vibe: [],
    mustHaves: [],
    shortlist: [],
    answeredQuestions: [],
    rejectedIdeas: [],
  };
}

export function normalizePlanTripDraft(input: PlanTripDraft): PlanTripDraft {
  const vibe = (input.vibe ?? []).map((v) => v.trim()).filter(Boolean);
  const mustHaves = (input.mustHaves ?? []).map((v) => v.trim()).filter(Boolean);
  const answeredQuestions = [
    ...new Set((input.answeredQuestions ?? []).map((q) => q.trim()).filter(Boolean)),
  ];
  const rejectedIdeas = [
    ...new Set((input.rejectedIdeas ?? []).map((q) => q.trim()).filter(Boolean)),
  ];
  const shortlist = (input.shortlist ?? [])
    .map((p) => ({
      ...p,
      title: p.title.trim(),
      summary: p.summary?.trim() || undefined,
    }))
    .filter((p) => p.title.length > 0)
    .slice(0, 8);

  return {
    tripName: input.tripName?.trim() || undefined,
    householdCount: input.householdCount,
    headcount: input.headcount,
    originMetro: input.originMetro?.trim() || undefined,
    maxDriveHours: input.maxDriveHours,
    region: input.region?.trim() || undefined,
    budgetPerHouseholdUsd: input.budgetPerHouseholdUsd,
    vibe: vibe.length ? vibe : undefined,
    mustHaves: mustHaves.length ? mustHaves : undefined,
    dateWindow: input.dateWindow?.trim() || undefined,
    shortlist: shortlist.length ? shortlist : undefined,
    answeredQuestions: answeredQuestions.length ? answeredQuestions : undefined,
    rejectedIdeas: rejectedIdeas.length ? rejectedIdeas : undefined,
  };
}

/** Merge extractor output onto prior draft. Empty/undefined fields do not wipe known values. */
export function mergePlanTripDraft(
  prior: PlanTripDraft,
  patch: PlanTripDraft,
): PlanTripDraft {
  const merged: PlanTripDraft = { ...prior };

  const assignScalar = <K extends keyof PlanTripDraft>(key: K) => {
    const next = patch[key];
    if (next === undefined || next === null) return;
    if (typeof next === "string" && !next.trim()) return;
    if (Array.isArray(next) && next.length === 0) return;
    merged[key] = next as PlanTripDraft[K];
  };

  (
    [
      "tripName",
      "householdCount",
      "headcount",
      "originMetro",
      "maxDriveHours",
      "region",
      "budgetPerHouseholdUsd",
      "dateWindow",
    ] as const
  ).forEach(assignScalar);

  if (patch.vibe?.length) {
    merged.vibe = [...new Set([...(prior.vibe ?? []), ...patch.vibe.map((v) => v.trim())])];
  }
  if (patch.mustHaves?.length) {
    merged.mustHaves = [
      ...new Set([...(prior.mustHaves ?? []), ...patch.mustHaves.map((v) => v.trim())]),
    ];
  }
  if (patch.answeredQuestions?.length) {
    merged.answeredQuestions = [
      ...new Set([
        ...(prior.answeredQuestions ?? []),
        ...patch.answeredQuestions.map((q) => q.trim()),
      ]),
    ];
  }
  if (patch.rejectedIdeas?.length) {
    merged.rejectedIdeas = [
      ...new Set([
        ...(prior.rejectedIdeas ?? []),
        ...patch.rejectedIdeas.map((q) => q.trim()),
      ]),
    ];
  }
  if (patch.shortlist?.length) {
    const byTitle = new Map<string, PlacesDraftItem>();
    for (const p of prior.shortlist ?? []) {
      byTitle.set(p.title.trim().toLowerCase(), p);
    }
    for (const p of patch.shortlist) {
      byTitle.set(p.title.trim().toLowerCase(), p);
    }
    merged.shortlist = [...byTitle.values()].slice(0, 8);
  }

  return normalizePlanTripDraft(merged);
}

function fieldPresent(draft: PlanTripDraft, key: DraftFieldKey): boolean {
  switch (key) {
    case "tripName":
      return Boolean(draft.tripName?.trim());
    case "householdCount":
      return typeof draft.householdCount === "number" && draft.householdCount > 0;
    case "originMetro":
      return Boolean(draft.originMetro?.trim());
    case "dateWindow":
      return Boolean(draft.dateWindow?.trim());
    case "maxDriveHours":
      return typeof draft.maxDriveHours === "number" && draft.maxDriveHours > 0;
    case "region":
      return Boolean(draft.region?.trim());
    case "budgetPerHouseholdUsd":
      return (
        typeof draft.budgetPerHouseholdUsd === "number" &&
        draft.budgetPerHouseholdUsd > 0
      );
    case "vibe":
      return (draft.vibe?.length ?? 0) > 0;
    case "shortlist":
      return (draft.shortlist?.length ?? 0) >= 3;
    case "headcount":
      return typeof draft.headcount === "number" && draft.headcount > 0;
    case "mustHaves":
      return (draft.mustHaves?.length ?? 0) > 0;
    default:
      return false;
  }
}

export function requiredFieldsForStep(step: PlanStepId): DraftFieldKey[] {
  if (step === "create") return [...BASICS_FIELDS];
  if (step === "places") return [...DEST_FIELDS];
  return [...DEST_FIELDS, "shortlist"];
}

export function missingFieldsForStep(
  draft: PlanTripDraft,
  step: PlanStepId,
): DraftFieldKey[] {
  const scale = resolvePlanScale({
    householdCount: draft.householdCount,
    headcount: draft.headcount,
  });

  return requiredFieldsForStep(step).filter((k) => {
    if (k === "householdCount" && (scale === "solo" || scale === "duo")) {
      return false;
    }
    return !fieldPresent(draft, k);
  });
}

export function formatKnownBlock(draft: PlanTripDraft): string {
  const lines: string[] = [];
  if (draft.tripName) lines.push(`tripName: ${draft.tripName}`);
  if (draft.householdCount != null)
    lines.push(`householdCount: ${draft.householdCount}`);
  if (draft.headcount != null) lines.push(`headcount: ${draft.headcount}`);
  if (draft.originMetro) lines.push(`originMetro: ${draft.originMetro}`);
  if (draft.maxDriveHours != null)
    lines.push(`maxDriveHours: ${draft.maxDriveHours}`);
  if (draft.region) lines.push(`region: ${draft.region}`);
  if (draft.budgetPerHouseholdUsd != null)
    lines.push(`budgetPerHouseholdUsd: $${draft.budgetPerHouseholdUsd}`);
  if (draft.vibe?.length) lines.push(`vibe: ${draft.vibe.join(", ")}`);
  if (draft.mustHaves?.length)
    lines.push(`mustHaves: ${draft.mustHaves.join(", ")}`);
  if (draft.dateWindow) lines.push(`dateWindow: ${draft.dateWindow}`);
  if (draft.shortlist?.length)
    lines.push(
      `shortlist: ${draft.shortlist.map((p) => p.title).join(" | ")}`,
    );
  if (draft.answeredQuestions?.length)
    lines.push(`answeredQuestions: ${draft.answeredQuestions.join(" || ")}`);
  if (draft.rejectedIdeas?.length)
    lines.push(`rejectedIdeas: ${draft.rejectedIdeas.join(" | ")}`);
  return lines.length ? lines.join("\n") : "(nothing confirmed yet)";
}

export function formatWorkingFromLine(draft: PlanTripDraft): string {
  const bits: string[] = [];
  if (draft.headcount != null) bits.push(`${draft.headcount} people`);
  else if (draft.householdCount != null)
    bits.push(`${draft.householdCount} households`);
  if (draft.maxDriveHours != null)
    bits.push(
      `${draft.maxDriveHours} hr max${draft.originMetro ? ` from ${draft.originMetro}` : ""}`,
    );
  else if (draft.originMetro) bits.push(`from ${draft.originMetro}`);
  if (draft.region) bits.push(draft.region);
  if (draft.budgetPerHouseholdUsd != null)
    bits.push(`~$${draft.budgetPerHouseholdUsd.toLocaleString("en-US")}/household`);
  if (draft.vibe?.length) bits.push(draft.vibe.slice(0, 3).join(", "));
  if (draft.dateWindow) bits.push(draft.dateWindow);
  return bits.length ? bits.join(", ") : "what you've shared so far";
}

export const FIELD_LABELS: Record<DraftFieldKey, string> = {
  tripName: "Trip name",
  householdCount: "Households",
  headcount: "People",
  originMetro: "Starting from",
  maxDriveHours: "Max drive (hours)",
  region: "Region",
  budgetPerHouseholdUsd: "Budget per household (USD)",
  vibe: "Vibe",
  mustHaves: "Must-haves",
  dateWindow: "Dates",
  shortlist: "Shortlist",
};

/** Seed PlanTripDraft from legacy plan payload fields. */
export function planTripDraftFromLegacy(payload: {
  name?: string;
  tagline?: string;
  destinationNotes?: string;
  targetBudget?: string;
  locationTitles?: { title: string; summary?: string }[];
  trip?: PlanTripDraft;
}): PlanTripDraft {
  if (payload.trip && Object.keys(payload.trip).length > 0) {
    return normalizePlanTripDraft(payload.trip);
  }
  const budgetMatch = payload.targetBudget?.match(/(\d[\d,]*)/);
  const budget = budgetMatch
    ? Number(budgetMatch[1].replace(/,/g, ""))
    : undefined;
  return normalizePlanTripDraft({
    tripName: payload.name,
    region: payload.destinationNotes,
    budgetPerHouseholdUsd: Number.isFinite(budget) ? budget : undefined,
    vibe: payload.tagline ? [payload.tagline] : undefined,
    shortlist: payload.locationTitles?.map((p) => ({
      title: p.title,
      summary: p.summary,
      selected: true,
    })),
  });
}
