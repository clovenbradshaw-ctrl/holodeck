#!/usr/bin/env node
// drive-personas.mjs — drive the five persona workflows through the fold's surface.
//
//   node drive-personas.mjs <persona> [--headless] [--hold <ms>|-1] [--files-only]
//
// personas: reporter | housing | drafter | philologist | tenant
// Each persona: adds its real corpus (local files), adds content via the web-search door
// (Wikipedia scope), asks its core question, and dumps the surface's response + screenshots.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openSurface } from "./drive-holodeck.mjs";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, ".thumbnail", "personas");
mkdirSync(OUT, { recursive: true });

const S = (n) => path.join(OUT, n);

const PERSONAS = {
  reporter: {
    files: [
      "/Users/mlacy/Documents/12⧸03⧸25 Metropolitan Council Committee： Public Health and Safety [QA7bbYgYeZg].txt",
      "/Users/mlacy/Documents/3.0/MNPD-DFR/data/dfr_addresses_light.json",
      "/Users/mlacy/Documents/3.0/MNPD-DFR/data/dfr_sensitive.json",
      "/Users/mlacy/Documents/3.0/surveillance_corpus/corpus.md",
    ],
    webScope: "wikipedia",
    webQuery: "Drone as First Responder Nashville police",
    question:
      "What did the council actually commit to for the DFR pilot in this transcript, versus what does the MNPD-DFR flight data show MNPD actually flying? List the disagreements you can find between the two.",
  },
  housing: {
    files: [
      "/Users/mlacy/Documents/3.0/ohs-custody/derived/AUD-CTTE-DEC9.txt",
      "/Users/mlacy/Documents/3.0/ohs-custody/derived/AUD-CTTE-BYLAWS.txt",
      "/Users/mlacy/Documents/3.0/ohs-custody/transcripts/2020-09-09-hpc-meeting.txt",
      "/Users/mlacy/Documents/3.0/ohs-custody/sources.json",
    ],
    webScope: "wikipedia",
    webQuery: "OHS Nashville Tennessee juvenile custody oversight investigation",
    question:
      "What do the audit committee documents say about monitoring and oversight of the facility? Be explicit about what is absent or silent in the sources, and keep every claim measured against a source.",
  },
  drafter: {
    files: [
      "/Users/mlacy/Documents/3.0/surveillance_corpus/corpus.md",
      "/Users/mlacy/Documents/3.0/metro-code/departments/chapter-2-106-community-review-board.md",
      "/Users/mlacy/Documents/3.0/metro-code/departments/chapter-2-132-metropolitan-human-relations-commission.md",
    ],
    webScope: "wikipedia",
    webQuery: "Boston city ordinance surveillance technology oversight board",
    question:
      "Which carve-outs do the strong surveillance bans in the corpus share, and which are one-city peculiarities? Show each comparison at the section level.",
  },
  philologist: {
    files: [
      "/Users/mlacy/Documents/3.0/eo-teachings/sources/dhvanyaloka-locana-balapriya.txt",
      "/Users/mlacy/Documents/3.0/eo-teachings/sources/dhvanyaloka-locana-balapriya.txt.provenance.json",
    ],
    webScope: "wikipedia",
    webQuery: "Dhvanyaloka Anandavardhana Sanskrit literary theory",
    question:
      "Does the passage 'śāntaśṛṅgārāvupanyastau praśamarāgayorvirodhāt' appear in the dhvanyaloka source I added? Quote the verbatim span and give its byte offset in the file.",
  },
  tenant: {
    files: [
      "/Users/mlacy/Documents/3.0/Eviction-Overwatch/data/nashville_council_district_demographics.json",
      "/var/folders/ck/tztwm60n4s9dxwrjfwlsmz3m0000gn/T/opencode/violations-slice.json",
      "/var/folders/ck/tztwm60n4s9dxwrjfwlsmz3m0000gn/T/opencode/landlord-slice.json",
    ],
    webScope: "wikipedia",
    webQuery: "Nashville Metropolitan Development Housing Agency MDHA violations",
    question:
      "Take the largest landlord by property count in the landlord data. Is that landlord's violation cluster unusual for the district it sits in? Use the demographic slice.",
  },
};

