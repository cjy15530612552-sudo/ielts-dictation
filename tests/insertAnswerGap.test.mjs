import test from "node:test";
import assert from "node:assert/strict";
import { insertAnswerGap } from "../src/utils/insertAnswerGap.js";

test("inserts a gap and shifts answers through the nearest empty slot", () => {
  const answers = ["weather", "conditions", "vary", "significantly", "", "need"];
  assert.deepEqual(insertAnswerGap(answers, 2), ["weather", "conditions", "", "vary", "significantly", "need"]);
  assert.deepEqual(answers, ["weather", "conditions", "vary", "significantly", "", "need"]);
});

test("does nothing when the current slot is already empty", () => {
  const answers = ["weather", "", "vary"];
  assert.equal(insertAnswerGap(answers, 1), answers);
});

test("does not move or discard answers when no empty slot remains on the right", () => {
  const answers = ["weather", "conditions", "vary"];
  assert.equal(insertAnswerGap(answers, 1), answers);
});

test("stops shifting at the nearest empty slot", () => {
  assert.deepEqual(insertAnswerGap(["a", "b", "c", "", "d", ""], 1), ["a", "", "b", "c", "d", ""]);
});
