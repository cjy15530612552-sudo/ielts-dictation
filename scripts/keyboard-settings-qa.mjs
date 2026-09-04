import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const browserPath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const baseUrl = "http://127.0.0.1:4173";
const outputDir = new URL("../qa/", import.meta.url);
const outputPath = (name) => fileURLToPath(new URL(name, outputDir));
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: browserPath });
const errors = [];

async function makePage(viewport) {
  const page = await browser.newPage({ viewport });
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/practices", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/vocabulary/groups", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  return page;
}

const desktop = await makePage({ width: 1440, height: 1024 });
await desktop.goto(baseUrl, { waitUntil: "domcontentloaded" });
await desktop.getByRole("link", { name: "键位设置" }).click();
await desktop.waitForURL("**/keyboard-settings");
await desktop.getByRole("heading", { name: "键位设置" }).waitFor();
for (const [action, key] of [["切换到下一格", "Space"], ["下一格 / 检查答案", "Enter"], ["重新播放", "Tab"], ["停止播放", "Esc"]]) {
  await desktop.getByRole("button", { name: `${action}键位，当前 ${key}` }).waitFor();
}

const advanceKey = desktop.getByRole("button", { name: "切换到下一格键位，当前 Space" });
await advanceKey.click();
await advanceKey.press("n");
await desktop.getByText("切换到下一格已设为 N。").waitFor();
await desktop.getByRole("button", { name: "切换到下一格键位，当前 N" }).waitFor();
await desktop.screenshot({ path: outputPath("keyboard-settings.png"), fullPage: true });

await desktop.goto(`${baseUrl}/dictation`, { waitUntil: "domcontentloaded" });
const first = desktop.getByLabel("第 1 个单词");
const second = desktop.getByLabel("第 2 个单词");
await first.fill("The");
await second.fill("library");
await first.press("n");
const customAdvanceValues = await Promise.all([1, 2, 3].map((number) => desktop.getByLabel(`第 ${number} 个单词`).inputValue()));
if (JSON.stringify(customAdvanceValues) !== JSON.stringify(["The", "library", ""])) throw new Error("Custom advance key changed answers");
if (!(await second.evaluate((element) => element === document.activeElement))) throw new Error("Custom advance key did not move focus");

await desktop.goto(`${baseUrl}/keyboard-settings`, { waitUntil: "domcontentloaded" });
await desktop.getByRole("button", { name: "切换到下一格键位，当前 N" }).waitFor();
const submitKey = desktop.getByRole("button", { name: "下一格 / 检查答案键位，当前 Enter" });
await submitKey.click();
await submitKey.press("n");
await desktop.getByText("下一格 / 检查答案已设为 N，并与切换到下一格交换键位。").waitFor();
await desktop.getByRole("button", { name: "切换到下一格键位，当前 Enter" }).waitFor();
await desktop.getByRole("button", { name: "下一格 / 检查答案键位，当前 N" }).waitFor();
await desktop.goto(`${baseUrl}/dictation`, { waitUntil: "domcontentloaded" });
await desktop.getByLabel("第 1 个单词").fill("The");
await desktop.getByLabel("第 1 个单词").press("n");
if (!(await desktop.getByLabel("第 2 个单词").evaluate((element) => element === document.activeElement))) {
  throw new Error("Custom submit key did not advance before the last input");
}
const expected = ["The", "library", "is", "located", "on", "the", "second", "floor"];
for (let index = 0; index < expected.length; index += 1) {
  await desktop.getByLabel(`第 ${index + 1} 个单词`).fill(expected[index]);
}
await desktop.getByLabel("第 8 个单词").press("n");
await desktop.getByText(/Accuracy/).waitFor();
await desktop.goto(`${baseUrl}/keyboard-settings`, { waitUntil: "domcontentloaded" });
await desktop.getByRole("button", { name: "恢复默认" }).click();
await desktop.getByText("已恢复默认键位。").waitFor();

const mobile = await makePage({ width: 390, height: 844 });
await mobile.goto(`${baseUrl}/keyboard-settings`, { waitUntil: "domcontentloaded" });
await mobile.getByRole("heading", { name: "键位设置" }).waitFor();
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (overflow > 1) throw new Error(`Keyboard settings overflows horizontally by ${overflow}px`);
await mobile.screenshot({ path: outputPath("keyboard-settings-mobile.png"), fullPage: true });

await writeFile(outputPath("keyboard-settings-browser-check.json"), JSON.stringify({
  route: "/keyboard-settings",
  validated: ["home navigation", "default bindings", "click then press to bind", "dictation uses custom advance key", "conflict swaps bindings", "custom submit key advances before last input", "custom submit key checks on last input", "persistence", "restore defaults", "mobile overflow"],
  consoleErrors: errors,
}, null, 2));
await browser.close();
if (errors.length) throw new Error(`Browser errors detected: ${errors.join("; ")}`);
console.log("Keyboard settings desktop and mobile flow passed.");
