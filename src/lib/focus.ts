/**
 * Whether focus moved from inside `container` to something outside it (the `relatedTarget` of
 * a blur or focusout event). `next` is null when nothing focusable took focus: a click on plain
 * text, or another window. Callers handle outside clicks separately; closing a popup on a null
 * target would swallow a click on one of its buttons in Safari, which does not focus buttons.
 */
export function isFocusLeaving(
  container: Pick<Node, 'contains'> | null,
  next: EventTarget | null
): boolean {
  if (!container || !next) return false;
  return !container.contains(next as Node);
}
