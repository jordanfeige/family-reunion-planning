"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type UIMessage,
} from "ai";

import { beginSavePlanDraftAction, savePlanDraftPayloadAction } from "@/app/actions/planDraft";
import { ChatBubble } from "@/components/ChatBubble";
import { ChatComposer } from "@/components/ChatComposer";
import {
  isMessageCapped,
  messagesRemaining,
  type PlanDraftPayload,
} from "@/lib/planDraft";
import {
  normalizePlacesDraft,
  placesDraftSchema,
  type PlacesDraftItem,
} from "@/lib/placesDraft";
import { normalizeTripDraft, tripDraftSchema, type TripDraft } from "@/lib/tripDraft";

function tripDraftFromMessages(messages: UIMessage[]): TripDraft | null {
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
      if (parsed.success) latest = normalizePlacesDraft(parsed.data).places;
    }
  }
  return latest;
}

const CREATE_STARTER: UIMessage = {
  id: "plan-create-starter",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Let’s plan your reunion. Who’s coming, any must-have vibes (lake, mountains, beach), and a rough budget? I’ll draft a trip you can save when you’re ready.",
    },
  ],
};

const PLACES_STARTER: UIMessage = {
  id: "plan-places-starter",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Great — now places for the family survey. Any region preferences or max drive time from a hub airport?",
    },
  ],
};

type Phase = "create" | "places" | "save";

