/** Scroll to and highlight the first field blocking a primary CTA. */

export function focusBlockingField(
  target: string | HTMLElement | null | undefined,
): void {
  if (typeof document === "undefined") return;
  const el =
    typeof target === "string" ? document.querySelector(target) : target;
  if (!el || !(el instanceof HTMLElement)) return;

  document
    .querySelectorAll(".field-block-highlight")
    .forEach((node) => node.classList.remove("field-block-highlight"));

  const highlightRoot =
    el.closest(".field, .decision-weekend-field, .decision-card, .live-shortlist, .survey-segment-group, .new-trip-composer, .ballot-controls") ??
    el;

  highlightRoot.classList.add("field-block-highlight");
  highlightRoot.scrollIntoView({ behavior: "smooth", block: "center" });

  const focusable =
    el.matches("input, textarea, select, button, [tabindex]")
      ? el
      : highlightRoot.querySelector<HTMLElement>(
          "input, textarea, select, button, [tabindex]",
        );
  focusable?.focus({ preventScroll: true });

  window.setTimeout(() => {
    highlightRoot.classList.remove("field-block-highlight");
  }, 2600);
}
