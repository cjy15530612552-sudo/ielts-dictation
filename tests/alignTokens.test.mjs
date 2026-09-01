import assert from "node:assert/strict";
import test from "node:test";
import { alignTokens } from "../src/utils/alignTokens.js";

test("aligns missing words without shifting later matches", () => {
  const expected = ["The", "library", "is", "located", "on", "the", "second", "floor"];
  const entered = ["The", "library", "located", "on", "second", "floor"];
  const result = alignTokens(expected, entered);
  assert.deepEqual(
    result.aligned.map(({ type }) => type),
    ["correct", "correct", "missing", "correct", "correct", "missing", "correct", "correct"],
  );
  assert.equal(result.correctCount, 6);
  assert.equal(result.issueCount, 2);
});

test("normalizes case and curly apostrophes", () => {
  const result = alignTokens(["We've"], ["we’ve"]);
  assert.equal(result.aligned[0].type, "correct");
});

test("reports spelling mistakes and extra words", () => {
  const result = alignTokens(["the", "library"], ["the", "libary", "today"]);
  assert.equal(result.aligned[1].type, "wrong");
  assert.deepEqual(result.extras, ["today"]);
});
