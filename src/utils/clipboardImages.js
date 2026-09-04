const EXTENSION_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function normalizeClipboardFile(file, index) {
  const extension = EXTENSION_BY_TYPE[file.type];
  if (!extension) return null;
  if (new RegExp(`\\.${extension === "jpg" ? "jpe?g" : extension}$`, "i").test(file.name ?? "")) {
    return file;
  }
  return new File(
    [file],
    `clipboard-image-${index + 1}.${extension}`,
    { type: file.type, lastModified: file.lastModified || Date.now() },
  );
}

export function getClipboardImageFiles(clipboardData) {
  if (!clipboardData) return [];
  const itemFiles = Array.from(clipboardData.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter(Boolean);
  const candidates = itemFiles.length > 0 ? itemFiles : Array.from(clipboardData.files ?? []);
  return candidates
    .map(normalizeClipboardFile)
    .filter(Boolean);
}
