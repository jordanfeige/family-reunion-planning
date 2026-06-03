"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";

import { refineItineraryDayAction } from "@/app/actions/trips";
import { ChatClearButton } from "@/components/ChatClearButton";
import { ChatBubble } from "@/components/ChatBubble";
import { ChatComposer } from "@/components/ChatComposer";
import { textFromMessage } from "@/lib/chatMessage";
import type { DayKey } from "@/lib/itinerary";

export function TripItineraryChat({
  slug,
  tripName,
  focusDay,
  focusDayLabel,
  hasBlocks,
  initialMessages = [],
}: {
  slug: string;
  tripName: string;
  focusDay: DayKey;
  focusDayLabel: string;
  hasBlocks: boolean;
  initialMessages?: UIMessage[];
}) {
  const router = useRouter();
  const [applyStatus, setApplyStatus] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/trips/${slug}/chat`,
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { ...body, messages, mode: "itinerary", focusDay },
        }),
      }),
    [slug, focusDay],
  );

  const { messages, sendMessage, status, error, clearError, setMessages } = useChat({
    transport,
    id: `${slug}-itinerary-${focusDay}`,
    messages: initialMessages,
  });

  const [draft, setDraft] = useState("");
  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const streamingAssistant =
    busy && lastMessage?.role === "assistant" ? lastMessage.id : null;

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastAssistantText = lastAssistant ? textFromMessage(lastAssistant) : "";

  async function applyToDay() {
    if (!lastAssistantText || !hasBlocks) return;
    setApplying(true);
    setApplyStatus(null);
    try {
      await refineItineraryDayAction(slug, focusDay, lastAssistantText);
      setApplyStatus(`Applied to ${focusDayLabel}. Review the updated blocks below.`);
      router.refresh();
    } catch (err) {
      setApplyStatus(err instanceof Error ? err.message : "Could not update that day.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="stack itinerary-chat">
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <ChatClearButton
          slug={slug}
          mode="itinerary"
          focusDay={focusDay}
          disabled={busy || messages.length === 0}
          onCleared={() => setMessages([])}
        />
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.5 }}>
        Chat about your locked plan for <strong>{tripName}</strong>. Focus is{" "}
        <strong>{focusDayLabel}</strong>—switch days above to change focus. Use{" "}
        <strong>Apply to day</strong> to merge the last reply into your saved itinerary.
      </p>

      {error ? (
        <div className="error-banner">
          {error.message}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: "0.75rem" }}
            onClick={() => clearError()}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {applyStatus ? (
        <p
          className={
            applyStatus.includes("Could not") ? "error-banner" : "success-banner"
          }
          style={{ margin: 0, fontSize: "0.88rem" }}
        >
          {applyStatus}
        </p>
      ) : null}

      <div className="card chat-thread">
        <div className="chat-scroll chat-thread-scroll">
          {messages.length === 0 ? (
            <p className="muted chat-thread-empty">
              {hasBlocks ? (
                <>
                  Try: &quot;Make {focusDayLabel.split(",")[0]} lighter for kids&quot; or
                  &quot;Suggest a backup indoor activity if it rains.&quot;
                </>
              ) : (
                <>
                  Generate an itinerary first, or ask what to include for a{" "}
                  {focusDayLabel.split(",")[0]} with your group size.
                </>
              )}
            </p>
          ) : (
            <div className="chat-thread-messages">
              {messages.map((m) => (
                <div key={m.id} className="chat-thread-turn">
                  <ChatBubble
                    message={m}
                    streaming={m.id === streamingAssistant}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {hasBlocks && lastAssistantText && status === "ready" ? (
          <button
            type="button"
            className="btn btn-berry btn-block-sm chat-thread-action"
            disabled={applying || busy}
            onClick={() => void applyToDay()}
          >
            {applying ? "Updating day…" : `Apply last reply to ${focusDayLabel.split(",")[0]}`}
          </button>
        ) : null}

        <ChatComposer
          id={`itinerary-chat-${slug}-${focusDay}`}
          placeholder={`Ask about ${focusDayLabel.split(",")[0]}…`}
          value={draft}
          busy={busy}
          onChange={setDraft}
          onSubmit={async () => {
            const text = draft.trim();
            if (!text || busy) return;
            setDraft("");
            setApplyStatus(null);
            await sendMessage({ text });
          }}
        />
      </div>
    </div>
  );
}
