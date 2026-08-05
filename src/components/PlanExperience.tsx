"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { LiveShortlist } from "@/components/LiveShortlist";
import { TrailMap } from "@/components/TrailMap";
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
      text: "I’m WandrAI — I’ll help you shape a reunion trip and a destination shortlist your family can vote on.\n\nFirst: who’s coming, and roughly how many people?",
    },
  ],
};

function placesStarter(tripName?: string): UIMessage {
  const lead = tripName
    ? `Great — “${tripName}” is on the board. Let’s find destinations for the family survey.`
    : "Let’s find destinations for the family survey.";
  return {
    id: "plan-places-starter",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: `${lead}\n\nAny region, drive-time limit, or vibe I should lock onto first?`,
      },
    ],
  };
}

type Phase = "create" | "places" | "save";

const TRIP_CHIPS = [
  "About 20 people — my side of the family",
  "Multi-generation, including kids and grandparents",
  "Close crew — maybe 10–12 adults",
];

const PLACES_CHIPS = [
  "Midwest lakes, within a day’s drive",
  "Mountain towns people can fly into",
  "Beach weekend, warm in early fall",
];

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
  const [hints, setHints] = useState<{ who?: string; vibe?: string }>({});

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

  const trailStops = [
    { id: "create", label: "Basics", complete: Boolean(localTrip?.name) || phase !== "create" },
    {
      id: "places",
      label: "Destinations",
      complete:
        (initialPayload.locationTitles?.length ?? 0) > 0 ||
        phase === "save",
    },
    { id: "save", label: "Save", complete: false },
  ];

  return (
    <div className="plan-page plan-page--trail">
      <header className="plan-workspace-head">
        <div>
          <p className="plan-workspace-eyebrow">WandrAI concierge</p>
          <h1 className="plan-workspace-title">
            {phase === "places"
              ? "Find destinations together"
              : phase === "save"
                ? "Save your trip"
                : "Start your reunion plan"}
          </h1>
          <p className="plan-workspace-lede">
            {phase === "places"
              ? "Chat with WandrAI — a live shortlist builds beside you for the family survey."
              : phase === "save"
                ? "Lock this draft into a real trip hub so you can share the survey."
                : "Answer a few questions. I’ll name the trip, then we’ll craft destinations your family can vote on."}
          </p>
        </div>
        {!signedIn ? (
          <p className="plan-page-quota" aria-live="polite">
            {capped
              ? "Free messages used — save to keep planning"
              : `${remaining} free messages left`}
          </p>
        ) : null}
      </header>

      <TrailMap
        stops={trailStops}
        activeId={phase === "save" || capped ? "save" : phase}
        onSelect={(id) => {
          if (id === "create") setPhase("create");
          if (id === "places" && localTrip?.name) setPhase("places");
          if (id === "save" && localTrip?.name) setPhase("save");
        }}
      />

      {errorCode === "expired" ? (
        <p className="error-banner">Your draft expired. Let’s start fresh.</p>
      ) : null}
      {errorCode === "needs_name" ? (
        <p className="error-banner">Add a trip name with WandrAI before saving.</p>
      ) : null}

      {!aiEnabled ? (
        <p className="error-banner">AI planning needs an API key on the server.</p>
      ) : null}

      {phase === "create" ? (
        <CreatePhase
          aiEnabled={aiEnabled && !capped}
          capped={capped}
          saveLabel={saveLabel}
          hints={hints}
          onHint={(patch) => setHints((h) => ({ ...h, ...patch }))}
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
          tripName={localTrip?.name ?? initialPayload.name}
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
            initialPayload.locationTitles?.length ||
            localTrip?.locationTitles?.length ||
            0
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

function SuggestionChips({
  chips,
  disabled,
  onPick,
}: {
  chips: string[];
  disabled?: boolean;
  onPick: (text: string) => void;
}) {
  return (
    <div className="plan-chips" role="group" aria-label="Suggestions">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          className="plan-chip"
          disabled={disabled}
          onClick={() => onPick(chip)}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

function LiveTripCard({
  trip,
  hints,
}: {
  trip: TripDraft | null;
  hints: { who?: string; vibe?: string };
}) {
  const rows = [
    { label: "Who’s coming", value: hints.who },
    { label: "Vibe", value: hints.vibe ?? trip?.destinationNotes },
    { label: "Budget", value: trip?.targetBudget },
    { label: "Trip name", value: trip?.name },
  ];

  return (
    <aside className="plan-live-card" aria-label="Live trip draft">
      <div className="places-draft-head">
        <p className="create-trip-draft-eyebrow">Live draft</p>
        {trip?.name ? <span className="places-draft-live">Ready</span> : null}
      </div>
      <p className="muted places-draft-sub">
        WandrAI fills this in as you chat — nothing is final until you continue.
      </p>
      <ul className="plan-live-rows">
        {rows.map((row) => (
          <li key={row.label} className={row.value ? "is-filled" : ""}>
            <span className="plan-live-label">{row.label}</span>
            <span className="plan-live-value">
              {row.value?.trim() || "Waiting…"}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function PlanChatPane({
  messages,
  streamingAssistantId,
  composerId,
  placeholder,
  draftText,
  busy,
  onChange,
  onSubmit,
  footer,
  chips,
}: {
  messages: UIMessage[];
  streamingAssistantId: string | null;
  composerId: string;
  placeholder: string;
  draftText: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  footer?: React.ReactNode;
  chips?: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingAssistantId]);

  return (
    <div className="plan-chat-pane plan-chat-pane--rich">
      <div className="plan-chat-scroll" ref={scrollRef}>
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} streaming={m.id === streamingAssistantId} />
        ))}
        {chips}
      </div>
      <ChatComposer
        id={composerId}
        placeholder={placeholder}
        value={draftText}
        busy={busy}
        compact
        onChange={onChange}
        onSubmit={onSubmit}
      />
      {footer}
    </div>
  );
}

function CreatePhase({
  aiEnabled,
  capped,
  saveLabel,
  hints,
  onHint,
  onTrip,
  onUserMessage,
  onContinue,
  onSave,
  pending,
}: {
  aiEnabled: boolean;
  capped: boolean;
  saveLabel: string;
  hints: { who?: string; vibe?: string };
  onHint: (patch: { who?: string; vibe?: string }) => void;
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

  const userTurns = messages.filter((m) => m.role === "user").length;

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || !aiEnabled) return;
    if (userTurns === 0) onHint({ who: trimmed });
    else if (userTurns === 1) onHint({ vibe: trimmed });
    setDraftText("");
    onUserMessage();
    await sendMessage({ text: trimmed });
  }

  const placeholder =
    userTurns === 0
      ? "Or type your own — who’s coming?"
      : userTurns === 1
        ? "e.g. lake house vibe, not too far to fly"
        : "e.g. under $1k per household";

  return (
    <section className="plan-panel plan-panel--split">
      {error ? (
        <div className="error-banner">
          {error.message}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => clearError()}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="plan-panel-grid">
        <PlanChatPane
          messages={messages}
          streamingAssistantId={streamingAssistant}
          composerId="plan-create-composer"
          placeholder={placeholder}
          draftText={draftText}
          busy={busy || pending || !aiEnabled}
          onChange={setDraftText}
          onSubmit={() => send(draftText)}
          chips={
            userTurns === 0 && !busy ? (
              <SuggestionChips
                chips={TRIP_CHIPS}
                disabled={!aiEnabled || pending}
                onPick={(text) => void send(text)}
              />
            ) : null
          }
          footer={
            trip?.name ? (
              <div className="plan-draft-bar">
                <div className="plan-draft-bar-main">
                  <span className="plan-draft-bar-label">Draft ready</span>
                  <strong>{trip.name}</strong>
                  {trip.tagline ? <span className="muted">{trip.tagline}</span> : null}
                </div>
                <div className="plan-draft-actions">
                  <button
                    type="button"
                    className="btn btn-berry btn-sm"
                    disabled={pending}
                    onClick={() => onContinue(trip)}
                  >
                    Find destinations →
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={pending}
                    onClick={() => onSave(trip)}
                  >
                    {saveLabel}
                  </button>
                </div>
              </div>
            ) : capped ? (
              <p className="plan-chat-hint">
                Message limit reached — save with Google to keep going.
              </p>
            ) : null
          }
        />
        <LiveTripCard trip={trip} hints={hints} />
      </div>
    </section>
  );
}

function PlacesPhase({
  tripName,
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
  tripName?: string;
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
    messages: [placesStarter(tripName)],
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

  const userTurns = messages.filter((m) => m.role === "user").length;

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || !aiEnabled) return;
    setDraftText("");
    onUserMessage();
    await sendMessage({ text: trimmed });
  }

  return (
    <section className="plan-places plan-places--trail">
      <div className="dest-split">
        <section className="dest-places-card" aria-label="Places chat">
          <header className="dest-places-head">
            <h2 className="dest-places-title">Places</h2>
            <p className="dest-places-lede">
              I’ll help you find the right US destinations for the family survey.
            </p>
          </header>
          {error ? (
            <div className="error-banner">
              {error.message}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => clearError()}
              >
                Dismiss
              </button>
            </div>
          ) : null}
          <div className="dest-chat-pane">
            <div className="dest-chat-scroll">
              {messages.map((m) => (
                <ChatBubble
                  key={m.id}
                  message={m}
                  streaming={m.id === streamingAssistant}
                />
              ))}
              {userTurns === 0 && !busy ? (
                <SuggestionChips
                  chips={PLACES_CHIPS}
                  disabled={!aiEnabled || pending}
                  onPick={(text) => void send(text)}
                />
              ) : null}
            </div>
            <ChatComposer
              id="plan-places-composer"
              placeholder={
                userTurns === 0
                  ? "Or type your own region / vibe…"
                  : "Refine the shortlist with WandrAI…"
              }
              value={draftText}
              busy={busy || pending || !aiEnabled}
              compact
              onChange={setDraftText}
              onSubmit={() => send(draftText)}
            />
          </div>
          <button type="button" className="plan-back-link" onClick={onBack}>
            ← Back to basics
          </button>
        </section>

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
          onConfirm={() => onSave(places)}
          confirmLabel={saveLabel}
          confirmBusy={pending}
          confirmDisabled={selected.length === 0}
        />
      </div>
      {capped ? (
        <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
          Message limit reached — save to continue.
        </p>
      ) : null}
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
    <section className="plan-save-wall plan-save-wall--trail">
      <p className="plan-workspace-eyebrow">Almost there</p>
      <h2>
        {signedIn ? "Create your trip hub" : "Save your trip to get the survey link"}
      </h2>
      <p className="muted">
        {tripName ? (
          <>
            <strong>{tripName}</strong>
            {placesCount > 0 ? ` · ${placesCount} places` : null} is ready.{" "}
            {signedIn
              ? "Create the hub to unlock sharing on the Trail Map."
              : "Continue with Google to unlock sharing on the Trail Map."}
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
