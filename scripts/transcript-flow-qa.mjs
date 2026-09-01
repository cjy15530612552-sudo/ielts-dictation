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
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      const item = { ...body, id: "favorite-1", created_at: "2026-08-31T00:00:00Z", practice_name: "剑雅18 Test 1 Part 4" };
      favorites = [item];
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ item, created: true }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(favorites) });
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
const input = desktop.getByLabel("选择 IELTS 原文截图");
await input.setInputFiles([imageFile(1), imageFile(2)]);
await desktop.getByText("2 / 6").waitFor();
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

const mobile = await createPage({ width: 390, height: 844 });
await mobile.goto(`${baseUrl}/practice/new`, { waitUntil: "domcontentloaded" });
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (overflow > 1) throw new Error(`Mobile upload layout overflows by ${overflow}px`);
await mobile.screenshot({ path: outputPath("transcript-upload-mobile.png"), fullPage: true });

const linkage = await createPage({ width: 1100, height: 800 });
await linkage.goto(`${baseUrl}/practice/new`, { waitUntil: "domcontentloaded" });
await linkage.getByLabel("Part", { exact: true }).selectOption("part3");
await linkage.getByRole("button", { name: "设置 Part 3 Discussion 语音" }).click();
await linkage.waitForURL("**/tts-playground?mode=part3");
if ((await linkage.getByLabel("IELTS Mode").inputValue()) !== "part3") throw new Error("Part selection did not carry into Voice Lab settings");

await writeFile(outputPath("transcript-browser-check.json"), JSON.stringify({
  routes: ["/practice/new", "/transcript/session-qa/review", "/"],
  validated: ["1-6 file limit", "practice naming", "Part persistence", "Part-to-Voice-Lab linkage", "thumbnail order", "analyze navigation", "editable transcript", "structured JSON", "confirmation save", "home insertion", "practice restart", "practice settings return to transcript review", "progress resume route", "context word card", "favorite save", "mobile overflow"],
  consoleErrors: errors,
}, null, 2));
await browser.close();
if (errors.length) throw new Error(`Browser errors detected: ${errors.join("; ")}`);
console.log("Transcript upload and review flow passed.");
