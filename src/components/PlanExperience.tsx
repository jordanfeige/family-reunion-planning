"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";

import {
  savePlanDraftPayloadAction,
} from "@/app/actions/planDraft";
import { ChatBubble } from "@/components/ChatBubble";
import { ChatComposer } from "@/components/ChatComposer";
import { CtaRequirementHint } from "@/components/CtaRequirementHint";
import { HubSurveyComposer } from "@/components/HubSurveyComposer";
import { LiveShortlist } from "@/components/LiveShortlist";
import { TrailMap } from "@/components/TrailMap";
import { TripDraftPanel } from "@/components/TripDraftPanel";
import { focusBlockingField } from "@/lib/formFocus";
import {
  isMessageCapped,
  messagesRemaining,
  type PlanDraftPayload,
} from "@/lib/planDraft";
import {
  missingFieldsForStep,
  planTripDraftFromLegacy,
  type PlanStepId,
  type PlanTripDraft,
} from "@/lib/planTripDraft";
import type { PlacesDraftItem } from "@/lib/placesDraft";

type Phase = PlanStepId;

const NEW_TRIP_PILLS = [
  "Lake cabin, room for 20",
  "Black Hills, easy drives",
  "Somewhere warm in March",
  "Surprise me",
];

const STARTER: UIMessage = {
  id: "plan-thread-starter",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "I'm WandrAI — I'll help you shape a reunion trip and a destination shortlist your family can vote on.\n\nWho's coming, and roughly how many people?",
    },
  ],
};

function asUIMessages(raw: PlanDraftPayload["messages"]): UIMessage[] {
  if (!raw?.length) return [STARTER];
  return raw.map((m) => ({
    id: String(m.id),
    role: m.role as UIMessage["role"],
    parts: (m.parts as UIMessage["parts"]) ?? [{ type: "text", text: "" }],
  }));
}

