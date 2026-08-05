"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type UIMessage,
} from "ai";
import { useRouter } from "next/navigation";

import { publishPlacesDraftAction } from "@/app/actions/trips";
import { ChatBubble } from "@/components/ChatBubble";
import { ChatComposer } from "@/components/ChatComposer";
import { ManualAddDrawer } from "@/components/ManualAddDrawer";
import { addLocationOptionAction } from "@/app/actions/trips";
import {
  normalizePlacesDraft,
  placesDraftSchema,
  type PlacesDraftItem,
} from "@/lib/placesDraft";
import { goToTripHubStep } from "@/lib/wizardNav";
import type { LocationOption } from "@/lib/locations";
import { formatLocationLabel } from "@/lib/locations";

function placesFromMessages(messages: UIMessage[]): PlacesDraftItem[] | null {
  let latest: PlacesDraftItem[] | null = null;
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (!isToolUIPart(part)) continue;
      if (getToolName(part) !== "update_places_draft") continue;
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
      const parsed = placesDraftSchema.safeParse(raw);
      if (parsed.success) {
        latest = normalizePlacesDraft(parsed.data).places;
      }
    }
  }
  return latest;
}

function starterMessage(tripName: string): UIMessage {
  return {
    id: "places-starter",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: `Any region you want near for “${tripName}”?`,
      },
    ],
  };
}

export function PlacesConcierge({
  slug,
  tripName,
  locations,
  initialMessages = [],
  aiEnabled,
}: {
  slug: string;
  tripName: string;
  locations: LocationOption[];
  initialMessages?: UIMessage[];
  aiEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="places-concierge">
      {locations.length === 0 ? (
        <div className="places-concierge-empty">
          <p className="places-concierge-empty-title">Choose survey destinations with WandrAI</p>
          <p className="muted places-concierge-empty-copy">
            A short conversation picks places your family can vote on—then we take you to the
            survey link.
          </p>
          <button
            type="button"
            className="btn btn-berry places-concierge-cta"
            onClick={() => setOpen(true)}
            disabled={!aiEnabled}
          >
            Plan places with WandrAI
          </button>
          {!aiEnabled ? (
            <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.88rem" }}>
              AI needs an API key. You can still add places manually below.
            </p>
          ) : null}
          <div className="places-concierge-manual">
            <ManualAddOnly slug={slug} />
          </div>
        </div>
      ) : (
        <div className="places-concierge-ready">
          <div className="places-concierge-ready-header">
            <div>
              <p className="places-concierge-ready-count">
                {locations.length} place{locations.length === 1 ? "" : "s"} on the survey
              </p>
              <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.88rem" }}>
                Family will pick from these on the preference survey.
              </p>
            </div>
            <div className="places-concierge-ready-actions">
              <button
                type="button"
                className="btn btn-berry btn-sm"
                onClick={() => {
                  goToTripHubStep(slug, "survey");
                }}
              >
                Go to survey
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setOpen(true)}
                disabled={!aiEnabled}
              >
                Refine with WandrAI
              </button>
            </div>
          </div>
          <ul className="hub-survey-places places-ready-chips" aria-label="Places">
            {locations.map((loc) => (
              <li key={loc.id}>{formatLocationLabel(loc)}</li>
            ))}
          </ul>
          <ManualAddOnly slug={slug} />
        </div>
      )}

      <PlacesConciergeSheet
        open={open}
        onClose={() => setOpen(false)}
        slug={slug}
        tripName={tripName}
        initialMessages={initialMessages}
        seedPlaces={locations.map((l) => ({
          title: l.title,
          summary: l.summary,
          selected: true,
        }))}
        onPublished={() => {
          setOpen(false);
          goToTripHubStep(slug, "survey");
          router.refresh();
        }}
      />
    </div>
  );
}

function ManualAddOnly({ slug }: { slug: string }) {
  return (
    <ManualAddDrawer title="Add location" triggerLabel="Add manually">
      {({ close }) => (
        <form
          className="stack"
          action={async (formData) => {
            await addLocationOptionAction(formData);
            close();
          }}
        >
          <input type="hidden" name="slug" value={slug} />
          <div className="field">
            <label htmlFor="loc_title_concierge">Destination name</label>
            <input
              id="loc_title_concierge"
              name="title"
              required
              placeholder="Lake Tahoe or Outer Banks"
            />
          </div>
          <div className="field">
            <label htmlFor="loc_summary_concierge">Short pitch (optional)</label>
            <input
              id="loc_summary_concierge"
              name="summary"
              placeholder="Easy flights, great food, mild weather"
            />
          </div>
          <button type="submit" className="btn btn-berry" style={{ alignSelf: "flex-start" }}>
            Add to survey
          </button>
        </form>
      )}
    </ManualAddDrawer>
  );
}

