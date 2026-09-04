import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const browserPath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const baseUrl = "http://127.0.0.1:4173";
const outputDir = new URL("../qa/", import.meta.url);
const outputPath = (name) => fileURLToPath(new URL(name, outputDir));
await mkdir(outputDir, { recursive: true });

const imageBuffer = await readFile(outputPath("implementation-desktop.png"));
const imageFile = (index) => ({ name: `ielts-page-${index}.png`, mimeType: "image/png", buffer: imageBuffer });
const transcript = {
  title: "Community Centre Registration",
  type: "dialogue",
  speakers: ["Receptionist", "Caller"],
  segments: [
    { id: 1, speaker: "Receptionist", text: "Good morning." },
    { id: 2, speaker: "Receptionist", text: "How can I help you?" },
    { id: 3, speaker: "Caller", text: "I'd like to register for the course on 14 September." },
  ],
  full_text: "Good morning. How can I help you?\n\nI'd like to register for the course on 14 September.",
  uncertain_tokens: [{ token: "14 September", reason: "Please verify the date in image 2." }],
};
const session = (status = "completed", currentTranscript = transcript) => ({
  session_id: "session-qa",
  practice_id: "practice-qa",
  status,
  images: [1, 2].map((order) => ({
    id: `image-${order}`,
    order,
    original_name: `ielts-page-${order}.png`,
    content_type: "image/png",
    size: imageBuffer.length,
    url: `/api/transcript/session-qa/images/image-${order}`,
  })),
  transcript: currentTranscript,
  error: null,
  created_at: "2026-08-31T00:00:00Z",
  updated_at: "2026-08-31T00:00:00Z",
});

const browser = await chromium.launch({ headless: true, executablePath: browserPath });
const errors = [];
let savedTranscript = transcript;
let favorites = [];
let createdPart = null;

async function createPage(viewport) {
  const page = await browser.newPage({ viewport });
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/practices", async (route) => {
    if (route.request().method() === "POST") {
      createdPart = route.request().postDataJSON().part;
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "practice-qa", name: "剑雅18 Test 1 Part 4", created_at: "2026-08-31T00:00:00Z", updated_at: "2026-08-31T00:00:00Z", last_completed_at: null, current_sentence: 1, total_sentences: 0, completed: false, transcript: null, favorite_count: 0 }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "practice-qa", name: "剑雅18 Test 1 Part 4", created_at: "2026-08-31T00:00:00Z", updated_at: "2026-08-31T00:00:00Z", last_completed_at: null, current_sentence: 1, total_sentences: 3, completed: false, transcript, transcript_session_id: "session-qa", favorite_count: 0 }]) });
  });
  await page.route("**/api/practices/practice-qa", async (route) => {
    if (route.request().method() === "DELETE") return route.fulfill({ status: 204, body: "" });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "practice-qa", name: "剑雅18 Test 1 Part 4", created_at: "2026-08-31T00:00:00Z", updated_at: "2026-08-31T00:00:00Z", last_completed_at: null, current_sentence: 1, total_sentences: 3, completed: false, transcript, favorite_count: favorites.length, sentences: [{ id: "sentence-1", sentence_index: 1, speaker: "Receptionist", display_text: "Good morning.", speech_text: "Good morning.", audio_url: null, status: "pending" }, { id: "sentence-2", sentence_index: 2, speaker: "Receptionist", display_text: "How can I help you?", speech_text: "How can I help you?", audio_url: null, status: "pending" }, { id: "sentence-3", sentence_index: 3, speaker: "Caller", display_text: "I'd like to register for the course on 14 September.", speech_text: "I'd like to register for the course on 14 September.", audio_url: null, status: "pending" }] }) });
  });
  await page.route("**/api/practices/practice-qa/**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "practice-qa", current_sentence: 2, total_sentences: 2, completed: route.request().url().endsWith("/complete"), favorite_count: favorites.length }) }));
  await page.route("**/api/word/explain", async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ word: body.word, lemma: body.word.toLowerCase(), phonetic_uk: "/ɡʊd/", part_of_speech: "adjective", meaning_zh: "好的", meaning_in_context: "这里是礼貌问候的一部分" }) });
  });
  await page.route("**/api/vocabulary*", async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      const item = { ...body, id: "favorite-1", created_at: "2026-08-31T00:00:00Z", practice_name: "剑雅18 Test 1 Part 4", audio_url: "/audio/playground/good.mp3", audio_status: "ready", audio_error: null };
      const second = {
        ...item,
        id: "favorite-2",
        word: "Morning",
        lemma: "morning",
        phonetic_uk: "/ˈmɔːnɪŋ/",
        part_of_speech: "noun",
        meaning_zh: "早晨",
        meaning_in_context: "问候中表示早晨",
        audio_url: "/audio/playground/morning.mp3",
      };
      favorites = [item, second];
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ item, created: true }) });
    }
    if (url.pathname.endsWith("/groups")) {
      const groups = favorites.length ? [{ practice_id: "practice-qa", practice_name: "剑雅18 Test 1 Part 4", word_count: favorites.length, updated_at: favorites[0].created_at }] : [];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(groups) });
    }
    const practiceId = url.searchParams.get("practice_id");
    const filtered = practiceId ? favorites.filter((item) => item.practice_id === practiceId) : favorites;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(filtered) });
  });
  await page.route("**/api/vocabulary/groups", async (route) => {
    const groups = favorites.length ? [{ practice_id: "practice-qa", practice_name: "剑雅18 Test 1 Part 4", word_count: favorites.length, updated_at: favorites[0].created_at }] : [];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(groups) });
  });
  await page.route("**/api/transcript/upload", async (route) => route.fulfill({
    status: 201, contentType: "application/json", body: JSON.stringify(session("uploaded", null)),
  }));
  await page.route("**/api/transcript/analyze", async (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(session()),
  }));
  await page.route("**/api/transcript/session-qa", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      savedTranscript = body.transcript;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session("confirmed", savedTranscript)) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session("completed", savedTranscript)) });
  });
  await page.route("**/api/transcript/session-qa/images/*", async (route) => route.fulfill({
    status: 200, contentType: "image/png", body: imageBuffer,
  }));
  return page;
}

