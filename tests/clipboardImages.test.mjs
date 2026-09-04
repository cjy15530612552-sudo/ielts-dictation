import assert from "node:assert/strict";
import test from "node:test";

import { getClipboardImageFiles } from "../src/utils/clipboardImages.js";

const clipboardItem = (file) => ({ kind: "file", getAsFile: () => file });

test("extracts supported images from clipboard items", () => {
  const image = new File(["image"], "screenshot.png", { type: "image/png" });
  const files = getClipboardImageFiles({ items: [clipboardItem(image)] });

  assert.deepEqual(files, [image]);
});

test("adds a usable extension when a clipboard image has no filename", () => {
  const image = new File(["image"], "", { type: "image/jpeg", lastModified: 123 });
  const [file] = getClipboardImageFiles({ items: [clipboardItem(image)] });

  assert.equal(file.name, "clipboard-image-1.jpg");
  assert.equal(file.type, "image/jpeg");
  assert.equal(file.lastModified, 123);
});

test("ignores text and unsupported clipboard files", () => {
  const text = { kind: "string", getAsFile: () => null };
  const gif = new File(["image"], "animation.gif", { type: "image/gif" });

  assert.deepEqual(getClipboardImageFiles({ items: [text, clipboardItem(gif)] }), []);
});
