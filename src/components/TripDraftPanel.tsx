"use client";

import { useState, useTransition } from "react";

import { patchPlanTripDraftAction } from "@/app/actions/planDraft";
import {
  FIELD_LABELS,
  type DraftFieldKey,
  type PlanTripDraft,
} from "@/lib/planTripDraft";
import { formatUsd } from "@/lib/units";

const EDITABLE: DraftFieldKey[] = [
  "tripName",
  "householdCount",
  "headcount",
  "originMetro",
  "maxDriveHours",
  "region",
  "budgetPerHouseholdUsd",
  "dateWindow",
];

function displayValue(draft: PlanTripDraft, key: DraftFieldKey): string {
  switch (key) {
    case "tripName":
      return draft.tripName ?? "";
    case "householdCount":
      return draft.householdCount != null ? String(draft.householdCount) : "";
    case "headcount":
      return draft.headcount != null ? String(draft.headcount) : "";
    case "originMetro":
      return draft.originMetro ?? "";
    case "maxDriveHours":
      return draft.maxDriveHours != null ? String(draft.maxDriveHours) : "";
    case "region":
      return draft.region ?? "";
    case "budgetPerHouseholdUsd":
      return draft.budgetPerHouseholdUsd != null
        ? formatUsd(draft.budgetPerHouseholdUsd)
        : "";
    case "dateWindow":
      return draft.dateWindow ?? "";
    case "vibe":
      return (draft.vibe ?? []).join(", ");
    case "mustHaves":
      return (draft.mustHaves ?? []).join(", ");
    case "shortlist":
      return (draft.shortlist ?? []).map((p) => p.title).join(", ");
    default:
      return "";
  }
}

export function TripDraftPanel({
  draft,
  onChange,
}: {
  draft: PlanTripDraft;
  onChange: (next: PlanTripDraft) => void;
}) {
  const [editing, setEditing] = useState<DraftFieldKey | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [pending, startTransition] = useTransition();

  const rows = EDITABLE.map((key) => ({
    key,
    label: FIELD_LABELS[key],
    value: displayValue(draft, key),
  })).filter((r) => r.value);

  const vibe = (draft.vibe ?? []).join(", ");
  if (vibe) rows.push({ key: "vibe", label: FIELD_LABELS.vibe, value: vibe });

  if (rows.length === 0) return null;

  function startEdit(key: DraftFieldKey, value: string) {
    setEditing(key);
    setDraftValue(
      key === "budgetPerHouseholdUsd" && draft.budgetPerHouseholdUsd != null
        ? String(draft.budgetPerHouseholdUsd)
        : value,
    );
  }

  function commit() {
    if (!editing) return;
    const key = editing;
    const raw = draftValue.trim();
    const patch: PlanTripDraft = {};
    if (key === "householdCount" || key === "headcount" || key === "maxDriveHours") {
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) {
        setEditing(null);
        return;
      }
      patch[key] = n;
    } else if (key === "budgetPerHouseholdUsd") {
      const n = Number(raw.replace(/[$,]/g, ""));
      if (!Number.isFinite(n) || n <= 0) {
        setEditing(null);
        return;
      }
      patch.budgetPerHouseholdUsd = Math.round(n);
    } else if (key === "vibe") {
      patch.vibe = raw.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (key === "tripName") {
      patch.tripName = raw;
    } else if (key === "originMetro") {
      patch.originMetro = raw;
    } else if (key === "region") {
      patch.region = raw;
    } else if (key === "dateWindow") {
      patch.dateWindow = raw;
    }

    startTransition(async () => {
      const res = await patchPlanTripDraftAction(patch);
      onChange(res.trip);
      setEditing(null);
    });
  }

  return (
    <aside className="trip-draft-panel" aria-label="Trip draft">
      <p className="trip-draft-panel-eyebrow">Trip draft</p>
      <ul className="trip-draft-panel-list">
        {rows.map((row) => (
          <li key={row.key} className="trip-draft-panel-row">
            <span className="trip-draft-panel-label">{row.label}</span>
            {editing === row.key ? (
              <span className="trip-draft-panel-edit">
                <input
                  className="trip-draft-panel-input"
                  value={draftValue}
                  autoFocus
                  disabled={pending}
                  onChange={(e) => setDraftValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  onBlur={() => commit()}
                />
              </span>
            ) : (
              <button
                type="button"
                className="trip-draft-panel-value"
                onClick={() => startEdit(row.key, row.value)}
              >
                {row.value}
              </button>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
