"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type UIMessage,
} from "ai";

import { savePlanDraftPayloadAction } from "@/app/actions/planDraft";
import { ChatBubble } from "@/components/ChatBubble";
import { ChatComposer } from "@/components/ChatComposer";
import { HubSurveyComposer } from "@/components/HubSurveyComposer";
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
      text: "I'm WandrAI — I'll help you shape a reunion trip and a destination shortlist your family can vote on.\n\nFirst: who's coming, and roughly how many people?",
    },
  ],
};

function placesStarter(tripName?: string): UIMessage {
  const lead = tripName
    ? `Great — "${tripName}" is on the board. Let's find destinations for the family survey.`
    : "Let's find destinations for the family survey.";
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

type Phase = "create" | "places" | "survey";

const NEW_TRIP_PILLS = [
  "Lake cabin, room for 20",
  "Black Hills, easy drives",
  "Somewhere warm in March",
  "Surprise me",
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
    initialPayload.step === "places" ||
    initialPayload.step === "survey" ||
    initialPayload.step === "save"
      ? initialPayload.step === "save"
        ? "survey"
        : initialPayload.step
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

  function goSurvey(trip?: TripDraft | null, places?: PlacesDraftItem[]) {
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
      surveyPrefs: initialPayload.surveyPrefs,
      step: "survey",
    };
    startTransition(async () => {
      await savePlanDraftPayloadAction(payload);
      setPhase("survey");
    });
  }

  const draftLocations = useMemo(
    () =>
      (initialPayload.locationTitles ?? []).map((p) => ({
        id: p.title,
        title: p.title,
        summary: p.summary,
      })),
    [initialPayload.locationTitles],
  );

  const trailStops = [
    { id: "create", label: "Basics", complete: Boolean(localTrip?.name) || phase !== "create" },
    {
      id: "places",
      label: "Destinations",
      complete:
        (initialPayload.locationTitles?.length ?? 0) > 0 || phase === "survey",
    },
    { id: "survey", label: "Survey", complete: false },
  ];

  return (
    <div
      className={
        phase === "create"
          ? "plan-page plan-page--new-trip"
          : "plan-page plan-page--trail"
      }
    >
      {phase !== "create" ? (
        <>
          <TrailMap stops={trailStops} activeId={phase} />
          <header className="plan-workspace-head">
            <div>
              <h1 className="plan-workspace-title">
                {phase === "places" ? "Places" : "Ask the family"}
              </h1>
              <p className="plan-workspace-lede">
                {phase === "places"
                  ? "I'll help you find the right US destinations for the family survey."
                  : "Six questions, two minutes. You'll see answers land here once you send."}
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
        </>
      ) : null}

      {errorCode === "expired" ? (
        <p className="error-banner">Your draft expired. Let&apos;s start fresh.</p>
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
          remaining={remaining}
          signedIn={signedIn}
          saveLabel="Continue to survey →"
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
          onSave={(t) => goSurvey(t)}
          pending={pending}
        />
      ) : null}

      {phase === "places" ? (
        <PlacesPhase
          tripName={localTrip?.name ?? initialPayload.name}
          aiEnabled={aiEnabled && !capped}
          capped={capped}
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
          onSave={(places) => goSurvey(localTrip, places)}
          pending={pending}
        />
      ) : null}

      {phase === "survey" ? (
        <section className="plan-panel">
          <HubSurveyComposer
            signedIn={signedIn}
            locations={draftLocations}
            initialPrefs={initialPayload.surveyPrefs}
            initialWeekends={initialPayload.surveyPrefs?.proposedWeekends ?? []}
            planDraftMode
          />
        </section>
      ) : null}
    </div>
  );
}

