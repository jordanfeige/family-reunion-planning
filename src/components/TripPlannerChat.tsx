"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";

function textFromMessage(message: UIMessage) {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function TripPlannerChat({
  slug,
  tripName,
}: {
  slug: string;
  tripName: string;
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/trips/${slug}/chat`,
      }),
    [slug],
  );

  const { messages, sendMessage, status, error, clearError } = useChat({
    transport,
  });

  const [draft, setDraft] = useState("");

  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0 }}>
        Ask about where to stay, day-by-day pacing, kid-friendly stops, food
        worth the splurge, and reservations worth booking early. I will answer
        with headings and bullet lists you can paste into{" "}
        <strong>Trip options</strong>.
      </p>
      {error ? (
        <div className="error-banner">
          {error.message}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginLeft: "0.75rem" }}
            onClick={() => clearError()}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      <div
        className="card"
        style={{
          maxHeight: "420px",
          overflowY: "auto",
          background: "#fff",
          padding: "1rem",
        }}
      >
        {messages.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Hei! Try: “We are 14 people in Bergen for 3 days in August with a
            mid budget—what is a relaxed itinerary?”
          </p>
        ) : (
          <div className="stack" style={{ gap: "0.75rem" }}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "92%",
                  borderRadius: "16px",
                  padding: "0.75rem 1rem",
                  background:
                    m.role === "user"
                      ? "rgba(42, 85, 128, 0.12)"
                      : "rgba(94, 234, 212, 0.15)",
                  color: "var(--color-night)",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.45,
                }}
              >
                <div style={{ fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                  {m.role === "user" ? "You" : "Nordic co-planner"}
                </div>
                {textFromMessage(m)}
              </div>
            ))}
          </div>
        )}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text || busy) return;
          setDraft("");
          await sendMessage({ text });
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <div className="field" style={{ flex: "1 1 220px", marginBottom: 0 }}>
            <label htmlFor={`chat-${slug}`} className="sr-only">
              Message
            </label>
            <textarea
              id={`chat-${slug}`}
              style={{ minHeight: "88px", width: "100%" }}
              placeholder={`Ask anything about “${tripName}”...`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Thinking…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
