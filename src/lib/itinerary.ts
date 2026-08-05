import { z } from "zod";

import { formatTimeOfDay } from "@/lib/datetime";
import { formatUsd } from "@/lib/units";
import { parseFridayIso, sundayFromFriday } from "@/lib/weekends";

export const BLOCK_TYPES = ["activity", "meal", "lodging", "travel"] as const;
export const BLOCK_STATUSES = ["idea", "to_book", "booked"] as const;
export const BLOCK_TAGS = ["drive", "stay", "water", "hike", "food"] as const;
export const DAY_KEYS = ["friday", "saturday", "sunday"] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];
export type BlockStatus = (typeof BLOCK_STATUSES)[number];
export type BlockTag = (typeof BLOCK_TAGS)[number];
export type DayKey = (typeof DAY_KEYS)[number];

export type ItineraryBlock = {
  id: string;
  /** 24h storage, e.g. "14:30" — render with formatTimeOfDay */
  startTime?: string;
  /** @deprecated Use startTime */
  time?: string;
  title: string;
  type: BlockType;
  tag?: BlockTag;
  notes?: string;
  costUsd?: number;
  photoUrl?: string;
  plannerNotes?: string;
  bookingUrl?: string;
  status: BlockStatus;
  assignedToUserId?: string;
};

const TYPE_TO_TAG: Record<BlockType, BlockTag> = {
  travel: "drive",
  lodging: "stay",
  meal: "food",
  activity: "hike",
};

export function blockStartTime(block: ItineraryBlock): string | undefined {
  return block.startTime?.trim() || block.time?.trim() || undefined;
}

export function blockTagLabel(block: ItineraryBlock): BlockTag {
  if (block.tag && BLOCK_TAGS.includes(block.tag)) return block.tag;
  return TYPE_TO_TAG[block.type] ?? "hike";
}

export type ItineraryDay = {
  key: DayKey;
  label: string;
  dateIso?: string;
  blocks: ItineraryBlock[];
};

export type TripItinerary = {
  days: ItineraryDay[];
  generatedAt?: string;
};

export type PublishedItinerary = TripItinerary & {
  locationTitle?: string;
  weekendLabel?: string;
  headcount?: number;
  publishedAt?: string;
};

export function itineraryHasContent(itinerary: TripItinerary): boolean {
  return itinerary.days.some((d) => d.blocks.length > 0);
}

export const itineraryBlockSchema = z.object({
  startTime: z.string().optional(),
  time: z.string().optional(),
  title: z.string(),
  type: z.enum(["activity", "meal", "lodging", "travel"]),
  tag: z.enum(["drive", "stay", "water", "hike", "food"]).optional(),
  notes: z.string().optional(),
  costUsd: z.number().optional(),
  photoUrl: z.string().optional(),
  plannerNotes: z.string().optional(),
  bookingUrl: z.string().optional(),
  status: z.enum(["idea", "to_book", "booked"]),
  assignedToUserId: z.string().optional(),
});

export const itineraryDaySchema = z.object({
  key: z.enum(["friday", "saturday", "sunday"]),
  label: z.string(),
  blocks: z.array(itineraryBlockSchema),
});

export const itineraryGenerationSchema = z.object({
  days: z.array(itineraryDaySchema),
});

