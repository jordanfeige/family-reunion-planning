"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";

import { publishLocationsFromChatAction } from "@/app/actions/trips";

export type PlannerMode = "locations" | "plan";

function textFromMessage(message: UIMessage) {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function TripPlannerChat({
  slug,
  tripName,
  defaultMode = "locations",
}: {
  slug: string;
  tripName: string;
  defaultMode?: PlannerMode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<PlannerMode>(defaultMode);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/trips/${slug}/chat`,
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { ...body, messages, mode },
        }),
      }),
    [slug, mode],
  );

  const { messages, sendMessage, status, error, clearError, setMessages } =
    useChat({
      transport,
      id: `${slug}-${mode}`,
    });

  const [draft, setDraft] = useState("");

  const busy = status === "submitted" || status === "streaming";

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastAssistantText = lastAssistant ? textFromMessage(lastAssistant) : "";

  async function publishLocations() {
    if (!lastAssistantText) return;
    setPublishing(true);
    setPublishStatus(null);
    try {
      const result = await publishLocationsFromChatAction(slug, lastAssistantText);
      setPublishStatus(
        result.added > 0
          ? `Added ${result.added} location(s) to the survey (${result.total} total).`
          : "No new locations found—try asking the AI for a clearer numbered list.",
      );
      router.refresh();
    } catch (err) {
      setPublishStatus(
        err instanceof Error ? err.message : "Could not publish locations.",
      );
    } finally {
      setPublishing(false);
    }
  }

  function switchMode(next: PlannerMode) {
    if (next === mode) return;
    setMode(next);
    setMessages([]);
    setDraft("");
    clearError();
    setPublishStatus(null);
  }

  return (
    <div className="stack">
      <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className={mode === "locations" ? "btn btn-primary" : "btn btn-secondary"}
          style={{ fontSize: "0.9rem" }}
          onClick={() => switchMode("locations")}
        >
          1 · Explore locations
        </button>
        <button
          type="button"
          className={mode === "plan" ? "btn btn-primary" : "btn btn-secondary"}
          style={{ fontSize: "0.9rem" }}
          onClick={() => switchMode("plan")}
        >
          2 · Plan the trip
        </button>
      </div>

      <p className="muted" style={{ margin: 0 }}>
        {mode === "locations" ? (
          <>
            Start here after creating a trip—brainstorm destinations and areas.
            When you like the AI&apos;s suggestions, click{" "}
            <strong>Add to survey</strong> so family can vote on locations.
          </>
        ) : (
          <>
            Use this once weekends and headcount are in—get itineraries, lodging,
            and activities grounded in RSVP data.
          </>
        )}
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

      {publishStatus ? (
        <p
          className={publishStatus.includes("Added") ? "success-banner" : "error-banner"}
          style={{ margin: 0 }}
        >
          {publishStatus}
        </p>
      ) : null}

      <div className="card chat-scroll" style={{ background: "#fff", padding: "1rem" }}>
        {messages.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {mode === "locations" ? (
              <>
                Hi! Try: &quot;We are 20–30 people looking for a summer reunion
                in Norway or nearby—what 4 areas should we consider?&quot;
              </>
            ) : (
              <>
                Hi! Try: &quot;Which weekend has the best turnout?&quot; or
                &quot;Plan a relaxed Fri–Sun for the winning weekend with 14
                people.&quot;
              </>
            )}
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
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    marginBottom: "0.25rem",
                  }}
                >
                  {m.role === "user" ? "You" : "WandrAI"}
                </div>
                {textFromMessage(m)}
              </div>
            ))}
          </div>
        )}
      </div>

      {mode === "locations" && lastAssistantText ? (
        <button
          type="button"
          className="btn btn-berry"
          disabled={publishing || busy}
          onClick={() => publishLocations()}
        >
          {publishing ? "Adding to survey…" : "Add last reply to survey"}
        </button>
      ) : null}

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
            <label htmlFor={`chat-${slug}-${mode}`} className="sr-only">
              Message
            </label>
            <textarea
              id={`chat-${slug}-${mode}`}
              style={{ minHeight: "88px", width: "100%" }}
              placeholder={
                mode === "locations"
                  ? `Where should “${tripName}” happen?`
                  : `Plan “${tripName}” with real headcount…`
              }
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
