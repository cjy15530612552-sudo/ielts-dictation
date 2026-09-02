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

function visualRows(rects) {
  const rows = [];
  rects.forEach((rect, index) => {
    let row = rows.find((candidate) => Math.abs(candidate.y - rect.y) < 2);
    if (!row) { row = { y: rect.y, indexes: [] }; rows.push(row); }
    row.indexes.push(index);
  });
  return rows.sort((left, right) => left.y - right.y);
}

function closestHorizontalIndex(rects, sourceIndex, candidates) {
  const sourceCenter = rects[sourceIndex].x + rects[sourceIndex].width / 2;
  return candidates.reduce((closest, candidate) => {
    const candidateCenter = rects[candidate].x + rects[candidate].width / 2;
    const closestCenter = rects[closest].x + rects[closest].width / 2;
    return Math.abs(candidateCenter - sourceCenter) < Math.abs(closestCenter - sourceCenter) ? candidate : closest;
  });
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
console.log("interaction: keyboard navigation and playback");
await first.fill("The");
await second.fill("library");
await desktop.getByLabel("第 3 个单词").fill("is");
await second.press("Space");
const shiftedValues = await Promise.all([1, 2, 3, 4].map((number) => desktop.getByLabel(`第 ${number} 个单词`).inputValue()));
if (JSON.stringify(shiftedValues) !== JSON.stringify(["The", "", "library", "is"])) {
  throw new Error(`Space did not insert a gap and shift answers right: ${JSON.stringify(shiftedValues)}`);
}
if (!(await second.evaluate((element) => element === document.activeElement))) throw new Error("Space did not retain the current input focus");
await second.fill("library");
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
await desktop.getByLabel("第 3 个单词").press("Space");
const fullValues = await Promise.all(expected.map((_, index) => desktop.getByLabel(`第 ${index + 1} 个单词`).inputValue()));
if (JSON.stringify(fullValues) !== JSON.stringify(expected)) throw new Error("Space changed answers when no empty slot remained");
if (!(await desktop.getByLabel("第 3 个单词").evaluate((element) => element === document.activeElement))) {
  throw new Error("Space moved focus when no empty slot remained");
}
await desktop.getByLabel("第 3 个单词").press("Enter");
if (!(await desktop.getByLabel("第 4 个单词").evaluate((element) => element === document.activeElement))) {
  throw new Error("Enter before the last word did not move focus to the next word");
}
if (await desktop.getByText("Accuracy 100%").isVisible()) throw new Error("Enter submitted before the last word");
await desktop.getByLabel("第 8 个单词").press("Enter");
console.log("interaction: result and next sentence");
await desktop.getByText("Accuracy 100%").waitFor();
await desktop.screenshot({ path: outputPath("implementation-result.png"), fullPage: true });
await desktop.getByRole("button", { name: "重新开始", exact: true }).click();
await desktop.getByLabel("第 1 个单词").waitFor();
for (let index = 0; index < expected.length; index += 1) {
  if ((await desktop.getByLabel(`第 ${index + 1} 个单词`).inputValue()) !== "") {
    throw new Error("Restart current sentence did not clear every input");
  }
}
if (!(await desktop.getByLabel("第 1 个单词").evaluate((element) => element === document.activeElement))) {
  throw new Error("Restart current sentence did not focus the first word");
}
await desktop.getByText("正在播放...").waitFor();
for (let index = 0; index < expected.length; index += 1) {
  await desktop.getByLabel(`第 ${index + 1} 个单词`).fill(expected[index]);
}
await desktop.getByLabel("第 8 个单词").press("Enter");
await desktop.getByText("Accuracy 100%").waitFor();
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
const mobileInputs = await mobile.locator(".word-input").all();
const mobileRects = await Promise.all(mobileInputs.map((input) => input.boundingBox()));
const rows = visualRows(mobileRects);
if (rows.length < 3) throw new Error("Mobile input layout did not create enough rows for vertical navigation testing");
const middleSource = rows[1].indexes[0];
const expectedUp = closestHorizontalIndex(mobileRects, middleSource, rows[0].indexes);
await mobileInputs[middleSource].focus();
await mobileInputs[middleSource].press("ArrowUp");
if (!(await mobileInputs[expectedUp].evaluate((element) => element === document.activeElement))) {
  throw new Error("ArrowUp did not select the nearest input in the row above");
}
const expectedDown = closestHorizontalIndex(mobileRects, middleSource, rows[2].indexes);
await mobileInputs[middleSource].focus();
await mobileInputs[middleSource].press("ArrowDown");
if (!(await mobileInputs[expectedDown].evaluate((element) => element === document.activeElement))) {
  throw new Error("ArrowDown did not select the nearest input in the row below");
}
const topBoundary = rows[0].indexes[0];
await mobileInputs[topBoundary].focus();
await mobileInputs[topBoundary].press("ArrowUp");
if (!(await mobileInputs[topBoundary].evaluate((element) => element === document.activeElement))) throw new Error("ArrowUp crossed the top boundary");
const bottomBoundary = rows.at(-1).indexes[0];
await mobileInputs[bottomBoundary].focus();
await mobileInputs[bottomBoundary].press("ArrowDown");
if (!(await mobileInputs[bottomBoundary].evaluate((element) => element === document.activeElement))) throw new Error("ArrowDown crossed the bottom boundary");
await mobile.screenshot({ path: outputPath("implementation-mobile.png"), fullPage: true });

await writeFile(new URL("browser-check.json", outputDir), JSON.stringify({
  viewport: { desktop: "1440x1024", mobile: "390x844" },
  interactions: ["Import navigation", "Space inserts a gap and shifts to nearest empty slot", "Space does nothing without a later empty slot", "Tab", "Escape", "Left/right caret movement", "Left/right boundary input switching", "Up/down visual row movement", "Up/down layout boundaries", "Backspace", "Enter advances before last word", "Enter checks on last word", "Restart current sentence clears inputs and replays", "Next sentence", "Previous sentence"],
  consoleErrors: errors,
}, null, 2));

await browser.close();
if (errors.length) throw new Error(`Browser errors detected: ${errors.join("; ")}`);
console.log("Visual and interaction capture completed without browser errors.");
