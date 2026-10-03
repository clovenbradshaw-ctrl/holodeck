// holodeck-records.test.mjs — the records log is the workspace as a relational database. The
// law proven here is the parity one: an uploaded source's local reading lands as Referents and
// Bonds, exactly as the OHS ground reading does, and the two never double-insert an anchor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDatabase } from './holodeck-records.js';
import { readDoc, mergeReadings } from './holodeck-reading.js';

const edge = (end1, label, end2, polarity = '+') => ({ end1, label, end2, polarity, refs: [] });
const doc = { id: 'u1', title: 'A note', format: 'text', text: 'Riley met O\u2019Connell. Riley said O\u2019Connell agreed.' };
const A = {
  docs: [doc], docById: { u1: doc }, sts: [],
  names: { Riley: { name: 'Riley', type: 'person', aliases: [], sts: [], docs: new Set(['u1']) } },
};
const localIx = mergeReadings([{
  name: 'u1',
  ...readDoc('u1', doc.text, { edges: [edge('Riley', 'met', 'O\u2019Connell'), edge('Riley', 'said', 'O\u2019Connell', '-')] }),
}], { from: 'test' });

test('a local reading lands as Referents and Bonds in the records', () => {
  const db = buildDatabase(A, null, { localIx });
  const names = Object.values(db.state.entities).map(e => e._type);
  assert.ok(names.includes('Referents'), 'Referents table exists');
  assert.ok(names.includes('Bonds'), 'Bonds table exists');
  const ref = db.state.entities['ref:' + 'riley'];
  assert.ok(ref, 'the referent Riley is a record');
  assert.equal(ref.standing, 'witnessed');
  assert.equal(ref.mentions, 2);
  const bond = db.state.entities['bond:Riley|O\u2019Connell'];
  assert.ok(bond, 'the bond is a record');
  assert.equal(bond.witnessed, 2);
  assert.equal(bond.negative, 1);
  assert.ok(db.schema.links.some(l => l.from === 'Bonds' && l.to === 'Referents'), 'Bonds link to Referents');
});

test('the OHS reading and the local reading do not double-insert an anchor', () => {
  const ohs = { cast: [{ id: 'riley', surfaces: ['Riley'], standing: 'primary', mentions: 9, srcN: 2, src: { a: 1, b: 1 }, first: 'a' }], bonds: [{ a: 'Riley', b: 'O\u2019Connell', n: 9, rel: { met: 9 }, pos: 9, neg: 0, srcN: 2, src: { a: 9, b: 9 }, first: 'a' }] };
  const db = buildDatabase(A, ohs, { localIx });
  const refs = Object.values(db.state.entities).filter(e => e._type === 'Referents');
  assert.equal(refs.filter(e => e._anchor === 'ref:riley').length, 1, 'one Riley record, not two');
  assert.equal(refs.find(e => e._anchor === 'ref:riley').standing, 'primary', 'the OHS reading wins the field');
  const bonds = Object.values(db.state.entities).filter(e => e._type === 'Bonds' && e._anchor === 'bond:Riley|O\u2019Connell');
  assert.equal(bonds.length, 1, 'one bond record, not two');
});
