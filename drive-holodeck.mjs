#!/usr/bin/env node
// drive-holodeck.mjs — drive the fold's browser surface (the holodeck) with Playwright.
//
// The surface's runtime lives entirely in the page (index.html + support.js); there is no
// control surface. So the browser IS the API, and this module is the client.
//
//   node drive-holodeck.mjs --discover        # open, wait, dump the live DOM shape, screenshot
//   node drive-holodeck.mjs --ingest "text"   # paste text into the omni/composer and drive a read
//   node drive-holodeck.mjs --ingest-file x.md
//   flags: --headed | --headless (default headed), --url http://127.0.0.1:8813/index.html
//
// Screenshots + the DOM dump land in .thumbnail/holodeck-test/ (gitignored).
// Console errors and page errors are captured on every run and printed at the end.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, ".thumbnail", "holodeck-test");
mkdirSync(OUT, { recursive: true });

const URL = process.env.FOLD_URL || "http://127.0.0.1:8813/index.html";

function usage() {
  console.error(`usage: node drive-holodeck.mjs --discover
       node drive-holodeck.mjs --ingest "text"
       node drive-holodeck.mjs --ingest-file FILE
       flags: --headless (default headed) --url URL --no-crash-window
screenshots -> ${OUT}`);
}

function parseArgv(argv) {
  const o = { headless: false, url: URL, crashWindow: 60000, hold: 0 };
  const args = [];
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--headless": o.headless = true; break;
      case "--headed": o.headless = false; break;
      case "--url": o.url = argv[++i]; break;
      case "--no-crash-window": o.crashWindow = 30000; break;
      case "--hold": o.hold = Number(argv[++i]) || 0; break;
      case "-h": case "--help": return null;
      default: args.push(argv[i]);
    }
  }
  o.mode = args.find((a) => a.startsWith("--")) || "discover";
  o.args = args;
  return o;
}

