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
import { DraftTray } from "@/components/DraftTray";
import { HubSurveyComposer } from "@/components/HubSurveyComposer";
import { LiveShortlist } from "@/components/LiveShortlist";
import { Orb } from "@/components/Orb";
import {
  ThinkingPanel,
  labelForThinkingEvent,
  type ThinkingStep,
} from "@/components/ThinkingPanel";
import { browsePlacesSubtitle } from "@/lib/browseHandoff";
import {
  isMessageCapped,
  messagesRemaining,
  type PlanDraftPayload,
} from "@/lib/planDraft";
import {
  applyScaleInference,
  deriveMode,
  isDuoScale,
  modeChangeLine,
  planCapabilities,
  stepEyebrow,
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

function starterMessage(): UIMessage {
  return {
    id: "plan-thread-starter",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Tell me what you're planning — dates, who, vibe — however it comes out.",
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
  seedMessage = null,
}: {
  initialPayload: PlanDraftPayload;
  initialMessageCount: number;
  aiEnabled: boolean;
  errorCode?: string;
  signedIn?: boolean;
  activeTrip?: { name: string; href: string } | null;
  seedMessage?: string | null;
}) {
  const [trip, setTrip] = useState<PlanTripDraft>(() =>
    planTripDraftFromLegacy(initialPayload),
  );
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [showNewPill, setShowNewPill] = useState(false);
  const nearBottomRef = useRef(true);
  const seedSentRef = useRef(false);
  const prevModeRef = useRef(deriveMode(trip));

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
      deriveMode({
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
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
      onData: (part) => {
        // Real pipeline events from createUIMessageStream (transient)
        if (part.type === "data-thinking") {
          const event =
            part.data &&
            typeof part.data === "object" &&
            "event" in part.data
              ? String((part.data as { event: string }).event)
              : "";
          if (!event) return;
          setThinkingSteps((prev) => {
            const done = prev.map((s) => ({ ...s, status: "done" as const }));
            if (done.some((s) => s.id === event)) return done;
            return [
              ...done,
              {
                id: event,
                label: labelForThinkingEvent(event),
                status: "active" as const,
              },
            ];
          });
          return;
        }
        if (part.type === "data-draft") {
          const nextTrip =
            part.data &&
            typeof part.data === "object" &&
            "trip" in part.data
              ? (part.data as { trip: PlanTripDraft }).trip
              : null;
          if (nextTrip) {
            setTrip(normalizePlanTripDraft(nextTrip));
          }
        }
      },
    });

  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];

  function textFromParts(m: UIMessage | undefined): string {
    if (!m?.parts) return "";
    return m.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("")
      .trim();
  }

  const streamingAssistant =
    status === "streaming" && lastMessage?.role === "assistant"
      ? lastMessage.id
      : null;
  const firstTokenArrived =
    Boolean(streamingAssistant) && Boolean(textFromParts(lastMessage));
  // §1c — panel replaced by first streamed token
  const showThinking =
    !firstTokenArrived &&
    (status === "submitted" || status === "streaming") &&
    thinkingSteps.length > 0;

  const shortlist: PlacesDraftItem[] = (trip.shortlist ?? []).map((p) => ({
    ...p,
    selected: !unchecked[p.title.trim().toLowerCase()],
  }));

  function scrollMessagesToBottom(force = false) {
    const el = scrollRef.current;
    if (!el) return;
    if (!force && !nearBottomRef.current) {
      setShowNewPill(true);
      return;
    }
    el.scrollTop = el.scrollHeight;
    setShowNewPill(false);
  }

  function onMessagesScroll() {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (nearBottomRef.current) setShowNewPill(false);
  }

  useEffect(() => {
    scrollMessagesToBottom();
  }, [messages, streamingAssistant, thinkingSteps]);

  // Clear thinking when stream ends or first token arrives
  useEffect(() => {
    if (firstTokenArrived || status === "ready" || status === "error") {
      setThinkingSteps([]);
    }
  }, [firstTokenArrived, status]);

  // Mode-change announcement
  useEffect(() => {
    if (scale === "unresolved") return;
    const prev = prevModeRef.current;
    const line = modeChangeLine(prev, scale);
    prevModeRef.current = scale;
    if (line) {
      setMessages((msgs) => [
        ...msgs,
        {
          id: `mode-change-${Date.now()}`,
          role: "assistant",
          parts: [{ type: "text", text: line }],
        },
      ]);
    }
  }, [scale, setMessages]);

  // visualViewport → shell height (iOS keyboard)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function sync() {
      const el = shellRef.current;
      if (!el || !vv) return;
      el.style.height = `${vv.height}px`;
    }
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  // §5 seed from home — optimistic user bubble already intended via send
  useEffect(() => {
    if (seedSentRef.current) return;
    let seed = seedMessage?.trim() || null;
    if (!seed) {
      try {
        const raw = sessionStorage.getItem("wa-pending-message");
        if (raw) {
          const parsed = JSON.parse(raw) as { text?: string; at?: number };
          if (parsed.text && Date.now() - (parsed.at ?? 0) < 60_000) {
            seed = parsed.text.trim();
          }
          sessionStorage.removeItem("wa-pending-message");
        }
      } catch {
        /* ignore */
      }
    }
    if (!seed || !aiEnabled || capped) return;
    seedSentRef.current = true;
    void send(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setLandingHint(
        "AI planning is unavailable right now — check the Anthropic API key.",
      );
      return;
    }
    if (capped) {
      setLandingHint("Free messages used — sign in to save and keep planning.");
      return;
    }
    if (!trimmed) return;

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
    setMessageCount((c) => c + 1);
    nearBottomRef.current = true;
    await sendMessage({ text: trimmed });
    requestAnimationFrame(() => scrollMessagesToBottom(true));
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
  void trailStops;

  const basicsReady = missingFieldsForStep(trip, "create").filter((k) => {
    if ((scale === "solo" || scale === "duo") && k === "householdCount") return false;
    if (scale === "small" && k === "householdCount") return false;
    return true;
  }).length === 0;

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
      ? "Build a shortlist, then send it — or decide yourself."
      : "Refine your shortlist, then build the plan.";

  const draftChips = [
    trip.dateWindow
      ? { key: "dateWindow", label: trip.dateWindow, value: trip.dateWindow }
      : null,
    trip.headcount != null
      ? {
          key: "headcount",
          label:
            trip.headcount === 2
              ? "Just the two of you"
              : `${trip.headcount} people`,
          value: String(trip.headcount),
        }
      : null,
    trip.originMetro
      ? {
          key: "originMetro",
          label: `From ${trip.originMetro}`,
          value: trip.originMetro,
        }
      : null,
    trip.tripName
      ? { key: "tripName", label: trip.tripName, value: trip.tripName }
      : null,
  ].filter(Boolean) as { key: string; label: string; value?: string }[];

  function commitChip(key: string, value: string) {
    const patch: PlanTripDraft = {};
    if (key === "headcount") {
      const n = Number(value.replace(/\D/g, ""));
      if (!Number.isFinite(n) || n <= 0) return;
      patch.headcount = n;
      if (n === 2) patch.householdCount = 1;
    } else if (key === "dateWindow") {
      patch.dateWindow = value;
    } else if (key === "originMetro") {
      patch.originMetro = value.replace(/^From\s+/i, "").trim();
    } else if (key === "tripName") {
      patch.tripName = value;
    } else {
      return;
    }
    const nextTrip = normalizePlanTripDraft({ ...trip, ...patch });
    setTrip(nextTrip);
    startTransition(async () => {
      try {
        await patchPlanTripDraftAction(patch);
      } catch {
        /* ignore */
      }
    });
  }

  const headerTitle =
    trip.tripName?.trim() ||
    (trip.dateWindow ? `Trip, ${trip.dateWindow}` : "New plan");
  const headerSub =
    scale === "duo"
      ? "Just the two of you"
      : scale === "solo"
        ? "Just you"
        : scale === "small"
          ? "A small group"
          : scale === "group"
            ? "The whole group"
            : stepEyebrow(
                phase === "create" ? 1 : phase === "places" ? 2 : 3,
                capabilities,
              );

  return (
    <div className="wa-chat-shell plan-page plan-page--conversation" ref={shellRef}>
      <header className="wa-chat-header">
        {(busy || showThinking) ? (
          <Orb state="thinking" size="sm" />
        ) : (
          <Orb state="idle" size="sm" />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "14.5px",
              fontWeight: 500,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {headerTitle}
          </div>
          <div
            className="wa-msg-enter"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9.5px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--faint)",
            }}
          >
            {headerSub}
          </div>
        </div>
        {activeTrip ? (
          <a
            href={activeTrip.href}
            style={{ fontSize: "12.5px", color: "var(--link)", flexShrink: 0 }}
          >
            Open trip
          </a>
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
          Couldn&apos;t reach me just now.{" "}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => clearError()}>
            Try again
          </button>
        </div>
      ) : null}
      {landingHint ? <p className="error-banner">{landingHint}</p> : null}

      {phase === "survey" && capabilities.survey ? (
        <div className="wa-chat-messages">
          <HubSurveyComposer
            signedIn={signedIn}
            locations={draftLocations}
            initialPrefs={initialPayload.surveyPrefs}
            initialWeekends={initialPayload.surveyPrefs?.proposedWeekends ?? []}
            planDraftMode
          />
        </div>
      ) : (
        <>
          <div
            className="wa-chat-messages"
            ref={scrollRef}
            onScroll={onMessagesScroll}
          >
            {messages.map((m) => (
              <ChatBubble
                key={m.id}
                message={m}
                streaming={m.id === streamingAssistant && !showThinking}
              />
            ))}
            {showThinking && thinkingSteps.length > 0 ? (
              <ThinkingPanel steps={thinkingSteps} />
            ) : null}

            {phase === "places" && shortlist.length > 0 ? (
              <div style={{ marginTop: 18 }}>
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
                <p className="wa-count-line" style={{ marginTop: 8 }}>
                  {placesLede}
                </p>
              </div>
            ) : null}
          </div>

          <DraftTray chips={draftChips} onCommit={commitChip} />

          <div className="wa-composer-wrap">
            {showNewPill ? (
              <button
                type="button"
                className="wa-new-pill"
                onClick={() => scrollMessagesToBottom(true)}
              >
                ↓ New
              </button>
            ) : null}
            <ChatComposer
              id="plan-thread-composer"
              placeholder="Answer in your own words…"
              value={draftText}
              busy={busy || pending}
              blockedReason={composerBlockedReason}
              compact
              quotaLabel={quotaLabel}
              onFocusMessagesScroll={() => scrollMessagesToBottom(true)}
              onChange={setDraftText}
              onSubmit={() => void send(draftText)}
            />
            {phase === "create" && basicsReady ? (
              <div className="plan-draft-bar" style={{ margin: "0 14px 11px" }}>
                <div className="plan-draft-bar-main">
                  <span className="plan-draft-bar-label">Basics ready</span>
                  <strong>{trip.tripName || "Name this later"}</strong>
                </div>
                <div className="plan-draft-actions action-pair">
                  <button
                    type="button"
                    className="btn btn-berry btn-sm"
                    onClick={() => goToStep("places")}
                  >
                    Find {shortlistKind === "ideas" ? "ideas" : "destinations"} →
                  </button>
                </div>
              </div>
            ) : null}
            {phase === "places" && shortlist.length > 0 ? (
              <div className="plan-draft-bar" style={{ margin: "0 14px 11px" }}>
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
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
