import test from "node:test";
import assert from "node:assert/strict";
import { insertAnswerGap, removeAnswerGap } from "../src/utils/insertAnswerGap.js";

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

test("removes an empty slot and shifts following answers left", () => {
  const answers = ["in", "spring", "", "so", "they", "", "different"];
  assert.deepEqual(removeAnswerGap(answers, 2), ["in", "spring", "so", "they", "", "different", ""]);
  assert.deepEqual(answers, ["in", "spring", "", "so", "they", "", "different"]);
});

test("does not remove a filled slot", () => {
  const answers = ["in", "spring", "so"];
  assert.equal(removeAnswerGap(answers, 1), answers);
});

test("keeps trailing empty slots unchanged when there is no later content", () => {
  const answers = ["in", "spring", "", ""];
  assert.equal(removeAnswerGap(answers, 2), answers);
});
