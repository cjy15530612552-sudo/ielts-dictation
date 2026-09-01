import test from "node:test";
import assert from "node:assert/strict";
import { formatLocalTime } from "../src/utils/formatLocalTime.js";

test("formats timestamps in the browser local calendar", () => {
  const now = new Date(2026, 7, 31, 20, 0);
  assert.match(formatLocalTime(new Date(2026, 7, 31, 18, 42).toISOString(), now), /^今天\s/);
  assert.match(formatLocalTime(new Date(2026, 7, 30, 21, 10).toISOString(), now), /^昨天\s/);
  assert.doesNotMatch(formatLocalTime(new Date(2026, 7, 27, 20, 31).toISOString(), now), /今天|昨天/);
});
