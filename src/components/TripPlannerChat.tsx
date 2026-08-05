"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";

import { ChatClearButton } from "@/components/ChatClearButton";
import { ChatBubble } from "@/components/ChatBubble";
import { ChatComposer } from "@/components/ChatComposer";
import { LocationSuggestionCards } from "@/components/LocationSuggestionCards";
import { textFromMessage } from "@/lib/chatMessage";

export function TripPlannerChat({
  slug,
  tripName,
  existingLocationTitles,
  initialMessages = [],
}: {
  slug: string;
  tripName: string;
  existingLocationTitles: string[];
  initialMessages?: UIMessage[];
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/trips/${slug}/chat`,
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { ...body, messages, mode: "locations" },
        }),
      }),
    [slug],
  );

  const { messages, sendMessage, status, error, clearError, setMessages } = useChat({
    transport,
    id: `${slug}-locations`,
    messages: initialMessages,
  });

  const [draft, setDraft] = useState("");
  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const streamingAssistant =
    busy && lastMessage?.role === "assistant" ? lastMessage.id : null;

  return (
    <div className="stack chat-panel">
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <ChatClearButton
          slug={slug}
          mode="locations"
          disabled={busy || messages.length === 0}
          onCleared={() => setMessages([])}
        />
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.5 }}>
        Brainstorm destinations and areas. Each WandrAI reply can surface location cards—use{" "}
        <strong>Add to survey</strong> so family can vote below.
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
              Hi! Try: &quot;We are 20–30 people looking for a summer reunion in the
              U.S.—what 4 lake or mountain areas should we consider?&quot;
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
                      <LocationSuggestionCards
                        slug={slug}
                        messageId={m.id}
                        assistantText={text}
                        existingLocationTitles={existingLocationTitles}
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
          id={`chat-${slug}`}
          placeholder={`Where should “${tripName}” happen?`}
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
