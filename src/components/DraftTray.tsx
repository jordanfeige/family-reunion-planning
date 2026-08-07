"use client";

import { useEffect, useRef, useState } from "react";

/**
 * §1d Draft tray — chips pinned above the composer.
 * Tap edits that field INLINE (no modal). Collapses when empty.
 * Unresolved values use shimmer (§1e).
 */
export function DraftTray({
  chips,
  onCommit,
}: {
  chips: { key: string; label: string; pending?: boolean; value?: string }[];
  onCommit: (key: string, value: string) => void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingKey) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingKey]);

  if (!chips.length) return null;

  function startEdit(chip: { key: string; label: string; value?: string }) {
    setEditingKey(chip.key);
    setDraft(chip.value ?? chip.label);
  }

  function commit() {
    if (!editingKey) return;
    const key = editingKey;
    const value = draft.trim();
    setEditingKey(null);
    if (value) onCommit(key, value);
  }

  function cancel() {
    setEditingKey(null);
    setDraft("");
  }

  return (
    <div className="wa-draft-tray">
      <p className="wa-draft-tray-eyebrow">Draft so far</p>
      <div className="wa-draft-chips">
        {chips.map((c) =>
          editingKey === c.key ? (
            <span key={c.key} className="wa-chip wa-chip--editing">
              <input
                ref={inputRef}
                className="wa-chip-input"
                value={draft}
                aria-label={`Edit ${c.key}`}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commit()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancel();
                  }
                }}
              />
            </span>
          ) : (
            <button
              key={c.key}
              type="button"
              className={`wa-chip${c.pending ? " is-pending" : ""}`}
              onClick={() => startEdit(c)}
            >
              {c.pending ? (
                <span className="wa-chip-value wa-pending">
                  {c.label || "····"}
                </span>
              ) : (
                c.label
              )}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
