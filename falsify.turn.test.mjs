// falsify.turn.test.mjs — the falsifier for the summary's turn claim.
//
// The first experiment reported "fold-at-identity carries the turn 3/3." It was
// a TAUTOLOGY: the identity was set to the OPPOSITE of the document's dominant
// stance, so the fold surfaced the document's MAJORITY-stance claims by
// construction, and the "carried" metric (answer stance != identity stance)
// rewarded echoing them. A turn is a MINORITY inversion, and that construction
// could not surface one. This test pins the falsification so the mistake cannot
// quietly return: an identity set to -docStance MUST surface only majority
// claims, while an identity HELD at docStance MUST surface the minority turn.

import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisFromText } from './falsify.summary.mjs';
import { select, stanceLens } from './holodeck-summary.js';

// majority: 6 positive claims; the buried turn: the audit's 2 negative claims.
const DOC = [
  'The program is good and it works well for the city.',
  'The new plan is reasonable and supported by the department.',
  'Officials said the program is effective and valuable for residents.',
  'The council found the measure necessary and beneficial.',
  'Supporters called the plan smart and needed for safety.',
  'The review said the program improves outcomes and is worth the cost.',
  'The independent audit found the program is bad and failed to reduce harm.',
  'The audit concluded the plan is unnecessary and the spending was wasted.',
].join(' ');

const A = analysisFromText(DOC, 'prog');
const claims = A.sts.filter((st) => !st.ref && st.claimy !== false);
const docStance = Math.sign(claims.reduce((s, st) => s + stanceLens(st.text), 0)) || 1;
const minorityOf = (r) => r.lines.filter((l) => stanceLens(l) !== docStance).length;

test('the old construction is a tautology: -docStance identity surfaces only majority claims', () => {
  const old = select(A, 'prog', { size: 4, forWhom: { conclusion: { names: [], measures: [], frames: ['fact'], stance: -docStance } } });
  assert.equal(minorityOf(old), 0, 'folding at -docStance can surface no minority (turn) claim — by construction');
});

test('the honest construction surfaces the genuine turn: a HELD identity picks the minority inversion', () => {
  const held = select(A, 'prog', { size: 4, forWhom: { conclusion: { names: [], measures: [], frames: ['fact'], stance: docStance } } });
  assert.ok(minorityOf(held) > 0, 'folding at the HELD identity surfaces the minority turn');
});
