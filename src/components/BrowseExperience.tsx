"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { startPlanFromBrowseAction } from "@/app/actions/browse";
import { SoftImage } from "@/components/SoftImage";
import {
  categoryLabel,
  filterBrowseIdeas,
  formatBrowseMeta,
  type BrowseFilter,
  type BrowseIdea,
} from "@/lib/browseIdeas";
import { deriveBrowseTags } from "@/lib/browseTags";
import {
  learningLines,
  listLocalSwipes,
  listSkippedTitles,
  recordLocalSwipe,
  undoLocalSwipe,
  type BrowseSwipeEvent,
} from "@/lib/peopleGraph";
import { placeStillUrl } from "@/lib/placeImages";

const FILTERS: { id: BrowseFilter; label: string }[] = [
  { id: "anything", label: "Anything" },
  { id: "go-somewhere", label: "Go somewhere" },
  { id: "stay-home", label: "Stay home" },
  { id: "under-50", label: "Under $50" },
  { id: "two-hours", label: "Two hours or less" },
];

const COLD_PILLS = [
  "Something for tonight",
  "A cheap Saturday",
  "Surprise me",
];

type KeptItem = BrowseIdea & { keptAt: string };

export function BrowseExperience({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [filter, setFilter] = useState<BrowseFilter>("anything");
  const [stack, setStack] = useState<BrowseIdea[]>([]);
  const [index, setIndex] = useState(0);
  const [promptId, setPromptId] = useState("");
  const [kept, setKept] = useState<KeptItem[]>([]);
  const [skipped, setSkipped] = useState<BrowseIdea[]>([]);
  const [swipeLog, setSwipeLog] = useState<BrowseSwipeEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [thinMessage, setThinMessage] = useState<string | null>(null);
  const [loadUi, setLoadUi] = useState<"idle" | "building" | "ready">("idle");
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);
  const [persistHint, setPersistHint] = useState<string | null>(null);
  const [showOnboardPlan, setShowOnboardPlan] = useState(false);
  const [pending, startTransition] = useTransition();
  const undoStack = useRef<{ idea: BrowseIdea; direction: "keep" | "skip"; eventId: string }[]>(
    [],
  );
  const pointerStart = useRef<number | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const remaining = Math.max(0, stack.length - index);
  const front = stack[index] ?? null;
  const mid = stack[index + 1] ?? null;
  const back = stack[index + 2] ?? null;
  const exhausted = stack.length > 0 && index >= stack.length;
  const filteredPreview = useMemo(
    () => filterBrowseIdeas(stack.slice(index), filter),
    [stack, index, filter],
  );

  useEffect(() => {
    setSwipeLog(listLocalSwipes());
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
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!front || loadUi !== "idle" || exiting) return;
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

  async function generate(nextPrompt: string, refine?: "cheaper" | "closer" | "weirder") {
    const text = nextPrompt.trim();
    if (!text) return;
    setLoadUi("building");
    setError(null);
    setThinMessage(null);
    setPrompt(text);
    try {
      // Fail client-side before a hanging gateway 504 with opaque HTML.
      const res = await fetch("/api/browse/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          filter,
          skippedTitles: listSkippedTitles(),
          refine,
        }),
        signal: AbortSignal.timeout(42_000),
      });
      let data: {
        error?: string;
        ideas?: BrowseIdea[];
        promptId?: string;
        thin?: boolean;
        message?: string;
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
        setStack([]);
        setIndex(0);
        setLoadUi("idle");
        return;
      }
      const ideas = data.ideas ?? [];
      setStack(ideas);
      setIndex(0);
      setPromptId(data.promptId || crypto.randomUUID());
      if (data.thin) setThinMessage(data.message ?? null);
      undoStack.current = [];
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
      setStack([]);
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

  function commit(direction: "keep" | "skip") {
    if (!front || exiting) return;
    setExiting(direction === "keep" ? "right" : "left");
    const idea = front;
    window.setTimeout(() => {
      const eventId = persistSwipe(idea, direction);
      undoStack.current.push({ idea, direction, eventId });
      if (direction === "keep") {
        setKept((k) => [{ ...idea, keptAt: new Date().toISOString() }, ...k]);
      } else {
        setSkipped((s) => [idea, ...s]);
      }
      setIndex((i) => i + 1);
      setExiting(null);
      setDragX(0);
      setPersistHint(null);
    }, 240);
  }

  function undo() {
    const last = undoStack.current.pop();
    if (!last) return;
    undoLocalSwipe(last.eventId);
    setSwipeLog(listLocalSwipes());
    if (last.direction === "keep") {
      setKept((k) => k.filter((x) => x.id !== last.idea.id));
    } else {
      setSkipped((s) => s.filter((x) => x.id !== last.idea.id));
    }
    setStack((prev) => {
      const next = [...prev];
      next.splice(index, 0, last.idea);
      return next;
    });
  }

  function onPointerDown(clientX: number) {
    if (!front) return;
    pointerStart.current = clientX;
    setDragging(true);
  }

  function onPointerMove(clientX: number) {
    if (!dragging || pointerStart.current == null) return;
    setDragX(clientX - pointerStart.current);
  }

  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (dragX > 90) commit("keep");
    else if (dragX < -90) commit("skip");
    else setDragX(0);
    pointerStart.current = null;
  }

  const learning = learningLines(swipeLog);
  const rotation = Math.max(-8, Math.min(8, dragX / 18));
  const exitX =
    exiting === "right" ? 420 : exiting === "left" ? -420 : dragX;

  function CardFace({
    idea,
    layer,
  }: {
    idea: BrowseIdea;
    layer: "front" | "mid" | "back";
  }) {
    return (
      <article
        className={`browse-card browse-card--${layer}`}
        style={
          layer === "front"
            ? {
                transform: `translateX(${exitX}px) rotate(${exiting ? (exiting === "right" ? 8 : -8) : rotation}deg)`,
                transition: dragging ? "none" : "transform 240ms ease-out",
              }
            : undefined
        }
        onPointerDown={(e) => {
          if (layer !== "front") return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
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
            src={placeStillUrl(idea.imageQuery || idea.title, idea.description)}
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
          <p className="browse-card-desc">{idea.description}</p>
          <ul className="browse-card-amenities">
            {idea.pluses.map((p) => (
              <li key={`p-${p}`} className="is-pro">
                <span aria-hidden>✓</span> {p}
              </li>
            ))}
            {idea.cautions.map((c) => (
              <li key={`c-${c}`} className="is-con">
                <span aria-hidden>!</span> {c}
              </li>
            ))}
          </ul>
        </div>
      </article>
    );
  }

  return (
    <div className="browse-page">
      <header className="browse-head">
        <div className="browse-head-main">
          <p className="browse-eyebrow">Browse</p>
          <h1 className="browse-title">
            {prompt.trim() || "What sounds good?"}
          </h1>
          <p className="browse-lede">
            Keep what sounds good, skip what doesn&apos;t. I&apos;ll learn from both.
          </p>
        </div>
        <div className="browse-filters" role="group" aria-label="Filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`browse-filter${filter === f.id ? " is-active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {!stack.length && loadUi === "idle" ? (
        <div className="browse-composer-block">
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
              <button type="button" className="browse-retry" onClick={() => void generate(prompt)}>
                Try again
              </button>
            </p>
          ) : null}
        </div>
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

      {stack.length > 0 && loadUi === "idle" ? (
        <div className="browse-body browse-body--enter">
          <div className="browse-deck-col">
            {exhausted ? (
              <div className="browse-exhausted">
                <p>That&apos;s the stack. Want me to go cheaper, closer, or weirder?</p>
                <div className="browse-pills">
                  {(["cheaper", "closer", "weirder"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      className="browse-pill"
                      onClick={() => void generate(prompt, r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <textarea
                  className="browse-composer"
                  rows={2}
                  placeholder="Or type a refinement…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
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
                  {back ? <CardFace idea={back} layer="back" /> : null}
                  {mid ? <CardFace idea={mid} layer="mid" /> : null}
                  {front ? <CardFace idea={front} layer="front" /> : null}
                </div>
                <div className="browse-controls">
                  <button
                    type="button"
                    className="browse-ctrl browse-ctrl--skip"
                    aria-label="Skip"
                    onClick={() => commit("skip")}
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    className="browse-ctrl browse-ctrl--undo"
                    aria-label="Undo"
                    onClick={() => undo()}
                  >
                    ↺
                  </button>
                  <button
                    type="button"
                    className="browse-ctrl browse-ctrl--keep"
                    aria-label="Keep"
                    onClick={() => commit("keep")}
                  >
                    ♥
                  </button>
                </div>
                <p className="browse-hint">
                  Swipe, or use ← and → · {Math.max(0, remaining - 1)} more in this stack
                </p>
                {persistHint ? <p className="browse-persist">{persistHint}</p> : null}
                {filter !== "anything" && filteredPreview.length === 0 ? (
                  <p className="browse-thin">
                    Nothing left in this stack matches that filter.
                  </p>
                ) : null}
              </>
            )}
          </div>

          <aside className="browse-rail">
            <section className="browse-rail-card">
              <div className="browse-rail-head">
                <h2 className="browse-rail-title">Kept · {kept.length}</h2>
                {kept.length > 0 && signedIn ? (
                  <button
                    type="button"
                    className="browse-rail-link"
                    onClick={() => {
                      /* soft invite copy */
                    }}
                  >
                    Share kept
                  </button>
                ) : null}
              </div>
              {kept.length === 0 ? (
                <p className="browse-rail-empty">
                  Nothing kept yet — swipe right on anything that sounds good.
                </p>
              ) : (
                <ul className="browse-kept-list">
                  {kept.slice(0, 6).map((k) => (
                    <li key={k.id} className="browse-kept-row">
                      <span className="browse-thumb" aria-hidden>
                        {k.title.slice(0, 1)}
                      </span>
                      <div className="browse-kept-text">
                        <strong>{k.title}</strong>
                        <span>{formatBrowseMeta(k)}</span>
                      </div>
                      <span className="browse-kept-cat">
                        {categoryLabel(k.category)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="browse-rail-foot">
                <button
                  type="button"
                  className="btn btn-berry btn-sm"
                  disabled={kept.length === 0 || pending}
                  onClick={() => {
                    if (!signedIn) {
                      router.push("/login?callbackUrl=/browse?save=1");
                      return;
                    }
                    startTransition(async () => {
                      await startPlanFromBrowseAction(
                        kept.map((k) => ({
                          title: k.title,
                          summary: k.description.slice(0, 160),
                          category: categoryLabel(k.category),
                        })),
                      );
                    });
                  }}
                >
                  Make a plan from these
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    /* keep browsing — no-op */
                  }}
                >
                  Keep browsing
                </button>
              </div>
            </section>

            {swipeLog.length >= 3 ? (
              <section className="browse-rail-card browse-rail-card--learn">
                <p className="browse-learn-eyebrow">What I&apos;m learning</p>
                <ul className="browse-learn-list">
                  {learning.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p className="browse-learn-foot">
                  Saved to your profile · review at{" "}
                  <a href="/people">/people</a>
                </p>
              </section>
            ) : null}

            <section className="browse-rail-card">
              <h2 className="browse-rail-title">Skipped · {skipped.length}</h2>
              <p className="browse-rail-empty">
                Skips never return in a later stack.
              </p>
              <div className="browse-skipped-pills">
                {skipped.slice(0, 3).map((s) => (
                  <span key={s.id} className="browse-skipped-pill">
                    {s.title}
                  </span>
                ))}
                {skipped.length > 3 ? (
                  <button type="button" className="browse-rail-link" onClick={() => undo()}>
                    +{skipped.length - 3} · undo any
                  </button>
                ) : skipped.length > 0 ? (
                  <button type="button" className="browse-rail-link" onClick={() => undo()}>
                    undo any
                  </button>
                ) : null}
              </div>
            </section>
          </aside>
        </div>
      ) : null}

      {showOnboardPlan ? (
        <div className="browse-onboard">
          <p>I&apos;m starting to get it. Want me to plan something?</p>
          <button
            type="button"
            className="btn btn-berry btn-sm"
            onClick={() => router.push(signedIn ? "/plan" : "/login?callbackUrl=/plan")}
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
    </div>
  );
}
