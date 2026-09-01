const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
  const body = isJson ? await response.json() : null;
  if (!response.ok) throw new Error(body?.detail ?? `Request failed with status ${response.status}`);
  return body;
}

const jsonOptions = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const listPractices = () => request("/api/practices");
export const createPractice = (name, part = "part1") => request("/api/practices", jsonOptions("POST", { name, part }));
export const getPractice = (id) => request(`/api/practices/${id}`);
export const updatePractice = (id, data) => request(`/api/practices/${id}`, jsonOptions("PUT", data));
export const deletePractice = (id) => request(`/api/practices/${id}`, { method: "DELETE" });
export const saveProgress = (id, currentSentence) => request(`/api/practices/${id}/progress`, jsonOptions("POST", { current_sentence: currentSentence }));
export const completePractice = (id) => request(`/api/practices/${id}/complete`, { method: "POST" });
export const restartPractice = (id) => request(`/api/practices/${id}/restart`, { method: "POST" });
export const endPracticeSession = (id) => request(`/api/practices/${id}/end-session`, { method: "POST" });
export const generatePracticeSentenceAudio = (practiceId, sentenceId) => request(
  `/api/practices/${practiceId}/sentences/${sentenceId}/audio`,
  { method: "POST" },
);

export const explainWord = (word, sentence) => request("/api/word/explain", jsonOptions("POST", { word, sentence }));
export const listVocabulary = (limit, practiceId, unassigned = false) => {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (practiceId) params.set("practice_id", practiceId);
  if (unassigned) params.set("unassigned", "true");
  const query = params.toString();
  return request(`/api/vocabulary${query ? `?${query}` : ""}`);
};
export const listVocabularyGroups = () => request("/api/vocabulary/groups");
export const addFavorite = (data) => request("/api/vocabulary", jsonOptions("POST", data));
export const generateFavoriteAudio = (id) => request(`/api/vocabulary/${id}/audio`, { method: "POST" });
export const deleteFavorite = (id) => request(`/api/vocabulary/${id}`, { method: "DELETE" });

export const getTtsConfig = () => request("/api/tts/playground/config");
export const listTtsVersions = () => request("/api/tts/playground/versions");
export const generateTtsVersion = (data) => request("/api/tts/playground/generate", jsonOptions("POST", data));
export const deleteTtsVersion = (id) => request(`/api/tts/playground/versions/${id}`, { method: "DELETE" });
export const listTtsSettings = () => request("/api/tts/settings");
export const saveDefaultTtsSetting = (data) => request("/api/tts/settings/default", jsonOptions("POST", data));
export const appAssetUrl = (path) => `${API_BASE_URL}${path}`;
export const getAiConfig = () => request("/api/ai/config");
export const saveServerApiKey = (apiKey) => request("/api/ai/key", jsonOptions("POST", { api_key: apiKey }));
export const clearServerApiKey = () => request("/api/ai/key", { method: "DELETE" });
