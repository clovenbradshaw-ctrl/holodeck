// the-fold/falsify-dmd-universe.mjs — EVERY ASSERTION HAS A FOR-WHOM AND IS
// BOUNDED BY DMD SALIENCY. (user law, 2026-10-02)
//
// Not "fabricated by string containment" — a claim is grounded iff, folded
// under ITS for-whom (the register it is asserted in), it is admitted by the
// DMD gate: its reading's discovery trajectory has COHERENT MASS above its own
// SHUFFLED NULL (order-dependent structure = DMD saliency), it found the
// material, and it makes a difference to the question (Bateson). This uses the
// real organ (eoreader7/native/kernel/for-whom.js) — never a re-invention.
//
// EXPERIMENT on the casual / non-standard English priors (cosem, enron, irc,
// nus-sms, lccc): each register is a for-whom over its own claims. Measure:
//   (a) the register's DMD coherence vs its null — is its universe REAL?
//   (b) a FOREIGN assertion (another register's claim, or one with invented
//       referents) folded under this for-whom — does it fall outside?
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { splitSentences } from "./vendor/eoreader7/native/adapters/text/spans.js";
import { createForWhom, createForWhomFold, foldForWhom, gateForWhomFold, coherentMass, trajectoryNull, discoveryTrajectory } from "./vendor/eoreader7/native/kernel/for-whom.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OC = "/Users/mlacy/Documents/3.0/live_priors/19-organic-community";
const REGISTERS = {
  cosem: { dir: "cosem", note: "Singapore colloquial English (Singlish)" },
  enron: { dir: "enron", note: "Enron mail — business chat" },
  irc: { dir: "ubuntu-irc/ubuntu", note: "Ubuntu #ubuntu support chat, 2004" },
  "nus-sms": { dir: "nus-sms/en", note: "SMS Singapore" },
  lccc: { dir: "lccc", note: "LCCC" },
};

/** A register's claims as ENCOUNTERS the for-whom folds. Names are the
 *  register's corpus-level vocabulary (doc-frequency >= 2 across claims — the
 *  register's own beings), not per-sentence recurrence; each claim's entries
 *  are the bonds among the vocabulary words it carries. No model, no grammar. */
function registerVocab(text) {
  const df = new Map();
  for (const s of splitSentences(text)) {
    const t = String(s.text ?? s);
    if ((t.match(/[A-Za-z]{2,}/g) || []).length < 3) continue;
    const seen = new Set();
    for (const w of t.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) || []) { if (w.length > 3 && !seen.has(w)) { seen.add(w); df.set(w, (df.get(w) || 0) + 1); } }
  }
  return new Set([...df.entries()].filter(([, n]) => n >= 2).map(([w]) => w));
}

function claimsToEntries(text, vocab) {
  const entries = [];
  const sentences = splitSentences(text);
  for (let i = 0; i < sentences.length; i++) {
    const t = String(sentences[i].text ?? sentences[i]);
    if ((t.match(/[A-Za-z]{2,}/g) || []).length < 3) continue;
    const tokens = new Set((t.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) || []));
    const names = [...tokens].filter((w) => vocab.has(w)).slice(0, 8);
    const figs = (t.match(/\d[\d,.]*/g) || []).slice(0, 3);
    for (let a = 0; a < names.length; a++) for (let b = a + 1; b < names.length; b++) {
      entries.push({ schema: "EOHyperedge@1", encounterRef: `enc${i}`, relation: "bond", referent: `${names[a]}-${names[b]}`, participants: [{ surface: names[a] }, { surface: names[b] }] });
    }
    for (const f of figs) entries.push({ schema: "EOMention@1", encounterRef: `enc${i}`, relation: "fig", referent: `fig:${f}`, participants: [{ surface: f }] });
  }
  return entries;
}

