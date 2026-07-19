import type { FocusEvent, MouseEvent } from "react";

/**
 * Select-all on focus helpers.
 * mouseup is only suppressed for the click that focused the field, so a
 * second click can still place the caret.
 */
const justFocused = new WeakSet<EventTarget>();

export function handleSelectOnFocus(
  e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>
) {
  const el = e.currentTarget;
  justFocused.add(el);
  requestAnimationFrame(() => {
    try {
      el.select();
    } catch {
      /* ignore — some input types don't support select() */
    }
  });
}

export function handleSelectOnMouseUp(
  e: MouseEvent<HTMLInputElement | HTMLTextAreaElement>
) {
  const el = e.currentTarget;
  if (!justFocused.has(el)) return;
  justFocused.delete(el);
  e.preventDefault();
}
