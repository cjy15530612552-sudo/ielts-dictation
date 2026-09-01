import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const browserPath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const baseUrl = "http://127.0.0.1:4173/dictation";
const outputDir = new URL("../qa/", import.meta.url);
const outputPath = (name) => fileURLToPath(new URL(name, outputDir));
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: browserPath });
const errors = [];

async function createPage(viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return page;
}

const desktop = await createPage({ width: 1440, height: 1024 });
desktop.setDefaultTimeout(5000);
console.log("capture: desktop initial");
await desktop.goto(baseUrl, { waitUntil: "domcontentloaded" });
await desktop.screenshot({ path: outputPath("implementation-desktop.png"), fullPage: true });

for (const [index, word] of ["The", "library", "is", "located"].entries()) {
  await desktop.getByLabel(`第 ${index + 1} 个单词`).fill(word);
}
await desktop.getByLabel("第 5 个单词").focus();
await desktop.screenshot({ path: outputPath("implementation-desktop-typed.png"), fullPage: true });
await desktop.reload({ waitUntil: "domcontentloaded" });

const importLink = desktop.getByRole("link", { name: "上传 IELTS 原文截图" });
if ((await importLink.getAttribute("href")) !== "/practice/new") {
  throw new Error("Import button does not link to the upload flow");
}

const first = desktop.getByLabel("第 1 个单词");
const second = desktop.getByLabel("第 2 个单词");
const third = desktop.getByLabel("第 3 个单词");
const fourth = desktop.getByLabel("第 4 个单词");
const fifth = desktop.getByLabel("第 5 个单词");
console.log("interaction: keyboard navigation and playback");
await first.fill("The");
await first.press("Enter");
if (!(await second.evaluate((element) => element === document.activeElement))) {
  throw new Error("Enter before the last word did not move focus to the next word");
}
await second.fill("library");
await third.fill("is");
await fourth.fill("located");
await second.press("Space");
const shiftedValues = await Promise.all([first, second, third, fourth, fifth].map((input) => input.inputValue()));
if (JSON.stringify(shiftedValues) !== JSON.stringify(["The", "", "library", "is", "located"])) {
  throw new Error(`Space did not shift answers into the nearest empty slot: ${JSON.stringify(shiftedValues)}`);
}
if (!(await second.evaluate((element) => element === document.activeElement))) {
  throw new Error("Space insertion did not preserve focus on the new empty slot");
}
await second.press("Space");
if (!(await third.evaluate((element) => element === document.activeElement))) {
  throw new Error("Space on an empty slot did not move focus to the next word");
}
await second.fill("library");
await third.fill("");
await fourth.fill("");
await fifth.fill("");
await second.press("Tab");
if ((await second.inputValue()) !== "library") throw new Error("Tab replay lost the current answer");
if (!(await second.evaluate((element) => element === document.activeElement))) {
  throw new Error("Tab replay did not preserve focus");
}
await desktop.getByText("正在播放...").waitFor();
await second.press("Escape");
await desktop.getByText("再听一遍").waitFor();
await second.evaluate((element) => element.setSelectionRange(4, 4));
await second.press("ArrowLeft");
if (!(await second.evaluate((element) => element === document.activeElement && element.selectionStart === 3))) {
  throw new Error("ArrowLeft did not move the caret within the current word");
}
await second.evaluate((element) => element.setSelectionRange(element.value.length, element.value.length));
await second.press("ArrowLeft");
if (!(await second.evaluate((element) => element === document.activeElement))) {
  throw new Error("ArrowLeft before the word boundary switched inputs too early");
}
await second.evaluate((element) => element.setSelectionRange(0, 0));
await second.press("ArrowLeft");
if (!(await first.evaluate((element) => element === document.activeElement && element.selectionStart === element.value.length))) {
  throw new Error("ArrowLeft at the start did not move focus backward");
}
await first.evaluate((element) => element.setSelectionRange(0, 0));
await first.press("ArrowLeft");
if (!(await first.evaluate((element) => element === document.activeElement && element.selectionStart === 0))) {
  throw new Error("ArrowLeft moved outside the first input");
}
await first.evaluate((element) => element.setSelectionRange(element.value.length, element.value.length));
await first.press("ArrowRight");
if (!(await second.evaluate((element) => element === document.activeElement && element.selectionStart === 0))) {
  throw new Error("ArrowRight at the end did not move focus forward");
}
await second.evaluate((element) => element.setSelectionRange(2, 2));
await second.press("ArrowRight");
if (!(await second.evaluate((element) => element === document.activeElement && element.selectionStart === 3))) {
  throw new Error("ArrowRight did not move the caret within the current word");
}
await second.fill("");
await second.press("Backspace");
if (!(await first.evaluate((element) => element === document.activeElement))) {
  throw new Error("Backspace on an empty word did not move focus backward");
}

const expected = ["The", "library", "is", "located", "on", "the", "second", "floor"];
for (let index = 0; index < expected.length; index += 1) {
  await desktop.getByLabel(`第 ${index + 1} 个单词`).fill(expected[index]);
}
await desktop.getByLabel("第 8 个单词").press("Enter");
console.log("interaction: result and next sentence");
await desktop.getByText("Accuracy 100%").waitFor();
await desktop.screenshot({ path: outputPath("implementation-result.png"), fullPage: true });
await desktop.getByRole("button", { name: /下一句/ }).click();
await desktop.getByLabel("第 1 个单词").waitFor();
if (!(await desktop.getByText("4 / 18").isVisible())) throw new Error("Next sentence did not update progress");
if (!(await desktop.getByLabel("第 1 个单词").evaluate((element) => element === document.activeElement))) {
  throw new Error("Next sentence did not focus the first word");
}
await desktop.getByRole("button", { name: "检查答案" }).click();
await desktop.getByRole("button", { name: "上一句" }).click();
await desktop.getByLabel("第 1 个单词").waitFor();
if (!(await desktop.getByText("3 / 18").isVisible())) throw new Error("Previous sentence did not update progress");

const mobile = await createPage({ width: 390, height: 844 });
mobile.setDefaultTimeout(5000);
console.log("capture: mobile initial");
await mobile.goto(baseUrl, { waitUntil: "domcontentloaded" });
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (overflow > 1) throw new Error(`Mobile layout overflows horizontally by ${overflow}px`);
await mobile.screenshot({ path: outputPath("implementation-mobile.png"), fullPage: true });

await writeFile(new URL("browser-check.json", outputDir), JSON.stringify({
  viewport: { desktop: "1440x1024", mobile: "390x844" },
  interactions: ["Import navigation", "Space inserts and shifts to nearest empty slot", "Space advances from an empty slot", "Tab", "Escape", "Arrow caret movement", "Arrow boundary input switching", "Backspace", "Enter advances", "last Enter checks", "Next sentence", "Previous sentence"],
  consoleErrors: errors,
}, null, 2));

await browser.close();
if (errors.length) throw new Error(`Browser errors detected: ${errors.join("; ")}`);
console.log("Visual and interaction capture completed without browser errors.");
