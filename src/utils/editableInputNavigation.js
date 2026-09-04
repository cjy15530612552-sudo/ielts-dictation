function isEditableInput(input) {
  if (!input || input.disabled || input.readOnly) return false;
  if (input.hidden || input.getAttribute?.("aria-hidden") === "true") return false;
  return typeof input.getClientRects !== "function" || input.getClientRects().length > 0;
}

export function findEditableInputIndex(inputs, fromIndex, direction) {
  if (!Array.isArray(inputs) || ![1, -1].includes(direction)) return -1;
  for (
    let index = fromIndex + direction;
    index >= 0 && index < inputs.length;
    index += direction
  ) {
    if (isEditableInput(inputs[index])) return index;
  }
  return -1;
}