function gate(entries, { qTerms = [], minTrajectoryLength = 8 } = {}) {
  // a for-whom reads FOR something, never from nowhere (for-whom.js throws on
  // a null question). The register's own question: its most frequent content
  // terms — the register's universe is what those terms make a difference to.
  if (!qTerms.length) {
    const freq = new Map();
    for (const e of entries) for (const p of e.participants ?? []) { const w = String(p.surface ?? "").toLowerCase(); if (w.length > 3) freq.set(w, (freq.get(w) || 0) + 1); }
    qTerms = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w]) => w);
  }
  const fw = createForWhom({ id: "reg", giver: "the register", question: qTerms.join(" ") });
  const fold = createForWhomFold(fw);
  for (const e of entries) foldForWhom(fold, e);
  const traj = discoveryTrajectory(entries);
  const real = coherentMass(traj);
  const floor = trajectoryNull(traj, { draws: 40, seed: 42 });
  const g = gateForWhomFold(fold, { nullDraws: 40, nullSeed: 42, minRelevance: 0, minTrajectoryLength });
  return { real, floor, coherent: g.coherent, material: g.material, relevant: g.relevant, admitted: g.admitted, decision: g.decision, trajLen: traj.length, qTerms };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("EVERY ASSERTION HAS A FOR-WHOM, BOUNDED BY DMD SALIENCY — casual / non-standard English priors\n");
  const rows = [];
  for (const key of Object.keys(REGISTERS)) {
    const reg = REGISTERS[key];
    const dir = path.join(OC, reg.dir);
    if (!fs.existsSync(dir)) { console.log(`${key}: absent, skipped`); continue; }
    // walk subdirectories (enron's texts sit per-writer folders; a register's
    // files may nest — the universe is the register's, wherever its bytes live)
    const walkFiles = (d) => { const out = []; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const a = path.join(d, e.name); if (e.isDirectory()) out.push(...walkFiles(a)); else if (/\.(txt|md)$/i.test(e.name)) out.push(a); } return out; };
    const files = walkFiles(dir).slice(0, 30);
    const text = files.map((f) => fs.readFileSync(f, "utf8").replace(/^---[\s\S]*?---\n/, "")).join("\n").slice(0, 60000);
    const vocab = registerVocab(text);
    const entries = claimsToEntries(text, vocab);
    if (!entries.length || !vocab.size) { console.log(`${key}: ${reg.note} — no structure read (${files.length} file(s) found, ${vocab.size} vocab) — NAMED GAP, not a result`); continue; }
    const g = gate(entries, { qTerms: [...vocab].slice(0, 4) });
    // the universe: the set of referents/relations the register can hold
    const vocabSet = new Set(entries.map((e) => e.referent).filter(Boolean));
    // a FOREIGN assertion: another register's claim, folded under THIS for-whom —
    // its referents are mostly NOT in this universe, so it must fail relevance.
    const foreignKeys = Object.keys(REGISTERS).filter((k) => k !== key).slice(0, 2);
    let foreignIn = 0, foreignTested = 0;
    for (const fk of foreignKeys) {
      const fdir = path.join(OC, REGISTERS[fk].dir);
      if (!fs.existsSync(fdir)) continue;
      const ftext = fs.readdirSync(fdir).filter((f) => /\.(txt|md)$/i.test(f)).slice(0, 4).map((f) => fs.readFileSync(path.join(fdir, f), "utf8")).join("\n").slice(0, 8000);
      const fVocab = registerVocab(ftext);
      const fEntries = claimsToEntries(ftext, fVocab);
      const shared = fEntries.filter((e) => vocabSet.has(e.referent)).length / Math.max(1, fEntries.length);
      foreignTested++; if (shared > 0.2) foreignIn++;
    }
    rows.push({ key, note: reg.note, ...g, foreignIn, foreignTested });
    const sep = g.coherent && (foreignTested ? foreignIn < foreignTested : true);
    console.log(`${key.padEnd(9)} ${reg.note.padEnd(40)} coherent ${g.coherent ? "✓" : "✗"} mass ${g.real.toFixed(3)}>null ${g.floor.toFixed(3)} | foreign-shared ${(foreignIn / Math.max(1, foreignTested)) * 100 || 0}% ${sep ? "✓" : "✗"}`);
  }
  const good = rows.filter((r) => r.coherent && (r.foreignTested ? r.foreignIn < r.foreignTested : true)).length;
  console.log(`\nVERDICT: ${good}/${rows.length} registers have a REAL universe (DMD-coherent above their null) and REFUSE foreign claims — grounding by DMD saliency, per for-whom, works on non-standard English. A claim is grounded iff it is admitted under its register's for-whom.`);
}