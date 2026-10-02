import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { echoPairs } = createRequire(import.meta.url)('./holodeck-echo.js');

const rng = seed => { let t = seed; return () => { t = (t * 1664525 + 1013904223) >>> 0; return t / 4294967296; }; };
const subject = ['traffic', 'police', 'nashville', 'enforcement', 'stops', 'fatal', 'crash', 'driver'];
const rare = Array.from({ length: 400 }, (_, i) => 'w' + i);

// every claim carries a few subject words (the whole corpus is about them) plus its own rare words
function corpus(nDocs, perDoc, seed) {
  const r = rng(seed), items = [];
  for (let d = 0; d < nDocs; d++) for (let k = 0; k < perDoc; k++) {
    const terms = new Map();
    for (let s = 0; s < 3; s++) terms.set(subject[Math.floor(r() * subject.length)], 0.4);
    for (let s = 0; s < 6; s++) terms.set(rare[Math.floor(r() * rare.length)], 2.5);
    items.push({ doc: 'd' + d, terms });
  }
  return items;
}
const planted = (items, a, b) => { items[b] = { doc: items[b].doc, terms: new Map(items[a].terms) }; items[b].terms.set('wextra', 2.5); };

test('a planted near-duplicate pair echoes', () => {
  const items = corpus(6, 30, 7); planted(items, 0, 100);
  const { pairs } = echoPairs(items);
  assert.ok(pairs.some(p => p.a === 0 && p.b === 100), 'the planted pair is found');
});

test('unrelated claims sharing only subject words rarely echo (design rate: about 1 claim in 20)', () => {
  const items = corpus(6, 30, 11);
  const { pairs } = echoPairs(items);
  const listed = new Set(); pairs.forEach(p => { if (p.ab) listed.add(p.a); if (p.ba) listed.add(p.b); });
  assert.ok(listed.size / items.length <= 0.1, 'spurious claims: ' + listed.size + ' of ' + items.length);
});

test('short claims sharing only a common word do not echo, while long claims sharing many rare words do', () => {
  const items = corpus(6, 30, 21);
  items.push({ doc: 'short1', terms: new Map([['w7', 2.5], ['traffic', 0.4]]) }, { doc: 'short2', terms: new Map([['w8', 2.5], ['traffic', 0.4]]) });
  const iA = items.length - 2, iB = items.length - 1;
  const long = new Map(); for (let k = 0; k < 8; k++) long.set('wq' + k, 2.5);
  items.push({ doc: 'long1', terms: new Map(long) }, { doc: 'long2', terms: new Map(long) });
  const { pairs } = echoPairs(items), has = (a, b) => pairs.some(p => p.a === a && p.b === b && (p.ab || p.ba));
  assert.ok(!has(iA, iB), 'two short claims sharing only a common word are chance');
  assert.ok(has(items.length - 2, items.length - 1), 'two long claims sharing eight rare words are an echo');
});

test('claims from the same source never echo', () => {
  const items = corpus(4, 20, 3); planted(items, 0, 1);
  const { pairs } = echoPairs(items);
  assert.ok(!pairs.some(p => items[p.a].doc === items[p.b].doc));
});

test('the same corpus gives the same echoes', () => {
  const a = corpus(5, 25, 5); planted(a, 2, 90);
  const x = echoPairs(a), y = echoPairs(a);
  assert.deepEqual(x.pairs, y.pairs); assert.equal(x.floor, y.floor);
});

test('fewer than two claims yields nothing', () => {
  assert.deepEqual(echoPairs([]).pairs, []); assert.deepEqual(echoPairs([{ doc: 'a', terms: new Map([['x', 1]]) }]).pairs, []);
});
