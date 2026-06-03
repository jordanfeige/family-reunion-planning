"use client";

import { useState } from "react";

import { submitPlanConfirmationAction } from "@/app/actions/trips";
import type { GuestSession } from "@/lib/guestSession";

type ConfirmationInitial = {
  respondentName: string;
  respondentEmail: string | null;
  status: "confirmed" | "declined";
  adultCount: number;
  kidCount: number;
};

export function PlanConfirmationForm({
  shareToken,
  weekendLabel,
  locationTitle,
  canConfirm,
  guestSession = null,
  initial = null,
}: {
  shareToken: string;
  weekendLabel: string;
  locationTitle: string;
  canConfirm: boolean;
  guestSession?: GuestSession | null;
  initial?: ConfirmationInitial | null;
}) {
  const emailLocked = Boolean(guestSession);
  const [status, setStatus] = useState<"confirmed" | "declined" | null>(
    initial?.status ?? null,
  );
  const [name, setName] = useState(
    initial?.respondentName ?? guestSession?.name ?? "",
  );
  const [email, setEmail] = useState(
    guestSession?.email ?? initial?.respondentEmail ?? "",
  );
  const [adultCount, setAdultCount] = useState(initial?.adultCount ?? 1);
  const [kidCount, setKidCount] = useState(initial?.kidCount ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canConfirm) {
    return (
      <div className="card" style={{ marginTop: "1.25rem" }}>
        <p className="pill">Final headcount</p>
        <p className="muted" style={{ margin: "0.5rem 0 0" }}>
          The organizers are still locking the date and location. Check back once the
          full plan is posted.
        </p>
      </div>
    );
  }

  return (
    <div className="card plan-confirm-card" style={{ marginTop: "1.25rem" }}>
      <p className="pill">Final RSVP</p>
      <h2 style={{ margin: "0.5rem 0 0.35rem", color: "var(--color-fjord)" }}>
        Are you in?
      </h2>
      <p className="muted" style={{ margin: "0 0 1rem" }}>
        <strong>{locationTitle}</strong>
        <br />
        {weekendLabel}
      </p>

      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!status) {
            setError("Please choose Yes or No.");
            return;
          }
          setBusy(true);
          setError(null);
          try {
            const fd = new FormData(e.currentTarget);
            fd.set("status", status);
            fd.set("name", name.trim());
            if (email.trim()) fd.set("email", email.trim());
            if (status === "confirmed") {
              fd.set("adult_count", String(adultCount));
              fd.set("kid_count", String(kidCount));
            }
            await submitPlanConfirmationAction(fd);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save.");
            setBusy(false);
          }
        }}
      >
        <input type="hidden" name="token" value={shareToken} />

        <div className="row" style={{ gap: "0.5rem" }}>
          <button
            type="button"
            className={status === "confirmed" ? "btn btn-primary" : "btn btn-secondary"}
            style={{ flex: 1 }}
            onClick={() => {
              setStatus("confirmed");
              setError(null);
            }}
          >
            Yes, we&apos;re in
          </button>
          <button
            type="button"
            className={status === "declined" ? "btn btn-berry" : "btn btn-secondary"}
            style={{ flex: 1 }}
            onClick={() => {
              setStatus("declined");
              setError(null);
            }}
          >
            Can&apos;t make it
          </button>
        </div>

        {status === "confirmed" ? (
          <div className="grid-2">
            <div className="field">
              <label htmlFor="confirm_adults">Adults (18+)</label>
              <input
                id="confirm_adults"
                name="adult_count"
                type="number"
                min={1}
                value={adultCount}
                inputMode="numeric"
                required
                onChange={(e) => setAdultCount(Number.parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <div className="field">
              <label htmlFor="confirm_kids">Kids (under 18)</label>
              <input
                id="confirm_kids"
                name="kid_count"
                type="number"
                min={0}
                value={kidCount}
                inputMode="numeric"
                onChange={(e) => setKidCount(Number.parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="confirm_name">Your name *</label>
          <input
            id="confirm_name"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="confirm_email">
            Email {emailLocked ? "" : "(optional)"}
          </label>
          <input
            id="confirm_email"
            type="email"
            autoComplete="email"
            value={email}
            readOnly={emailLocked}
            required={emailLocked}
            onChange={(e) => {
              if (emailLocked) return;
              setEmail(e.target.value);
            }}
          />
          {emailLocked ? (
            <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.82rem" }}>
              Locked to your signed-in account.
            </p>
          ) : null}
        </div>

        {error ? <p className="error-banner" style={{ margin: 0 }}>{error}</p> : null}

        <button type="submit" className="btn btn-berry btn-block-sm" disabled={busy}>
          {busy ? "Saving…" : initial ? "Update RSVP" : "Submit RSVP"}
        </button>
      </form>
    </div>
  );
}