const desktop = await createPage({ width: 1440, height: 1024 });
await desktop.goto(`${baseUrl}/practice/new`, { waitUntil: "domcontentloaded" });
await desktop.getByLabel("练习名称").fill("剑雅18 Test 1 Part 4");
await desktop.getByLabel("Part", { exact: true }).selectOption("part4");
const dropzone = desktop.getByRole("region", { name: "上传截图区域，可拖拽、选择或粘贴图片" });
await dropzone.getByText("拖拽截图到这里").click();
if (!await dropzone.evaluate((element) => element === document.activeElement)) {
  throw new Error("Clicking upload content did not focus the paste target");
}
await desktop.evaluate(() => {
  const clipboardData = new DataTransfer();
  clipboardData.items.add(new File(["clipboard image"], "clipboard.png", { type: "image/png" }));
  document.querySelector(".upload-dropzone").dispatchEvent(new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
    clipboardData,
  }));
});
await desktop.getByText("1 / 6").waitFor();
await desktop.getByAltText("第 1 张：clipboard.png").waitFor();
const input = desktop.getByLabel("选择 IELTS 原文截图");
await input.setInputFiles([imageFile(1), imageFile(2)]);
await desktop.getByText("3 / 6").waitFor();
await desktop.screenshot({ path: outputPath("transcript-upload.png"), fullPage: true });

await input.setInputFiles(Array.from({ length: 5 }, (_, index) => imageFile(index + 3)));
await desktop.getByText("每次最多上传 6 张图片").waitFor();
await desktop.getByLabel("将 ielts-page-2.png 向前移动").click();
await desktop.getByRole("button", { name: "开始识别" }).click();
await desktop.waitForURL("**/transcript/session-qa/review");
await desktop.getByRole("heading", { name: "可编辑 Transcript" }).waitFor();
await desktop.screenshot({ path: outputPath("transcript-review.png"), fullPage: true });

const fullText = desktop.getByLabel("完整英文原文");
await fullText.fill(`${transcript.full_text}\n\nPostcode: NG1 4BU.`);
await desktop.getByText("查看模型 JSON").click();
await desktop.getByText('"full_text"').waitFor();
await desktop.getByRole("button", { name: "确认原文并生成语音" }).click();
await desktop.waitForURL(`${baseUrl}/`);
await desktop.getByRole("heading", { name: "我的听力练习" }).waitFor();
await desktop.screenshot({ path: outputPath("home-with-practice.png"), fullPage: true });
if (!savedTranscript.full_text.includes("NG1 4BU")) throw new Error("Edited transcript was not submitted");
if (createdPart !== "part4") throw new Error("Selected IELTS Part was not submitted with the practice");

await desktop.getByRole("button", { name: "重新开始 剑雅18 Test 1 Part 4" }).click();
await desktop.waitForURL("**/practice/practice-qa/dictation?restart=1");
await desktop.goBack();
await desktop.getByRole("link", { name: "设置 剑雅18 Test 1 Part 4" }).click();
await desktop.waitForURL("**/transcript/session-qa/review");
await desktop.goBack();

