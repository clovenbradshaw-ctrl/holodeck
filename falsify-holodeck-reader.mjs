// the-fold/falsify-holodeck-reader.mjs — FALSIFY the composed reader's
// improvement in the holodeck.
//
// The claim under test: swapping the holodeck's dispatch reader for the
// COMPOSED reader (positional clause connector where the measured RoleConfig
// settles, recurrence elsewhere) recovers MORE real structure from the same
// source than the dispatch reader it replaced — and does not merely emit more.
//
// Falsified if: the composed reader's relations on real text are ≤ the
// dispatch reader's, OR the composed reader's gain does not vanish under a
// word-shuffle null (extra relations would then be noise, not reading).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { composedRelations } from "./vendor/eoreader7/native/adapters/text/gfp-relations-composed.js";
import { relationExtractorsFor } from "./vendor/eoreader7/native/adapters/text/relations-language.js";
import { classifyWord, dominantClass } from "./vendor/eoreader7/native/adapters/text/wordclass.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const posPrior = JSON.parse(fs.readFileSync(path.join(HERE, "vendor/eoreader7/native/priors/pos-eng.json"), "utf8"));
const roleConfig = JSON.parse(fs.readFileSync(path.join(HERE, "vendor/eoreader7/native/priors/role-config-eng.json"), "utf8"));
const verbForms = new Set();
for (const [w, c] of Object.entries(posPrior.forms ?? {})) { const t = Object.values(c).reduce((a, b) => a + b, 0); if (t > 0 && ((c.VERB ?? 0) + (c.AUX ?? 0)) / t >= 0.9) verbForms.add(w.toLowerCase()); }

// the source the holodeck reads (the derivation fixture), first N sentences
const TEXT = fs.readFileSync(path.join(HERE, "fixtures/summary-goldens/no-turn-on-red.txt"), "utf8").replace(/\s+/g, " ").trim();
const dispatchRead = relationExtractorsFor({ language: "eng", roleConfig: null, posPrior: null, classifyWord, dominantClass });
const composedRead = (text) => composedRelations(text, { posPrior, roleConfig, classifyWord, dominantClass, verbForms }).relations;

const shuffle = (s) => { const a = s.split(/\s+/); for (let i = a.length - 1; i > 0; i--) { const j = (i * 7 + 3) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a.join(" "); };
const keyOf = (r) => `${String(r.end1).toLowerCase()}|${String(r.label).toLowerCase().split(/\s+/)[0]}|${String(r.end2).toLowerCase()}`;

const dispatch = dispatchRead.extractRelations(TEXT, { clauseAware: true }) || [];
const composed = composedRead(TEXT);
const composedNull = composedRead(shuffle(TEXT));
const dispatchNull = dispatchRead.extractRelations(shuffle(TEXT), { clauseAware: true }) || [];

const uniq = (rs) => new Set(rs.map(keyOf)).size;
console.log("holodeck source (no-turn-on-red):");
console.log(`  dispatch reader:        ${dispatch.length} relations (${uniq(dispatch)} distinct)`);
console.log(`  composed reader:        ${composed.length} relations (${uniq(composed)} distinct)`);
console.log(`  dispatch shuffle-null:  ${dispatchNull.length}`);
console.log(`  composed shuffle-null:  ${composedNull.length}`);
const realGain = uniq(composed) - uniq(dispatch);
const nullGain = uniq(composedRead(shuffle(TEXT))) - uniq(dispatchRead.extractRelations(shuffle(TEXT), { clauseAware: true }) || []);
console.log(`\n  distinct gain (composed - dispatch) on REAL text: ${realGain}`);
console.log(`  distinct gain on SHUFFLED text:                   ${nullGain}`);
const verdict = realGain > 0 && realGain > nullGain ? "SUPPORTED — the composed reader recovers more, and the gain is real (larger than the shuffle's)" : realGain <= 0 ? "FALSIFIED — the composed reader does not read more than the dispatch reader it replaced" : "WEAK — the composed reader reads more, but the shuffle reads more too: the gain is incoherent, not reading";
console.log(`\nVERDICT: ${verdict}`);