function parseArgv(argv) {
  const o = { headless: false, hold: 15000, filesOnly: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--headless") o.headless = true;
    else if (argv[i] === "--hold") o.hold = Number(argv[++i]);
    else if (argv[i] === "--files-only") o.filesOnly = true;
    else rest.push(argv[i]);
  }
  o.persona = rest[0] || "reporter";
  if (!PERSONAS[o.persona]) {
    console.error("unknown persona", o.persona, "—", Object.keys(PERSONAS).join(" | "));
    process.exit(1);
  }
  return o;
}

export async function drivePersona(name, { headless = false, filesOnly = false } = {}) {
  const cfg = PERSONAS[name];
  const surf = await openSurface({ headless });
  const log = [];
  const say = (m) => {
    log.push(m);
    console.log(m);
  };
  const bodyText = () => surf.bodyText();

  // ---- Add local corpus files (real files from this machine) ----
  say(`[${name}] adding ${cfg.files.length} corpus files…`);
  const openDialog = async () => {
    const inDialog = await surf.page
      .locator('button:has-text("Done"):visible')
      .count()
      .then((n) => n > 0);
    if (inDialog) return;
    const add = surf.page.locator('button:has-text("Add source"), button:has-text("Upload or paste a file")').first();
    const n = await add.count().then((c) => c > 0);
    if (n) {
      await add.click();
      await surf.settle(2500);
    }
  };
  await openDialog();
  const closeDialog = async () => {
    const done = surf.page.locator('button:has-text("Done"):visible').first();
    if (await done.count().then((n) => n > 0)) await done.click({ force: true }).catch(() => {});
    const x = surf.page.locator("button", { hasText: "✕" }).first();
    if (await x.count().then((n) => n > 0)) await x.click({ force: true }).catch(() => {});
    await surf.settle(1200);
  };
  // Upload via the real file-chooser path: click the "Upload files" label, then hand it the files.
  let uploaded = false;
  for (let attempt = 0; attempt < 3 && !uploaded; attempt++) {
    const chooserP = surf.page.waitForEvent("filechooser", { timeout: 10000 }).catch(() => null);
    const lbl = surf.page.locator('label:has-text("Upload files")').first();
    if (!(await lbl.count().then((n) => n > 0))) {
      await openDialog();
      await surf.settle(2000);
    }
    await lbl.click({ force: true }).catch(() => {});
    const chooser = await chooserP;
    if (chooser) {
      await chooser.setFiles(cfg.files.filter((f) => f));
      uploaded = true;
    }
    if (!uploaded) await surf.settle(2000);
  }
  if (!uploaded) throw new Error("could not open a file chooser for upload");
  say(`[${name}] files handed to the surface; waiting for the read…`);
  await surf.settle(3000);
  // Poll until the workspace view shows sources (dialog gone) or the dialog says Reading N files.
  let readState = "";
  for (let i = 0; i < 40; i++) {
    const t = await bodyText();
    const m = t.match(/Reading (\d+) files/);
    if (!m && /Sources\s+\d+/.test(t)) { readState = `workspace ready: ${t.slice(0, 400)}`; break; }
    if (m) readState = `still reading: ${m[0]}`;
    await surf.settle(3000);
  }
  say(`[${name}] ${readState || "read did not visibly land"}`);
  await surf.shot(S(`${name}-01-files-added`));
  const ws = await bodyText();
  say(`[${name}] workspace snapshot: ${ws.slice(0, 700)}`);

  // Watch the ingestion replay animation so the read itself is seen, not just waited on.
  const watchBtn = surf.page
    .locator('button:has-text("Watch it being read"), button:has-text("Replay the reading")')
    .first();
  if (await watchBtn.count().then((n) => n > 0)) {
    say(`[${name}] opening the ingest replay…`);
    await watchBtn.click({ force: true }).catch(() => {});
    await surf.settle(2500);
    await surf.shot(S(`${name}-01b-replay`));
    say(`[${name}] replay state: ${(await bodyText()).slice(-700)}`);
    // let the replay play a moment, then close the modal so later steps are reachable
    await surf.settle(3000);
    await surf.page.keyboard.press("Escape");
    await surf.settle(1200);
  } else {
    say(`[${name}] no replay control visible yet`);
  }

  // ---- Web-search ingest (the surface's own search door), in a fresh dialog ----
  if (!filesOnly) {
    say(`[${name}] web search (${cfg.webScope}): "${cfg.webQuery}"`);
    await openDialog();
    const sel = surf.page.locator("select").last();
    const row = sel.locator("xpath=..");
    await sel.selectOption(cfg.webScope).catch(() => say(`[${name}] scope select failed (${cfg.webScope})`));
    await surf.settle(800);
    const q = row.locator("input");
    await q.fill(cfg.webQuery);
    await q.press("Enter");
    await surf.settle(6000);
    await surf.shot(S(`${name}-02-search-results`));
    say(`[${name}] search results panel (tail):`);
    say((await bodyText()).slice(-1200));
    // click the first result row's Add
    const addBtn = surf.page.locator("button", { hasText: /^Add$/ }).first();
    const addN = await addBtn.count().then((n) => n > 0);
    if (addN) {
      await addBtn.click({ force: true }).catch(() => {});
      let added = false;
      for (let i = 0; i < 14; i++) {
        await surf.settle(3000);
        const t = await bodyText();
        if (/Replay the reading/.test(t) || /Reading \d+ files/.test(t) || /added to your content/i.test(t)) {
          added = true;
          break;
        }
      }
      say(`[${name}] web result add ${added ? "confirmed" : "did not visibly land"} (${await bodyText().then((t) => t.slice(-220))})`);
    }
    await surf.settle(4000);
    await surf.shot(S(`${name}-03-after-web-add`));
  }
  await closeDialog();

  // ---- Ask the persona's question ----
  say(`[${name}] asking the Fold: ${cfg.question.slice(0, 90)}…`);
  let composer = surf.page.locator('input[placeholder*="Ask a question"]').first();
  let cN = await composer.count().then((n) => n > 0);
  if (!cN) {
    const askBtn = surf.page.locator("button:has-text('Ask the Fold')").first();
    if (await askBtn.count().then((n) => n > 0)) {
      await askBtn.click({ force: true }).catch(() => {});
      await surf.settle(1500);
    }
    composer = surf.page
      .locator('textarea[placeholder*="Ask about"], input[placeholder*="Ask a question"], input[placeholder*="Search, ask"]')
      .first();
    cN = await composer.count().then((n) => n > 0);
    say(`[${name}] after Ask-the-Fold, inputs: ${JSON.stringify(await surf.visibleInputs())}`);
  }
  if (!cN) throw new Error("no composer input found");
  const before = await bodyText();
  await composer.fill(cfg.question);
  await surf.page.keyboard.press("Enter");
  const changed = await surf.pollTextChange(before, 150000, 3000);
  await surf.settle(4000);
  await surf.shot(S(`${name}-04-answer`));
  if (changed) {
    say(`[${name}] surface answer (first 3500 chars):`);
    say(changed.slice(0, 3500));
  } else {
    say(`[${name}] no visible text change after asking`);
  }
  writeFileSync(S(`${name}-log.json`), JSON.stringify({ persona: name, cfg, log }, null, 2));
  return { name, log, surf };
}

async function main() {
  const o = parseArgv(process.argv.slice(2));
  const r = await drivePersona(o.persona, { headless: o.headless, filesOnly: o.filesOnly });
  const surf = r.surf;
  if (surf.consoleErrors.length) {
    console.log(`[${o.persona}] ${surf.consoleErrors.length} console errors/warnings:`);
    surf.consoleErrors.slice(0, 10).forEach((e) => console.log("  · " + e));
  }
  if (surf.badResponses.length) {
    console.log(`[${o.persona}] HTTP >=400:`);
    surf.badResponses.slice(0, 10).forEach((e) => console.log("  · " + e));
  }
  if (o.hold > 0) {
    console.log(`[${o.persona}] holding ${o.hold}ms — watch it live`);
    await surf.page.waitForTimeout(o.hold);
  } else if (o.hold === -1) {
    console.log(`[${o.persona}] keeping browser open — Ctrl+C to close`);
    await new Promise((res) => {
      process.once("SIGINT", res);
      process.once("SIGTERM", res);
    });
  }
  await surf.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(`[persona] fatal: ${e.message}`);
    process.exit(1);
  });
}