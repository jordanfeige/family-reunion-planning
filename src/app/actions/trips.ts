"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  galleryItems,
  surveyResponses,
  surveys,
  tripOptions,
  trips,
} from "@/db/schema";
import { newSecretToken, newTripSlug } from "@/lib/tokens";

async function requireSessionUserId() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login?callbackUrl=/dashboard");
  return id;
}

export async function createTripAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("Give your gathering a name.");
  }

  const db = getDb();
  const slug = newTripSlug();
  const shareOptionsToken = newSecretToken();
  const surveyToken = newSecretToken();

  const [trip] = await db
    .insert(trips)
    .values({
      slug,
      name,
      tagline: String(formData.get("tagline") ?? "").trim() || null,
      destinationNotes: String(formData.get("destination") ?? "").trim() || null,
      targetBudget: String(formData.get("budget") ?? "").trim() || null,
      shareOptionsToken,
      ownerId: userId,
    })
    .returning();

  if (!trip) throw new Error("Could not create trip.");

  await db.insert(surveys).values({
    tripId: trip.id,
    publicToken: surveyToken,
    title: "When can your crew join?",
  });

  redirect(`/t/${slug}`);
}

export async function updateTripBasicsAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) throw new Error("Missing trip.");

  const db = getDb();
  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.slug, slug), eq(trips.ownerId, userId)))
    .limit(1);
  if (!trip) throw new Error("Trip not found.");

  const slotsRaw = String(formData.get("proposed_slots") ?? "").trim();
  const proposedDateSlots = slotsRaw
    ? slotsRaw
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  await db
    .update(trips)
    .set({
      name: String(formData.get("name") ?? trip.name).trim() || trip.name,
      tagline: String(formData.get("tagline") ?? "").trim() || null,
      destinationNotes: String(formData.get("destination") ?? "").trim() || null,
      targetBudget: String(formData.get("budget") ?? "").trim() || null,
      tripStart: parseOptionalDate(formData.get("trip_start")),
      tripEnd: parseOptionalDate(formData.get("trip_end")),
      proposedDateSlots,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, trip.id));

  revalidatePath(`/t/${slug}`);
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function addTripOptionAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const contentMarkdown = String(formData.get("content") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim() || null;
  if (!slug || !title || !contentMarkdown) {
    throw new Error("Title and plan details are required.");
  }

  const db = getDb();
  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.slug, slug), eq(trips.ownerId, userId)))
    .limit(1);
  if (!trip) throw new Error("Trip not found.");

  const existing = await db
    .select({ id: tripOptions.id })
    .from(tripOptions)
    .where(eq(tripOptions.tripId, trip.id));

  await db.insert(tripOptions).values({
    tripId: trip.id,
    title,
    summary,
    contentMarkdown,
    sortOrder: existing.length,
  });

  revalidatePath(`/t/${slug}`);
}

export async function deleteTripOptionAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const optionId = String(formData.get("option_id") ?? "").trim();
  if (!slug || !optionId) throw new Error("Missing fields.");

  const db = getDb();
  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.slug, slug), eq(trips.ownerId, userId)))
    .limit(1);
  if (!trip) throw new Error("Trip not found.");

  await db
    .delete(tripOptions)
    .where(and(eq(tripOptions.id, optionId), eq(tripOptions.tripId, trip.id)));

  revalidatePath(`/t/${slug}`);
}

export async function addGalleryItemAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const mediaType = String(formData.get("media_type") ?? "image").trim();
  const caption = String(formData.get("caption") ?? "").trim() || null;
  if (!slug || !url) throw new Error("Upload did not return a URL.");

  const db = getDb();
  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.slug, slug), eq(trips.ownerId, userId)))
    .limit(1);
  if (!trip) throw new Error("Trip not found.");

  await db.insert(galleryItems).values({
    tripId: trip.id,
    url,
    mediaType: mediaType === "video" ? "video" : "image",
    caption,
  });

  revalidatePath(`/t/${slug}`);
}

export async function deleteGalleryItemAction(formData: FormData) {
  const userId = await requireSessionUserId();
  const slug = String(formData.get("slug") ?? "").trim();
  const itemId = String(formData.get("item_id") ?? "").trim();
  if (!slug || !itemId) throw new Error("Missing fields.");

  const db = getDb();
  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.slug, slug), eq(trips.ownerId, userId)))
    .limit(1);
  if (!trip) throw new Error("Trip not found.");

  await db
    .delete(galleryItems)
    .where(and(eq(galleryItems.id, itemId), eq(galleryItems.tripId, trip.id)));

  revalidatePath(`/t/${slug}`);
}

export async function submitSurveyResponseAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const respondentName = String(formData.get("name") ?? "").trim();
  const attendeeCount = Math.max(
    1,
    Number.parseInt(String(formData.get("attendee_count") ?? "1"), 10) || 1,
  );
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const respondentEmail = String(formData.get("email") ?? "").trim() || null;

  if (!token || !respondentName) {
    throw new Error("Please add your name.");
  }

  const selected = formData.getAll("slot") as string[];

  const db = getDb();
  const row = await db
    .select({ survey: surveys, trip: trips })
    .from(surveys)
    .innerJoin(trips, eq(surveys.tripId, trips.id))
    .where(eq(surveys.publicToken, token))
    .limit(1);
  const surveyRow = row[0];
  if (!surveyRow) throw new Error("This link is not valid anymore.");

  await db.insert(surveyResponses).values({
    surveyId: surveyRow.survey.id,
    respondentName,
    respondentEmail,
    selectedSlots: selected,
    attendeeCount,
    notes,
  });

  revalidatePath(`/r/${token}`);
  revalidatePath(`/t/${surveyRow.trip.slug}`);
  redirect(`/r/${token}?thanks=1`);
}
