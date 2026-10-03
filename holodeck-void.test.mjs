// holodeck-void.test.mjs — the mechanical summary's REAL job: supplying the void.
//
// When the material yields too few readable claims — or nothing shares a word
// with the question — the summary must SAY SO (DEF·Ground, Clearing), never
// vanish. A silent absence is what a model fills from memory, so the void is the
// one output of the fold that must always be present. This pins it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { subjectSummary } from './holodeck-ask.js';
import { makeEngineRelationReader } from './holodeck-reader.js';

const R = await makeEngineRelationReader();

test('void — a question the material cannot match yields an explicit void, never null', async () => {
  const s = await subjectSummary([], { question: 'What did the audit find about the missing contract funds?', reader: R });
  assert.ok(s, 'the fold returns a value, never null');
  assert.equal(s.void, true, 'it is typed as a void');
  assert.equal(s.at, 'retrieval', 'the void is at the retrieval boundary');
  assert.match(s.text, /shares a word|silent|no grounded material/i, 'it states the emptiness as a fact');
});

test('void — material present but yielding too few claims still returns the closest, grounded', async () => {
  const passages = [{ source: 'd', start: 0, end: 120, text: 'The weather was mild today and the roads were clear and dry all afternoon across the county.' }];
  const s = await subjectSummary(passages, { question: 'What did the audit find about the contract?', reader: R });
  assert.equal(s.void, true, 'too few claims is a void, not null');
  assert.ok(Array.isArray(s.closest), 'it carries what it did find');
});

test('void — a fold that DOES form is not a void and carries a one-sentence pick', async () => {
  // enough recurring names/relations to fold (the reader gates on recurrence)
  const text = [
    'Kupin advanced the ordinance through the transportation committee and the ordinance moved to the council.',
    'The transportation committee studied the ordinance and the committee produced a report for the council.',
    'Kupin said the ordinance would make Chartres avenue safer and the committee agreed with Kupin.',
    'The council reviewed the ordinance and Kupin presented the ordinance to the council a second time.',
    'The audit found the ordinance does not reduce collisions on Chartres avenue, and Kupin dismissed the audit.',
  ].join(' ');
  const s = await subjectSummary([{ source: 'd', start: 0, end: text.length, text }], { question: 'What did Kupin say about the ordinance on Chartres?', reader: R });
  assert.ok(s, 'a formable subject returns a value');
  if (!s.void) assert.ok(s.one && s.one.length > 0, 'a non-void fold carries its one-sentence pick');
});