function LiveTripCard({
  trip,
  hints,
  variant = "aside",
}: {
  trip: TripDraft | null;
  hints: { who?: string; vibe?: string };
  variant?: "aside" | "inline";
}) {
  const rows = [
    { label: "Who's coming", value: hints.who },
    { label: "Vibe", value: hints.vibe ?? trip?.destinationNotes },
    { label: "Budget", value: trip?.targetBudget },
    { label: "Trip name", value: trip?.name },
  ].filter((row) => Boolean(row.value?.trim()));

  if (rows.length === 0) return null;

  return (
    <aside
      className={
        variant === "inline" ? "plan-live-inline" : "plan-live-card plan-live-aside"
      }
      aria-label="Live trip draft"
    >
      <div className="places-draft-head">
        <p className="create-trip-draft-eyebrow">
          {variant === "inline" ? "Confirmed so far" : "Live draft"}
        </p>
        {trip?.name ? <span className="places-draft-live">Ready</span> : null}
      </div>
      <ul className="plan-live-rows">
        {rows.map((row) => (
          <li key={row.label} className="is-filled">
            <span className="plan-live-label">{row.label}</span>
            <span className="plan-live-value">{row.value}</span>
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
  remaining,
  signedIn,
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
  remaining: number;
  signedIn: boolean;
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
  const [started, setStarted] = useState(false);
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
    setStarted(true);
    onUserMessage();
    await sendMessage({ text: trimmed });
  }

  const liveCard = <LiveTripCard trip={trip} hints={hints} />;
  const liveInline = <LiveTripCard trip={trip} hints={hints} variant="inline" />;
  const hasLiveDraft = Boolean(
    hints.who ||
      hints.vibe ||
      trip?.destinationNotes ||
      trip?.targetBudget ||
      trip?.name,
  );

  if (!started && userTurns === 0) {
    return (
      <section className="new-trip" aria-labelledby="new-trip-heading">
        <p className="new-trip-eyebrow">New trip</p>
        <h1 id="new-trip-heading" className="new-trip-title">
          What kind of reunion are we planning?
        </h1>
        <p className="new-trip-lede">
          Describe it however you like. I&apos;ll ask a few questions, then build a
          shortlist your family can vote on.
        </p>

        <div className="new-trip-composer">
          <label className="sr-only" htmlFor="new-trip-prompt">
            Describe your reunion
          </label>
          <textarea
            id="new-trip-prompt"
            className="new-trip-textarea"
            rows={3}
            value={draftText}
            disabled={!aiEnabled || pending || capped}
            placeholder="A relaxed lake weekend within 4 hours of Sioux Falls, room for the grandkids…"
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draftText);
              }
            }}
          />
          <div className="new-trip-composer-foot">
            <div className="new-trip-context" aria-label="Trip context">
              <span className="new-trip-pill">07/17/2026 – 07/19/2026</span>
              <span className="new-trip-pill">9 households</span>
              <span className="new-trip-pill">From Sioux Falls, SD</span>
            </div>
            <button
              type="button"
              className="btn btn-berry new-trip-submit new-trip-submit--labeled"
              disabled={!aiEnabled || pending || capped || !draftText.trim()}
              onClick={() => void send(draftText)}
            >
              Start planning →
            </button>
            <button
              type="button"
              className="new-trip-send"
              aria-label="Start planning"
              disabled={!aiEnabled || pending || capped || !draftText.trim()}
              onClick={() => void send(draftText)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path
                  d="M12 19V5M5 12l7-7 7 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="new-trip-suggestions" role="group" aria-label="Starting points">
          {NEW_TRIP_PILLS.map((pill) => (
            <button
              key={pill}
              type="button"
              className="new-trip-suggestion"
              disabled={!aiEnabled || pending || capped}
              onClick={() => setDraftText(pill)}
            >
              {pill}
            </button>
          ))}
        </div>

        {!signedIn ? (
          <p className="new-trip-quota muted">
            {capped
              ? "Free messages used — save to keep planning"
              : `${remaining} free messages left`}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="plan-panel plan-panel--split">
      <p className="step-progress-eyebrow">Step 1 of 3 · Basics</p>
      {error ? (
        <div className="error-banner">
          {error.message}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => clearError()}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div
        className={
          hasLiveDraft ? "plan-panel-grid" : "plan-panel-grid plan-panel-grid--solo"
        }
      >
        <div className="plan-chat-with-inline">
          <PlanChatPane
            messages={messages}
            streamingAssistantId={streamingAssistant}
            composerId="plan-create-composer"
            placeholder={
              userTurns <= 1
                ? "Answer in your own words…"
                : "e.g. under $1,000 per household"
            }
            draftText={draftText}
            busy={busy || pending || !aiEnabled}
            onChange={setDraftText}
            onSubmit={() => send(draftText)}
            footer={
              trip?.name ? (
                <div className="plan-draft-bar">
                  <div className="plan-draft-bar-main">
                    <span className="plan-draft-bar-label">Draft ready</span>
                    <strong>{trip.name}</strong>
                    {trip.tagline ? <span className="muted">{trip.tagline}</span> : null}
                  </div>
                  <div className="plan-draft-actions action-pair">
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
                      className="btn btn-secondary btn-sm action-pair-secondary"
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
          {liveInline}
        </div>
        {liveCard}
      </div>
    </section>
  );
}

function PlacesPhase({
  tripName,
  aiEnabled,
  capped,
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

  const lastMessage = messages[messages.length - 1];
  const streamingAssistant =
    busy && lastMessage?.role === "assistant" ? lastMessage.id : null;

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || !aiEnabled) return;
    setDraftText("");
    onUserMessage();
    await sendMessage({ text: trimmed });
  }

  return (
    <section className="plan-places plan-places--trail">
      <div className={places.length > 0 ? "dest-split" : "dest-split dest-split--solo"}>
        <section className="dest-places-card" aria-label="Places chat">
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
            </div>
            <ChatComposer
              id="plan-places-composer"
              placeholder="Answer in your own words…"
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
            onConfirm={() => onSave(places)}
            confirmBusy={pending}
            onDifferentIdeas={() => void send("Show me different ideas")}
          />
        ) : null}
      </div>
      {capped ? (
        <p className="muted plan-cap-note">
          Message limit reached — you can still compose the survey.
        </p>
      ) : null}
    </section>
  );
}
