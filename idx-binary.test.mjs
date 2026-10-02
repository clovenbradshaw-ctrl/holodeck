import test from 'node:test';
import assert from 'node:assert/strict';
import { packIndex, FoldIndex, unpackIndex } from './idx-binary.js';

function sampleIndex() {
  const src = (chunks, chars, maps) => ({ chunks, chars, ops: {}, terrain: {}, kinds: {}, cast: {}, bonds: {}, idChurn: {}, ...maps });
  return {
    schema: 'FoldReadingIndex@2',
    from: 'https://example.com/ground/read.jsonl.zst',
    cursor: { sequence: 3, ts: '2026-09-01T00:00:00Z' },
    builtAt: '2026-09-01T00:00:00.000Z',
    ms: 1234,
    lines: 1000, bad: 0, encounters: 7,
    castTotal: 3, bondsTotal: 2, canonTotal: 2, identitiesTotal: 2,
    order: ['b.txt', 'a.txt'],
    kinds: { 'DEF/define': 4, 'INS/': 2 },
    sources: {
      'a.txt': src(3, 500, { ops: { INS: 2, DEF: 1 }, terrain: { prose: 3 }, kinds: { 'DEF/define': 1 }, cast: { 'Alice': 2 }, bonds: { 'Alice — Bob': 1 }, idChurn: {} }),
      'b.txt': src(4, 900, { ops: { CON: 2 }, terrain: {}, kinds: { 'CON/rel': 2 }, cast: { 'Bob': 3 }, bonds: {}, idChurn: { 'X ↔ Y': 1 } }),
    },
    cast: [
      { id: 'alice-id', surfaces: ['Alice', 'Alicia'], standing: 'settled', mentions: 10, src: { 'a.txt': 6, 'b.txt': 4 }, first: 'a.txt', firstSeq: 1, srcN: 2 },
      { id: 'bob-id', surfaces: ['Bob'], standing: 'contested', mentions: 7, src: { 'b.txt': 7 }, first: 'b.txt', firstSeq: 3, srcN: 1 },
      { id: 'carol-id', surfaces: ['Carol'], standing: '', mentions: 2, src: { 'a.txt': 2 }, first: 'a.txt', firstSeq: 2, srcN: 1 },
    ],
    bonds: [
      { a: 'Alice', b: 'Bob', n: 3, rel: { knows: 2, hires: 1 }, pos: 3, neg: 0, src: { 'a.txt': 2, 'b.txt': 1 }, first: 'a.txt', firstSeq: 1, srcN: 2 },
      { a: 'Carol', b: 'Bob', n: 1, rel: { meets: 1 }, pos: 1, neg: 0, src: { 'b.txt': 1 }, first: 'b.txt', firstSeq: 3, srcN: 1 },
    ],
    canon: [
      { a: 'Alice', b: 'Bob', n: 3, alts: { Alicia: 1 }, src: { 'a.txt': 3 }, srcN: 1 },
      { a: 'Carol', b: 'Bob', n: 1, alts: {}, src: { 'b.txt': 1 }, srcN: 1 },
    ],
    identities: [
      { left: 'Alice', right: 'Alicia', n: 2, events: { identity_hypothesis_supported: 2 }, src: { 'a.txt': 2 }, srcN: 1 },
      { left: 'X', right: 'Y', n: 1, events: { identity_split: 1 }, src: { 'b.txt': 1 }, srcN: 1 },
    ],
  };
}

