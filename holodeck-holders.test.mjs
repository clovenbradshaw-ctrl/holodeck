// Offline conformance for holodeck-holders.js (v2 — read through the pipeline).
// Injected priors, no browser, no network. Run: node --test holodeck-holders.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { attributeStatements, summarizeHolders } from './holodeck-holders.js';
import { READER, BASIS } from './vendor/eoreader7/native/kernel/perspective.js';

const VERBS = new Set(['said', 'told', 'met', 'read', 'saw', 'left', 'changed', 'would', 'is', 'was', 'will', 'comply', 'go']);
const NOMINALS = new Set(['alice', 'barlow', 'policy', 'council', 'minister', 'she', 'we', 'man', 'book', 'board', 'director', 'plan']);
const CAST = new Map([['Alice Barlow', 'Alice Barlow'], ['Alice', 'Alice Barlow'], ['Barlow', 'Alice Barlow'], ['The board', 'Board'], ['Board', 'Board']]);
const isVerb = (w) => VERBS.has(String(w).toLowerCase());
const isNominal = (w) => NOMINALS.has(String(w).toLowerCase());
const referentFor = (s) => CAST.get(s) || null;

// A deterministic stand-in for relations.js's SVO output: subject + the offset
// where the object begins (the pipeline gives objectOffset; the test fixes it).
const REL = {
  'Alice Barlow said the policy would change.': [{ subject: 'Alice Barlow', objectOffset: 18 }],
  'The minister said the policy would change.': [{ subject: 'The minister', objectOffset: 21 }],
  'The council met on Tuesday.': [{ subject: 'The council', objectOffset: 16 }],
  'She saw the man who left.': [{ subject: 'She', objectOffset: 8 }],
  'The board announced the audit was political.': [{ subject: 'The board', objectOffset: 21 }],
};
const relationsOf = (t) => REL[t] || [];

const doc = (id, text) => ({ id, text });
const st = (id, d, sub) => { const s = d.text.indexOf(sub); return { id, doc: d.id, s, e: s + sub.length, text: sub }; };
const prior = { relationsOf, isVerb, isNominal, referentFor };

test('a reporting frame reads its matrix subject as the holder', () => {
  const d = doc('d0', 'Alice Barlow said the policy would change.');
  const h = attributeStatements([st('d0:0', d, d.text)], [d], prior).get('d0:0');
  assert.equal(h.holder, 'Alice Barlow');
  assert.equal(h.basis, BASIS.ASSERTED);
  assert.equal(h.depth, 1);
  assert.equal(h.gap, null);
});

test('a reporting frame whose subject is a role noun is a typed missing holder', () => {
  const d = doc('d0', 'The minister said the policy would change.');
  const h = attributeStatements([st('d0:0', d, d.text)], [d], prior).get('d0:0');
  assert.equal(h.holder, null);
  assert.equal(h.gap.type, 'attribution_unwitnessed');
});

test('a plain intransitive/adjunct clause is the reader’s own, not a frame', () => {
  const d = doc('d0', 'The council met on Tuesday.');
  const h = attributeStatements([st('d0:0', d, d.text)], [d], prior).get('d0:0');
  assert.equal(h.holder, READER);
  assert.equal(h.basis, BASIS.WITNESSED);
  assert.equal(h.gap, null);
});

test('a relative clause inside the object is not a reported complement', () => {
  const d = doc('d0', 'She saw the man who left.');
  const h = attributeStatements([st('d0:0', d, d.text)], [d], prior).get('d0:0');
  assert.equal(h.holder, READER);
  assert.equal(h.gap, null);
});

test('a quotation with no frame read is unowned, never handed to the reader', () => {
  const d = doc('d0', '"We will not comply," said the Director.');
  const h = attributeStatements([st('d0:0', d, d.text)], [d], prior).get('d0:0');
  assert.equal(h.holder, null);
  assert.equal(h.gap.type, 'embedded_speaker_unattributed');
});

test('a declared section speaker is read as a binding, before any frame', () => {
  const d = doc('d0', "JONATHAN HARKER'S JOURNAL\n\nI will go at once.");
  const h = attributeStatements([st('d0:0', d, 'I will go at once.')], [d], {
    ...prior,
    speakerSectionsOf: () => [{ start: 0, end: 999, heading: "JONATHAN HARKER'S JOURNAL", speaker: 'Jonathan Harker' }],
    speakerAt: (sections) => sections[0].speaker,
  }).get('d0:0');
  assert.equal(h.holder, 'Jonathan Harker');
  assert.equal(h.basis, BASIS.ASSERTED);
  assert.deepEqual(h.via, ['section']);
});

test('the record is exactly the kernel’s five fields', () => {
  const d = doc('d0', 'The council met on Tuesday.');
  const h = attributeStatements([st('d0:0', d, d.text)], [d], prior).get('d0:0');
  assert.deepEqual(Object.keys(h).sort(), ['basis', 'depth', 'gap', 'holder', 'via']);
});

test('the cast spoken of but never speaking is named as latent', () => {
  const d = doc('d0', 'Alice Barlow said the policy would change.');
  const sts = [st('d0:0', d, d.text)];
  const held = attributeStatements(sts, [d], prior);
  sts.forEach((s) => { s.heldBy = held.get(s.id); });
  const sum = summarizeHolders(sts, { 'Alice Barlow': {}, Board: {} });
  assert.deepEqual(sum.silent, ['Board']);
  assert.equal(sum.holders.find((x) => x.holder === 'Alice Barlow').statements, 1);
});

test('a missing prior is refused, never patched by loosening a gate', () => {
  const d = doc('d0', 'The council met on Tuesday.');
  const s = [st('d0:0', d, d.text)];
  assert.throws(() => attributeStatements(s, [d], { isVerb, isNominal, referentFor }), /injected/);
  assert.throws(() => attributeStatements(s, [d], { relationsOf, isVerb, isNominal }), /injected/);
});
