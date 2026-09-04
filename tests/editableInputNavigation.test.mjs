import assert from "node:assert/strict";
import test from "node:test";

import { findEditableInputIndex } from "../src/utils/editableInputNavigation.js";

const input = (overrides = {}) => ({
  disabled: false,
  readOnly: false,
  hidden: false,
  getAttribute: () => null,
  getClientRects: () => [{}],
  ...overrides,
});

test("finds editable inputs in both directions", () => {
  const inputs = [input(), input(), input()];
  assert.equal(findEditableInputIndex(inputs, 0, 1), 1);
  assert.equal(findEditableInputIndex(inputs, 2, -1), 1);
});

test("skips disabled, read-only, hidden, and non-rendered inputs", () => {
  const inputs = [
    input(),
    input({ disabled: true }),
    input({ readOnly: true }),
    input({ hidden: true }),
    input({ getClientRects: () => [] }),
    input(),
  ];
  assert.equal(findEditableInputIndex(inputs, 0, 1), 5);
  assert.equal(findEditableInputIndex(inputs, 5, -1), 0);
});

test("returns no target at boundaries or for invalid input", () => {
  const inputs = [input(), input()];
  assert.equal(findEditableInputIndex(inputs, 0, -1), -1);
  assert.equal(findEditableInputIndex(inputs, 1, 1), -1);
  assert.equal(findEditableInputIndex(inputs, 0, 0), -1);
  assert.equal(findEditableInputIndex(null, 0, 1), -1);
});