await desktop.getByRole("link", { name: /^剑雅18 Test 1 Part 4/ }).click();
await desktop.waitForURL("**/practice/practice-qa/dictation");
for (const [index, word] of ["Good", "morning"].entries()) {
  await desktop.getByLabel(`第 ${index + 1} 个单词`).fill(word);
}
await desktop.getByLabel("第 2 个单词").press("Enter");
await desktop.getByRole("button", { name: "Good" }).click();
await desktop.getByRole("dialog", { name: "Good 单词解释" }).waitFor();
await desktop.getByRole("button", { name: "收藏单词" }).click();
await desktop.getByText("已加入单词本").waitFor();
await desktop.goto(baseUrl, { waitUntil: "domcontentloaded" });
const groupCard = desktop.locator(".vocabulary-group-card", { hasText: "剑雅18 Test 1 Part 4" });
await groupCard.waitFor();
await desktop.screenshot({ path: outputPath("home-vocabulary-groups.png"), fullPage: true });
await groupCard.click();
await desktop.waitForURL("**/vocabulary?practiceId=practice-qa");
await desktop.getByRole("heading", { name: "剑雅18 Test 1 Part 4" }).waitFor();
await desktop.getByRole("heading", { name: "Good" }).waitFor();
await desktop.getByRole("button", { name: "播放 Good 发音" }).waitFor();
await desktop.screenshot({ path: outputPath("practice-vocabulary.png"), fullPage: true });
await desktop.evaluate(() => {
  window.__vocabularyAudioUrls = [];
  window.Audio = class MockAudio {
    constructor(src) { this.src = src; }
    addEventListener() {}
    pause() {}
    play() {
      window.__vocabularyAudioUrls.push(this.src);
      return Promise.resolve();
    }
  };
});
await desktop.getByRole("button", { name: "进行听写" }).click();
await desktop.getByRole("heading", { name: "听一听这个单词" }).waitFor();
await desktop.getByText("1 / 2").waitFor();
await desktop.screenshot({ path: outputPath("vocabulary-dictation.png"), fullPage: true });
if (await desktop.getByRole("heading", { name: "Good" }).count()) throw new Error("The drill revealed the word before an answer was chosen");
await desktop.getByRole("button", { name: /^理解/ }).click();
await desktop.getByText("2 / 2").waitFor();
if ((await desktop.evaluate(() => window.__vocabularyAudioUrls.length)) !== 2) throw new Error("Understanding did not automatically play the next word");
await desktop.getByRole("button", { name: /^不理解/ }).click();
await desktop.getByRole("heading", { name: "Morning" }).waitFor();
await desktop.getByRole("button", { name: "完成" }).click();
await desktop.getByRole("heading", { name: "本轮听写完成" }).waitFor();
await desktop.getByText("理解 1 个 · 需要复习 1 个").waitFor();
await desktop.screenshot({ path: outputPath("vocabulary-dictation-complete.png"), fullPage: true });
await desktop.getByRole("button", { name: "再来一遍" }).click();
await desktop.getByText("1 / 2").waitFor();
await desktop.getByRole("button", { name: "返回单词本" }).click();
await desktop.getByRole("heading", { name: "Good" }).waitFor();

const mobile = await createPage({ width: 390, height: 844 });
await mobile.goto(`${baseUrl}/practice/new`, { waitUntil: "domcontentloaded" });
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (overflow > 1) throw new Error(`Mobile upload layout overflows by ${overflow}px`);
await mobile.screenshot({ path: outputPath("transcript-upload-mobile.png"), fullPage: true });

const vocabularyMobile = await createPage({ width: 390, height: 844 });
await vocabularyMobile.goto(`${baseUrl}/vocabulary?practiceId=practice-qa`, { waitUntil: "domcontentloaded" });
await vocabularyMobile.evaluate(() => {
  window.Audio = class MockAudio {
    addEventListener() {}
    pause() {}
    play() { return Promise.resolve(); }
  };
});
await vocabularyMobile.getByRole("button", { name: "进行听写" }).click();
await vocabularyMobile.getByRole("heading", { name: "听一听这个单词" }).waitFor();
const vocabularyOverflow = await vocabularyMobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (vocabularyOverflow > 1) throw new Error(`Mobile vocabulary drill overflows by ${vocabularyOverflow}px`);
await vocabularyMobile.screenshot({ path: outputPath("vocabulary-dictation-mobile.png"), fullPage: true });

const linkage = await createPage({ width: 1100, height: 800 });
await linkage.goto(`${baseUrl}/practice/new`, { waitUntil: "domcontentloaded" });
await linkage.getByLabel("Part", { exact: true }).selectOption("part3");
await linkage.getByRole("button", { name: "设置 Part 3 Discussion 语音" }).click();
await linkage.waitForURL("**/tts-playground?mode=part3");
if ((await linkage.getByLabel("IELTS Mode").inputValue()) !== "part3") throw new Error("Part selection did not carry into Voice Lab settings");

await writeFile(outputPath("transcript-browser-check.json"), JSON.stringify({
  routes: ["/practice/new", "/transcript/session-qa/review", "/"],
  validated: ["clipboard image paste", "1-6 file limit", "practice naming", "Part persistence", "Part-to-Voice-Lab linkage", "thumbnail order", "analyze navigation", "editable transcript", "structured JSON", "confirmation save", "home insertion", "practice restart", "practice settings return to transcript review", "progress resume route", "context word card", "favorite save with generated pronunciation", "practice vocabulary grouping", "practice vocabulary filtering", "vocabulary pronunciation control", "vocabulary dictation start", "understood auto-advance", "not-understood reveal", "vocabulary dictation completion", "vocabulary dictation restart", "mobile vocabulary dictation", "mobile overflow"],
  consoleErrors: errors,
}, null, 2));
await browser.close();
if (errors.length) throw new Error(`Browser errors detected: ${errors.join("; ")}`);
console.log("Transcript upload and review flow passed.");
