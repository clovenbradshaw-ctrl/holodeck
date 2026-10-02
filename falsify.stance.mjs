// falsify.stance.mjs — a position must be readable through the hyperlexicon.
//
// The Draft's mechanical check hears names, figures, and a short verb list; a
// copula position ("X is pro Y") is none of those, so a source that states it
// was reported as holding nothing. The reader assembled in holodeck-reader.js
// now hears the copula construction and equates a stance with its own
// paraphrases, so the same source's "tweeted in support of" is the same act as
// "is pro". This proves the reader does that, and that it does NOT bind the
// opposite stance or a different object.
//
//   node falsify.stance.mjs
//
// The reader's priors load over fetch; in Node a file:// fetch is answered from
// disk so the lemmatizer (which carries sameAct) is actually present, exactly
// as the browser loads it.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  const s = String(u);
  if (s.startsWith('file:')) { try { return new Response(await readFile(fileURLToPath(s)), { status: 200 }); } catch (e) { return new Response('', { status: 404 }); } }
  return realFetch(u, o);
};

const { makeEngineRelationReader } = await import('./holodeck-reader.js');

const SOURCE = {
  ref: 'Susan Sarandon#0-320',
  text: 'On May 27, 2021, Susan Sarandon tweeted in support of the Palestinian people, in her words, "fighting against the apartheid government of Netanyahu", and of the Israeli people "that they too, will enjoy peace".',
};

let fails = 0;
const ok = m => console.log('  ✔ ' + m);
const fail = m => { fails++; console.log('  ✖ ' + m); };
const verdict = (report, claim) => (report.read(claim).claims || [])[0] || null;

console.log('─ Falsification: a position is read through the hyperlexicon ─');
const R = await makeEngineRelationReader();
const report = R([SOURCE]);
console.log('  edges read from the source:');
for (const e of report.edges) console.log('    ' + e.end1 + ' —' + e.label + '→ ' + e.end2 + (e.polarity === '-' ? ' (negated)' : ''));

// [1] The construction the base reader misses: a copula + adjective position.
const copula = verdict(report, 'susan sarandon is pro palestine');
copula ? ok('the copula position is heard: “' + copula.end1 + ' —' + copula.label + '→ ' + copula.end2 + '”') : fail('the copula position “is pro palestine” was not heard at all');
if (copula) {
  copula.verdict === 'bound'
    ? ok('and it binds the source’s own “tweeted in support of the” (stance class equated, object matched)')
    : fail('the copula position did not bind: verdict ' + copula.verdict + (copula.nearest && copula.nearest.length ? ' (nearest: ' + copula.nearest[0].label + ')' : ''));
}

// [2] A paraphrase with the source's own verb binds.
const para = verdict(report, 'Susan Sarandon supported the Palestinian people');
para && para.verdict === 'bound' ? ok('a paraphrase of the source’s own verb binds') : fail('the paraphrase did not bind: ' + (para ? para.verdict : 'not heard'));

// [3] Falsifier — the OPPOSITE stance must never bind.
const opp = verdict(report, 'Susan Sarandon opposed the Palestinian people');
opp && opp.verdict !== 'bound' ? ok('the opposite stance does not bind (' + opp.verdict + ')') : fail('the opposite stance wrongly bound');

// [4] Falsifier — the same stance toward a DIFFERENT object must never bind.
const other = verdict(report, 'Susan Sarandon is pro israel');
other && other.verdict !== 'bound' ? ok('the same stance toward a different object does not bind (' + other.verdict + ')') : fail('a different object wrongly bound');

console.log('\n' + (fails === 0 ? 'ALL STANCE-READING FALSIFICATION CHECKS PASSED' : fails + ' STANCE-READING CHECK(S) FAILED'));
process.exit(fails === 0 ? 0 : 1);
