import assert from "node:assert/strict";
import test from "node:test";
import { mockSentences } from "../src/data/mockSentences.js";

test("removes sentence punctuation while preserving IELTS token formats", () => {
  assert.deepEqual(mockSentences[2].tokens, ["The", "library", "is", "located", "on", "the", "second", "floor"]);
  assert.ok(mockSentences[4].tokens.includes("£150"));
  assert.ok(mockSentences[5].tokens.includes("10:30"));
  assert.ok(mockSentences[8].tokens.includes("john@example.com"));
  assert.ok(mockSentences[9].tokens.includes("part-time"));
  assert.ok(mockSentences[11].tokens.includes("We've"));
});
