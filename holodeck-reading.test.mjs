// holodeck-reading.test.mjs — the local reading is a fold, so its laws are structural: a
// surface merges across sources, an unordered pair merges its relations and polarity, and the
// projected index is the same FoldReadingIndex@2 shape the OHS reading and the records view
// already consume. A hand-made reader report stands in for holodeck-reader.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readDoc, mergeReadings, readWorkspace, splitPassages, countSurface, bondKey, readSighted, nameRuns } from './holodeck-reading.js';

const edge = (end1, label, end2, polarity = '+') => ({ end1, label, end2, polarity, refs: [] });

test('splitPassages keeps short paragraphs whole and cuts long ones on sentence boundaries', () => {
  assert.deepEqual(splitPassages('One.\n\nTwo.\n\nThree.'), ['One.', 'Two.', 'Three.']);
  const long = Array.from({ length: 40 }, (_, i) => 'Sentence number ' + i + ' has several words in it.').join(' ');
  const parts = splitPassages(long, 120);
  assert.ok(parts.length > 1, 'a long paragraph is cut');
  parts.forEach(p => assert.ok(p.length <= 120, 'no passage exceeds the cap'));
  assert.equal(parts.join(' ').replace(/\s+/g, ' '), long.replace(/\s+/g, ' '), 'cutting loses nothing');
});

test('a surface or doc named after Object.prototype is kept, never swallowed', () => {
  // '__proto__', 'constructor' and 'toString' are the falsifier's stock attack on a plain-object
  // accumulator: assigning to them on {} would hit the prototype, not store the count.
  const r = readDoc('__proto__', '__proto__ is constructor. constructor met toString.', {
    edges: [edge('__proto__', 'is', 'constructor'), edge('constructor', 'met', 'toString')],
  });
  assert.deepEqual(r.surfaces.sort(), ['__proto__', 'constructor', 'toString'], 'all three surfaces survive');
  const c = r.cast.find(x => x.surfaces[0] === '__proto__');
  assert.ok(c, '__proto__ is a referent');
  assert.equal(c.mentions, 1, 'its mention is counted, not lost to the prototype');
  assert.equal(r.source.cast.__proto__, 1, 'the per-source count is kept');
  const rix = mergeReadings([{ name: '__proto__', ...r }]);
  assert.ok(rix.cast.find(x => x.id === '__proto__'), 'it survives the merge');
});

test('countSurface counts whole words for one token and scans multi-word names', () => {
  assert.equal(countSurface('The cat sat. A cat, another cat.', 'cat'), 3);
  assert.equal(countSurface('concatenate', 'cat'), 0, 'a word inside another is not a mention');
  assert.equal(countSurface('Alpha Beta and Alpha Beta again', 'Alpha Beta'), 2);
});

test('readDoc turns the reader edges into a source block plus global cast and bonds', () => {
  const text = 'Riley met O\u2019Connell. Riley said O\u2019Connell agreed.';
  const report = { edges: [edge('Riley', 'met', 'O\u2019Connell'), edge('Riley', 'said', 'O\u2019Connell', '-')] };
  const r = readDoc('u1', text, report, { passages: 2 });
  assert.deepEqual(r.surfaces.sort(), ['O\u2019Connell', 'Riley']);
  assert.equal(r.source.chunks, 2);
  assert.equal(r.source.ops.CON, 2);
  assert.equal(r.source.cast.Riley, 2, 'two mentions of Riley');
  assert.equal(r.source.bonds[bondKey('Riley', 'O\u2019Connell')], 2);
  const b = r.bonds[0];
  assert.equal(b.a, 'Riley'); assert.equal(b.b, 'O\u2019Connell');
  assert.equal(b.n, 2); assert.equal(b.neg, 1, 'one of the two edges is negated'); assert.equal(b.pos, 1);
  assert.deepEqual({ ...b.rel }, { met: 1, said: 1 });
  assert.equal(r.cast.find(c => c.surfaces[0] === 'Riley').mentions, 2);
  assert.equal(r.cast.find(c => c.surfaces[0] === 'Riley').standing, 'witnessed');
});

