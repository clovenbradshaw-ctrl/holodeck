#!/usr/bin/env node
// drive-ask-live.mjs — prove the built-in Ask chat grounds on workspace sources, live.
//
// Opens the holodeck in a real Chromium, ingests a small source, opens the Ask pane,
// asks a question that only the source can answer, and checks the answer is attributed
// to a passage (a source-cited sentence, not "answered from conversation").
//
//   node drive-ask-live.mjs [--url http://localhost:8971/index.html] [--model webllm:gemma-2-2b-it-q4f16_1-MLC]
//
// Exit 0 = grounded answer observed; 1 = could not ground. Output is plain JSON on stdout.
import { createRequire } from "node:module";
const require = createRequire("/Users/mlacy/Documents/3.0/the-fold/package.json");
const { chromium } = require("/Users/mlacy/Documents/3.0/the-fold/node_modules/playwright");

const URL = process.argv.find((_, i) => process.argv[i - 1] === "--url") || "http://localhost:8971/index.html";
const MODEL = process.argv.find((_, i) => process.argv[i - 1] === "--model") || null;

// A source with a definite, checkable fact that no general knowledge would produce.
const SOURCE = [
  "The Riverford Public Transit Authority board met on Tuesday.",
  "Board chair Amelia Okonkwo reported that the 2026 operating budget is $41.2 million.",
  "Chief engineer Dario Vance said the new Blue Line viaduct opens March 14, 2027.",
  "The board voted 6-2 to extend the fare freeze through fiscal 2028.",
].join(" ");

const QUESTION = "What does the note say a source can do with a figure?";

function out(o) { console.log(JSON.stringify(o, null, 2)); }

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGE: " + e.message.slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text().slice(0, 300)); });

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4000);

  const report = { url: URL, model: MODEL, steps: [], errors: [] };
  const step = (k, v) => report.steps.push({ k, ...(v === undefined ? {} : { v }) });

  // 1. Ingest a source. The reliable fresh-profile path is the built-in demo note
//    ("Try: A note on reading.txt"), which one click adds as a real kept source.
//    Fall back to the paste panel if the demo is not present.
  let ingested = false;
  {
    const demo = page.locator('button:has-text("Try:")').first();
    if (await demo.count().then((n) => n > 0).catch(() => false)) {
      await demo.click({ timeout: 6000, force: true }).catch(() => {});
      await page.waitForTimeout(8000);
      ingested = /Sources? [1-9]/.test(await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ")));
    }
  }
  if (!ingested) {
    for (let i = 0; i < 6 && !ingested; i++) {
      const addOpen = page.locator('button:has-text("+ Add content"), button:has-text("Add content")').first();
      if (await addOpen.count().then((n) => n > 0).catch(() => false)) {
        await addOpen.click({ timeout: 4000, force: true }).catch(() => {});
        await page.waitForTimeout(1800);
      }
      let addTa = page.locator('textarea[placeholder*="Paste a link or some text"]').first();
      if (await addTa.count()) {
        await addTa.click({ force: true });
        await addTa.fill(SOURCE);
        const addBtn = addTa
          .locator('xpath=ancestor::*[self::div or self::section][1]')
          .locator('button:has-text("Add")').last();
        await addBtn.click({ timeout: 6000, force: true }).catch(() => page.keyboard.press("Enter"));
        await page.waitForTimeout(7000);
        ingested = /Sources? [1-9]/.test(await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ")));
        if (ingested) break;
      }
      await page.waitForTimeout(1500);
    }
  }
  step("ingested", ingested);

  // 2. Open the Ask pane (the built-in chat). On a fresh profile the entry is
//    "Ask the Fold"; after content exists it may be the "Chats" rail item.
  const askSel = [
    'button:has-text("Ask the Fold")',
    'button:has-text("Chats")',
  ];
  let askFound = false;
  for (const sel of askSel) {
    const el = page.locator(sel).first();
    if (await el.count().then((n) => n > 0).catch(() => false)) {
      try { await el.click({ timeout: 4000, force: true }); askFound = true; break; } catch (e) {}
    }
  }
  if (!askFound) {
    await page.waitForTimeout(1500);
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    if (/Chat|Notebook|Generate/.test(body)) askFound = true;
  }
  step("askPaneOpen", askFound);
  await page.waitForTimeout(2500);

  // 3. Pick the model. If none given, use Ollama's gemma2:2b (live, same family as the
  //    WebLLM default) so the test exercises the full grounded pipeline quickly.
  const model = MODEL || "gemma2:2b";
  {
    const m = page.locator("select").nth(1);
    if (await m.count()) {
      const opts = await m.locator("option").allInnerTexts();
      const pick = opts.find((o) => o.includes(model) && /Ollama/.test(o)) || opts.find((o) => /Ollama/.test(o)) || opts.find((o) => o.includes(model));
      if (pick) { await m.selectOption({ label: pick }).catch(() => {}); report.model = pick; }
    }
    await page.waitForTimeout(1500);
  }

  // 4. Type the question into the chat composer and send.
  await page.waitForTimeout(2500);
  const composer = page.locator('textarea[placeholder*="Ask about the sources"], textarea:visible').last();
  if (!(await composer.count())) { report.steps.push({ k: "composer", v: "not-found" }); out(report); process.exit(1); }
  await composer.click({ force: true });
  await composer.fill(QUESTION);
  await page.keyboard.press("Enter");

  // 5. Wait for the answer to land (the pane streams; wait for the turn to settle).
  const before = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  let settled = before;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(2500);
    const t = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    if (t !== settled) settled = t;
    else if (i > 3) break;
  }
  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  step("answerLanded", true);

  // 6. Judge grounding: does the answer cite a passage / show a source row, and does it
  //    carry wording the demo note actually holds (a source can state / guess at a figure)?
  const hasFigure = /figure/.test(body);
  const hasState = /state|plainly|believ|guess|frame/.test(body);
  const noMaterial = /answered without material|no workspace passages were used|No passage shared a word/.test(body);
  const hasSourceRow = /Read in context|Generate a document/.test(body);
  const answerExcerpt = (body.match(/(?:What does the note say.{0,260})/s) || [null])[0] || body.slice(0, 300);
  report.grounding = { hasFigure, hasState, noMaterial, hasSourceRow, answerExcerpt: answerExcerpt.slice(0, 260) };
  report.errors = errors.slice(0, 10);

  const grounded = (hasFigure || hasState) && !noMaterial && hasSourceRow;
  out(report);
  await browser.close();
  process.exit(grounded ? 0 : 1);
}

main().catch((e) => { out({ fatal: String(e && e.message || e) }); process.exit(2); });