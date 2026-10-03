// summary-fold-falsifier.mjs — THE DEFINITIVE FALSIFIER: does folding the
// summarizer at an IDENTITY improve the generation, above a paired null?
//
// Design (frozen here, before the run — the long-project's discipline):
//   · held-out prose corpus (no NTOR, no wiki markup; this host may not even
//     hold NTOR — the run discloses whether it does)
//   · four arms, all Gary-clean (no-apparatus, facts not prohibitions,
//     question last), all one context budget
//   · the metric is STANCE-CARRIAGE: the mouth's answer asserts a stance the
//     fold's identity did not already hold (the turn surfaced), read by the
//     same English evaluative lens STANCE_GIVER declares
//   · the PAIRED null: for each document, fold at the real identity against a
//     shuffle-null identity (a random, unrelated conclusion). The null tests
//     the identity's DIFFERENCE, not "any extra context".
//
// The claim, falsifiable: fold-at-an-identity carries the turn more often than
// the shuffle-null, paired per document. Test: one-sided exact binomial over
// the discordant pairs. FALSIFIED if the count does not clear 0.05.
//
//   node summary-fold-falsifier.mjs [--limit N] [--json]
import { readFileSync } from "node:fs";
import { analysisFromText } from "./falsify.summary.mjs";
import { select, stanceOf } from "./holodeck-summary.js";
import { makeGary } from "/Users/mlacy/Documents/3.0/eoreader7/native/organs/gary.js";
import { apparatusMentions, strikeAddresses } from "/Users/mlacy/Documents/3.0/eoreader7/native/the-fold/firewall.js";

const MOUTH = "gemma2:2b";
const BUDGET = 1400;
const gary = makeGary({ apparatusMentions, strikeAddresses });

const DIR = "/Users/mlacy/Documents/3.0/live_priors/01-literature-books/gutenberg";
const DOCS = ["pg11_Alice_s_Adventures_in_Wonderland", "pg1661_The_Adventures_of_Tom_Sawyer", "pg84_Frankenstein",
  "pg1342_Pride_and_Prejudice", "pg768_The_Adventures_of_Sherlock_Holmes", "pg2701_Moby_Dick",
  "pg145_Middlemarch-George-Eliot", "pg59129_Leviathan_by_Hobbes", "pg62168_The_Origin_of_Species_by_Darwin",
  "pg5827_Meditations_by_Marcus_Aurelius"].map((n) => ({ name: n, path: `${DIR}/${n}.txt` }));

const clean = (s) => String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const garyClean = (s) => gary.check([{ role: "user", content: s }], { material: 1 }).findings.every((f) => f.rule !== "no-apparatus" && f.rule !== "no-address");
const figs = (t) => [...new Set((String(t).match(/\d[\d,.]*/g) || []).map((s) => s.replace(/[.,]$/, "")))].filter((s) => s.length >= 2);

async function ask(ctx) {
  const msg = `Below are sentences copied from one text. Say what this text shows, in three sentences.\n\n${ctx}`;
  if (!garyClean(msg)) return { out: "", refused: true };
  const res = await fetch("http://localhost:11435/api/chat", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MOUTH, stream: false, options: { temperature: 0 }, messages: [{ role: "user", content: msg }] }),
  });
  return { out: String((await res.json()).message?.content ?? "").trim(), refused: false };
}

/** exact one-sided binomial P(X >= k | n, p=0.5) */
function binomTail(k, n) { let s = 0; for (let i = k; i <= n; i++) { let c = 1; for (let j = 0; j < i; j++) c = (c * (n - j)) / (j + 1); s += c * Math.pow(0.5, n); } return s; }

const limit = (() => { const i = process.argv.indexOf("--limit"); return i > 0 ? Number(process.argv[i + 1]) : DOCS.length; })();
const corpus = DOCS.slice(0, limit);
const rows = [];
console.log(`summary-fold FALSIFIER — mouth ${MOUTH}, ${corpus.length} held-out docs, paired identity vs shuffle\n`);

