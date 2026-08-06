"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { startPlanFromBrowseAction } from "@/app/actions/browse";
import { BrowseTabBar } from "@/components/BrowseTabBar";
import { SoftImage } from "@/components/SoftImage";
import { browseGenerateClientTimeoutMs } from "@/lib/browseGenerate";
import {
  BROWSE_DEAL_MORE,
  BROWSE_DECK_SIZE,
  BROWSE_KEEP_TARGET,
  categoryLabel,
  formatBrowseMeta,
  formatCostDollars,
  formatDurationLabel,
  type BrowseIdea,
} from "@/lib/browseIdeas";
import {
  bumpBrowseNight,
  readBrowseArea,
  readBrowseNight,
  readPersistedKept,
  writeBrowseArea,
  writePersistedKept,
  type PersistedKeptIdea,
} from "@/lib/browseLocal";
import { deriveBrowseTags } from "@/lib/browseTags";
import {
  learningLines,
  listLocalSwipes,
  listSkippedTitles,
  recordLocalSwipe,
  undoLocalSwipe,
  type BrowseSwipeEvent,
} from "@/lib/peopleGraph";
import { APP_NAME } from "@/lib/brand";

const COLD_PILLS = [
  "Something for tonight",
  "A cheap Saturday",
  "Surprise me nearby",
];

const TAG_CHIP_LABEL: Record<string, string> = {
  quiet: "quiet",
  lively: "lively",
  outdoors: "outdoors",
  "hands-on": "hands-on",
  "food-forward": "food-forward",
  alcohol: "social",
  spectator: "easygoing",
  physical: "active",
  "kids-friendly": "kids-friendly",
  "at-home": "at home",
  "long-drive": "worth the drive",
  budget: "budget-friendly",
  splurge: "a little splurge",
};

type KeptItem = BrowseIdea & { keptAt: string };

function toPersisted(k: KeptItem): PersistedKeptIdea {
  return {
    id: k.id,
    title: k.title,
    blurb: k.blurb,
    category: k.category,
    estCostUsd: k.estCostUsd,
    durationMins: k.durationMins,
    driveMinutes: k.driveMinutes,
    imageUrl: k.imageUrl,
    keptAt: k.keptAt,
  };
}

function softChipsForIdea(
  idea: BrowseIdea,
  swipeLog: BrowseSwipeEvent[],
): string[] {
  const derived = [
    ...(idea.tags ?? []),
    ...deriveBrowseTags(idea),
  ];
  const keepCounts = new Map<string, number>();
  for (const s of swipeLog) {
    if (s.direction !== "keep") continue;
    for (const t of s.tags) keepCounts.set(t, (keepCounts.get(t) ?? 0) + 1);
  }
  const ranked = [...new Set(derived)].sort(
    (a, b) => (keepCounts.get(b) ?? 0) - (keepCounts.get(a) ?? 0),
  );
  return ranked
    .slice(0, 3)
    .map((t) => TAG_CHIP_LABEL[t] ?? t)
    .filter(Boolean);
}

function sessionSoftChips(swipeLog: BrowseSwipeEvent[]): string[] {
  if (swipeLog.length < 2) return [];
  const keepCounts = new Map<string, number>();
  for (const s of swipeLog) {
    if (s.direction !== "keep") continue;
    for (const t of s.tags) keepCounts.set(t, (keepCounts.get(t) ?? 0) + 1);
  }
  return [...keepCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([t]) => TAG_CHIP_LABEL[t] ?? t);
}

