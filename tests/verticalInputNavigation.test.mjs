import test from "node:test";
import assert from "node:assert/strict";
import { findVerticalInputIndex } from "../src/utils/verticalInputNavigation.js";

const rect = (left, top, width = 80, height = 40) => ({ left, right: left + width, top, bottom: top + height });
const layout = [rect(0, 0), rect(110, 0), rect(20, 80), rect(130, 80), rect(60, 160)];

test("moves to the horizontally nearest input in the adjacent visual row", () => {
  assert.equal(findVerticalInputIndex(layout, 3, -1), 1);
  assert.equal(findVerticalInputIndex(layout, 1, 1), 3);
  assert.equal(findVerticalInputIndex(layout, 3, 1), 4);
});

test("stays on the current input at top and bottom boundaries", () => {
  assert.equal(findVerticalInputIndex(layout, 0, -1), 0);
  assert.equal(findVerticalInputIndex(layout, 4, 1), 4);
});

test("ignores missing input rectangles and invalid directions", () => {
  assert.equal(findVerticalInputIndex([rect(0, 0), null, rect(0, 80)], 2, -1), 0);
  assert.equal(findVerticalInputIndex(layout, 2, 0), 2);
});