for (const doc of corpus) {
  let text;
  try { text = readFileSync(doc.path, "utf8"); } catch { console.log(`  (skip ${doc.name}: not present)`); continue; }
  text = clean(text.replace(/^[\s\S]*?(?:\*\*\*\s*START OF[^\n]*\n|This eBook is for)/, "")).slice(0, 14000);
  const A = analysisFromText(text, doc.name);
  const claims = A.sts.filter((st) => !st.ref && st.claimy !== false && clean(st.text).split(" ").length >= 4);
  const docStance = Math.sign(claims.reduce((s, st) => s + stanceOf(st.text), 0)) || 1;
  const identity = { conclusion: { names: [], measures: [], frames: ["fact"], stance: -docStance } };
  const nul = { conclusion: { names: ["ZZZ_UNRELATED"], measures: [], frames: ["fact"], stance: 0 } };
  const fId = select(A, doc.name, { size: 4, forWhom: identity });
  const fNul = select(A, doc.name, { size: 4, forWhom: nul });
  const srcFigs = new Set(figs(text).map((s) => s.toLowerCase()));
  const srcMid = text.slice(Math.max(0, Math.floor(text.length / 2) - 700), Math.max(0, Math.floor(text.length / 2) - 700) + BUDGET);

  const arms = {};
  for (const [arm, ctx] of [["identity", fId.lines.join(" ")], ["shuffle", fNul.lines.join(" ")], ["baseline", srcMid]]) {
    const { out, refused } = await ask(clean(ctx).slice(0, BUDGET));
    const st = out ? stanceOf(out) : 0;
    const carried = st !== 0 && st !== identity.conclusion.stance ? 1 : 0; // asserts the turn's stance
    const fab = [...figs(out)].filter((x) => x.length > 1 && !srcFigs.has(x.toLowerCase())).length;
    arms[arm] = { carried, fab, refused, out: out.slice(0, 60) };
  }
  rows.push({ doc: doc.name, docStance, ...arms });
  console.log(`${doc.name.slice(0, 34).padEnd(34)} identity ${arms.identity.carried} (fab ${arms.identity.fab}) | shuffle ${arms.shuffle.carried} (fab ${arms.shuffle.fab}) | baseline ${arms.baseline.carried}`);
}

// paired identity vs shuffle over discordant pairs
let a = 0, b = 0; // a: identity carried & shuffle not; b: shuffle carried & identity not
for (const r of rows) { if (r.identity.carried && !r.shuffle.carried) a++; else if (r.shuffle.carried && !r.identity.carried) b++; }
const n = a + b;
const p = n ? binomTail(a, n) : 1;
const fabI = rows.reduce((s, r) => s + r.identity.fab, 0);
const fabS = rows.reduce((s, r) => s + r.shuffle.fab, 0);
console.log(`\n── FALSIFICATION ──`);
console.log(`documents: ${rows.length}`);
console.log(`identity carried: ${rows.filter((r) => r.identity.carried).length}  |  shuffle carried: ${rows.filter((r) => r.shuffle.carried).length}  |  baseline carried: ${rows.filter((r) => r.baseline.carried).length}`);
console.log(`paired discordant: identity-only ${a}, shuffle-only ${b}  ->  exact one-sided p = ${p.toFixed(4)}`);
console.log(`fabricated: identity ${fabI}, shuffle ${fabS}`);
const sig = p <= 0.05;
const fabSafe = fabI <= fabS;
if (sig && fabSafe) console.log(`\nSUPPORTED (falsification FAILED): the identity's difference beats the shuffle — exact one-sided p=${p.toFixed(4)}, fabrication flat.`);
else if (sig && !fabSafe) console.log(`\nSUPPORTED ON TURN-CARRIAGE, FABRICATION FLAGGED: p=${p.toFixed(4)} (identity-only ${a}, shuffle-only ${b}) — but identity fabricated ${fabI} vs shuffle ${fabS}; the gain is confounded by the mouth inventing. Report as a positive with the fabrication caveat, not a clean pass.`);
else console.log(`\nFALSIFIED / NOT SUPPORTED at 0.05: p=${p.toFixed(4)} (a=${a}, b=${b}); the identity's difference is not separated from the null on this corpus.`);
if (process.argv.includes("--json")) console.log(JSON.stringify({ rows, a, b, p, fabI, fabS }, null, 2));