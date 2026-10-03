// summary-fold-experiment.mjs — EXPERIMENT WITH GARY: what does his door
// actually require, and does the fold-at-an-identity beat raw-source context
// once EVERY arm goes through that door?
//
// Gary (eoreader7/native/organs/gary.js) owns the prompt: no address, no
// apparatus noun, facts not prohibitions, question last. The pilot taught two
// lessons: (1) the raw arm summarized boilerplate, so the baseline is now the
// source's MIDDLE (equal budget); (2) the wiki doc's "turn" was CSS, so markup
// is stripped and prose-only docs are used. Density is measured (no hardcoded
// answer): a span whose top-ranked claims are lower-excess is boilerplate.
import { readFileSync } from "node:fs";
import { analysisFromText } from "./falsify.summary.mjs";
import { select, stanceOf } from "./holodeck-summary.js";
import { makeGary } from "/Users/mlacy/Documents/3.0/eoreader7/native/organs/gary.js";
import { apparatusMentions, strikeAddresses } from "/Users/mlacy/Documents/3.0/eoreader7/native/the-fold/firewall.js";

const MOUTH = "gemma2:2b";
const BUDGET = 1400;
const gary = makeGary({ apparatusMentions, strikeAddresses });

const DOCS = [
  { name: "common-sense", path: "/Users/mlacy/Documents/3.0/live_priors/01-literature-books/gitenberg/pg147_Common-Sense.txt" },
  { name: "eb1911-law", path: "/Users/mlacy/Documents/3.0/live_priors/02-encyclopedic/1911-britannica/EB1911_Law.txt" },
  { name: "wikinews", path: "/Users/mlacy/Documents/3.0/live_priors/08-news-current/eu-commission/Wikinews_Shorts__November_13__2008.txt" },
];

const garyClean = (s) => gary.check([{ role: "user", content: s }], { material: 1 }).findings.filter((f) => f.rule === "no-apparatus" || f.rule === "no-address").length === 0;

async function ask(context) {
  const instruction = "Below are sentences copied from one text. Say what this text shows, in three sentences.";
  const msg = `${instruction}\n\n${context}`;
  if (!garyClean(msg)) return "(REFUSED BY GARY)";
  const res = await fetch("http://localhost:11435/api/chat", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MOUTH, stream: false, options: { temperature: 0 },
      messages: [{ role: "user", content: msg }] }),
  });
  return String((await res.json()).message?.content ?? "").trim();
}

import { blankMarkup } from "./holodeck-reader.js";
const strip = (t) => blankMarkup(String(t)).replace(/[.#][\w-]+\s*\{[^}]*\}/g, " ").replace(/\s+/g, " ").trim();
const figs = (t) => [...new Set((String(t).match(/\d[\d,.]*/g) || []).map((s) => s.replace(/[.,]$/, "")))].filter((s) => s.length >= 2);

console.log(`summary-fold experiment THROUGH GARY — mouth ${MOUTH}, budget ${BUDGET}\n`);
const rows = [];
for (const doc of DOCS) {
  let text = strip(readFileSync(doc.path, "utf8"));
  text = text.replace(/^[\s\S]*?(?:\*\*\*\s*START OF[^\n]*\n|This eBook is for)/, "");
  text = text.slice(0, 12000);
  const A = analysisFromText(text, doc.name);
  const claims = A.sts.filter((st) => !st.ref && st.claimy !== false && String(st.text).replace(/\s+/g, " ").trim().split(" ").length >= 4);
  const docStance = Math.sign(claims.reduce((s, st) => s + stanceOf(st.text), 0)) || 1;
  const identity = { conclusion: { names: [], measures: [], frames: ["fact"], stance: -docStance } };
  const fId = select(A, doc.name, { size: 4, forWhom: identity });
  const fEmpty = select(A, doc.name, { size: 4 });
  const nul = select(A, doc.name, { size: 4, forWhom: { conclusion: { names: ["ZZZ_UNRELATED"], measures: [], frames: ["fact"], stance: 0 } } });
  const srcFigs = new Set(figs(text).map((s) => s.toLowerCase()));
  const clamp = (s) => strip(s).slice(0, BUDGET);
  const mid = Math.max(0, Math.floor(text.length / 2) - Math.floor(BUDGET / 2));
  const arms = {
    baseline: clamp(text.slice(mid, mid + BUDGET)),          // the source's MIDDLE, not boilerplate
    "fold-empty": clamp(fEmpty.lines.join(" ")),
    "fold-identity": clamp(fId.lines.join(" ")),
    "shuffle-null": clamp(nul.lines.join(" ")),
  };
  console.log(`── ${doc.name} (doc stance ${docStance}; identity ${-docStance})`);
  for (const [arm, ctx] of Object.entries(arms)) {
    const out = await ask(ctx);
    const low = out.toLowerCase();
    const asserts = stanceOf(out);
    const carried = asserts !== 0 && asserts !== identity.conclusion.stance && identity.conclusion.stance !== 0 ? 1 : 0;
    const fab = [...figs(out)].filter((x) => x.length > 1 && !srcFigs.has(x.toLowerCase())).length;
    rows.push({ doc: doc.name, arm, carried, fab });
    console.log(`   ${arm.padEnd(14)} asserts-stance ${asserts} (identity ${identity.conclusion.stance}; carried ${carried})  fabricated ${fab}  :: ${JSON.stringify(out.slice(0, 66))}`);
  }
  console.log("");
}
console.log("── ARM TOTALS (3 docs) ──");
for (const arm of ["baseline", "fold-empty", "fold-identity", "shuffle-null"]) {
  const r = rows.filter((x) => x.arm === arm);
  console.log(`  ${arm.padEnd(14)} turn-carried ${r.reduce((s, x) => s + x.carried, 0)}/${r.length}  fabricated ${r.reduce((s, x) => s + x.fab, 0)}`);
}