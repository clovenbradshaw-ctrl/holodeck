// Offline conformance for holodeck-perspectives.js: no network, no live_priors text.
// Run: node --test holodeck-perspectives.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from './holodeck-perspectives.js';
import { createHolograph, admit } from './vendor/eoreader7/native/kernel/bayes-surprise.js';

const STREAM = [
  'The engine was described by Ada Lovelace and Charles Babbage in 1843.',
  'Later notes by Ada Lovelace and Charles Babbage extended the design.',
  'A letter from Grace Hopper mentioned Ada Lovelace once.',
  'Nobody in the audience objected to the plan at all.',
  'The audit did not support the claim by Charles Babbage and Grace Hopper.',
];

test('factsAlong reads what each statement does to the picture', () => {
  const f = P.factsAlong(STREAM);
  assert.equal(f.length, STREAM.length);
  assert.equal(f[0].event, 'introduce'); // two names, none yet in the picture
  assert.equal(f[1].event, 'restate');   // the same pair, held again
  assert.equal(f[3].event, 'bare');      // no names at all
  assert.ok(['bond', 'enter', 'turn'].includes(f[4].event));
  for (const x of f) assert.deepEqual(Object.keys(x).sort(), ['event', 'fresh', 'known']);
});

test('a reader stores structure only: no word from the text survives in the holograph', () => {
  const holo = createHolograph();
  P.factsAlong(STREAM).forEach((f) => admit(holo, f));
  const serial = JSON.stringify([...holo.slots].map(([k, m]) => [k, [...m]]));
  for (const w of ['Ada', 'Lovelace', 'Babbage', 'Hopper', 'engine', 'audit', 'letter']) assert.ok(!serial.includes(w), w + ' leaked into the holograph');
  const values = new Set([...holo.slots.values()].flatMap((m) => [...m.keys()]));
  const allowed = new Set(['bare', 'introduce', 'enter', 'bond', 'restate', 'turn', '0', '1', '2', '3+', '(absent)']);
  for (const v of values) assert.ok(allowed.has(v), 'unexpected stored value: ' + v);
});

test('scoring is read-only: a workspace statement never teaches a reader', () => {
  const holo = createHolograph();
  P.factsAlong(STREAM).forEach((f) => admit(holo, f));
  const snap = () => JSON.stringify([...holo.slots].map(([k, m]) => [k, [...m]]) .concat([[holo.admitted]]));
  const before = snap();
  for (let i = 0; i < 50; i++) P.scoreAgainstGenre(holo, { event: 'bond', known: '3+', fresh: '3+' }, 1);
  assert.equal(snap(), before);
});

test('a reader that has read nothing finds nothing notable', () => {
  const r = P.scoreAgainstGenre(createHolograph(), { event: 'bond', known: '2', fresh: '0' });
  assert.equal(r.notable, false);
});

test('readers with different experience disagree, and divergence names the claim in both directions', () => {
  const mk = (facts) => { const holo = createHolograph(); const combos = new Map();
    facts.forEach((f) => { admit(holo, f); const k = JSON.stringify(f); combos.set(k, { f, n: (combos.get(k)?.n || 0) + 1 }); });
    return { holo, files: 1, sentences: facts.length, notableBits: P.notableBitsOf(holo, combos) }; };
  const bareOnly = mk(Array(80).fill({ event: 'bare', known: '0', fresh: '0' }).concat(Array(2).fill({ event: 'bond', known: '2', fresh: '0' })));
  const bondy = mk(Array(40).fill({ event: 'bond', known: '2', fresh: '0' }).concat(Array(40).fill({ event: 'bare', known: '0', fresh: '0' })));
  const holos = { lit: bareOnly, ency: bondy, gov: bondy };
  const facts = { event: 'bond', known: '2', fresh: '0' };
  const items = [{ id: 'x', byGenre: P.scorePerspectives(holos, facts) }];
  assert.equal(items[0].byGenre.lit.notable, true);
  assert.equal(items[0].byGenre.ency.notable, false);
  const { projected, pairs } = P.projectAndDiverge(P.buildPerspectiveLog(items));
  assert.equal(projected.gap, null);
  const litEncy = pairs.find((p) => p.a === 'lit' && p.b === 'ency');
  assert.deepEqual(litEncy.conflicting.map((c) => c.claim), ['notable:x']);
  assert.equal(pairs.find((p) => p.a === 'ency' && p.b === 'gov').conflicting.length, 0); // same experience, same verdict
});
