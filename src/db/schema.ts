import { sql } from "drizzle-orm";
import type { AdapterAccountType } from "@auth/core/adapters";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Auth.js tables — keep column names aligned with the Drizzle adapter */
export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => ({
    compoundKey: primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  }),
);

export const authenticators = pgTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (authenticator) => ({
    compoundPK: primaryKey({
      columns: [authenticator.userId, authenticator.credentialID],
    }),
  }),
);

export const trips = pgTable("trip", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  destinationNotes: text("destination_notes"),
  targetBudget: text("target_budget"),
  tripStart: timestamp("trip_start", { mode: "date" }),
  tripEnd: timestamp("trip_end", { mode: "date" }),
  proposedDateSlots: jsonb("proposed_date_slots")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  locationOptions: jsonb("location_options")
    .$type<{ id: string; title: string; summary?: string }[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  selectedLocationId: text("selected_location_id"),
  selectedWeekendFriday: text("selected_weekend_friday"),
  planHeadcount: integer("plan_headcount"),
  itinerary: jsonb("itinerary")
    .$type<{
      days: {
        key: string;
        label: string;
        dateIso?: string;
        blocks: {
          id: string;
          time?: string;
          title: string;
          type: string;
          notes?: string;
          bookingUrl?: string;
          status: string;
        }[];
      }[];
      generatedAt?: string;
    }>()
    .notNull()
    .default(sql`'{"days":[]}'::jsonb`),
  publishedItinerary: jsonb("published_itinerary").$type<{
    days: {
      key: string;
      label: string;
      dateIso?: string;
      blocks: {
        id: string;
        time?: string;
        title: string;
        type: string;
        notes?: string;
        bookingUrl?: string;
        status: string;
      }[];
    }[];
    generatedAt?: string;
    locationTitle?: string;
    weekendLabel?: string;
    headcount?: number;
    publishedAt?: string;
  } | null>(),
  shareOptionsToken: text("share_options_token").notNull().unique(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const tripMembers = pgTable(
  "trip_member",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("editor").$type<"editor">(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    tripUserUnique: uniqueIndex("trip_member_trip_user_unique").on(t.tripId, t.userId),
  }),
);

export const tripInvites = pgTable(
  "trip_invite",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    tripEmailUnique: uniqueIndex("trip_invite_trip_email_unique").on(t.tripId, t.email),
  }),
);

export const surveys = pgTable("survey", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" })
    .unique(),
  publicToken: text("public_token").notNull().unique(),
  title: text("title").notNull().default("When can your crew join?"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const surveyResponses = pgTable("survey_response", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  surveyId: text("survey_id")
    .notNull()
    .references(() => surveys.id, { onDelete: "cascade" }),
  respondentName: text("respondent_name").notNull(),
  respondentEmail: text("respondent_email"),
  selectedSlots: jsonb("selected_slots")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  selectedLocations: jsonb("selected_locations")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  adultCount: integer("adult_count").notNull().default(1),
  kidCount: integer("kid_count").notNull().default(0),
  /** @deprecated Use adultCount + kidCount; kept in sync on insert for legacy reads */
  attendeeCount: integer("attendee_count").notNull().default(1),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at", { mode: "date" }).notNull().defaultNow(),
});

export const tripConfirmations = pgTable("trip_confirmation", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  respondentName: text("respondent_name").notNull(),
  respondentEmail: text("respondent_email"),
  status: text("status").notNull().$type<"confirmed" | "declined">(),
  adultCount: integer("adult_count").notNull().default(0),
  kidCount: integer("kid_count").notNull().default(0),
  weekendFriday: text("weekend_friday").notNull(),
  locationId: text("location_id").notNull(),
  submittedAt: timestamp("submitted_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const tripOptions = pgTable("trip_option", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  summary: text("summary"),
  contentMarkdown: text("content_markdown").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const galleryItems = pgTable("gallery_item", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  tripId: text("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  mediaType: text("media_type").notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