export function BrowseExperience({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [stack, setStack] = useState<BrowseIdea[]>([]);
  const [index, setIndex] = useState(0);
  const [deckSize, setDeckSize] = useState(BROWSE_DECK_SIZE);
  const [promptId, setPromptId] = useState("");
  const [kept, setKept] = useState<KeptItem[]>([]);
  const [skipped, setSkipped] = useState<BrowseIdea[]>([]);
  const [swipeLog, setSwipeLog] = useState<BrowseSwipeEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [thinMessage, setThinMessage] = useState<string | null>(null);
  const [loadUi, setLoadUi] = useState<"idle" | "building" | "ready">("idle");
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);
  const [returning, setReturning] = useState(false);
  const [persistHint, setPersistHint] = useState<string | null>(null);
  const [showOnboardPlan, setShowOnboardPlan] = useState(false);
  const [ceremonyDismissed, setCeremonyDismissed] = useState(false);
  const [nightCount, setNightCount] = useState(1);
  const [areaLabel, setAreaLabel] = useState("Near you");
  const [areaEditing, setAreaEditing] = useState(false);
  const [areaDraft, setAreaDraft] = useState("");
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });
  const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "ready" | "denied">(
    "idle",
  );
  const [pending, startTransition] = useTransition();
  const undoStack = useRef<{ idea: BrowseIdea; direction: "keep" | "skip"; eventId: string }[]>(
    [],
  );
  const pointerStart = useRef<number | null>(null);
  const dragXRef = useRef(0);
  const frontCardRef = useRef<HTMLElement | null>(null);
  const exitingGuard = useRef(false);
  const exitDoneTimer = useRef<number | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const areaInputRef = useRef<HTMLInputElement>(null);

  function prefersReducedMotion() {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function exitDistancePx() {
    if (typeof window === "undefined") return 520;
    return Math.max(window.innerWidth, 360) + 120;
  }

  function applyFrontTransform(x: number, rotateDeg: number, opacity = 1) {
    const el = frontCardRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${x}px, 0, 0) rotate(${rotateDeg}deg)`;
    el.style.opacity = String(opacity);
  }

  function clearExitTimers() {
    if (exitDoneTimer.current != null) {
      window.clearTimeout(exitDoneTimer.current);
      exitDoneTimer.current = null;
    }
  }

  const front = stack[index] ?? null;
  const mid = stack[index + 1] ?? null;
  const back = stack[index + 2] ?? null;
  const exhausted = stack.length > 0 && index >= stack.length;
  const hitKeepTarget = kept.length >= BROWSE_KEEP_TARGET;
  const showCeremony =
    stack.length > 0 &&
    loadUi === "idle" &&
    kept.length > 0 &&
    (exhausted || (hitKeepTarget && !ceremonyDismissed));

  useEffect(() => {
    return () => clearExitTimers();
  }, []);

  useEffect(() => {
    setSwipeLog(listLocalSwipes());
    setNightCount(readBrowseNight());
    const saved = readPersistedKept();
    if (saved.length) {
      // Hydrate kept titles for Saved tab continuity; session kept starts empty until swipe.
    }
    const area = readBrowseArea();
    if (area?.label) {
      setAreaLabel(area.label);
      setCoords({ lat: area.lat, lng: area.lng });
      setGeoStatus("ready");
      return;
    }
    if (!navigator.geolocation) {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        setAreaLabel("Near you");
        writeBrowseArea({ label: "Near you", lat, lng });
        setGeoStatus("ready");
      },
      () => {
        setGeoStatus("denied");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }, []);

  useEffect(() => {
    if (swipeLog.length >= 10 && !signedIn) {
      setShowOnboardPlan(true);
    }
  }, [swipeLog.length, signedIn]);

  useEffect(() => {
    if (loadUi !== "ready") return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = reduced ? 400 : 1200;
    const t = window.setTimeout(() => setLoadUi("idle"), ms);
    return () => window.clearTimeout(t);
  }, [loadUi]);

  useEffect(() => {
    if (!areaEditing) return;
    areaInputRef.current?.focus();
  }, [areaEditing]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!front || loadUi !== "idle" || exiting || showCeremony) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        void commit("skip");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        void commit("keep");
      } else if (e.key === "Backspace") {
        e.preventDefault();
        undo();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  function persistKeptList(next: KeptItem[]) {
    writePersistedKept(next.map(toPersisted));
  }

  async function generate(
    nextPrompt: string,
    opts?: {
      refine?: "cheaper" | "closer" | "weirder";
      count?: number;
      append?: boolean;
    },
  ) {
    const text = nextPrompt.trim();
    if (!text) return;
    setLoadUi("building");
    setError(null);
    setThinMessage(null);
    setPrompt(text);
    setCeremonyDismissed(false);
    try {
      const res = await fetch("/api/browse/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          skippedTitles: listSkippedTitles(),
          refine: opts?.refine,
          count: opts?.count ?? BROWSE_DECK_SIZE,
          lat: coords.lat,
          lng: coords.lng,
          areaLabel: areaLabel === "Near you" ? null : areaLabel,
        }),
        signal: AbortSignal.timeout(browseGenerateClientTimeoutMs()),
      });
      let data: {
        error?: string;
        ideas?: BrowseIdea[];
        promptId?: string;
        thin?: boolean;
        message?: string;
        areaLabel?: string | null;
        lat?: number | null;
        lng?: number | null;
      } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        const timedOut = res.status === 504 || res.status === 408;
        setError(
          data.error ||
            (timedOut
              ? "That took too long — try a shorter prompt, or tap Generate again."
              : "Couldn't build a stack just now."),
        );
        if (!opts?.append) {
          setStack([]);
          setIndex(0);
        }
        setLoadUi("idle");
        return;
      }
      const ideas = data.ideas ?? [];
      if (data.areaLabel) {
        setAreaLabel(data.areaLabel);
        writeBrowseArea({
          label: data.areaLabel,
          lat: data.lat ?? coords.lat,
          lng: data.lng ?? coords.lng,
        });
      }
      if (data.lat != null && data.lng != null) {
        setCoords({ lat: data.lat, lng: data.lng });
      }
      if (opts?.append) {
        setStack((prev) => [...prev, ...ideas]);
        setDeckSize((d) => d + ideas.length);
      } else {
        setStack(ideas);
        setIndex(0);
        setDeckSize(ideas.length || BROWSE_DECK_SIZE);
        undoStack.current = [];
        bumpBrowseNight();
        setNightCount(readBrowseNight());
      }
      setPromptId(data.promptId || crypto.randomUUID());
      if (data.thin) setThinMessage(data.message ?? null);
      setLoadUi(ideas.length > 0 ? "ready" : "idle");
    } catch (err) {
      const timedOut =
        err instanceof DOMException &&
        (err.name === "TimeoutError" || err.name === "AbortError");
      setError(
        timedOut
          ? "That took too long — try a shorter prompt, or tap Generate again."
          : "Couldn't build a stack just now.",
      );
      if (!opts?.append) setStack([]);
      setLoadUi("idle");
    }
  }

  function persistSwipe(idea: BrowseIdea, direction: "keep" | "skip") {
    try {
      const { event } = recordLocalSwipe({
        ideaTitle: idea.title,
        tags: deriveBrowseTags(idea),
        direction,
        promptId: promptId || "local",
      });
      setSwipeLog(listLocalSwipes());
      return event.id;
    } catch {
      setPersistHint("Not saved yet — retrying.");
      return crypto.randomUUID();
    }
  }

  function advanceAfterExit(idea: BrowseIdea, direction: "keep" | "skip") {
    clearExitTimers();
    const eventId = persistSwipe(idea, direction);
    undoStack.current.push({ idea, direction, eventId });
    if (direction === "keep") {
      setKept((k) => {
        const next = [{ ...idea, keptAt: new Date().toISOString() }, ...k];
        persistKeptList(next);
        return next;
      });
    } else {
      setSkipped((s) => [idea, ...s]);
    }
    setIndex((i) => i + 1);
    setExiting(null);
    setReturning(false);
    setDragging(false);
    dragXRef.current = 0;
    exitingGuard.current = false;
    setPersistHint(null);
  }

  function commit(direction: "keep" | "skip") {
    if (!front || exitingGuard.current || showCeremony) return;
    exitingGuard.current = true;
    setDragging(false);
    setReturning(false);
    pointerStart.current = null;

    const idea = front;
    const exitSide = direction === "keep" ? "right" : "left";
    setExiting(exitSide);

    const el = frontCardRef.current;
    const reduced = prefersReducedMotion();
    const fromX = dragXRef.current;
    const fromRot = Math.max(-12, Math.min(12, fromX / 16));
    const dist = exitDistancePx();
    const toX = exitSide === "right" ? dist : -dist;
    const toRot = exitSide === "right" ? 14 : -14;
    const durationMs = reduced ? 120 : 420;

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      if (el) el.removeEventListener("transitionend", onTransitionEnd);
      advanceAfterExit(idea, direction);
    };

    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.target !== el) return;
      const expect = reduced ? "opacity" : "transform";
      if (e.propertyName !== expect) return;
      settle();
    };

    if (el) {
      el.style.transition = "none";
      applyFrontTransform(fromX, fromRot, 1);
      void el.offsetWidth;
      if (reduced) {
        el.style.transition = "opacity 120ms ease";
        applyFrontTransform(fromX, fromRot, 0);
      } else {
        el.style.transition =
          "transform 420ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 360ms ease";
        applyFrontTransform(toX, toRot, 0);
      }
      el.addEventListener("transitionend", onTransitionEnd);
    }

    clearExitTimers();
    exitDoneTimer.current = window.setTimeout(settle, durationMs + 80);
  }

  function undo() {
    const last = undoStack.current.pop();
    if (!last) return;
    undoLocalSwipe(last.eventId);
    setSwipeLog(listLocalSwipes());
    if (last.direction === "keep") {
      setKept((k) => {
        const next = k.filter((x) => x.id !== last.idea.id);
        persistKeptList(next);
        return next;
      });
    } else {
      setSkipped((s) => s.filter((x) => x.id !== last.idea.id));
    }
    setCeremonyDismissed(false);
    setStack((prev) => {
      const next = [...prev];
      next.splice(index, 0, last.idea);
      return next;
    });
  }

  function onPointerDown(clientX: number) {
    if (!front || exitingGuard.current || showCeremony) return;
    pointerStart.current = clientX;
    setReturning(false);
    setDragging(true);
    const el = frontCardRef.current;
    if (el) el.style.transition = "none";
  }

  function onPointerMove(clientX: number) {
    if (pointerStart.current == null || exitingGuard.current) return;
    const x = clientX - pointerStart.current;
    dragXRef.current = x;
    const rot = Math.max(-12, Math.min(12, x / 16));
    applyFrontTransform(x, rot, 1);
  }

  function springBack() {
    setReturning(true);
    const el = frontCardRef.current;
    const reduced = prefersReducedMotion();
    if (el) {
      el.style.transition = reduced
        ? "transform 120ms ease, opacity 120ms ease"
        : "transform 380ms cubic-bezier(0.22, 1.25, 0.36, 1), opacity 280ms ease";
      applyFrontTransform(0, 0, 1);
    }
    dragXRef.current = 0;
    window.setTimeout(() => setReturning(false), reduced ? 140 : 400);
  }

  function onPointerUp() {
    if (pointerStart.current == null || exitingGuard.current) return;
    setDragging(false);
    pointerStart.current = null;
    const x = dragXRef.current;
    if (x > 90) commit("keep");
    else if (x < -90) commit("skip");
    else springBack();
  }

  function saveArea() {
    const label = areaDraft.trim() || "Near you";
    setAreaLabel(label);
    setCoords({ lat: null, lng: null });
    writeBrowseArea({ label, lat: null, lng: null });
    setAreaEditing(false);
    setGeoStatus("ready");
  }

  function makePlan() {
    if (!signedIn) {
      router.push("/login?callbackUrl=/browse?save=1");
      return;
    }
    startTransition(async () => {
      await startPlanFromBrowseAction(
        kept.map((k) => ({
          title: k.title,
          summary: k.blurb || k.description.slice(0, 160),
          category: k.category,
          tags: deriveBrowseTags(k),
        })),
      );
    });
  }

  function dealAnotherEight() {
    setCeremonyDismissed(true);
    void generate(prompt || "More local ideas near me", {
      count: BROWSE_DEAL_MORE,
      append: true,
    });
  }

  const progressIndex = exhausted
    ? deckSize
    : Math.min(deckSize, index + 1);
  const learning = learningLines(swipeLog);
  const chipSource = front
    ? softChipsForIdea(front, swipeLog)
    : sessionSoftChips(swipeLog);

  function CardFace({
    idea,
    layer,
  }: {
    idea: BrowseIdea;
    layer: "front" | "mid" | "back";
  }) {
    const frontClass =
      layer === "front"
        ? [
            dragging ? "is-dragging" : "",
            exiting ? `is-exiting is-exiting-${exiting}` : "",
            returning ? "is-returning" : "",
          ]
            .filter(Boolean)
            .join(" ")
        : "";
    const chips =
      layer === "front" ? softChipsForIdea(idea, swipeLog) : idea.tags.slice(0, 2);

    return (
      <article
        ref={layer === "front" ? frontCardRef : undefined}
        className={`browse-card browse-card--${layer}${frontClass ? ` ${frontClass}` : ""}`}
        onPointerDown={(e) => {
          if (layer !== "front") return;
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          onPointerDown(e.clientX);
        }}
        onPointerMove={(e) => {
          if (layer !== "front") return;
          onPointerMove(e.clientX);
        }}
        onPointerUp={() => {
          if (layer !== "front") return;
          onPointerUp();
        }}
        onPointerCancel={() => {
          if (layer !== "front") return;
          onPointerUp();
        }}
      >
        <div className="browse-card-media">
          <SoftImage
            src={idea.imageUrl}
            letter={idea.title}
            className="browse-card-img"
            width={392}
            height={248}
          />
          <span className="browse-card-chip">{categoryLabel(idea.category)}</span>
        </div>
        <div className="browse-card-body">
          <h2 className="browse-card-title">{idea.title}</h2>
          <p className="browse-card-meta">{formatBrowseMeta(idea)}</p>
          <p className="browse-card-desc">{idea.blurb}</p>
          {layer === "front" ? (
            <div className="browse-card-progress">
              <div
                className="browse-card-progress-track"
                aria-hidden
              >
                <span
                  className="browse-card-progress-fill"
                  style={{
                    width: `${Math.round((progressIndex / Math.max(1, deckSize)) * 100)}%`,
                  }}
                />
              </div>
              <span className="browse-card-progress-label">
                {progressIndex} of {deckSize}
              </span>
            </div>
          ) : null}
          {layer === "front" && chips.length > 0 ? (
            <div className="browse-soft-chips">
              {chips.map((c, i) => (
                <span key={`${c}-${i}`} className="browse-soft-chip">
                  {c}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  const letterFor = (i: number) => String.fromCharCode(65 + i);

  return (
    <div className="browse-page browse-page--r12">
      <header className="browse-head browse-head--compact">
        <div className="browse-head-brand">
          <p className="browse-brand">{APP_NAME}</p>
          <p className="browse-eyebrow">Browse</p>
        </div>
        <div className="browse-area">
          {areaEditing ? (
            <form
              className="browse-area-form"
              onSubmit={(e) => {
                e.preventDefault();
                saveArea();
              }}
            >
              <input
                ref={areaInputRef}
                className="browse-area-input"
                value={areaDraft}
                onChange={(e) => setAreaDraft(e.target.value)}
                placeholder="City, town, or area"
                aria-label="Your city or area"
                enterKeyHint="done"
              />
              <button type="submit" className="browse-area-save">
                Save
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="browse-area-btn"
              onClick={() => {
                setAreaDraft(areaLabel === "Near you" ? "" : areaLabel);
                setAreaEditing(true);
              }}
            >
              <span className="browse-area-pin" aria-hidden>
                ⌖
              </span>
              <span className="browse-area-label">
                {geoStatus === "locating" ? "Finding you…" : areaLabel}
              </span>
              <span className="browse-area-edit">Edit</span>
            </button>
          )}
        </div>
      </header>

      {!stack.length && loadUi === "idle" ? (
        <>
          <div className="browse-composer-block">
            <h1 className="browse-title">What sounds good near you?</h1>
            <p className="browse-lede">
              Keep what sounds good, skip what doesn&apos;t. Finite stack of{" "}
              {BROWSE_DECK_SIZE} — aim for {BROWSE_KEEP_TARGET}.
            </p>
            <textarea
              ref={composerRef}
              className="browse-composer"
              rows={2}
              placeholder="A cheap Saturday, something for tonight, surprise me…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void generate(prompt);
                }
              }}
            />
            <div className="browse-pills">
              {COLD_PILLS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="browse-pill"
                  onClick={() => void generate(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-berry"
              onClick={() => {
                if (!prompt.trim()) {
                  composerRef.current?.focus();
                  setError("Describe what you’re in the mood for.");
                  return;
                }
                void generate(prompt);
              }}
            >
              Build a stack →
            </button>
            {error ? (
              <p className="browse-error">
                {error}{" "}
                <button
                  type="button"
                  className="browse-retry"
                  onClick={() => void generate(prompt)}
                >
                  Try again
                </button>
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {loadUi === "building" || loadUi === "ready" ? (
        <div
          className={`browse-loading-panel${loadUi === "ready" ? " is-ready" : ""}`}
          role="status"
          aria-busy={loadUi === "building"}
          aria-live="polite"
        >
          {loadUi === "building" ? (
            <>
              <div className="browse-stack-spinner" aria-hidden="true">
                <span className="browse-stack-spinner-card browse-stack-spinner-card--back" />
                <span className="browse-stack-spinner-card browse-stack-spinner-card--mid" />
                <span className="browse-stack-spinner-card browse-stack-spinner-card--front">
                  <i className="browse-stack-spinner-mark" />
                </span>
              </div>
              <p className="browse-loading">Building a finite stack…</p>
            </>
          ) : (
            <>
              <div className="browse-ready-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                  <path
                    d="M5 12.5l4.2 4.2L19 7.5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="browse-loading">Stack ready — swipe to keep or skip</p>
            </>
          )}
        </div>
      ) : null}

      {stack.length > 0 && loadUi === "idle" && !showCeremony ? (
        <div className="browse-body browse-body--enter">
          <div className="browse-deck-col">
            {kept.length > 0 ? (
              <div className="browse-shortlist-strip" aria-label="Tonight's shortlist">
                <span className="browse-shortlist-strip-label">
                  Shortlist · {kept.length}
                </span>
                <ul className="browse-shortlist-strip-list">
                  {kept.slice(0, 5).map((k, i) => (
                    <li key={k.id} className="browse-shortlist-strip-item">
                      <span className="browse-shortlist-letter" aria-hidden>
                        {letterFor(i)}
                      </span>
                      <span className="browse-shortlist-title">{k.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {exhausted && kept.length === 0 ? (
              <div className="browse-exhausted">
                <p>That&apos;s the stack. Want me to go cheaper, closer, or weirder?</p>
                <div className="browse-pills">
                  {(["cheaper", "closer", "weirder"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      className="browse-pill"
                      onClick={() => void generate(prompt, { refine: r })}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-berry"
                  onClick={() => void generate(prompt)}
                >
                  New stack →
                </button>
              </div>
            ) : (
              <>
                {thinMessage ? <p className="browse-thin">{thinMessage}</p> : null}
                <div className="browse-deck">
                  {back ? (
                    <CardFace key={`back-${back.id}`} idea={back} layer="back" />
                  ) : null}
                  {mid ? (
                    <CardFace key={`mid-${mid.id}`} idea={mid} layer="mid" />
                  ) : null}
                  {front ? (
                    <CardFace key={`front-${front.id}`} idea={front} layer="front" />
                  ) : null}
                </div>
                <div className="browse-controls">
                  <button
                    type="button"
                    className="browse-ctrl browse-ctrl--skip"
                    aria-label="Skip"
                    onClick={() => commit("skip")}
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                      <path
                        d="M7 7l10 10M17 7L7 17"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="browse-ctrl browse-ctrl--undo"
                    aria-label="Undo"
                    onClick={() => undo()}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                      <path
                        d="M8 8H5.5A6.5 6.5 0 1 1 5.6 16"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        fill="none"
                        strokeLinecap="round"
                      />
                      <path
                        d="M8 4.5v5H3"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="browse-ctrl browse-ctrl--keep"
                    aria-label="Keep"
                    onClick={() => commit("keep")}
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                      <path
                        d="M12 19.2l-6.4-5.7C3.8 11.8 3.9 8.7 6.2 7c1.7-1.2 4-.8 5.2.7 1.2-1.5 3.5-1.9 5.2-.7 2.3 1.7 2.4 4.8.6 6.5L12 19.2z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
                <p className="browse-hint">
                  {progressIndex} of {deckSize} · swipe right to keep
                </p>
                {chipSource.length > 0 && !front ? (
                  <div className="browse-soft-chips browse-soft-chips--session">
                    {chipSource.map((c) => (
                      <span key={c} className="browse-soft-chip">
                        {c}
                      </span>
                    ))}
                  </div>
                ) : null}
                {persistHint ? <p className="browse-persist">{persistHint}</p> : null}
                {swipeLog.length >= 3 && learning[0] ? (
                  <p className="browse-learn-inline">{learning[0]}</p>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      {showCeremony ? (
        <div className="browse-ceremony">
          <div className="browse-ceremony-mark" aria-hidden>
            <svg viewBox="0 0 64 48" width="56" height="42" fill="none">
              <path
                d="M12 30c4-10 10-16 20-16s16 6 20 16"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M22 28c2.5-6 6-9 10-9s7.5 3 10 9"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path
                d="M28 14c.4-2 1.6-3.4 4-4 2.4.6 3.6 2 4 4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <circle cx="20" cy="12" r="1.2" fill="currentColor" />
              <circle cx="44" cy="11" r="1.2" fill="currentColor" />
              <circle cx="32" cy="8" r="1" fill="currentColor" />
            </svg>
          </div>
          <p className="browse-ceremony-kicker">
            Night {nightCount} ·{" "}
            {kept.length === 1
              ? "one kept"
              : kept.length === 2
                ? "two kept"
                : kept.length === 3
                  ? "three kept"
                  : `${kept.length} kept`}
          </p>
          <h1 className="browse-ceremony-title">
            Tonight&apos;s shortlist · {kept.length}
          </h1>
          <p className="browse-ceremony-lede">
            {exhausted
              ? "You’ve finished the stack. Here are the ideas you’re taking forward."
              : "Three keeps — ready to turn into a plan, or deal more."}
          </p>
          <ul className="browse-ceremony-list">
            {kept.slice(0, 8).map((k, i) => (
              <li key={k.id} className="browse-ceremony-row">
                <span className="browse-ceremony-letter" aria-hidden>
                  {letterFor(i)}
                </span>
                <div className="browse-ceremony-copy">
                  <strong>{k.title}</strong>
                  <span>{k.blurb}</span>
                </div>
                <div className="browse-ceremony-meta">
                  <span>{formatCostDollars(k.estCostUsd)}</span>
                  <span>{formatDurationLabel(k)}</span>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-berry browse-ceremony-primary"
            disabled={pending}
            onClick={() => makePlan()}
          >
            Make a plan from these
          </button>
          <button
            type="button"
            className="browse-ceremony-secondary"
            onClick={() => dealAnotherEight()}
          >
            Deal me another {BROWSE_DEAL_MORE}
          </button>
          {!exhausted ? (
            <button
              type="button"
              className="browse-ceremony-keep-swiping"
              onClick={() => setCeremonyDismissed(true)}
            >
              Keep swiping
            </button>
          ) : null}
        </div>
      ) : null}

      {showOnboardPlan ? (
        <div className="browse-onboard">
          <p>I&apos;m starting to get it. Want me to plan something?</p>
          <button
            type="button"
            className="btn btn-berry btn-sm"
            onClick={() =>
              router.push(signedIn ? "/plan" : "/login?callbackUrl=/plan")
            }
          >
            Plan something
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowOnboardPlan(false)}
          >
            Keep browsing
          </button>
        </div>
      ) : null}

      <BrowseTabBar />
    </div>
  );
}
