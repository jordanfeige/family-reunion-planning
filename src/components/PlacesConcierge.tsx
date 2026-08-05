"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type UIMessage,
} from "ai";
import { useRouter } from "next/navigation";

import {
  addLocationOptionAction,
  publishPlacesDraftAction,
} from "@/app/actions/trips";
import { ChatBubble } from "@/components/ChatBubble";
import { ChatComposer } from "@/components/ChatComposer";
import { CopyButton } from "@/components/CopyButton";
import { ManualAddDrawer } from "@/components/ManualAddDrawer";
import { queueTrailBeat } from "@/components/TrailBeat";
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
        text: `Hi — I’ll help build survey destinations for “${tripName}.” What vibe are we going for?`,
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
  surveyUrl,
  basicsSlot,
}: {
  slug: string;
  tripName: string;
  locations: LocationOption[];
  initialMessages?: UIMessage[];
  aiEnabled: boolean;
  surveyUrl?: string;
  basicsSlot?: React.ReactNode;
}) {
  const router = useRouter();
  const [refining, setRefining] = useState(locations.length === 0 && aiEnabled);

  useEffect(() => {
    if (locations.length === 0 && aiEnabled) setRefining(true);
  }, [locations.length, aiEnabled]);

  if (!refining && locations.length > 0) {
    return (
      <div className="places-fullpage">
        <header className="hub-workspace-head">
          <div>
            <h2 className="hub-workspace-title">Destinations</h2>
            <p className="hub-workspace-lede">
              Shortlist published — refine anytime, then share the survey.
            </p>
          </div>
        </header>
        {basicsSlot}
        <div className="places-published-banner">
          <p className="places-published-title">Shortlist published</p>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            {locations.length} place{locations.length === 1 ? "" : "s"} on the
            survey.
          </p>
        </div>
        <ul className="places-ready-list" aria-label="Places">
          {locations.map((loc, i) => (
            <li key={loc.id}>
              <span className="places-ready-num">{i + 1}</span>
              <span>
                <strong>{formatLocationLabel(loc)}</strong>
                {loc.summary ? (
                  <span className="muted places-ready-summary">{loc.summary}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        <div className="places-concierge-ready-actions">
          {surveyUrl ? (
            <CopyButton text={surveyUrl} label="Copy survey link" className="btn-berry" />
          ) : (
            <button
              type="button"
              className="btn btn-berry"
              onClick={() => goToTripHubStep(slug, "survey")}
            >
              Open survey
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setRefining(true)}
            disabled={!aiEnabled}
          >
            Refine with WandrAI
          </button>
        </div>
        <ManualAddOnly slug={slug} />
      </div>
    );
  }

  return (
    <div className="places-fullpage">
      <header className="hub-workspace-head">
        <div>
          <h2 className="hub-workspace-title">Destinations</h2>
          <p className="hub-workspace-lede">
            Chat with WandrAI to build destinations your family can vote on.
          </p>
        </div>
      </header>
      {basicsSlot}
      {!aiEnabled ? (
        <p className="muted" style={{ marginBottom: "1rem" }}>
          AI needs an API key. Add places manually below.
        </p>
      ) : null}
      {aiEnabled ? (
        <PlacesFullPlanner
          slug={slug}
          tripName={tripName}
          initialMessages={initialMessages}
          seedPlaces={locations.map((l) => ({
            title: l.title,
            summary: l.summary,
            selected: true,
          }))}
          onPublished={(names) => {
            queueTrailBeat(slug, "shortlist", names.join("|"));
            goToTripHubStep(slug, "survey");
            router.refresh();
          }}
          onCancelRefine={
            locations.length > 0 ? () => setRefining(false) : undefined
          }
        />
      ) : null}
      <ManualAddOnly slug={slug} />
    </div>
  );
}

function ManualAddOnly({ slug }: { slug: string }) {
  return (
    <div className="places-fullpage-manual">
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
    </div>
  );
}

function PlacesFullPlanner({
  slug,
  tripName,
  initialMessages,
  seedPlaces,
  onPublished,
  onCancelRefine,
}: {
  slug: string;
  tripName: string;
  initialMessages: UIMessage[];
  seedPlaces: PlacesDraftItem[];
  onPublished: (names: string[]) => void;
  onCancelRefine?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
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
  const userTurns = messages.filter((m) => m.role === "user").length;
  const selected = places.filter((p) => p.selected !== false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingAssistant]);

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
        onPublished(selected.map((p) => p.title));
      } catch (err) {
        setPublishError(err instanceof Error ? err.message : "Could not publish places.");
      }
    });
  }

  return (
    <div className="places-fullpage-planner">
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

      <div className="places-fullpage-grid">
        <section className="places-fullpage-chat" aria-label="WandrAI chat">
          <div className="places-chat-pane places-chat-pane--embedded">
            <div className="places-chat-scroll" ref={scrollRef}>
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
                userTurns === 0
                  ? "e.g. lakes and mountains in the Midwest"
                  : "Message WandrAI…"
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

        <aside className="places-fullpage-draft" aria-label="Survey destinations draft">
          <div className="places-draft-head">
            <p className="create-trip-draft-eyebrow">Survey destinations</p>
            {places.length > 0 ? (
              <span className="places-draft-live">Live draft</span>
            ) : null}
          </div>
          <p className="muted places-draft-sub">
            Check the ones that feel right, then publish to the survey.
          </p>
          {places.length === 0 ? (
            <p className="muted" style={{ margin: "0.75rem 0 0", fontSize: "0.9rem", lineHeight: 1.5 }}>
              As you chat, places show up here.
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
              : `These feel right${selected.length ? ` (${selected.length})` : ""}`}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm places-restart-btn"
            disabled={busy}
            onClick={() => {
              setMessages([starterMessage(tripName)]);
              setUnchecked({});
              setIgnoreChatDraft(true);
            }}
          >
            Restart chat
          </button>
          {onCancelRefine ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm places-restart-btn"
              onClick={onCancelRefine}
            >
              Cancel refine
            </button>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
