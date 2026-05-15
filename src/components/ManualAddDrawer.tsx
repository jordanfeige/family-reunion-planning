"use client";

import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";

type DrawerChild = (helpers: { close: () => void }) => ReactNode;

export function ManualAddDrawer({
  title,
  triggerLabel,
  children,
  triggerClassName,
}: {
  title: string;
  triggerLabel: string;
  children: DrawerChild;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        className={triggerClassName ?? "btn btn-secondary btn-sm"}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
      >
        {triggerLabel}
      </button>
      {open ? (
        <div className="manual-add-drawer-root">
          <button
            type="button"
            className="manual-add-drawer-backdrop"
            aria-label="Close panel"
            onClick={close}
          />
          <div
            id={panelId}
            className="manual-add-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="manual-add-drawer-header">
              <h2 id={titleId} className="manual-add-drawer-title">
                {title}
              </h2>
              <button
                type="button"
                className="manual-add-drawer-close"
                aria-label="Close"
                onClick={close}
              >
                ×
              </button>
            </div>
            <div className="manual-add-drawer-body">{children({ close })}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
