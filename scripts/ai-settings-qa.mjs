import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const browserPath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const outputDir = new URL("../qa/", import.meta.url);
const outputPath = (name) => fileURLToPath(new URL(name, outputDir));
await mkdir(outputDir, { recursive: true });
const config = {
  models: {
    text: { name: "qwen3.6-flash", base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
    vision: { name: "qwen3-vl-plus", base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
    tts: { name: "qwen-audio-3.0-tts-plus", base_url: "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer" },
  },
  server_key_configured: false,
  key_storage: "backend-env",
  env_setup_available: true,
};
let receivedKey = null;

const browser = await chromium.launch({ headless: true, executablePath: browserPath });
const errors = [];
async function makePage(viewport) {
  const page = await browser.newPage({ viewport });
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/ai/config", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(config) }));
  await page.route("**/api/ai/key", (route) => {
    if (route.request().method() === "DELETE") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false, saved_to: "backend/.env" }) });
    receivedKey = route.request().postDataJSON().api_key;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: true, saved_to: "backend/.env" }) });
  });
  return page;
}

const desktop = await makePage({ width: 1440, height: 1024 });
await desktop.goto("http://127.0.0.1:4173/ai-settings", { waitUntil: "domcontentloaded" });
await desktop.getByRole("heading", { name: "AI 配置" }).waitFor();
for (const model of ["qwen3.6-flash", "qwen3-vl-plus", "qwen-audio-3.0-tts-plus"]) await desktop.getByText(model, { exact: true }).waitFor();
const keyInput = desktop.getByLabel("API Key", { exact: true });
if ((await keyInput.getAttribute("type")) !== "password") throw new Error("API key input is not masked");
await keyInput.fill("test-session-key");
await desktop.getByRole("button", { name: "保存到后端环境" }).click();
await desktop.getByText("后端 API Key 已配置").waitFor();
if (receivedKey !== "test-session-key") throw new Error("API key was not sent to the backend setup endpoint");
if ((await desktop.locator("body").innerText()).includes("test-session-key")) throw new Error("API key is visible in rendered page text");
await desktop.screenshot({ path: outputPath("ai-settings.png"), fullPage: true });
await desktop.getByRole("button", { name: "清除后端 API Key" }).click();
await desktop.getByText("后端尚未配置 API Key").waitFor();

const mobile = await makePage({ width: 390, height: 844 });
await mobile.goto("http://127.0.0.1:4173/ai-settings", { waitUntil: "domcontentloaded" });
await mobile.getByRole("heading", { name: "AI 配置" }).waitFor();
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (overflow > 1) throw new Error(`AI settings overflows horizontally by ${overflow}px`);
await mobile.screenshot({ path: outputPath("ai-settings-mobile.png"), fullPage: true });

await writeFile(outputPath("ai-settings-browser-check.json"), JSON.stringify({ route: "/ai-settings", storage: "backend/.env", lockedModels: Object.values(config.models).map((item) => item.name), validated: ["masked input", "backend save request", "no rendered key", "clear key", "mobile overflow"], consoleErrors: errors }, null, 2));
await browser.close();
if (errors.length) throw new Error(`Browser errors detected: ${errors.join("; ")}`);
console.log("AI settings desktop and mobile flow passed.");
