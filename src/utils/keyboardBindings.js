export const KEYBOARD_BINDINGS_STORAGE_KEY = "ielts-dictation.keyboard-bindings.v1";

export const DEFAULT_KEYBOARD_BINDINGS = Object.freeze({
  advance: "Space",
  submit: "Enter",
  replay: "Tab",
  stop: "Escape",
});

export const FIXED_KEY_CODES = new Set(["ArrowLeft", "ArrowRight", "Backspace"]);
const MODIFIER_KEY_CODES = new Set([
  "AltLeft", "AltRight", "ControlLeft", "ControlRight", "MetaLeft", "MetaRight", "ShiftLeft", "ShiftRight",
]);

function availableStorage(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage; } catch { return null; }
}

export function normalizeKeyboardBindings(value) {
  const normalized = { ...DEFAULT_KEYBOARD_BINDINGS };
  if (!value || typeof value !== "object") return normalized;

  const used = new Set();
  for (const action of Object.keys(DEFAULT_KEYBOARD_BINDINGS)) {
    const code = value[action];
    if (typeof code === "string" && code && !FIXED_KEY_CODES.has(code) && !MODIFIER_KEY_CODES.has(code) && !used.has(code)) {
      normalized[action] = code;
      used.add(code);
    }
  }
  return new Set(Object.values(normalized)).size === Object.keys(normalized).length
    ? normalized
    : { ...DEFAULT_KEYBOARD_BINDINGS };
}

export function loadKeyboardBindings(storage) {
  const target = availableStorage(storage);
  if (!target) return { ...DEFAULT_KEYBOARD_BINDINGS };
  try {
    return normalizeKeyboardBindings(JSON.parse(target.getItem(KEYBOARD_BINDINGS_STORAGE_KEY)));
  } catch {
    return { ...DEFAULT_KEYBOARD_BINDINGS };
  }
}

export function storeKeyboardBindings(bindings, storage) {
  const normalized = normalizeKeyboardBindings(bindings);
  const target = availableStorage(storage);
  if (target) target.setItem(KEYBOARD_BINDINGS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function assignKeyboardBinding(bindings, action, code) {
  if (!(action in DEFAULT_KEYBOARD_BINDINGS) || !code || FIXED_KEY_CODES.has(code) || MODIFIER_KEY_CODES.has(code)) {
    return { bindings, swappedAction: null, changed: false };
  }

  const next = { ...normalizeKeyboardBindings(bindings) };
  const previousCode = next[action];
  const swappedAction = Object.keys(next).find((candidate) => candidate !== action && next[candidate] === code) ?? null;
  if (swappedAction) next[swappedAction] = previousCode;
  next[action] = code;
  return { bindings: next, swappedAction, changed: previousCode !== code };
}

export function isBindableKeyboardEvent(event) {
  return Boolean(event.code) && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
    && !FIXED_KEY_CODES.has(event.code) && !MODIFIER_KEY_CODES.has(event.code);
}

export function formatKeyCode(code) {
  const labels = { Space: "Space", Enter: "Enter", Tab: "Tab", Escape: "Esc" };
  if (labels[code]) return labels[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return code.replace(/(Left|Right)$/, " $1");
}
