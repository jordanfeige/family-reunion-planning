"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import { ChatBubble } from "@/components/ChatBubble";
import { ChatComposer } from "@/components/ChatComposer";
import { VenueSuggestionCards } from "@/components/VenueSuggestionCards";
import { textFromMessage } from "@/lib/chatMessage";
import type { VenueOption } from "@/lib/venues";

export function TripVenueChat({
  slug,
  lockedLocationTitle,
  headcount,
  existingVenues,
}: {
  slug: string;
  lockedLocationTitle: string;
  headcount: number | null;
  existingVenues: VenueOption[];
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/trips/${slug}/chat`,
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { ...body, messages, mode: "venues" },
        }),
      }),
    [slug],
  );

  const { messages, sendMessage, status, error, clearError } = useChat({
    transport,
    id: `${slug}-venues`,
  });

  const [draft, setDraft] = useState("");
  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const streamingAssistant =
    busy && lastMessage?.role === "assistant" ? lastMessage.id : null;

  const headcountHint = headcount ? `${headcount} people` : "our group";

  return (
    <div className="stack chat-panel">
      <p className="muted" style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.5 }}>
        Compare resorts, rentals, restaurants, and gathering spots within{" "}
        <strong>{lockedLocationTitle}</strong>. Add picks to your private shortlist—family
        won&apos;t vote on these.
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

      <div className="card chat-thread">
        <div className="chat-scroll chat-thread-scroll">
          {messages.length === 0 ? (
            <p className="muted chat-thread-empty">
              Try: &quot;We need lodging for {headcountHint} near {lockedLocationTitle}—compare
              3 cabin resorts vs a campground with group sites.&quot;
            </p>
          ) : (
            <div className="chat-thread-messages">
              {messages.map((m) => {
                const isAssistant = m.role === "assistant";
                const text = textFromMessage(m);
                const isStreaming = m.id === streamingAssistant;
                const showSuggestions =
                  isAssistant &&
                  text.trim().length > 0 &&
                  !isStreaming &&
                  status === "ready";

                return (
                  <div key={m.id} className="chat-thread-turn">
                    <ChatBubble message={m} streaming={isStreaming} />
                    {showSuggestions ? (
                      <VenueSuggestionCards
                        slug={slug}
                        assistantText={text}
                        existingVenues={existingVenues}
                        enabled
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <ChatComposer
          id={`venue-chat-${slug}`}
          placeholder={`Stay & eat near ${lockedLocationTitle}…`}
          value={draft}
          busy={busy}
          onChange={setDraft}
          onSubmit={async () => {
            const text = draft.trim();
            if (!text || busy) return;
            setDraft("");
            await sendMessage({ text });
          }}
        />
      </div>
    </div>
  );
}
