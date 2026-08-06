"use client";

import { useRef, useState, useTransition, type KeyboardEvent } from "react";

import { saveLodgingRateAction } from "@/app/actions/lodging";
import { looksLikeUrl } from "@/lib/lodging/pricing";

/**
 * Inline rate editor — tab: rate → fees → URL → save. Enter saves.
 * Pasting a URL into the rate field moves it to the source field.
 */
export function LodgingRateEditor({
  slug,
  shareToken,
  optionId,
  propertyId,
  initialNightly,
  initialFees,
  initialSourceUrl,
  enteredByName,
  requireName,
  householdCount,
  onSaved,
  onCancel,
}: {
  slug?: string;
  shareToken?: string;
  optionId: string;
  propertyId: string;
  initialNightly?: number;
  initialFees?: number;
  initialSourceUrl?: string;
  enteredByName?: string;
  requireName?: boolean;
  householdCount?: number;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [nightly, setNightly] = useState(
    initialNightly != null ? String(initialNightly) : "",
  );
  const [fees, setFees] = useState(
    initialFees != null ? String(initialFees) : "",
  );
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl ?? "");
  const [name, setName] = useState(enteredByName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const feesRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const splitHint =
    householdCount != null && householdCount > 1
      ? `Paste the rate and I'll split it ${householdCount} ways.`
      : "Paste the rate and I'll split it among the households.";

  function moveUrlFromRateIfNeeded(value: string) {
    if (looksLikeUrl(value) && !sourceUrl.trim()) {
      setSourceUrl(value.trim().startsWith("http") ? value.trim() : `https://${value.trim()}`);
      setNightly("");
      queueMicrotask(() => feesRef.current?.focus());
      return true;
    }
    return false;
  }

  function save() {
    setError(null);
    if (requireName && !name.trim()) {
      setError("Add your name so we can credit the rate.");
      nameRef.current?.focus();
      return;
    }
    startTransition(async () => {
      const result = await saveLodgingRateAction({
        slug,
        shareToken,
        optionId,
        propertyId,
        nightlyRaw: nightly,
        feesRaw: fees,
        sourceUrlRaw: sourceUrl,
        enteredByName: name.trim() || enteredByName,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved?.();
    });
  }

  function onKeyDown(e: KeyboardEvent, field: "rate" | "fees" | "url" | "name") {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (field === "rate") {
      if (moveUrlFromRateIfNeeded(nightly)) return;
      feesRef.current?.focus();
      return;
    }
    if (field === "fees") {
      urlRef.current?.focus();
      return;
    }
    if (field === "url") {
      if (requireName) {
        nameRef.current?.focus();
        return;
      }
      save();
      return;
    }
    save();
  }

  return (
    <div className="place-lodging-rate-editor">
      <p className="place-lodging-rate-lede">{splitHint}</p>
      <div className="place-lodging-rate-fields">
        <label className="place-lodging-rate-field">
          <span>Nightly rate (USD)</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="$240"
            value={nightly}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value;
              if (moveUrlFromRateIfNeeded(v)) return;
              setNightly(v);
            }}
            onKeyDown={(e) => onKeyDown(e, "rate")}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (looksLikeUrl(text)) {
                e.preventDefault();
                moveUrlFromRateIfNeeded(text);
              }
            }}
          />
        </label>
        <label className="place-lodging-rate-field">
          <span>Cleaning + fees (optional)</span>
          <input
            ref={feesRef}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="$150"
            value={fees}
            disabled={pending}
            onChange={(e) => setFees(e.target.value)}
            onKeyDown={(e) => onKeyDown(e, "fees")}
          />
        </label>
        <label className="place-lodging-rate-field place-lodging-rate-field--wide">
          <span>Listing URL (optional)</span>
          <input
            ref={urlRef}
            type="url"
            autoComplete="off"
            placeholder="https://"
            value={sourceUrl}
            disabled={pending}
            onChange={(e) => setSourceUrl(e.target.value)}
            onKeyDown={(e) => onKeyDown(e, "url")}
          />
        </label>
        {requireName ? (
          <label className="place-lodging-rate-field">
            <span>Your name</span>
            <input
              ref={nameRef}
              type="text"
              autoComplete="name"
              placeholder="Diane"
              value={name}
              disabled={pending}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => onKeyDown(e, "name")}
            />
          </label>
        ) : null}
      </div>
      {error ? <p className="place-lodging-rate-error">{error}</p> : null}
      <div className="place-lodging-rate-actions">
        <button
          type="button"
          className="btn btn-berry btn-sm"
          disabled={pending}
          onClick={save}
        >
          {pending ? "Saving…" : "Save rate"}
        </button>
        {onCancel ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