export function PlanExperience({
  initialPayload,
  initialMessageCount,
  aiEnabled,
  errorCode,
  signedIn = false,
}: {
  initialPayload: PlanDraftPayload;
  initialMessageCount: number;
  aiEnabled: boolean;
  errorCode?: string;
  signedIn?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>(
    initialPayload.step === "places" || initialPayload.step === "save"
      ? initialPayload.step
      : "create",
  );
  const [messageCount, setMessageCount] = useState(initialMessageCount);
  const [pending, startTransition] = useTransition();
  const [localTrip, setLocalTrip] = useState<TripDraft | null>(
    initialPayload.name
      ? {
          name: initialPayload.name,
          tagline: initialPayload.tagline,
          destinationNotes: initialPayload.destinationNotes,
          targetBudget: initialPayload.targetBudget,
          locationTitles: initialPayload.locationTitles?.map((p) => p.title),
        }
      : null,
  );
  const [unchecked, setUnchecked] = useState<Record<string, true>>({});

  const capped = !signedIn && isMessageCapped(messageCount);
  const remaining = messagesRemaining(messageCount);

  function goSave(trip?: TripDraft | null, places?: PlacesDraftItem[]) {
    const payload: PlanDraftPayload = {
      name: trip?.name ?? localTrip?.name ?? initialPayload.name,
      tagline: trip?.tagline ?? localTrip?.tagline ?? initialPayload.tagline,
      destinationNotes:
        trip?.destinationNotes ??
        localTrip?.destinationNotes ??
        initialPayload.destinationNotes,
      targetBudget:
        trip?.targetBudget ?? localTrip?.targetBudget ?? initialPayload.targetBudget,
      locationTitles:
        places
          ?.filter((p) => p.selected !== false)
          .map((p) => ({ title: p.title, summary: p.summary })) ??
        initialPayload.locationTitles,
      step: "save",
    };
    startTransition(async () => {
      await beginSavePlanDraftAction(payload);
    });
  }

  const saveLabel = signedIn ? "Create trip hub" : "Save with Google";
  const saveWallLabel = signedIn ? "Create trip & open hub" : "Continue with Google";

  return (
    <div className="plan-page">
      <header className="plan-page-header">
        <p className="plan-page-eyebrow">Plan a trip</p>
        <h1 className="plan-page-title">WandrAI</h1>
        <p className="muted plan-page-sub">
          {signedIn
            ? "Same flow as starting fresh — chat, pick places, then open your trip hub."
            : "No account needed yet — save with Google when you want the survey link."}
        </p>
        {!signedIn ? (
          <p className="plan-page-quota" aria-live="polite">
            {capped
              ? "Free messages used — save to keep planning"
              : `${remaining} free message${remaining === 1 ? "" : "s"} left`}
          </p>
        ) : null}
      </header>

      {errorCode === "expired" ? (
        <p className="error-banner">Your draft expired. Let’s start fresh.</p>
      ) : null}
      {errorCode === "needs_name" ? (
        <p className="error-banner">Add a trip name with WandrAI before saving.</p>
      ) : null}

      {!aiEnabled ? (
        <p className="error-banner">AI planning needs an API key on the server.</p>
      ) : null}

      <nav className="plan-phase-rail" aria-label="Planning steps">
        <span className={phase === "create" ? "is-active" : ""}>1 · Trip</span>
        <span className={phase === "places" ? "is-active" : ""}>2 · Places</span>
        <span className={phase === "save" ? "is-active" : ""}>3 · Save</span>
      </nav>

      {phase === "create" ? (
        <CreatePhase
          aiEnabled={aiEnabled && !capped}
          capped={capped}
          saveLabel={saveLabel}
          onTrip={setLocalTrip}
          onUserMessage={() => setMessageCount((c) => c + 1)}
          onContinue={(t) => {
            setLocalTrip(t);
            startTransition(async () => {
              await savePlanDraftPayloadAction({
                name: t.name,
                tagline: t.tagline,
                destinationNotes: t.destinationNotes,
                targetBudget: t.targetBudget,
                locationTitles: t.locationTitles?.map((title) => ({ title })),
                step: "places",
              });
              setPhase("places");
            });
          }}
          onSave={(t) => goSave(t)}
          pending={pending}
        />
      ) : null}

      {phase === "places" ? (
        <PlacesPhase
          aiEnabled={aiEnabled && !capped}
          capped={capped}
          saveLabel={signedIn ? "Create hub & get survey link" : "Save & get survey link"}
          seedPlaces={
            initialPayload.locationTitles?.map((p) => ({
              title: p.title,
              summary: p.summary,
              selected: true,
            })) ??
            localTrip?.locationTitles?.map((title) => ({ title, selected: true })) ??
            []
          }
          unchecked={unchecked}
          setUnchecked={setUnchecked}
          onUserMessage={() => setMessageCount((c) => c + 1)}
          onBack={() => setPhase("create")}
          onSave={(places) => goSave(localTrip, places)}
          pending={pending}
        />
      ) : null}

      {phase === "save" || capped ? (
        <SaveWall
          tripName={localTrip?.name ?? initialPayload.name}
          placesCount={
            (initialPayload.locationTitles?.length ||
              localTrip?.locationTitles?.length ||
              0)
          }
          pending={pending}
          signedIn={signedIn}
          saveLabel={saveWallLabel}
          onSave={() => goSave(localTrip)}
        />
      ) : null}
    </div>
  );
}

function CreatePhase({
  aiEnabled,
  capped,
  saveLabel,
  onTrip,
  onUserMessage,
  onContinue,
  onSave,
  pending,
}: {
  aiEnabled: boolean;
  capped: boolean;
  saveLabel: string;
  onTrip: (t: TripDraft) => void;
  onUserMessage: () => void;
  onContinue: (t: TripDraft) => void;
  onSave: (t: TripDraft) => void;
  pending: boolean;
}) {
  const [draftText, setDraftText] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/plan/chat",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { ...body, messages, mode: "create" },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, error, clearError } = useChat({
    transport,
    id: "plan-create",
    messages: [CREATE_STARTER],
  });

  const busy = status === "submitted" || status === "streaming";
  const trip = tripDraftFromMessages(messages);

  useEffect(() => {
    if (trip) onTrip(trip);
  }, [trip, onTrip]);

  const lastMessage = messages[messages.length - 1];
  const streamingAssistant =
    busy && lastMessage?.role === "assistant" ? lastMessage.id : null;

  return (
    <section className="plan-panel">
      {error ? (
        <div className="error-banner">
          {error.message}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => clearError()}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="card chat-thread plan-chat-thread">
        <div className="chat-scroll chat-thread-scroll">
          {messages.map((m) => (
            <ChatBubble key={m.id} message={m} streaming={m.id === streamingAssistant} />
          ))}
        </div>
      </div>

      <ChatComposer
        id="plan-create-composer"
        placeholder="e.g. 25 cousins, lake vibe, under $1k per household…"
        value={draftText}
        busy={busy || pending || !aiEnabled}
        onChange={setDraftText}
        onSubmit={async () => {
          const text = draftText.trim();
          if (!text || busy || !aiEnabled) return;
          setDraftText("");
          onUserMessage();
          await sendMessage({ text });
        }}
      />

      {trip?.name ? (
        <div className="create-trip-draft plan-draft-card">
          <div className="create-trip-draft-main">
            <p className="create-trip-draft-eyebrow">Draft</p>
            <strong className="create-trip-draft-name">{trip.name}</strong>
            {trip.tagline ? <p className="muted create-trip-draft-line">{trip.tagline}</p> : null}
          </div>
          <div className="plan-draft-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() => onContinue(trip)}
            >
              Continue to places
            </button>
            <button
              type="button"
              className="btn btn-berry"
              disabled={pending}
              onClick={() => onSave(trip)}
            >
              {saveLabel}
            </button>
          </div>
        </div>
      ) : null}

      {capped ? (
        <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>
          Message limit reached — save with Google to keep going.
        </p>
      ) : null}
    </section>
  );
}