test('round-trips a FoldReadingIndex@2 through binary without loss', () => {
  const src = sampleIndex();
  const bytes = packIndex(src);
  const out = unpackIndex(bytes);
  for (const k of ['schema', 'from', 'builtAt', 'ms', 'lines', 'bad', 'encounters', 'castTotal', 'bondsTotal', 'canonTotal', 'identitiesTotal']) {
    assert.deepEqual(out[k], src[k], k);
  }
  assert.deepEqual(out.cursor, src.cursor, 'cursor');
  assert.deepEqual(out.kinds, src.kinds, 'kinds');
  assert.deepEqual(out.order, src.order, 'order');
  assert.deepEqual(out.cast, src.cast, 'cast');
  assert.deepEqual(out.bonds, src.bonds, 'bonds');
  assert.deepEqual(out.canon, src.canon, 'canon');
  assert.deepEqual(out.identities, src.identities, 'identities');
  assert.deepEqual(out.sources, src.sources, 'sources');
});

test('castTop matches slice().sort().slice(0,n)', () => {
  const ix = new FoldIndex(packIndex(sampleIndex()));
  const want = sampleIndex().cast.slice().sort((a, b) => b.srcN - a.srcN || b.mentions - a.mentions).slice(0, 2);
  assert.deepEqual(ix.castTop(2), want);
  assert.equal(ix.castTop(2).length, 2);
});

test('bondsOf matches filter/sort/slice', () => {
  const ix = new FoldIndex(packIndex(sampleIndex()));
  const want = sampleIndex().bonds.filter(b => b.a === 'Bob' || b.b === 'Bob').sort((a, b) => b.n - a.n).slice(0, 5);
  assert.deepEqual(ix.bondsOf('Bob'), want);
  assert.equal(ix.bondsOf('Nobody').length, 0);
});

test('source() random access agrees with the sources map', () => {
  const ix = new FoldIndex(packIndex(sampleIndex()));
  assert.deepEqual(ix.source('b.txt'), ix.sources['b.txt']);
  assert.deepEqual(ix.source('a.txt'), ix.sources['a.txt']);
  assert.equal(ix.source('nope.txt'), null);
});

test('lazy accessors are cached (single decode)', () => {
  const ix = new FoldIndex(packIndex(sampleIndex()));
  assert.equal(ix.cast, ix.cast);
  assert.equal(ix.bonds, ix.bonds);
  assert.equal(ix.sources, ix.sources);
  assert.equal(ix.kinds, ix.kinds);
  assert.equal(ix.order, ix.order);
});

test('one ArrayBuffer serves every accessor', () => {
  const src = sampleIndex();
  const bytes = packIndex(src);
  const ix = new FoldIndex(bytes);
  ix.cast; ix.castTop(1); ix.bonds; ix.bondsOf('Bob'); ix.sources; ix.source('a.txt'); ix.kinds; ix.order; ix.cursor; ix.canon; ix.identities;
  assert.deepEqual(ix.bonds[0], src.bonds[0]);
  assert.equal(ix.castTotal, src.castTotal);
  assert.equal(ix.encounters, src.encounters);
});

test('empty sections round-trip', () => {
  const src = sampleIndex();
  src.cast = []; src.bonds = []; src.canon = []; src.identities = []; src.sources = {}; src.order = []; src.kinds = {};
  const out = unpackIndex(packIndex(src));
  assert.deepEqual(out.cast, []);
  assert.deepEqual(out.bonds, []);
  assert.deepEqual(out.canon, []);
  assert.deepEqual(out.identities, []);
  assert.deepEqual(out.sources, {});
  assert.deepEqual(out.order, []);
  assert.deepEqual(out.kinds, {});
  assert.equal(out.castTotal, src.castTotal);
});

test('missing optional scalars stay sane', () => {
  const src = sampleIndex();
  delete src.cursor; delete src.from; delete src.standing;
  const out = unpackIndex(packIndex(src));
  assert.equal(out.cursor, null);
  assert.equal(out.from, '');
});

test('rejects a non-FRIX buffer and unknown versions', () => {
  assert.throws(() => new FoldIndex(new Uint8Array([1, 2, 3, 4, 5, 6])), /not a FRIX/);
  const bytes = packIndex(sampleIndex());
  bytes[4] = 99; bytes[5] = 0;
  assert.throws(() => new FoldIndex(bytes), /unknown FRIX version/);
});