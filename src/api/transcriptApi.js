const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    throw new Error(body?.detail ?? `Request failed with status ${response.status}`);
  }
  return body;
}

export async function uploadTranscriptImages(files, practiceId = null) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file, file.name));
  if (practiceId) formData.append("practice_id", practiceId);
  return request("/api/transcript/upload", { method: "POST", body: formData });
}

export function analyzeTranscript(sessionId) {
  return request("/api/transcript/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export function getTranscriptSession(sessionId) {
  return request(`/api/transcript/${sessionId}`);
}

export function confirmTranscript(sessionId, transcript) {
  return request(`/api/transcript/${sessionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, confirmed: true }),
  });
}

export function transcriptAssetUrl(path) {
  if (!path || /^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}