function dividerMessage(step: Phase): UIMessage {
  const label =
    step === "places" ? "Destinations" : step === "survey" ? "Survey" : "Basics";
  return {
    id: `divider-${step}-${Date.now()}`,
    role: "assistant",
    parts: [{ type: "text", text: `—— ${label} ——` }],
  };
}

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
  const [trip, setTrip] = useState<PlanTripDraft>(() =>
    planTripDraftFromLegacy(initialPayload),
  );
  const [unchecked, setUnchecked] = useState<Record<string, true>>({});
  const [draftText, setDraftText] = useState("");
  const [landingHint, setLandingHint] = useState<string | null>(null);
  const [landingDone, setLandingDone] = useState(
    () => Boolean(initialPayload.messages?.length) || Boolean(initialPayload.name),
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const capped = !signedIn && isMessageCapped(messageCount);
  const remaining = messagesRemaining(messageCount);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/plan/chat",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            messages,
            step: phaseRef.current,
            mode: phaseRef.current === "places" ? "places" : "create",
          },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, error, clearError, setMessages } =
    useChat({
      transport,
      id: "plan-thread",
      messages: asUIMessages(initialPayload.messages),
    });

  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const streamingAssistant =
    busy && lastMessage?.role === "assistant" ? lastMessage.id : null;

  const shortlist: PlacesDraftItem[] = (trip.shortlist ?? []).map((p) => ({
    ...p,
    selected: !unchecked[p.title.trim().toLowerCase()],
  }));

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingAssistant]);

  // Persist thread when idle (trip state is owned by extractor / patch actions)
  useEffect(() => {
    if (status !== "ready") return;
    if (messages.length === 0) return;
    startTransition(async () => {
      await savePlanDraftPayloadAction({
        messages: messages as PlanDraftPayload["messages"],
        step: phase === "create" ? "create" : phase,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist on ready only
  }, [status]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (busy || pending) return;
    if (!aiEnabled) {
      setLandingHint("AI planning is unavailable right now — check the Anthropic API key.");
      return;
    }
    if (capped) {
      setLandingHint("Free messages used — sign in to save and keep planning.");
      return;
    }
    if (!trimmed) {
      setLandingHint("Describe your reunion to start planning.");
      focusBlockingField("#new-trip-prompt, #plan-thread-composer");
      return;
    }
    setLandingHint(null);
    setDraftText("");
    setLandingDone(true);
    setMessageCount((c) => c + 1);
    await sendMessage({ text: trimmed });
  }

  const composerBlockedReason = !aiEnabled
    ? "AI planning is unavailable right now — check the Anthropic API key."
    : capped
      ? "Free messages used — sign in to save and keep planning."
      : null;

  function goToStep(next: Phase) {
    if (next === phase) return;
    const divider = dividerMessage(next);
    const alreadyHasDivider = messages.some(
      (m) => m.id.startsWith(`divider-${next}`) || m.id === divider.id,
    );
    const nextMessages = alreadyHasDivider ? messages : [...messages, divider];
    setMessages(nextMessages);
    setPhase(next);

    startTransition(async () => {
      await savePlanDraftPayloadAction({
        messages: nextMessages as PlanDraftPayload["messages"],
        trip,
        step: next === "create" ? "create" : next,
      });
    });

    // Destinations with nothing missing: produce shortlist immediately (no questions)
    if (next === "places" && aiEnabled && !capped) {
      void sendMessage({ text: "⟦advance:places⟧" });
    }
  }

  function goSurvey(places?: PlacesDraftItem[]) {
    const selected =
      places?.filter((p) => p.selected !== false) ??
      shortlist.filter((p) => p.selected !== false);
    const nextTrip: PlanTripDraft = {
      ...trip,
      shortlist: selected.length ? selected : trip.shortlist,
    };
    setTrip(nextTrip);
    const divider = dividerMessage("survey");
    const nextMessages = [...messages, divider];
    setMessages(nextMessages);
    setPhase("survey");
    startTransition(async () => {
      await savePlanDraftPayloadAction({
        trip: nextTrip,
        messages: nextMessages as PlanDraftPayload["messages"],
        step: "survey",
        locationTitles: selected.map((p) => ({
          title: p.title,
          summary: p.summary,
        })),
      });
    });
  }

  const trailStops = [
    {
      id: "create",
      label: "Basics",
      complete: Boolean(trip.tripName) || phase !== "create",
    },
    {
      id: "places",
      label: "Destinations",
      complete: (trip.shortlist?.length ?? 0) > 0 || phase === "survey",
    },
    { id: "survey", label: "Survey", complete: false },
  ];

  const basicsReady = missingFieldsForStep(trip, "create").length === 0;
  const showLanding = phase === "create" && !landingDone && messages.length <= 1;

  const draftLocations = useMemo(() => {
    if (trip.shortlist?.length) {
      return trip.shortlist.map((p) => ({
        id: p.title,
        title: p.title,
        summary: p.summary,
      }));
    }
    return (initialPayload.locationTitles ?? []).map((p) => ({
      id: p.title,
      title: p.title,
      summary: p.summary,
    }));
  }, [trip.shortlist, initialPayload.locationTitles]);

  if (showLanding) {
    return (
      <div className="plan-page plan-page--new-trip">
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
              disabled={pending || Boolean(composerBlockedReason)}
              placeholder="A relaxed lake weekend within 4 hours of Sioux Falls, room for the grandkids…"
              onChange={(e) => {
                setLandingHint(null);
                setDraftText(e.target.value);
              }}
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
                disabled={pending || Boolean(composerBlockedReason)}
                onClick={() => void send(draftText)}
              >
                Start planning →
              </button>
              <button
                type="button"
                className="new-trip-send"
                aria-label="Start planning"
                disabled={pending || Boolean(composerBlockedReason)}
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
            <CtaRequirementHint>
              {composerBlockedReason ?? landingHint}
            </CtaRequirementHint>
          </div>
          <div className="new-trip-suggestions" role="group" aria-label="Starting points">
            {NEW_TRIP_PILLS.map((pill) => (
              <button
                key={pill}
                type="button"
                className="new-trip-suggestion"
                disabled={pending || Boolean(composerBlockedReason)}
                onClick={() => {
                  setLandingHint(null);
                  setDraftText(pill);
                }}
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
      </div>
    );
  }

  return (
    <div className="plan-page plan-page--trail">
      <TrailMap
        stops={trailStops}
        activeId={phase}
        onSelect={(id) => {
          if (id === "create" || id === "places" || id === "survey") {
            if (id === "places" && !basicsReady && phase === "create") return;
            goToStep(id);
          }
        }}
      />

      <header className="plan-workspace-head">
        <div>
          <h1 className="plan-workspace-title">
            {phase === "places"
              ? "Places"
              : phase === "survey"
                ? "Ask the family"
                : "Basics"}
          </h1>
          <p className="plan-workspace-lede">
            {phase === "places"
              ? "One shortlist for the family survey — built from what you already shared."
              : phase === "survey"
                ? "Six questions, two minutes. You'll see answers land here once you send."
                : "One conversation. Edits happen in the draft, not by re-asking."}
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

      {errorCode === "expired" ? (
        <p className="error-banner">Your draft expired. Let&apos;s start fresh.</p>
      ) : null}
      {errorCode === "needs_name" ? (
        <p className="error-banner">Add a trip name with WandrAI before saving.</p>
      ) : null}
      {!aiEnabled ? (
        <p className="error-banner">AI planning needs an API key on the server.</p>
      ) : null}
      {error ? (
        <div className="error-banner">
          {error.message}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => clearError()}>
            Dismiss
          </button>
        </div>
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
      ) : (
        <section
          className={
            shortlist.length > 0 && phase === "places"
              ? "plan-places plan-places--trail"
              : "plan-panel"
          }
        >
          <div
            className={
              shortlist.length > 0 && phase === "places"
                ? "dest-split"
                : "plan-panel-grid plan-panel-grid--solo"
            }
          >
            <div className="plan-chat-with-draft">
              <div className="plan-chat-pane plan-chat-pane--rich">
                <div className="plan-chat-scroll" ref={scrollRef}>
                  {messages.map((m) => (
                    <ChatBubble
                      key={m.id}
                      message={m}
                      streaming={m.id === streamingAssistant}
                    />
                  ))}
                </div>
                <ChatComposer
                  id="plan-thread-composer"
                  placeholder="Answer in your own words…"
                  value={draftText}
                  busy={busy || pending}
                  blockedReason={composerBlockedReason}
                  compact
                  onChange={setDraftText}
                  onSubmit={() => void send(draftText)}
                />
                {phase === "create" && basicsReady ? (
                  <div className="plan-draft-bar">
                    <div className="plan-draft-bar-main">
                      <span className="plan-draft-bar-label">Basics ready</span>
                      <strong>{trip.tripName}</strong>
                    </div>
                    <div className="plan-draft-actions action-pair">
                      <button
                        type="button"
                        className="btn btn-berry btn-sm"
                        disabled={pending || busy}
                        onClick={() => goToStep("places")}
                      >
                        Find destinations →
                      </button>
                    </div>
                  </div>
                ) : null}
                {phase === "places" && shortlist.length > 0 ? (
                  <div className="plan-draft-bar">
                    <div className="plan-draft-actions action-pair">
                      <button
                        type="button"
                        className="btn btn-berry btn-sm"
                        disabled={pending}
                        onClick={() => goSurvey(shortlist)}
                      >
                        Continue to survey →
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm action-pair-secondary"
                        onClick={() => goToStep("create")}
                      >
                        Back to basics
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <TripDraftPanel draft={trip} onChange={setTrip} />
            </div>

            {phase === "places" && shortlist.length > 0 ? (
              <LiveShortlist
                places={shortlist}
                onToggle={(title) => {
                  const key = title.trim().toLowerCase();
                  setUnchecked((prev) => {
                    const next = { ...prev };
                    if (next[key]) delete next[key];
                    else next[key] = true;
                    return next;
                  });
                }}
                onConfirm={() => goSurvey(shortlist)}
                confirmBusy={pending}
                onDifferentIdeas={() => void send("Show me different ideas")}
              />
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