function addDays(isoFriday: string, offset: number): string {
  const d = parseFridayIso(isoFriday);
  if (!d) return isoFriday;
  const next = new Date(d);
  next.setDate(next.getDate() + offset);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const day = String(next.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function defaultDayLabels(fridayIso: string): ItineraryDay[] {
  const fmt = (iso: string) => {
    const d = parseFridayIso(iso);
    if (!d) return iso;
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };
  return [
    { key: "friday", label: fmt(fridayIso), dateIso: fridayIso, blocks: [] },
    {
      key: "saturday",
      label: fmt(addDays(fridayIso, 1)),
      dateIso: addDays(fridayIso, 1),
      blocks: [],
    },
    {
      key: "sunday",
      label: fmt(addDays(fridayIso, 2)),
      dateIso: addDays(fridayIso, 2),
      blocks: [],
    },
  ];
}

export function normalizeItinerary(
  raw: unknown,
  fridayIso?: string | null,
): TripItinerary {
  if (!raw || typeof raw !== "object") {
    return { days: fridayIso ? defaultDayLabels(fridayIso) : [] };
  }
  const o = raw as TripItinerary;
  if (!Array.isArray(o.days) || o.days.length === 0) {
    return {
      days: fridayIso ? defaultDayLabels(fridayIso) : [],
      generatedAt: o.generatedAt,
    };
  }

  const days: ItineraryDay[] = o.days.map((day, i) => {
    const key = (DAY_KEYS.includes(day.key as DayKey)
      ? day.key
      : DAY_KEYS[i] ?? "friday") as DayKey;
    const blocks: ItineraryBlock[] = (day.blocks ?? []).map((b) => {
      const rawTime = (b.startTime ?? b.time)?.trim();
      const cost =
        typeof b.costUsd === "number" && Number.isFinite(b.costUsd)
          ? b.costUsd
          : undefined;
      return {
        id: b.id || crypto.randomUUID(),
        startTime: rawTime || undefined,
        title: String(b.title ?? "").trim() || "Untitled",
        type: BLOCK_TYPES.includes(b.type as BlockType)
          ? (b.type as BlockType)
          : "activity",
        tag: BLOCK_TAGS.includes(b.tag as BlockTag) ? (b.tag as BlockTag) : undefined,
        notes: b.notes?.trim() || undefined,
        costUsd: cost,
        photoUrl: b.photoUrl?.trim() || undefined,
        plannerNotes: b.plannerNotes?.trim() || undefined,
        bookingUrl: b.bookingUrl?.trim() || undefined,
        status: BLOCK_STATUSES.includes(b.status as BlockStatus)
          ? (b.status as BlockStatus)
          : "idea",
        assignedToUserId: b.assignedToUserId?.trim() || undefined,
      };
    });
    return {
      key,
      label: day.label || key,
      dateIso: day.dateIso,
      blocks,
    };
  });

  return { days, generatedAt: o.generatedAt };
}

export function itineraryFromGenerated(
  generated: z.infer<typeof itineraryGenerationSchema>,
  fridayIso: string,
): TripItinerary {
  const defaults = defaultDayLabels(fridayIso);
  const byKey = new Map(generated.days.map((d) => [d.key, d]));

  const days: ItineraryDay[] = defaults.map((def) => {
    const gen = byKey.get(def.key);
    if (!gen) return def;
    return {
      key: def.key,
      label: gen.label || def.label,
      dateIso: def.dateIso,
      blocks: gen.blocks.map((b) => ({
        id: crypto.randomUUID(),
        startTime: (b.startTime ?? b.time)?.trim() || undefined,
        title: b.title.trim(),
        type: b.type,
        tag: b.tag,
        notes: b.notes?.trim() || undefined,
        costUsd:
          typeof b.costUsd === "number" && Number.isFinite(b.costUsd)
            ? b.costUsd
            : undefined,
        photoUrl: b.photoUrl?.trim() || undefined,
        bookingUrl: b.bookingUrl?.trim() || undefined,
        status: b.status,
      })),
    };
  });

  return { days, generatedAt: new Date().toISOString() };
}

export function getBookingBlocks(itinerary: TripItinerary) {
  const items: (ItineraryBlock & { dayKey: DayKey; dayLabel: string })[] = [];
  for (const day of itinerary.days) {
    for (const block of day.blocks) {
      if (
        block.status === "to_book" ||
        block.status === "booked" ||
        block.type === "lodging" ||
        block.type === "meal"
      ) {
        items.push({ ...block, dayKey: day.key, dayLabel: day.label });
      }
    }
  }
  return items.filter(
    (b) => b.status !== "idea" || b.type === "lodging" || b.type === "meal",
  );
}

export function formatItineraryForPrompt(itinerary: TripItinerary): string {
  if (!itinerary.days.some((d) => d.blocks.length > 0)) {
    return "No saved itinerary yet.";
  }
  return itinerary.days
    .map((day) => {
      const blocks = day.blocks
        .map((b) => {
          const t = blockStartTime(b);
          const timeLabel = t ? `${formatTimeOfDay(t)} ` : "";
          const cost =
            b.costUsd !== undefined ? ` (${formatUsd(b.costUsd)})` : "";
          return `  - ${timeLabel}${b.title} [${blockTagLabel(b)}, ${b.status}]${cost}${b.notes ? `: ${b.notes}` : ""}`;
        })
        .join("\n");
      return `${day.label}:\n${blocks || "  (empty)"}`;
    })
    .join("\n\n");
}

export function weekendDateRangeLabel(fridayIso: string): string {
  const sun = sundayFromFriday(fridayIso);
  const fri = parseFridayIso(fridayIso);
  if (!fri || !sun) return fridayIso;
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(fri)} – ${fmt(sun)}`;
}
