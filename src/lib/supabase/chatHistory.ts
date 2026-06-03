import type { UIMessage } from "ai";

import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type ChatThreadMode = "locations" | "venues" | "itinerary";

const CHAT_ROLES = new Set(["user", "assistant", "system"]);

type ChatRow = Database["public"]["Tables"]["trip_chat_message"]["Row"];

function supabase() {
  return createSupabaseAdmin();
}

function throwDb(error: { message: string } | null, context: string): never {
  throw new Error(error?.message ?? `Database error: ${context}`);
}

function newId() {
  return crypto.randomUUID();
}

function threadQuery(
  tripId: string,
  mode: ChatThreadMode,
  focusDay: string | null,
) {
  let q = supabase()
    .from("trip_chat_message")
    .select("*")
    .eq("trip_id", tripId)
    .eq("mode", mode);

  if (focusDay === null) {
    q = q.is("focus_day", null);
  } else {
    q = q.eq("focus_day", focusDay);
  }

  return q;
}

function rowToUIMessage(row: ChatRow): UIMessage {
  return {
    id: row.message_id,
    role: row.role as UIMessage["role"],
    parts: row.parts as UIMessage["parts"],
  };
}

function persistableMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter(
    (m) =>
      typeof m.id === "string" &&
      m.id.length > 0 &&
      CHAT_ROLES.has(m.role) &&
      Array.isArray(m.parts),
  );
}

export async function loadChatThread({
  tripId,
  mode,
  focusDay,
}: {
  tripId: string;
  mode: ChatThreadMode;
  focusDay: string | null;
}): Promise<UIMessage[]> {
  const { data, error } = await threadQuery(tripId, mode, focusDay)
    .order("sort_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throwDb(error, "loadChatThread");
  return ((data ?? []) as ChatRow[]).map(rowToUIMessage);
}

export async function saveChatThread({
  tripId,
  mode,
  focusDay,
  messages,
}: {
  tripId: string;
  mode: ChatThreadMode;
  focusDay: string | null;
  messages: UIMessage[];
}): Promise<void> {
  const toSave = persistableMessages(messages);
  const now = new Date().toISOString();

  let deleteQ = supabase()
    .from("trip_chat_message")
    .delete()
    .eq("trip_id", tripId)
    .eq("mode", mode);

  if (focusDay === null) {
    deleteQ = deleteQ.is("focus_day", null);
  } else {
    deleteQ = deleteQ.eq("focus_day", focusDay);
  }

  const { error: deleteError } = await deleteQ;
  if (deleteError) throwDb(deleteError, "saveChatThread:delete");

  if (toSave.length === 0) return;

  const rows = toSave.map((m, sortIndex) => ({
    id: newId(),
    trip_id: tripId,
    mode,
    focus_day: focusDay,
    message_id: m.id,
    role: m.role,
    parts: m.parts as Database["public"]["Tables"]["trip_chat_message"]["Insert"]["parts"],
    sort_index: sortIndex,
    created_at: now,
  }));

  const { error: insertError } = await supabase()
    .from("trip_chat_message")
    .insert(rows);

  if (insertError) throwDb(insertError, "saveChatThread:insert");
}

export async function clearChatThread({
  tripId,
  mode,
  focusDay,
}: {
  tripId: string;
  mode: ChatThreadMode;
  focusDay: string | null;
}): Promise<void> {
  let q = supabase()
    .from("trip_chat_message")
    .delete()
    .eq("trip_id", tripId)
    .eq("mode", mode);

  if (focusDay === null) {
    q = q.is("focus_day", null);
  } else {
    q = q.eq("focus_day", focusDay);
  }

  const { error } = await q;
  if (error) throwDb(error, "clearChatThread");
}

export function normalizeChatFocusDay(
  mode: ChatThreadMode,
  focusDay: string | undefined,
): string | null {
  if (mode === "itinerary") {
    const day = focusDay?.trim();
    return day ? day : null;
  }
  return null;
}
