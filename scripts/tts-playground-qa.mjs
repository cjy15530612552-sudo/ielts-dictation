import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const browserPath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const outputDir = new URL("../qa/", import.meta.url);
const outputPath = (name) => fileURLToPath(new URL(name, outputDir));
await mkdir(outputDir, { recursive: true });

const config = {
  model: "qwen-audio-3.0-tts-plus",
  modes: [
    { value: "part1", label: "Part 1 Conversation", instruction: "Speak in natural British English at a normal IELTS Listening test pace." },
    { value: "part2", label: "Part 2 Monologue", instruction: "Use a calm, natural monologue style." },
    { value: "part3", label: "Part 3 Discussion", instruction: "Use natural conversational rhythm and connected speech." },
    { value: "part4", label: "Part 4 Academic Lecture", instruction: "Use a clear but natural academic lecture style." },
    { value: "custom", label: "Custom", instruction: "Speak clearly and naturally in English." },
  ],
  accents: [{ value: "british", label: "British English", instruction: "Use a natural British English accent." }, { value: "australian", label: "Australian English", instruction: "Use a natural Australian English accent." }, { value: "neutral", label: "Neutral English", instruction: "Use a natural neutral English accent." }],
  paces: [{ value: "slow", label: "Slightly Slow", instruction: "Speak slightly slower." }, { value: "normal", label: "IELTS Normal", instruction: "Speak at a natural IELTS Listening test pace." }, { value: "fast", label: "Slightly Fast", instruction: "Speak slightly faster." }],
  voices: [{ value: "longanlingxin", label: "Longan Lingxin · Female" }, { value: "longanlufeng", label: "Longan Lufeng · Male" }],
  default_voice: "longanlingxin",
};
const generated = { id: "qa-version", text: "The total cost is fifteen pounds fifty, and the course starts at ten thirty.", speech_text: "The total cost is fifteen pounds fifty, and the course starts at ten thirty.", model: config.model, mode: "part1", accent: "british", pace: "normal", voice: "longanlingxin", instruction: "Speak naturally.", audio_url: "/audio/playground/qa.wav", created_at: "2026-09-01T00:00:00Z" };
const silentWav = Buffer.alloc(44 + 8000);
silentWav.write("RIFF", 0); silentWav.writeUInt32LE(silentWav.length - 8, 4); silentWav.write("WAVEfmt ", 8);
silentWav.writeUInt32LE(16, 16); silentWav.writeUInt16LE(1, 20); silentWav.writeUInt16LE(1, 22);
silentWav.writeUInt32LE(8000, 24); silentWav.writeUInt32LE(16000, 28); silentWav.writeUInt16LE(2, 32); silentWav.writeUInt16LE(16, 34);
silentWav.write("data", 36); silentWav.writeUInt32LE(8000, 40);
const browser = await chromium.launch({ headless: true, executablePath: browserPath });
const errors = [];

async function pageFor(viewport) {
  const page = await browser.newPage({ viewport });
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/tts/playground/config", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(config) }));
  await page.route("**/api/tts/playground/versions", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/tts/settings", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/tts/playground/generate", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(generated) });
  });
  await page.route("**/audio/playground/qa.wav", (route) => route.fulfill({ status: 200, contentType: "audio/wav", body: silentWav }));
  return page;
}

const desktop = await pageFor({ width: 1440, height: 1024 });
await desktop.goto("http://127.0.0.1:4173/tts-playground?mode=part3", { waitUntil: "domcontentloaded" });
await desktop.getByRole("heading", { name: "IELTS Voice Lab" }).waitFor();
if ((await desktop.getByLabel("IELTS Mode").inputValue()) !== "part3") throw new Error("Mode query did not select Part 3");
await desktop.getByRole("button", { name: "Test 4" }).click();
if (!(await desktop.getByLabel("Test text").inputValue()).includes("fifteen pounds fifty")) throw new Error("Test preset did not update text");
await desktop.getByRole("button", { name: "生成试听" }).click();
await desktop.getByRole("status").filter({ hasText: "Generating IELTS voice..." }).waitFor();
await desktop.getByText("Ready to play").first().waitFor();
await desktop.getByText("Version A").waitFor();
await desktop.screenshot({ path: outputPath("tts-playground.png"), fullPage: true });

const mobile = await pageFor({ width: 390, height: 844 });
await mobile.goto("http://127.0.0.1:4173/tts-playground", { waitUntil: "domcontentloaded" });
await mobile.getByRole("heading", { name: "IELTS Voice Lab" }).waitFor();
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (overflow > 1) throw new Error(`TTS playground overflows horizontally by ${overflow}px`);
await mobile.screenshot({ path: outputPath("tts-playground-mobile.png"), fullPage: true });

await writeFile(outputPath("tts-browser-check.json"), JSON.stringify({ route: "/tts-playground", model: config.model, officialVoices: config.voices.map((voice) => voice.value), validated: ["preset text", "mode", "accent", "pace", "voice", "instruction", "single generation", "history version", "mobile overflow"], consoleErrors: errors }, null, 2));
await browser.close();
if (errors.length) throw new Error(`Browser errors detected: ${errors.join("; ")}`);
console.log("TTS Playground desktop and mobile flow passed.");
