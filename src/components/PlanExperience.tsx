"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";

import {
  beginSavePlanDraftAction,
  patchPlanTripDraftAction,
  savePlanDraftPayloadAction,
} from "@/app/actions/planDraft";
import { ChatBubble } from "@/components/ChatBubble";
import { ChatComposer } from "@/components/ChatComposer";
import { CtaRequirementHint } from "@/components/CtaRequirementHint";
import { HubSurveyComposer } from "@/components/HubSurveyComposer";
import { LiveShortlist } from "@/components/LiveShortlist";
import { TrailMap } from "@/components/TrailMap";
import { TripDraftPanel } from "@/components/TripDraftPanel";
import { browsePlacesSubtitle } from "@/lib/browseHandoff";
import { focusBlockingField } from "@/lib/formFocus";
import {
  isMessageCapped,
  messagesRemaining,
  type PlanDraftPayload,
} from "@/lib/planDraft";
import {
  applyScaleInference,
  isDuoScale,
  planCapabilities,
  resolvePlanScale,
} from "@/lib/planMode";
import { planFlowSteps } from "@/lib/planSteps";
import {
  missingFieldsForStep,
  normalizePlanTripDraft,
  planTripDraftFromLegacy,
  type PlanStepId,
  type PlanTripDraft,
} from "@/lib/planTripDraft";
import type { PlacesDraftItem } from "@/lib/placesDraft";

type Phase = PlanStepId;

const NEW_TRIP_PILLS = [
  "Lake cabin weekend",
  "Black Hills, easy drives",
  "Somewhere warm in March",
  "Surprise me",
];

function starterMessage(): UIMessage {
  return {
    id: "plan-thread-starter",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "I'm WandrAI — tell me what you're planning and I'll help shape it.",
      },
    ],
  };
}

function asUIMessages(raw: PlanDraftPayload["messages"]): UIMessage[] {
  if (!raw?.length) return [starterMessage()];
  return raw.map((m) => ({
    id: String(m.id),
    role: m.role as UIMessage["role"],
    parts: (m.parts as UIMessage["parts"]) ?? [{ type: "text", text: "" }],
  }));
}

function dividerMessage(step: Phase, placesLabel: string): UIMessage {
  const label =
    step === "places"
      ? placesLabel
      : step === "survey"
        ? "Ask the family"
        : "Basics";
  return {
    id: `divider-${step}-${Date.now()}`,
    role: "assistant",
    parts: [{ type: "text", text: `—— ${label} ——` }],
  };
}

function duoShareHref(shortlist: PlacesDraftItem[], partnerName?: string): string {
  const titles = shortlist
    .filter((p) => p.selected !== false)
    .map((p) => p.title)
    .slice(0, 3);
  const body = [
    partnerName ? `Hey ${partnerName} —` : "Hey —",
    "Pick one of these for our weekend:",
    ...titles.map((t, i) => `${i + 1}. ${t}`),
    "",
    "Reply with 1, 2, or 3.",
  ].join("\n");
  return `mailto:?subject=${encodeURIComponent("Pick one for our weekend")}&body=${encodeURIComponent(body)}`;
}

