import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_KEYBOARD_BINDINGS,
  KEYBOARD_BINDINGS_STORAGE_KEY,
  assignKeyboardBinding,
  formatKeyCode,
  loadKeyboardBindings,
  storeKeyboardBindings,
} from "../src/utils/keyboardBindings.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("loads and stores the default keyboard bindings", () => {
  const storage = memoryStorage();
  assert.deepEqual(loadKeyboardBindings(storage), DEFAULT_KEYBOARD_BINDINGS);
  storeKeyboardBindings(DEFAULT_KEYBOARD_BINDINGS, storage);
  assert.deepEqual(JSON.parse(storage.getItem(KEYBOARD_BINDINGS_STORAGE_KEY)), DEFAULT_KEYBOARD_BINDINGS);
});

test("assigns a new key without changing other actions", () => {
  const result = assignKeyboardBinding(DEFAULT_KEYBOARD_BINDINGS, "advance", "KeyN");
  assert.deepEqual(result.bindings, { advance: "KeyN", submit: "Enter", replay: "Tab", stop: "Escape" });
  assert.equal(result.swappedAction, null);
});

test("swaps actions when a key is already assigned", () => {
  const result = assignKeyboardBinding(DEFAULT_KEYBOARD_BINDINGS, "advance", "Enter");
  assert.deepEqual(result.bindings, { advance: "Enter", submit: "Space", replay: "Tab", stop: "Escape" });
  assert.equal(result.swappedAction, "submit");
});

test("keeps fixed navigation keys reserved", () => {
  const result = assignKeyboardBinding(DEFAULT_KEYBOARD_BINDINGS, "submit", "ArrowRight");
  assert.equal(result.bindings, DEFAULT_KEYBOARD_BINDINGS);
  assert.equal(result.changed, false);
});

test("formats physical key codes for the interface", () => {
  assert.equal(formatKeyCode("Space"), "Space");
  assert.equal(formatKeyCode("Escape"), "Esc");
  assert.equal(formatKeyCode("KeyN"), "N");
  assert.equal(formatKeyCode("Digit4"), "4");
});
