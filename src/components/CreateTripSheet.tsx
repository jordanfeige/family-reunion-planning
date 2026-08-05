"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type UIMessage,
} from "ai";

import { createTripAction, createTripFromDraftAction } from "@/app/actions/trips";
import { ChatBubble } from "@/components/ChatBubble";
import { ChatComposer } from "@/components/ChatComposer";
import {
  normalizeTripDraft,
  tripDraftSchema,
  type TripDraft,
} from "@/lib/tripDraft";

function draftFromMessages(messages: UIMessage[]): TripDraft | null {
  let latest: TripDraft | null = null;
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (!isToolUIPart(part)) continue;
      if (getToolName(part) !== "update_trip_draft") continue;
      const raw =
        "input" in part && part.input
          ? part.input
          : "output" in part &&
              part.output &&
              typeof part.output === "object" &&
              part.output !== null &&
              "draft" in part.output
            ? (part.output as { draft: unknown }).draft
            : null;
      if (!raw) continue;
      const parsed = tripDraftSchema.safeParse(raw);
      if (parsed.success) latest = normalizeTripDraft(parsed.data);
    }
  }
  return latest;
}

const STARTER: UIMessage = {
  id: "create-starter",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Tell me about the reunion you’re planning—who’s coming, rough places or vibes, and any budget notes. I’ll draft a trip hub you can create when it looks right.",
    },
  ],
};

export function CreateTripSheet({
  open,
  onClose,
  aiEnabled,
}: {
  open: boolean;
  onClose: () => void;
  aiEnabled: boolean;
}) {
  const titleId = useId();
  const [draftText, setDraftText] = useState("");
  const [quickName, setQuickName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/trips/create-chat",
      }),
    [],
  );

  const { messages, sendMessage, status, error, clearError, setMessages } = useChat({
    transport,
    id: "create-trip",
    messages: [STARTER],
  });

  const busy = status === "submitted" || status === "streaming";
  const draft = draftFromMessages(messages);
  const lastMessage = messages[messages.length - 1];
  const streamingAssistant =
    busy && lastMessage?.role === "assistant" ? lastMessage.id : null;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  function resetAndClose() {
    setMessages([STARTER]);
    setDraftText("");
    setQuickName("");
    setCreateError(null);
    clearError();
    onClose();
  }

  function createFromDraft() {
    if (!draft?.name) return;
    setCreateError(null);
    startTransition(async () => {
      try {
        await createTripFromDraftAction(draft);
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (message === "NEXT_REDIRECT" || /NEXT_REDIRECT/.test(String(err))) {
          return;
        }
        setCreateError(message || "Could not create trip.");
      }
    });
  }

  return (
    <div className="create-trip-root" role="presentation">
      <button
        type="button"
        className="create-trip-backdrop"
        aria-label="Close"
        onClick={resetAndClose}
      />
      <div
        className="create-trip-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="create-trip-header">
          <div>
            <h2 id={titleId} className="create-trip-title">
              New trip
            </h2>
            <p className="muted create-trip-sub">
              Chat with WandrAI, or jump ahead with a name only.
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={resetAndClose}>
            Close
          </button>
        </header>

        <div className="create-trip-body">
          {aiEnabled ? (
            <section className="create-trip-chat" aria-label="Plan with WandrAI">
              {error || createError ? (
                <div className="error-banner">
                  {createError ?? error?.message}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginLeft: "0.75rem" }}
                    onClick={() => {
                      setCreateError(null);
                      clearError();
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}

              <div className="card chat-thread create-trip-thread">
                <div className="chat-scroll chat-thread-scroll">
                  {messages.map((message) => (
                    <ChatBubble
                      key={message.id}
                      message={message}
                      streaming={message.id === streamingAssistant}
                    />
                  ))}
                </div>
              </div>

              <ChatComposer
                id="create-trip-message"
                placeholder="e.g. 25 cousins, lake house vibe, under $1k per household…"
                value={draftText}
                busy={busy || pending}
                onChange={setDraftText}
                onSubmit={async () => {
                  const text = draftText.trim();
                  if (!text || busy) return;
                  setDraftText("");
                  await sendMessage({ text });
                }}
              />

              {draft?.name ? (
                <div className="create-trip-draft">
                  <div className="create-trip-draft-main">
                    <p className="create-trip-draft-eyebrow">Draft ready</p>
                    <strong className="create-trip-draft-name">{draft.name}</strong>
                    {draft.tagline ? (
                      <p className="muted create-trip-draft-line">{draft.tagline}</p>
                    ) : null}
                    {draft.destinationNotes ? (
                      <p className="muted create-trip-draft-line">{draft.destinationNotes}</p>
                    ) : null}
                    {draft.targetBudget ? (
                      <p className="muted create-trip-draft-line">Budget: {draft.targetBudget}</p>
                    ) : null}
                    {draft.locationTitles?.length ? (
                      <p className="muted create-trip-draft-line">
                        Places: {draft.locationTitles.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn btn-berry"
                    disabled={pending}
                    onClick={createFromDraft}
                  >
                    {pending ? "Creating…" : "Create trip hub"}
                  </button>
                </div>
              ) : null}
            </section>
          ) : (
            <p className="muted" style={{ margin: "0 0 1rem", lineHeight: 1.5 }}>
              WandrAI chat needs an API key on the server. You can still create a hub with a
              name.
            </p>
          )}

          <section className="create-trip-quick" aria-label="Create with name only">
            <h3 className="create-trip-quick-title">Name only</h3>
            <form action={createTripAction} className="create-trip-quick-form">
              <div className="field" style={{ flex: 1, margin: 0 }}>
                <label htmlFor="quick-trip-name" className="sr-only">
                  Trip name
                </label>
                <input
                  id="quick-trip-name"
                  name="name"
                  required
                  placeholder="Summer lake weekend"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  disabled={pending}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={pending}>
                Create
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

export function CreateTripLauncher({
  aiEnabled,
  hasTrips,
}: {
  aiEnabled: boolean;
  hasTrips: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={`dashboard-toolbar${hasTrips ? "" : " dashboard-toolbar--empty"}`}>
        {hasTrips ? (
          <button type="button" className="btn btn-berry" onClick={() => setOpen(true)}>
            + New trip
          </button>
        ) : (
          <div className="dashboard-empty">
            <h2 className="dashboard-empty-title">Plan your next reunion</h2>
            <p className="muted dashboard-empty-copy">
              Chat with WandrAI to shape the trip, or create a hub with just a name.
            </p>
            <button type="button" className="btn btn-berry" onClick={() => setOpen(true)}>
              Start with WandrAI
            </button>
          </div>
        )}
      </div>
      <CreateTripSheet open={open} onClose={() => setOpen(false)} aiEnabled={aiEnabled} />
    </>
  );
}
