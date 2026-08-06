"use client";

import { useState, type FormEvent } from "react";

import {
  closeBallotAction,
  publishBallotAction,
  reopenBallotAction,
} from "@/app/actions/trips";
import { CopyButton } from "@/components/CopyButton";
import { CtaRequirementHint } from "@/components/CtaRequirementHint";
import { focusBlockingField } from "@/lib/formFocus";
import type { BallotStatus } from "@/lib/venues";

export function TripBallotControls({
  slug,
  ballotStatus,
  voteUrl,
  optionCount,
  locationLocked,
}: {
  slug: string;
  ballotStatus: BallotStatus;
  voteUrl: string;
  optionCount: number;
  locationLocked: boolean;
}) {
  const [ctaHint, setCtaHint] = useState<string | null>(null);

  const statusLabel =
    ballotStatus === "open"
      ? "Voting open"
      : ballotStatus === "closed"
        ? "Voting closed"
        : "Draft";

  function onOpenVoting(e: FormEvent<HTMLFormElement>) {
    if (!locationLocked) {
      e.preventDefault();
      setCtaHint("Lock a destination on the Decision step before opening the vote.");
      focusBlockingField(".ballot-controls");
      return;
    }
    if (optionCount === 0) {
      e.preventDefault();
      setCtaHint("Add at least one venue option to the ballot before opening voting.");
      focusBlockingField(".ballot-controls");
      return;
    }
    setCtaHint(null);
  }

  return (
    <div className="card ballot-controls" style={{ padding: "1rem" }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <p className="pill" style={{ margin: 0 }}>
            Group vote · {statusLabel}
          </p>
          <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.88rem" }}>
            {optionCount} option{optionCount === 1 ? "" : "s"} on the ballot. Family sees totals
            only—not who voted.
          </p>
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
          {ballotStatus === "draft" ? (
            <form action={publishBallotAction} onSubmit={onOpenVoting}>
              <input type="hidden" name="slug" value={slug} />
              <button type="submit" className="btn btn-berry">
                Open voting
              </button>
            </form>
          ) : null}
          {ballotStatus === "open" ? (
            <form action={closeBallotAction}>
              <input type="hidden" name="slug" value={slug} />
              <button type="submit" className="btn btn-secondary">
                Close voting
              </button>
            </form>
          ) : null}
          {ballotStatus === "closed" ? (
            <form action={reopenBallotAction}>
              <input type="hidden" name="slug" value={slug} />
              <button type="submit" className="btn btn-secondary">
                Reopen voting
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {ballotStatus === "draft" ? (
        <CtaRequirementHint>{ctaHint}</CtaRequirementHint>
      ) : null}

      {ballotStatus !== "draft" ? (
        <div style={{ marginTop: "0.85rem" }}>
          <p className="mono" style={{ fontSize: "0.82rem", margin: "0 0 0.5rem" }}>
            {voteUrl}
          </p>
          <CopyButton text={voteUrl} label="Copy vote link" />
          <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.82rem" }}>
            Anyone with this link can vote (name required). If they use the same email as the
            planning survey, their ballot is linked to that household.
          </p>
        </div>
      ) : null}
    </div>
  );
}
