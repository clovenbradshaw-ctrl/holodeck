// Offline conformance for holodeck-holders.js (v3 — who is telling, read
// through the frame pipeline). No browser, no network.
// Run: node --test holodeck-holders.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { attributeStatements, summarizeHolders, projectHolders } from './holodeck-holders.js';
import { READER, BASIS } from './vendor/eoreader7/native/kernel/perspective.js';

const doc = (id, text) => ({ id, text });
const st = (id, d, sub) => { const s = d.text.indexOf(sub); return { id, doc: d.id, s, e: s + sub.length, text: sub }; };

const JOURNAL = "JONATHAN HARKER'S JOURNAL\n\nI will go at once. The castle is old.";
const PLAIN = 'Alice Barlow said the policy would change.';
const RUN = 'He wrote the following.\n\n“The first line of the telling.\n\n“The second line of the telling, and still it ran on.\n\nThen he stopped.';
const KINDLESS = 'LOG OF THE DEMETER\n\nWe are lost in the fog.';

test('a declared heading binds the section’s statements to the narrator', () => {
  const d = doc('d0', JOURNAL);
  const h = attributeStatements([st('d0:0', d, 'I will go at once.')], [d]).get('d0:0');
  assert.equal(h.holder, 'JONATHAN HARKER');
  assert.equal(h.basis, BASIS.ASSERTED);
  assert.equal(h.depth, 1);
  assert.deepEqual(h.via, ['frame', 'narration']);
});

test('a document with no declared frame leaves statements to the reader', () => {
  const d = doc('d0', PLAIN);
  const h = attributeStatements([st('d0:0', d, PLAIN)], [d]).get('d0:0');
  assert.equal(h.holder, READER);
  assert.equal(h.basis, BASIS.WITNESSED);
  assert.equal(h.gap, null);
});

test('a quotation run with no declared speaker is a typed gap, never the reader', () => {
  const d = doc('d0', RUN);
  const h = attributeStatements([st('d0:0', d, 'The first line of the telling.')], [d]).get('d0:0');
  assert.equal(h.holder, null);
  assert.equal(h.gap.type, 'embedded_speaker_unattributed');
});

test('a section that declares no speaker is a typed absence, never a nearest-guess', () => {
  const d = doc('d0', KINDLESS);
  const h = attributeStatements([st('d0:0', d, 'We are lost in the fog.')], [d]).get('d0:0');
  assert.equal(h.holder, null);
  assert.equal(h.gap.type, 'unassigned_by_prior');
});

test('the front leg’s EOT triples attach beside the holder, never as the holder', () => {
  const d = doc('d0', PLAIN);
  const eot = [{ end1: 'Alice Barlow', label: 'said', end2: 'the policy' }];
  const rec = { id: 'd0:0', doc: d.id, s: 0, e: PLAIN.length, text: PLAIN };
  const h = attributeStatements([rec], [d], { relationsOf: () => eot }).get('d0:0');
  assert.deepEqual(rec.eot, eot);
  assert.equal(h.holder, READER); // the frame is the holder; the claim is content
});

test('the projection keeps holders apart and names the latent cast', () => {
  const d = doc('d0', JOURNAL);
  const sts = [st('d0:0', d, 'I will go at once.'), st('d0:1', d, 'The castle is old.')];
  const held = attributeStatements(sts, [d]);
  sts.forEach((s) => { s.heldBy = held.get(s.id); });
  const p = projectHolders(sts, { 'JONATHAN HARKER': {}, 'Alice Barlow': {} });
  assert.deepEqual(p.holders, ['JONATHAN HARKER']);
  assert.deepEqual(p.latent, ['Alice Barlow']);
});

test('the record is exactly the kernel’s five fields', () => {
  const d = doc('d0', PLAIN);
  const h = attributeStatements([st('d0:0', d, PLAIN)], [d]).get('d0:0');
  assert.deepEqual(Object.keys(h).sort(), ['basis', 'depth', 'gap', 'holder', 'via']);
});

test('the summary separates holders from typed gaps', () => {
  const d = doc('d0', RUN);
  const sts = [st('d0:0', d, 'The first line of the telling.')];
  const held = attributeStatements(sts, [d]);
  sts.forEach((s) => { s.heldBy = held.get(s.id); });
  const sum = summarizeHolders(sts, {});
  assert.equal(sum.gaps[0].type, 'embedded_speaker_unattributed');
});