function PlacesConciergeSheet({
  open,
  onClose,
  slug,
  tripName,
  initialMessages,
  seedPlaces,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  tripName: string;
  initialMessages: UIMessage[];
  seedPlaces: PlacesDraftItem[];
  onPublished: () => void;
}) {
  const titleId = useId();
  const [draftText, setDraftText] = useState("");
  const [unchecked, setUnchecked] = useState<Record<string, true>>({});
  const [ignoreChatDraft, setIgnoreChatDraft] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  const seeded =
    initialMessages.length > 0 ? initialMessages : [starterMessage(tripName)];

  const { messages, sendMessage, status, error, clearError, setMessages } = useChat({
    transport,
    id: `${slug}-places-concierge`,
    messages: seeded,
  });

  const busy = status === "submitted" || status === "streaming";
  const fromChat = ignoreChatDraft ? null : placesFromMessages(messages);
  const basePlaces = fromChat?.length ? fromChat : seedPlaces;
  const places: PlacesDraftItem[] = basePlaces.map((p) => ({
    ...p,
    selected: !unchecked[p.title.trim().toLowerCase()],
  }));
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

  const selected = places.filter((p) => p.selected !== false);

  function publish() {
    if (selected.length === 0) {
      setPublishError("Select at least one place to publish.");
      return;
    }
    setPublishError(null);
    startTransition(async () => {
      try {
        await publishPlacesDraftAction(
          slug,
          selected.map((p) => ({ title: p.title, summary: p.summary })),
        );
        onPublished();
      } catch (err) {
        setPublishError(err instanceof Error ? err.message : "Could not publish places.");
      }
    });
  }

  return (
    <div className="create-trip-root places-sheet-root" role="presentation">
      <button
        type="button"
        className="create-trip-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="places-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="create-trip-header">
          <div>
            <h2 id={titleId} className="create-trip-title">
              Plan places
            </h2>
            <p className="muted create-trip-sub">One question at a time — then publish to the survey.</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="places-sheet-grid">
          <section className="places-sheet-chat" aria-label="WandrAI chat">
            {error || publishError ? (
              <div className="error-banner">
                {publishError ?? error?.message}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: "0.75rem" }}
                  onClick={() => {
                    setPublishError(null);
                    clearError();
                  }}
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            <div className="plan-chat-pane places-sheet-pane">
              <div className="plan-chat-scroll">
                {messages.map((message) => (
                  <ChatBubble
                    key={message.id}
                    message={message}
                    streaming={message.id === streamingAssistant}
                  />
                ))}
              </div>
              <ChatComposer
                id={`places-chat-${slug}`}
                placeholder={
                  messages.filter((m) => m.role === "user").length === 0
                    ? "e.g. Midwest, near Chicago"
                    : "e.g. lake towns, within a day’s drive"
                }
                value={draftText}
                busy={busy || pending}
                compact
                onChange={setDraftText}
                onSubmit={async () => {
                  const text = draftText.trim();
                  if (!text || busy) return;
                  setDraftText("");
                  setIgnoreChatDraft(false);
                  await sendMessage({ text });
                }}
              />
            </div>
          </section>

          <aside className="places-sheet-draft" aria-label="Survey destinations draft">
            <p className="create-trip-draft-eyebrow">Survey destinations</p>
            {places.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>
                As you chat, places will show up here. Check the ones to publish.
              </p>
            ) : (
              <ul className="places-draft-list">
                {places.map((place) => {
                  const key = place.title.trim().toLowerCase();
                  const checked = place.selected !== false;
                  return (
                    <li key={place.title}>
                      <label className="places-draft-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setUnchecked((prev) => {
                              const next = { ...prev };
                              if (checked) next[key] = true;
                              else delete next[key];
                              return next;
                            });
                          }}
                        />
                        <span>
                          <strong>{place.title}</strong>
                          {place.summary ? (
                            <span className="muted places-draft-summary">{place.summary}</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            <button
              type="button"
              className="btn btn-berry places-publish-btn"
              disabled={pending || selected.length === 0}
              onClick={publish}
            >
              {pending
                ? "Publishing…"
                : `Publish to survey${selected.length ? ` (${selected.length})` : ""}`}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginTop: "0.5rem", width: "100%" }}
              disabled={busy}
              onClick={() => {
                setMessages([starterMessage(tripName)]);
                setUnchecked({});
                setIgnoreChatDraft(true);
              }}
            >
              Restart chat
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
