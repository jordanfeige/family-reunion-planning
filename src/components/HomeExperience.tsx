"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SoftImage } from "@/components/SoftImage";
import { useHoldToTalk } from "@/lib/useHoldToTalk";
import { categoryLabel, type BrowseCategory } from "@/lib/browseIdeas";

export type HomeFallthroughIdea = {
  id: string;
  title: string;
  category: BrowseCategory;
  durationLabel: string;
  costLabel: string;
  imageUrl: string | null;
  attribution?: string | null;
  attributionHref?: string | null;
};

export type HomeActiveTrip = {
  name: string;
  href: string;
  meta: string;
  blocker: string | null;
  remindHref?: string | null;
};

const MOBILE_PILLS = ["Date night", "A cheap Saturday", "Surprise me"] as const;
const DESKTOP_EXTRA = ["Weekend away", "The whole family"] as const;
const GEO_CACHE_KEY = "wa-home-geo-v1";

type GeoCache = { label: string; lat: number; lng: number; at: number };

function readGeoCache(): GeoCache | null {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GeoCache;
    if (!parsed.label || typeof parsed.lat !== "number") return null;
    if (Date.now() - (parsed.at ?? 0) > 30 * 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeGeoCache(entry: GeoCache) {
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
}

export function HomeExperience({
  locationLabel: serverLocation,
  activeTrip,
  fallthrough,
}: {
  locationLabel: string | null;
  activeTrip: HomeActiveTrip | null;
  fallthrough: HomeFallthroughIdea[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [interim, setInterim] = useState(false);
  const [wide, setWide] = useState(false);
  const [guestLocation, setGuestLocation] = useState<string | null>(null);
  const geoAttempted = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);

  const locationLabel = serverLocation || guestLocation;

  const voice = useHoldToTalk({
    value: text,
    onChange: (next, isInterim) => {
      setText(next);
      setInterim(Boolean(isInterim));
    },
  });

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Guest home: navigator.geolocation → Mapbox reverse-geocode ONCE, cached (§4a)
  useEffect(() => {
    if (serverLocation || geoAttempted.current) return;
    geoAttempted.current = true;
    const cached = readGeoCache();
    if (cached?.label) {
      setGuestLocation(cached.label);
      return;
    }
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        void fetch("/api/geo/reverse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lng }),
        })
          .then((r) => r.json())
          .then((data: { label?: string | null }) => {
            const label = data.label?.trim() || null;
            if (!label) return; // omit entirely — never guess
            writeGeoCache({ label, lat, lng, at: Date.now() });
            setGuestLocation(label);
          })
          .catch(() => {
            /* omit */
          });
      },
      () => {
        /* denied — omit */
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 600_000 },
    );
  }, [serverLocation]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const pills = wide
    ? [...MOBILE_PILLS, ...DESKTOP_EXTRA]
    : [...MOBILE_PILLS];

  function fillPill(label: string) {
    setText(label);
    setInterim(false);
    textareaRef.current?.focus();
  }

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) {
      textareaRef.current?.focus();
      return;
    }
    if (sendingRef.current) return;
    sendingRef.current = true;

    try {
      sessionStorage.setItem(
        "wa-pending-message",
        JSON.stringify({ text: trimmed, at: Date.now() }),
      );
    } catch {
      /* ignore */
    }
    window.location.href = `/api/plan/start?seed=${encodeURIComponent(trimmed.slice(0, 200))}`;
  }

  const ideas = fallthrough.slice(0, wide ? 3 : 2);

  return (
    <div className="home-r12">
      {locationLabel ? (
        <div className="home-r12-location">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <circle
              cx="5"
              cy="5"
              r="3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <circle cx="5" cy="5" r="1.2" fill="currentColor" />
          </svg>
          <span>{locationLabel}</span>
        </div>
      ) : null}

      <h1>What are we planning?</h1>
      <p className="home-r12-lead">
        Two of you or thirty. Say it however you like.
      </p>

      <div className="home-composer-card">
        <textarea
          ref={textareaRef}
          value={text}
          placeholder="A date night this Saturday…"
          aria-label="What are we planning?"
          style={interim ? { color: "var(--muted)" } : undefined}
          onChange={(e) => {
            setInterim(false);
            setText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="home-composer-card-rule">
          <div className="home-composer-card-row">
            {voice.supported ? (
              <button
                type="button"
                className={`home-mic-pill${voice.listening ? " is-listening" : ""}`}
                aria-label="Hold to speak"
                aria-pressed={voice.listening}
                onPointerDown={(e) => {
                  e.preventDefault();
                  voice.start();
                }}
                onPointerUp={() => voice.stop()}
                onPointerLeave={() => {
                  if (voice.listening) voice.stop();
                }}
                onClick={(e) => {
                  if (wide) {
                    e.preventDefault();
                    voice.toggle();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    voice.toggle();
                  }
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                  <path
                    d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z"
                    fill="currentColor"
                  />
                </svg>
                {voice.listening ? (
                  <span className="wa-voice-bars" aria-hidden>
                    <span className="wa-voice-bar" />
                    <span className="wa-voice-bar" />
                    <span className="wa-voice-bar" />
                  </span>
                ) : (
                  "Hold to talk"
                )}
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="home-send-btn"
              aria-label="Send"
              onClick={() => void send()}
            >
              ↑
            </button>
          </div>
        </div>
        {voice.errorMessage ? (
          <p className="home-voice-error">
            {voice.errorMessage}
            {voice.error === "network" ? (
              <>
                {" "}
                <button
                  type="button"
                  className="home-pill"
                  style={{ minHeight: 32, padding: "4px 10px" }}
                  onClick={() => voice.start()}
                >
                  Try again
                </button>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="home-pills">
        {pills.map((p) => (
          <button
            key={p}
            type="button"
            className="home-pill"
            onClick={() => fillPill(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {activeTrip ? (
        <a href={activeTrip.href} className="home-active-trip">
          <div className="home-active-trip-main">
            <span className="home-active-trip-letter" aria-hidden>
              {(activeTrip.name.trim().charAt(0) || "?").toUpperCase()}
            </span>
            <div className="home-active-trip-body">
              <p className="home-active-trip-title">{activeTrip.name}</p>
              <p className="home-active-trip-meta">{activeTrip.meta}</p>
            </div>
            {activeTrip.blocker ? (
              <span className="home-active-trip-blocker">{activeTrip.blocker}</span>
            ) : null}
          </div>
          {activeTrip.remindHref || activeTrip.blocker ? (
            <button
              type="button"
              className="home-active-trip-action"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push(activeTrip.remindHref || activeTrip.href);
              }}
            >
              Remind them
            </button>
          ) : null}
        </a>
      ) : null}

      {ideas.length >= 2 ? (
        <section className="home-fallthrough">
          <div className="home-fallthrough-row">
            <h2>Not sure yet?</h2>
            <Link href="/browse" className="home-fallthrough-browse">
              Browse →
            </Link>
          </div>
          <div className="home-idea-grid">
            {ideas.map((idea, i) => (
              <Link
                key={idea.id}
                href="/browse"
                className={`home-idea-card${i === 2 ? " home-idea-card--desktop-only" : ""}`}
              >
                <div className="home-idea-card-media">
                  <span className="home-idea-chip">
                    {categoryLabel(idea.category)}
                  </span>
                  <SoftImage
                    src={idea.imageUrl}
                    letter={idea.title}
                    alt=""
                    attribution={idea.attribution}
                    attributionHref={idea.attributionHref ?? undefined}
                  />
                </div>
                <div className="home-idea-card-body">
                  <p className="home-idea-card-title">{idea.title}</p>
                  <p className="home-idea-card-meta">
                    {idea.durationLabel} · {idea.costLabel}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
