// falsify.summary.test.mjs — the standalone falsifier (build-order step 5) as
// a TEST IMPORT, so it is never a manual integration. Runs the four invariants
// against the derivation's own source AND a held-out source, and proves the
// null control fires (a check seen firing, GL-QA-01).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { falsify, analysisFromText } from './falsify.summary.mjs';
import { resolverEdges, tokens } from './holodeck-summary.js';

const NTOR = readFileSync(fileURLToPath(new URL('./fixtures/summary-goldens/no-turn-on-red.txt', import.meta.url)), 'utf8');

test('the four invariants hold on the derivation source (NTOR)', () => {
  const r = falsify(NTOR, 'ntor');
  assert.ok(r.ok, `violated: ${JSON.stringify(r.invariants.filter((i) => !i.ok))}`);
  assert.deepEqual(r.invariants.map((i) => i.id), ['G', 'N', 'M', 'S']);
});

test('the four invariants hold on a HELD-OUT source the ladder was not tuned on', () => {
  // The 1911 Britannica Law entry — argumentative reference prose the golden was
  // not derived from. A summary invariant that only holds on its own source is
  // not an invariant.
  const HELD_OUT = readFileSync('/Users/mlacy/Documents/3.0/live_priors/02-encyclopedic/1911-britannica/EB1911_Law.txt', 'utf8');
  const r = falsify(HELD_OUT, 'eb1911-law');
  assert.ok(r.ok, `violated: ${JSON.stringify(r.invariants.filter((i) => !i.ok))}`);
});

test('the null control fires: word salad manufactures no explanations', () => {
  const shuffled = analysisFromText(tokens(NTOR).join(' '), 'ntor');
  const edges = resolverEdges(shuffled, 'ntor', { top: 8 });
  assert.ok(edges.length <= 1, `word salad manufactured ${edges.length} explanations`);
});