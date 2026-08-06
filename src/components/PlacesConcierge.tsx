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
import { CtaRequirementHint } from "@/components/CtaRequirementHint";
import { LiveShortlist } from "@/components/LiveShortlist";
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
        text: `I’ll help you find the right US destinations for “${tripName}.”\n\nWhat kind of weekend are you imagining — lake, mountain, beach, or city-break?`,
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
  nudgeSlot,
}: {
  slug: string;
  tripName: string;
  locations: LocationOption[];
  initialMessages?: UIMessage[];
  aiEnabled: boolean;
  surveyUrl?: string;
  basicsSlot?: React.ReactNode;
  nudgeSlot?: React.ReactNode;
}) {
  const router = useRouter();
  const [refining, setRefining] = useState(locations.length === 0 && aiEnabled);

  useEffect(() => {
    if (locations.length === 0 && aiEnabled) setRefining(true);
  }, [locations.length, aiEnabled]);

  if (!refining && locations.length > 0) {
    return (
      <div className="dest-published">
        <header className="dest-places-head">
          <h2 className="dest-places-title">Places</h2>
          <p className="dest-places-lede">
            Shortlist is on the survey — refine anytime with WandrAI.
          </p>
        </header>
        {basicsSlot}
        <ul className="places-ready-list" aria-label="Places">
          {locations.map((loc, i) => (
            <li key={loc.id}>
              <span className="places-ready-num">{i + 1}</span>
              <span>
                <strong>{formatLocationLabel(loc)}</strong>
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
        {!aiEnabled ? (
          <CtaRequirementHint>
            AI needs an API key before you can refine destinations.
          </CtaRequirementHint>
        ) : null}
        <ManualAddOnly slug={slug} />
      </div>
    );
  }

  return (
    <div className="dest-workspace">
      {nudgeSlot ? <div className="dest-nudge-callout">{nudgeSlot}</div> : null}
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
      ) : (
        <ManualAddOnly slug={slug} />
      )}
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
              <label htmlFor="loc_summary_concierge">Region / pitch (optional)</label>
              <input
                id="loc_summary_concierge"
                name="summary"
                placeholder="California · Easy flights, great food"
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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingAssistant]);

  function publish() {
    const selected = places.filter((p) => p.selected !== false);
    if (selected.length === 0) {
      setPublishError("Select at least one place.");
      return;
    }
    setPublishError(null);
    startTransition(async () => {
      try {
        await publishPlacesDraftAction(slug, selected);
        onPublished(selected.map((p) => p.title));
      } catch (err) {
        setPublishError(err instanceof Error ? err.message : "Could not publish places.");
      }
    });
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setDraftText("");
    setIgnoreChatDraft(false);
    await sendMessage({ text: trimmed });
  }

  return (
    <div className={places.length > 0 ? "dest-split" : "dest-split dest-split--solo"}>
      {error || publishError ? (
        <div className="error-banner dest-split-banner">
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

      <section className="dest-places-card" aria-label="Places chat">
        <header className="dest-places-head">
          <h2 className="dest-places-title">Places</h2>
          <p className="dest-places-lede">
            I’ll help you find the right US destinations for the family survey.
          </p>
        </header>
        <div className="dest-chat-pane">
          <div className="dest-chat-scroll" ref={scrollRef}>
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
            placeholder="Answer in your own words…"
            value={draftText}
            busy={busy || pending}
            compact
            onChange={setDraftText}
            onSubmit={() => send(draftText)}
          />
        </div>
        <div className="dest-places-foot">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
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
            <button type="button" className="btn btn-secondary btn-sm" onClick={onCancelRefine}>
              Cancel refine
            </button>
          ) : null}
          <ManualAddOnly slug={slug} />
        </div>
      </section>

      {places.length > 0 ? (
        <LiveShortlist
          places={places}
          onToggle={(title) => {
            const key = title.trim().toLowerCase();
            setUnchecked((prev) => {
              const next = { ...prev };
              if (next[key]) delete next[key];
              else next[key] = true;
              return next;
            });
          }}
          onConfirm={publish}
          confirmBusy={pending}
          onDifferentIdeas={() => void send("Show me different ideas")}
        />
      ) : null}
    </div>
  );
}
