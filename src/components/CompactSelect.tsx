"use client";

import { useEffect, useId, useRef, useState } from "react";

export type CompactSelectOption = {
  value: string;
  label: string;
};

export function CompactSelect({
  id: idProp,
  value,
  options,
  onChange,
  placeholder = "Choose…",
  disabled = false,
  name,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  options: CompactSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  "aria-label"?: string;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const listId = `${id}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(next: string) {
    setOpen(false);
    if (next !== value) onChange(next);
  }

  return (
    <div
      ref={rootRef}
      className={`compact-select${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}`}
    >
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        type="button"
        id={id}
        className="compact-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`compact-select-value${selected ? "" : " is-placeholder"}`}>
          {displayLabel}
        </span>
        <span className="compact-select-chevron" aria-hidden />
      </button>
      {open ? (
        <ul id={listId} className="compact-select-menu" role="listbox" aria-labelledby={id}>
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li key={opt.value || "__empty"} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`compact-select-option${isSelected ? " is-selected" : ""}`}
                  onClick={() => choose(opt.value)}
                >
                  {isSelected ? (
                    <span className="compact-select-check" aria-hidden>
                      ✓
                    </span>
                  ) : (
                    <span className="compact-select-check compact-select-check--spacer" aria-hidden />
                  )}
                  <span className="compact-select-option-label">{opt.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