export async function openSurface({ headless = false, url = URL, width = 1440, height = 900 } = {}) {
  const browser = await chromium.launch({ headless, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width, height } });
  const consoleErrors = [];
  const badResponses = [];
  const failedRequests = [];
  const allRequests = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") consoleErrors.push(`${m.type()}: ${m.text().slice(0, 400)}`);
  });
  page.on("pageerror", (e) => consoleErrors.push(`PAGE: ${e.message.slice(0, 400)}`));
  page.on("crash", () => consoleErrors.push("PAGE: renderer crashed"));
  page.on("close", () => consoleErrors.push("PAGE: closed unexpectedly"));
  page.on("request", (r) => allRequests.push(r.url()));
  page.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url().slice(0, 160)}`);
  });
  page.on("requestfailed", (r) => {
    failedRequests.push(`${r.failure()?.errorText || "?"} ${r.url().slice(0, 160)}`);
  });
  // External fonts hang the app's font-stall in headless/headed loads — abort them fast so
  // screenshot()'s font-wait never blocks on an unreachable CDN.
  page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort()).catch(() => {});

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  return new Surface(browser, page, consoleErrors, badResponses, failedRequests, allRequests);
}

export class Surface {
  constructor(browser, page, consoleErrors, badResponses, failedRequests, allRequests) {
    this.browser = browser;
    this.page = page;
    this.consoleErrors = consoleErrors;
    this.badResponses = badResponses;
    this.failedRequests = failedRequests;
    this.allRequests = allRequests;
  }

  async shot(name) {
    const f = path.join(OUT, `${name}.png`);
    await this.page.screenshot({ path: f, fullPage: false, timeout: 40000, animations: "disabled" });
    return f;
  }

  async settle(ms = 2500) {
    await this.page.waitForTimeout(ms);
  }

  // Boot sanity: #not-served (bare file:// load) must be hidden once the app boots.
  async notServed() {
    return this.page.locator("#not-served").isVisible().catch(() => false);
  }

  // Dump the live DOM's interactive shape so driving is done against what is actually there.
  async discover() {
    return this.page.evaluate(() => {
      const text = (el) => (el.innerText || el.value || el.getAttribute("placeholder") || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 120);
      const q = (sels) => [...document.querySelectorAll(sels)];
      return {
        title: document.title,
        readyState: document.readyState,
        appEls: {
          inputs: q("input").map((e) => ({ type: e.type, ph: text(e) })),
          textareas: q("textarea").map((e) => ({ ph: text(e) })),
          contenteditable: q("[contenteditable]").map((e) => ({ ph: text(e) })),
          buttons: q("button").map((e) => text(e)).filter(Boolean).slice(0, 80),
          details: q("details").map((e) => text(e)).filter(Boolean).slice(0, 40),
          links: q("a[href]").map((e) => `${text(e)} -> ${e.getAttribute("href")}`).slice(0, 40),
        },
        bodyText: document.body.innerText.replace(/\s+/g, " ").slice(0, 1200),
        markers: {
          hasOmni: !!document.querySelector('[class*="omni"], [id*="omni"]'),
          hasRecords: !!document.querySelector('[class*="record"], [id*="record"]'),
          hasFoldRail: !!document.querySelector('[class*="rail"], [id*="rail"]'),
        },
      };
    });
  }

  async ingestViaComposer(text) {
    const page = this.page;
    const composer = page.locator('input[placeholder*="paste text"], input[placeholder*="Ask a question"]').first();
    const has = await composer.count().then((n) => n > 0).catch(() => false);
    if (!has) throw new Error("no composer input found");
    await composer.click({ timeout: 10000 });
    await composer.fill(text);
    await page.keyboard.press("Enter");
  }

  async ingestViaOmni(text) {
    const page = this.page;
    const omni = page.locator('input[placeholder*="Search, ask"]').first();
    if (await omni.count().then((n) => n > 0)) {
      await omni.click({ timeout: 10000 });
      await omni.fill(text);
      await page.keyboard.press("Enter");
      return "omni";
    }
    await this.ingestViaComposer(text);
    return "composer";
  }

  async close() {
    await this.browser.close();
  }

  // Poll body innerText until it changes from `initial` or timeout.
  async pollTextChange(initial, timeoutMs = 60000, stepMs = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const t = await this.page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
      if (t !== initial) return t;
      await this.page.waitForTimeout(stepMs);
    }
    return null;
  }

  async bodyText() {
    return this.page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  }

  async visibleInputs() {
    return this.page.evaluate(() => [...document.querySelectorAll("input, textarea, [contenteditable]")].map((e) => ({
      tag: e.tagName,
      ph: (e.placeholder || e.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim(),
      vis: !!e.offsetParent,
      value: (e.value || "").slice(0, 60),
    })));
  }

  async visibleButtons() {
    return this.page.evaluate(() => [...document.querySelectorAll("button")].filter((e) => e.offsetParent).map((e) => e.innerText.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 60));
  }

  async typeAndEnter(text, which = "first") {
    const page = this.page;
    const visible = await page.locator("input:visible, textarea:visible").all();
    if (!visible.length) throw new Error("no visible input");
    const el = which === "last" ? visible[visible.length - 1] : visible[0];
    await el.click();
    await el.fill(text);
    await page.keyboard.press("Enter");
    return el.getAttribute("placeholder") || el.getAttribute("aria-label") || "input";
  }
}

async function main() {
  const o = parseArgv(process.argv.slice(2));
  if (!o) return usage();
  const surf = await openSurface({ headless: o.headless, url: o.url });
  try {
    console.log(`[holodeck] opened ${o.url} (headless=${o.headless})`);
    await surf.settle(4000);
    const ns = await surf.notServed();
    console.log(`[holodeck] #not-served visible? ${ns}`);
    const d = await surf.discover();
    console.log(`[holodeck] title: ${d.title} · readyState: ${d.readyState}`);
    const dump = path.join(OUT, "dom.json");
    writeFileSync(dump, JSON.stringify(d, null, 2));
    console.log(`[holodeck] DOM dump -> ${dump}`);
    console.log("[holodeck] buttons:", JSON.stringify(d.appEls.buttons, null, 1));

    if (o.mode === "--ingest" || o.mode === "--ingest-file") {
      const text = o.mode === "--ingest-file" ? readFileSync(o.args[1], "utf8") : o.args[1];
      if (!text) { console.error("[holodeck] no text to ingest"); return; }
      const f0 = await surf.shot("01-landing");
      console.log(`[holodeck] shot 01-landing -> ${f0}`);
      const via = await surf.ingestViaComposer(text);
      console.log(`[holodeck] pasted ${text.length} chars via composer`);
      await surf.settle(9000);
      const f1 = await surf.shot("02-after-ingest");
      console.log(`[holodeck] shot 02-after-ingest -> ${f1}`);
      const state = await surf.page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 2000));
      console.log(`[holodeck] surface state after ingest:\n${state}`);
      const r2 = await surf.page.evaluate(() => ({
        addedCards: [...document.querySelectorAll('button, [role="button"]')].map((e) => e.innerText.replace(/\s+/g, " ").trim()).filter((t) => /Inspect|Added|Replay|reading|trace|∅|✓|✗/.test(t)).slice(0, 40),
      }));
      console.log(`[holodeck] cards: ${JSON.stringify(r2.addedCards, null, 1)}`);
    } else if (o.mode === "--try-sample") {
      const f0 = await surf.shot("01-landing");
      console.log(`[holodeck] shot 01-landing -> ${f0}`);
      const initial = await surf.page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
      const sample = surf.page.locator('button', { hasText: "Try: A note on reading.txt" }).first();
      await sample.click({ timeout: 10000 });
      console.log("[holodeck] clicked the sample note");
      const changed = await surf.pollTextChange(initial, 60000);
      if (changed) {
        console.log("[holodeck] surface changed — new state:");
        console.log(changed.slice(0, 2500));
        const f1 = await surf.shot("03-after-sample");
        console.log(`[holodeck] shot 03-after-sample -> ${f1}`);
      } else {
        console.log("[holodeck] surface did not change within 60s");
      }
    } else if (o.mode === "--probe") {
      console.log("[holodeck] probe: walking the surface UI");
      const s0 = await surf.bodyText();
      console.log("[probe:0] state:", s0.slice(0, 900));
      const buttons0 = await surf.visibleButtons();
      console.log("[probe:0] visible buttons:", JSON.stringify(buttons0));
      const inputs0 = await surf.visibleInputs();
      console.log("[probe:0] visible inputs:", JSON.stringify(inputs0));

      // 1) Start here
      const startBtn = surf.page.locator('button:visible', { hasText: "Start here" }).first();
      if (await startBtn.count().then((n) => n > 0)) {
        await startBtn.click();
        await surf.settle(2500);
        console.log("[probe:1] after Start here:", (await surf.bodyText()).slice(0, 900));
        await surf.shot("p1-start-here");
      }

      // 2) Upload or paste a file -> walk every tab of the Add sources dialog
      const upBtn = surf.page.locator('button:visible', { hasText: "Upload or paste" }).first();
      if (await upBtn.count().then((n) => n > 0)) {
        await upBtn.click();
        await surf.settle(1500);
        console.log("[probe:2] inputs after upload click:", JSON.stringify(await surf.visibleInputs()));
        const dialogLeaves = await surf.page.evaluate(() =>
          [...document.querySelectorAll("div, span, a, button, label, li, [role]")]
            .filter((e) => e.children.length === 0)
            .map((e) => ({ tag: e.tagName, cls: typeof e.className === "string" ? e.className.slice(0, 60) : "", role: e.getAttribute("role"), t: (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50) }))
            .filter((x) => x.t && /Wikipedia|Internet Archive|GitHub|Upload files|Link|Paste|Add|Done|✕|→|⌃|⌄/.test(x.t))
            .slice(0, 60)
        );
        console.log("[probe:2] dialog leaves:", JSON.stringify(dialogLeaves, null, 1));
        const tabs = ["Wikipedia", "GitHub", "Internet Archive", "Link", "Paste text", "Upload files"];
        for (const tab of tabs) {
          const tb = surf.page.getByText(tab, { exact: true }).first();
          if (await tb.count().then((n) => n > 0)) {
            await tb.click({ force: true }).catch(() => {});
            await surf.settle(1000);
            const ins = await surf.visibleInputs();
            const btns = await surf.visibleButtons();
            console.log(`[probe:2.tab=${tab}] inputs:`, JSON.stringify(ins));
            console.log(`[probe:2.tab=${tab}] buttons:`, JSON.stringify(btns));
            await surf.shot(`p2-tab-${tab.replace(/\s+/g, "-")}`);
          } else {
            console.log(`[probe:2.tab=${tab}] (no such element)`);
          }
        }
        const arrow = surf.page.locator("button:visible", { hasText: "→" }).first();
        if (await arrow.count().then((n) => n > 0)) {
          await arrow.click();
          await surf.settle(1000);
          console.log("[probe:2.arrow] after → :", JSON.stringify(await surf.visibleButtons()));
        }
        await surf.page.keyboard.press("Escape");
        await surf.settle(800);
      }

      // 3) omni bar: type a web-search style query
      const omniPh = "Search, ask a question, or paste a link";
      const omni = surf.page.locator(`input:visible[placeholder*="Search, ask"]`).first();
      if (await omni.count().then((n) => n > 0)) {
        await omni.fill("Fusus 2026 surveillance contract Nashville wikipedia");
        await surf.page.keyboard.press("Enter");
        await surf.settle(8000);
        console.log("[probe:3] after omni query:", (await surf.bodyText()).slice(0, 1100));
        await surf.shot("p3-omni-query");
      } else {
        console.log("[probe:3] no omni bar found");
      }
    } else {
      const f0 = await surf.shot("01-landing");
      console.log(`[holodeck] shot 01-landing -> ${f0}`);
    }

    if (surf.consoleErrors.length) {
      console.log(`[holodeck] ${surf.consoleErrors.length} console errors/warnings:`);
      surf.consoleErrors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    } else {
      console.log("[holodeck] no console errors or warnings");
    }
    if (surf.badResponses.length) {
      console.log(`[holodeck] ${surf.badResponses.length} HTTP >=400:`);
      surf.badResponses.forEach((e) => console.log(`  · ${e}`));
    }
    if (surf.failedRequests.length) {
      console.log(`[holodeck] ${surf.failedRequests.length} failed requests:`);
      surf.failedRequests.forEach((e) => console.log(`  · ${e}`));
    }
    if (o.hold > 0) {
      console.log(`[holodeck] holding the browser open ${o.hold}ms — watch it live`);
      await surf.page.waitForTimeout(o.hold);
    } else if (o.hold === -1) {
      console.log("[holodeck] keeping the browser open — press Ctrl+C to close");
      await new Promise((res) => {
        process.once("SIGINT", () => { console.log("[holodeck] closing"); res(); });
        process.once("SIGTERM", () => { console.log("[holodeck] closing"); res(); });
      });
    }
  } finally {
    await surf.close();
  }
}

const args = [];
for (const a of process.argv.slice(2)) if (!a.startsWith("--")) args.push(a);

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(`[holodeck] fatal: ${e.message}`);
    process.exit(1);
  });
}