export function PlanExperience({
  initialPayload,
  initialMessageCount,
  aiEnabled,
  errorCode,
  signedIn = false,
  activeTrip,
}: {
  initialPayload: PlanDraftPayload;
  initialMessageCount: number;
  aiEnabled: boolean;
  errorCode?: string;
  signedIn?: boolean;
  activeTrip?: { name: string; href: string } | null;
}) {
  const [trip, setTrip] = useState<PlanTripDraft>(() =>
    planTripDraftFromLegacy(initialPayload),
  );

  const capabilities = useMemo(
    () =>
      planCapabilities({
        householdCount: trip.householdCount ?? 1,
        headcount: trip.headcount,
      }),
    [trip.householdCount, trip.headcount],
  );

  const scale = useMemo(
    () =>
      resolvePlanScale({
        householdCount: trip.householdCount,
        headcount: trip.headcount,
      }),
    [trip.householdCount, trip.headcount],
  );

  const browseSeed = initialPayload.browseSeed;
  const shortlistKind = browseSeed?.kind ?? "places";
  const placesStepLabel = shortlistKind === "ideas" ? "Ideas" : "Places";
  const shortlistHeader =
    shortlistKind === "ideas" ? "Your picks" : "Live shortlist";
  const fromBrowse = Boolean(browseSeed);

  const flowSteps = useMemo(
    () =>
      planFlowSteps(capabilities).map((s) =>
        s.id === "places" ? { ...s, label: placesStepLabel } : s,
      ),
    [capabilities, placesStepLabel],
  );

  const initialPhase = ((): Phase => {
    const step = initialPayload.step;
    if (step === "survey" && !capabilities.survey) return "places";
    if (step === "places" || step === "survey") return step;
    if (step === "save") return capabilities.survey ? "survey" : "places";
    return "create";
  })();

  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [messageCount, setMessageCount] = useState(initialMessageCount);
  const [pending, startTransition] = useTransition();
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
  const showQuota = !signedIn && remaining <= 5;
  const quotaLabel = showQuota
    ? capped
      ? "Free messages used — save to keep planning"
      : `${remaining} free messages left`
    : null;
  const duo = isDuoScale({
    householdCount: trip.householdCount ?? 1,
    headcount: trip.headcount,
  });
  const partnerName = browseSeed?.partnerName?.trim() || undefined;

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

  function scrollMessagesToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  useEffect(() => {
    scrollMessagesToBottom();
  }, [messages, streamingAssistant]);

  useEffect(() => {
    if (status !== "ready") return;
    if (messages.length === 0) return;
    startTransition(async () => {
      await savePlanDraftPayloadAction({
        messages: messages as PlanDraftPayload["messages"],
        step: phase === "create" ? "create" : phase,
        trip,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist on ready only
  }, [status]);

  // Drop survey phase if capability turns off (e.g. household count edited down)
  useEffect(() => {
    if (!capabilities.survey && phase === "survey") {
      setPhase("places");
    }
  }, [capabilities.survey, phase]);

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
      setLandingHint("Describe what you’re planning to get started.");
      focusBlockingField("#new-trip-prompt, #plan-thread-composer");
      return;
    }

    // R3: apply scale immediately on the client so the next UI turn is correct
    const nextTrip = normalizePlanTripDraft(applyScaleInference(trip, trimmed));
    if (
      nextTrip.householdCount !== trip.householdCount ||
      nextTrip.headcount !== trip.headcount
    ) {
      setTrip(nextTrip);
      startTransition(async () => {
        try {
          await patchPlanTripDraftAction({
            householdCount: nextTrip.householdCount,
            headcount: nextTrip.headcount,
          });
        } catch {
          /* server path also applies inference */
        }
      });
    }

    setLandingHint(null);
    setDraftText("");
    setLandingDone(true);
    setMessageCount((c) => c + 1);
    await sendMessage({ text: trimmed });
    requestAnimationFrame(() => scrollMessagesToBottom());
  }

  const composerBlockedReason = !aiEnabled
    ? "AI planning is unavailable right now — check the Anthropic API key."
    : capped
      ? "Free messages used — sign in to save and keep planning."
      : null;

  function goToStep(next: Phase) {
    if (next === "survey" && !capabilities.survey) return;
    if (next === phase) return;
    const divider = dividerMessage(next, placesStepLabel);
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

    if (next === "places" && aiEnabled && !capped) {
      void sendMessage({ text: "⟦advance:places⟧" });
    }
  }

  function goSurvey(places?: PlacesDraftItem[]) {
    if (!capabilities.survey) return;
    const selected =
      places?.filter((p) => p.selected !== false) ??
      shortlist.filter((p) => p.selected !== false);
    const nextTrip: PlanTripDraft = {
      ...trip,
      shortlist: selected.length ? selected : trip.shortlist,
    };
    setTrip(nextTrip);
    const divider = dividerMessage("survey", placesStepLabel);
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

  function buildPlan(places?: PlacesDraftItem[]) {
    const selected =
      places?.filter((p) => p.selected !== false) ??
      shortlist.filter((p) => p.selected !== false);
    const nextTrip: PlanTripDraft = {
      ...trip,
      shortlist: selected.length ? selected : trip.shortlist,
    };
    setTrip(nextTrip);
    startTransition(async () => {
      await beginSavePlanDraftAction({
        trip: nextTrip,
        messages: messages as PlanDraftPayload["messages"],
        step: "save",
        locationTitles: selected.map((p) => ({
          title: p.title,
          summary: p.summary,
        })),
      });
    });
  }

  const trailStops = flowSteps.map((s) => ({
    id: s.id,
    label: s.label,
    complete:
      s.id === "create"
        ? Boolean(trip.tripName) || phase !== "create"
        : s.id === "places"
          ? (trip.shortlist?.length ?? 0) > 0 || phase === "survey"
          : false,
  }));

  const basicsReady = missingFieldsForStep(trip, "create").filter((k) => {
    if ((scale === "solo" || scale === "duo") && k === "householdCount") return false;
    return true;
  }).length === 0;
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

  const placesLede = fromBrowse
    ? browsePlacesSubtitle(
        browseSeed?.count ?? (shortlist.length || 3),
        shortlistKind,
      )
    : capabilities.survey
      ? "Build a shortlist, then send it to the family — or decide yourself."
      : "Refine your shortlist, then build the plan.";

  const contextPills = [
    trip.dateWindow ? { key: "dates", label: trip.dateWindow } : null,
    trip.householdCount != null && scale === "group"
      ? {
          key: "hh",
          label: `${trip.householdCount} household${trip.householdCount === 1 ? "" : "s"}`,
        }
      : trip.headcount != null
        ? {
            key: "hc",
            label: `${trip.headcount} ${trip.headcount === 1 ? "person" : "people"}`,
          }
        : null,
    trip.originMetro ? { key: "origin", label: `From ${trip.originMetro}` } : null,
  ].filter(Boolean) as { key: string; label: string }[];

  if (showLanding) {
    return (
      <div className="plan-page plan-page--new-trip">
        {activeTrip ? (
          <a className="plan-active-trip-card" href={activeTrip.href}>
            <span className="plan-active-trip-label">Active trip</span>
            <strong className="plan-active-trip-name">{activeTrip.name}</strong>
            <span className="plan-active-trip-cta">Open →</span>
          </a>
        ) : null}
        <section className="new-trip" aria-labelledby="new-trip-heading">
          <p className="new-trip-eyebrow">New trip</p>
          <h1 id="new-trip-heading" className="new-trip-title">
            What are we planning?
          </h1>
          <p className="new-trip-lede">
            Describe it however you like. I&apos;ll ask a few questions, then help
            you shape a shortlist.
          </p>
          <div className="new-trip-composer">
            <label className="sr-only" htmlFor="new-trip-prompt">
              What are we planning?
            </label>
            <textarea
              id="new-trip-prompt"
              className="new-trip-textarea"
              rows={3}
              value={draftText}
              disabled={pending || Boolean(composerBlockedReason)}
              placeholder="A date night, a lake weekend, a trip with friends…"
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
              {contextPills.length > 0 ? (
                <div className="new-trip-context" aria-label="Trip context">
                  {contextPills.map((p) => (
                    <span key={p.key} className="new-trip-pill">
                      {p.label}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="new-trip-context-spacer" aria-hidden />
              )}
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
            <div className="chat-composer-footer">
              <CtaRequirementHint>
                {composerBlockedReason ?? landingHint}
              </CtaRequirementHint>
              {quotaLabel ? (
                <p className="chat-composer-quota" aria-live="polite">
                  {quotaLabel}
                </p>
              ) : null}
            </div>
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
        </section>
      </div>
    );
  }

  return (
    <div className="plan-page plan-page--trail plan-page--conversation">
      <div className="plan-conversation-chrome">
        {activeTrip ? (
          <a className="plan-active-trip-card" href={activeTrip.href}>
            <span className="plan-active-trip-label">Active trip</span>
            <strong className="plan-active-trip-name">{activeTrip.name}</strong>
            <span className="plan-active-trip-cta">Open →</span>
          </a>
        ) : null}
        <TrailMap stops={trailStops} activeId={phase} />

        <header className="plan-workspace-head">
          <div>
            <h1 className="plan-workspace-title">
              {phase === "places"
                ? placesStepLabel
                : phase === "survey"
                  ? "Ask the family"
                  : "Basics"}
            </h1>
            <p className="plan-workspace-lede plan-workspace-lede--desktop">
              {phase === "places"
                ? placesLede
                : phase === "survey"
                  ? "Six questions, two minutes. You'll see answers land here once you send."
                  : "Edits live in the draft beside the chat."}
            </p>
          </div>
        </header>
      </div>

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

      {phase === "survey" && capabilities.survey ? (
        <section className="plan-panel plan-conversation-body">
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
              ? "plan-places plan-places--trail plan-conversation-body"
              : "plan-panel plan-conversation-body"
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
              <div className="plan-chat-pane plan-chat-pane--rich plan-chat-pane--column">
                <div className="plan-chat-scroll" ref={scrollRef}>
                  {messages.map((m) => (
                    <ChatBubble
                      key={m.id}
                      message={m}
                      streaming={m.id === streamingAssistant}
                    />
                  ))}
                </div>
                <div className="plan-composer-dock">
                  <ChatComposer
                    id="plan-thread-composer"
                    placeholder="Answer in your own words…"
                    value={draftText}
                    busy={busy || pending}
                    blockedReason={composerBlockedReason}
                    compact
                    quotaLabel={quotaLabel}
                    onFocusMessagesScroll={scrollMessagesToBottom}
                    onChange={setDraftText}
                    onSubmit={() => void send(draftText)}
                  />
                  {phase === "create" && basicsReady ? (
                    <div className="plan-draft-bar">
                      <div className="plan-draft-bar-main">
                        <span className="plan-draft-bar-label">Basics ready</span>
                        <strong>{trip.tripName || "Name this later"}</strong>
                      </div>
                      <div className="plan-draft-actions action-pair">
                        <button
                          type="button"
                          className="btn btn-berry btn-sm"
                          disabled={pending || busy}
                          onClick={() => goToStep("places")}
                        >
                          Find {shortlistKind === "ideas" ? "ideas" : "destinations"} →
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {phase === "places" && shortlist.length > 0 ? (
                    <div className="plan-draft-bar">
                      {capabilities.survey ? (
                        <>
                          <div className="plan-equal-doors action-pair">
                            <button
                              type="button"
                              className="btn btn-berry btn-sm"
                              onClick={() => goSurvey(shortlist)}
                            >
                              Send these to the family
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm plan-equal-door-secondary"
                              onClick={() => buildPlan(shortlist)}
                            >
                              I&apos;ll just decide
                            </button>
                          </div>
                          <p className="plan-equal-doors-hint">
                            You don&apos;t have to ask anyone. Deciding now is faster.
                          </p>
                        </>
                      ) : (
                        <div className="plan-draft-actions action-pair">
                          <button
                            type="button"
                            className="btn btn-berry btn-sm"
                            onClick={() => buildPlan(shortlist)}
                          >
                            Build the plan →
                          </button>
                          {duo ? (
                            <a
                              className="btn btn-secondary btn-sm plan-equal-door-secondary"
                              href={duoShareHref(shortlist, partnerName)}
                            >
                              {partnerName
                                ? `Send these to ${partnerName}`
                                : "Send these to a friend"}
                            </a>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm action-pair-secondary"
                            onClick={() => goToStep("create")}
                          >
                            Back to basics
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              <TripDraftPanel
                draft={trip}
                onChange={setTrip}
                showEmptyTripNamePlaceholder
              />
            </div>

            {phase === "places" && shortlist.length > 0 ? (
              <LiveShortlist
                places={shortlist}
                title={shortlistHeader}
                onToggle={(title) => {
                  const key = title.trim().toLowerCase();
                  setUnchecked((prev) => {
                    const next = { ...prev };
                    if (next[key]) delete next[key];
                    else next[key] = true;
                    return next;
                  });
                }}
                onConfirm={() =>
                  capabilities.survey ? goSurvey(shortlist) : buildPlan(shortlist)
                }
                confirmLabel={
                  capabilities.survey ? undefined : "Build the plan →"
                }
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