test('mergeReadings sums a bond across sources and merges a surface into one row', () => {
  const a = readDoc('u1', 'Riley met O. Riley met O. Riley met O.', { edges: [edge('Riley', 'met', 'O'), edge('Riley', 'met', 'O'), edge('Riley', 'met', 'O')] });
  const b = readDoc('u2', 'Riley left. Riley saw O.', { edges: [edge('Riley', 'left', 'O'), edge('Riley', 'saw', 'O', '-')] });
  const rix = mergeReadings([{ name: 'u1', ...a }, { name: 'u2', ...b }], { from: 'test' });
  assert.equal(rix.schema, 'FoldReadingIndex@2');
  assert.deepEqual(rix.order, ['u1', 'u2']);
  assert.equal(rix.encounters, 2);
  const riley = rix.cast.find(c => c.surfaces[0] === 'Riley');
  assert.equal(riley.srcN, 2, 'Riley is read in two sources');
  assert.deepEqual({ ...riley.src }, { u1: 1, u2: 1 });
  assert.equal(riley.mentions, 3, 'the higher mention count wins, as the OHS fold does');
  const bk = rix.bonds.find(x => x.a === 'Riley' && x.b === 'O');
  assert.equal(bk.n, 5, 'the pair recurs across both sources');
  assert.equal(bk.neg, 1);
  assert.deepEqual({ ...bk.rel }, { met: 3, left: 1, saw: 1 });
  assert.deepEqual(Object.keys(rix.sources), ['u1', 'u2']);
  assert.equal(rix.sources.u1.cast.Riley, 3);
  assert.equal(rix.castTotal, rix.cast.length);
  assert.equal(rix.bondsTotal, rix.bonds.length);
});

test('readWorkspace reads each doc with the injected reader and skips the textless', () => {
  const seen = [];
  const relationsFor = passages => { seen.push(passages.map(p => p.ref)); return { edges: [edge('A', 'is', 'B')] }; };
  const rix = readWorkspace([{ id: 'u1', text: 'A is B.' }, { id: 'u2', text: '   ' }], relationsFor, { from: 'test' });
  assert.deepEqual(rix.order, ['u1']);
  assert.equal(seen.length, 1, 'the textless doc never reaches the reader');
  assert.equal(rix.cast.length, 2);
  assert.equal(rix.bonds.length, 1);
});

test('a screen reading folds beside a text reading and keeps its 2D regions', () => {
  const text = { name: 'u1', ...readDoc('u1', 'Acme Labs hired Bob Smith.', { edges: [edge('Acme Labs', 'hired', 'Bob Smith')] }) };
  const screen = readSighted('img1', [
    { id: 'e1', role: 'h1', region: [10, 10, 200, 40], text: 'Acme Labs' },
    { id: 'e2', role: 'p', region: [10, 60, 300, 20], text: 'Acme Labs hired Bob Smith' },
  ]);
  const rix = mergeReadings([text, screen], { from: 'test' });
  assert.deepEqual(rix.order, ['u1', 'img1'], 'a text source and an image fold into one index');
  const acme = rix.cast.find(c => c.id === 'acme labs');
  assert.equal(acme.srcN, 2, 'Acme Labs is read in both the text and the image');
  assert.equal(acme.regions.length, 2, 'the image referent carries its two regions');
  assert.equal(acme.standing, 'sighted');
  assert.deepEqual(rix.cast.find(c => c.id === 'bob smith').regions, [[10, 60, 300, 20]]);
});

test('nameRuns reads a box\'s name phrase and drops furniture and lone stop words', () => {
  assert.deepEqual(nameRuns('Acme Labs'), ['Acme Labs']);
  assert.deepEqual(nameRuns('Contact'), []);
  assert.deepEqual(nameRuns('Acme Labs hired Bob Smith'), ['Acme Labs', 'Bob Smith']);
});

test('the projected shape carries every key the OHS index consumers read', () => {
  const rix = mergeReadings([{ name: 'u1', ...readDoc('u1', 'A is B.', { edges: [edge('A', 'is', 'B')] }) }]);
  for (const k of ['schema', 'from', 'builtAt', 'ms', 'lines', 'bad', 'encounters', 'order', 'sources', 'kinds', 'castTotal', 'cast', 'bondsTotal', 'bonds', 'canonTotal', 'canon', 'identitiesTotal', 'identities'])
    assert.ok(k in rix, 'missing ' + k);
});