function PlacesPhase({
  aiEnabled,
  capped,
  saveLabel,
  seedPlaces,
  unchecked,
  setUnchecked,
  onUserMessage,
  onBack,
  onSave,
  pending,
}: {
  aiEnabled: boolean;
  capped: boolean;
  saveLabel: string;
  seedPlaces: PlacesDraftItem[];
  unchecked: Record<string, true>;
  setUnchecked: React.Dispatch<React.SetStateAction<Record<string, true>>>;
  onUserMessage: () => void;
  onBack: () => void;
  onSave: (places: PlacesDraftItem[]) => void;
  pending: boolean;
}) {
  const [draftText, setDraftText] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/plan/chat",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { ...body, messages, mode: "places" },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, error, clearError } = useChat({
    transport,
    id: "plan-places",
    messages: [PLACES_STARTER],
  });

  const busy = status === "submitted" || status === "streaming";
  const fromChat = placesFromMessages(messages);
  const base = fromChat?.length ? fromChat : seedPlaces;
  const places = base.map((p) => ({
    ...p,
    selected: !unchecked[p.title.trim().toLowerCase()],
  }));
  const selected = places.filter((p) => p.selected !== false);

  const lastMessage = messages[messages.length - 1];
  const streamingAssistant =
    busy && lastMessage?.role === "assistant" ? lastMessage.id : null;

  return (
    <section className="plan-panel places-sheet-grid plan-places-grid">
      <div className="places-sheet-chat">
        {error ? (
          <div className="error-banner">
            {error.message}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => clearError()}>
              Dismiss
            </button>
          </div>
        ) : null}
        <div className="card chat-thread plan-chat-thread">
          <div className="chat-scroll chat-thread-scroll">
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} streaming={m.id === streamingAssistant} />
            ))}
          </div>
        </div>
        <ChatComposer
          id="plan-places-composer"
          placeholder="e.g. Prefer the Midwest, within a day’s drive…"
          value={draftText}
          busy={busy || pending || !aiEnabled}
          onChange={setDraftText}
          onSubmit={async () => {
            const text = draftText.trim();
            if (!text || busy || !aiEnabled) return;
            setDraftText("");
            onUserMessage();
            await sendMessage({ text });
          }}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
          ← Back to trip
        </button>
      </div>

      <aside className="places-sheet-draft">
        <p className="create-trip-draft-eyebrow">Survey destinations</p>
        {places.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            Places will appear here as you chat.
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
          onClick={() => onSave(places)}
        >
          {saveLabel}
        </button>
        {capped ? (
          <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
            Message limit reached — save to continue.
          </p>
        ) : null}
      </aside>
    </section>
  );
}

function SaveWall({
  tripName,
  placesCount,
  pending,
  signedIn,
  saveLabel,
  onSave,
}: {
  tripName?: string;
  placesCount: number;
  pending: boolean;
  signedIn: boolean;
  saveLabel: string;
  onSave: () => void;
}) {
  return (
    <section className="plan-save-wall">
      <h2>
        {signedIn ? "Create your trip hub" : "Save your trip to get the survey link"}
      </h2>
      <p className="muted">
        {tripName ? (
          <>
            <strong>{tripName}</strong>
            {placesCount > 0 ? ` · ${placesCount} places` : null} is ready.{" "}
            {signedIn
              ? "Create the hub to unlock sharing."
              : "Continue with Google to unlock sharing."}
          </>
        ) : signedIn ? (
          <>Create your hub to keep planning and unlock the family survey link.</>
        ) : (
          <>Continue with Google to save your plan and unlock the family survey link.</>
        )}
      </p>
      <button type="button" className="btn btn-berry" disabled={pending} onClick={onSave}>
        {pending ? "Continuing…" : saveLabel}
      </button>
    </section>
  );
}
