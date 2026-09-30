// holodeck-doors.test.mjs — the document-doorway client against real ledger bytes.
// Fixture: fixtures/er7-document-ledger.jsonl is a verbatim copy of
// eoreader7/documents/enzyme-frontier-2026-09-29T20-37-43-469Z:1.jsonl (four turns: 3, 4, 9, 10),
// written by the proxy's /v1/documents machinery, never hand-made.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isFunctionWord } from '../eoreader7/native/the-fold/pos-prior.js';
import { parseLedger, cellsOf, startDocument, readLedger, newJobId, DoorError, doorControls, topicControl, claimSentences } from './holodeck-doors.js';

const TEXT = fs.readFileSync(new URL('./fixtures/er7-document-ledger.jsonl', import.meta.url), 'utf8');
const { rows } = parseLedger(TEXT);
const turnOf = r => (/:(\d+):obs:/.exec(r.id) || [])[1];

test('every row of the real ledger parses as an EOT observation', () => {
  const p = parseLedger(TEXT);
  assert.equal(p.malformed, 0);
  assert.equal(p.rows.length, TEXT.trim().split('\n').length);
  assert.ok(p.rows.every(r => r.schema === 'EOTObservation@1'));
});

test('a line that is not an observation is counted, never dropped silently', () => {
  const p = parseLedger(TEXT + '\nnot json\n{"no":"role"}\n');
  assert.equal(p.malformed, 2);
  assert.equal(p.rows.length, rows.length);
});

test('each part is addressed by the plan that precedes it, not by the last plan in the file', () => {
  const { sets, unaddressed } = cellsOf(rows);
  assert.equal(sets.length, 4, 'four void plans, one per turn');
  const t3 = sets[0]; // turn 3: twelve questions, twelve parts
  assert.equal(t3.plan.length, 12);
  assert.equal(t3.cells.filter(c => c.parts.length).length, 12);
  const t9 = sets[2];
  assert.equal(t9.cells.filter(c => c.parts.length).length, 8);
  // The control: pairing turn 9's parts with the file's LAST plan (turn 10, a one-question code turn) addresses none of them.
  const lastQs = sets[3].plan.map(q => q.toLowerCase());
  const t9parts = rows.filter(r => r.role === 'part' && turnOf(r) === '9');
  assert.equal(t9parts.filter(p => lastQs.some(q => q.startsWith(p.title.toLowerCase().trim()))).length, 0);
  // The fold beat is kept and named unaddressed, not forced into a cell.
  assert.ok(unaddressed.some(r => r.title === 'grounding, world, prose'));
});

test('revision rows stay with their plan, unbound: no position rule is sound on real ledgers', () => {
  const t4 = cellsOf(rows).sets[1];
  const expected = rows.filter(r => r.role === 'revision' && turnOf(r) === '4');
  assert.equal(t4.revisions.length, expected.length);
  assert.ok(t4.cells.every(c => !('revisions' in c)));
  // The control that rules out "a revision belongs to the part it follows": in this code turn the rounds come BEFORE
  // their part, and none of them names a cell to supersede.
  const seq = rows.filter(r => turnOf(r) === '4').map(r => r.role);
  assert.ok(seq.indexOf('revision') < seq.indexOf('part'));
  assert.ok(expected.every(r => r.supersedes == null || r.supersedes === 'None'));
});

test('an unknown holon level is refused before any request leaves', async () => {
  let called = 0; const f = async () => { called++; return new Response('{}'); };
  await assert.rejects(startDocument('http://x', { task: 't', holonLevel: 'chapter' }, f), e => e instanceof DoorError && e.type === 'unknown_holon_level');
  assert.equal(called, 0);
});

test("the proxy's typed refusal surfaces with its type", async () => {
  const f = async () => new Response(JSON.stringify({ error: { message: 'holonLevel must be one of section', type: 'unknown_holon_level' } }), { status: 400 });
  await assert.rejects(startDocument('http://x', { task: 't', holonLevel: 'section' }, f), e => e.type === 'unknown_holon_level' && e.status === 400);
});

test('an unreachable proxy is a typed gap, not a hang or a blank', async () => {
  const f = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(startDocument('http://x', { task: 't' }, f), e => e.type === 'unreachable');
});

test('a ledger that does not exist yet reads as missing, not as an empty artifact', async () => {
  const f = async () => new Response('not found', { status: 404 });
  const L = await readLedger('http://x', 'hd-1', f);
  assert.equal(L.missing, true);
});

test('job ids never end in _N, which the ledger route rewrites to :N', () => {
  for (let i = 0; i < 200; i++) assert.ok(!/_\d+$/.test(newJobId(Date.now() + i)));
  assert.ok(/^hd-/.test(newJobId()));
});

// The controls themselves are tested: each must pass on the real ledger and refute a mutation of it.
const turn9 = rows.filter(r => turnOf(r) === '9');
const heldPara = turn9.find(r => r.role === 'part' && r.text.length > 80).text;
const verdictOf = (poll, L, name) => doorControls(poll, L).find(v => v.name.startsWith(name)).ok;

test('controls pass on the real ledger', () => {
  const L = { rows: turn9, malformed: 0 };
  const poll = { status: 'unsatisfied', projection: heldPara };
  const v = doorControls(poll, L);
  assert.deepEqual(v.filter(x => x.ok === false).map(x => x.name), []);
  assert.equal(verdictOf(poll, L, 'complete means'), null, 'not complete, so not testable');
});

test('a part composed before its plan is refuted', () => {
  const plan = turn9.find(r => r.role === 'plan'); const moved = [...turn9.filter(r => r !== plan), plan];
  assert.equal(verdictOf({ status: 'writing', projection: '' }, { rows: moved, malformed: 0 }, 'the void plan'), false);
});

test('a projected paragraph the ledger does not hold is refuted', () => {
  const poll = { status: 'complete', projection: heldPara + '\n\nThis paragraph was never composed by any cell of the plan and appears nowhere in the ledger at all.', job: { satisfaction: { ok: true } } };
  assert.equal(verdictOf(poll, { rows: turn9, malformed: 0 }, 'every projected paragraph'), false);
});

test('a part answering no question of its plan is refuted, a fold beat is not', () => {
  const stray = { ...turn9.find(r => r.role === 'part'), title: 'A question nobody planned' };
  assert.equal(verdictOf({ status: 'writing', projection: '' }, { rows: [...turn9, stray], malformed: 0 }, 'every part answers'), false);
  assert.ok(turn9.some(r => r.title === 'grounding, world, prose'), 'the real fold beat is present and passes');
});

test('complete without satisfaction is refuted', () => {
  assert.equal(verdictOf({ status: 'complete', projection: '', job: { satisfaction: { ok: false } } }, { rows: turn9, malformed: 0 }, 'complete means'), false);
});

// Fixture pair: fixtures/er7-ungrounded-ledger.jsonl and fixtures/er7-ungrounded-poll.json, snapshotted from job
// hd-munpvixic08ty ("Why a spinning top stays upright", gemma2:2b, no web, no workspace) on 2026-09-30.
test('an ungrounded disclosure that never reaches the projection is refuted (real bytes)', () => {
  const L = parseLedger(fs.readFileSync(new URL('./fixtures/er7-ungrounded-ledger.jsonl', import.meta.url), 'utf8'));
  const poll = JSON.parse(fs.readFileSync(new URL('./fixtures/er7-ungrounded-poll.json', import.meta.url), 'utf8'));
  assert.ok(L.rows.some(r => /^DISCLOSED UNGROUNDED/.test(r.text)), 'the ledger discloses it');
  assert.ok(poll.projection.trim().length > 0, 'something folded out');
  assert.equal(verdictOf(poll, L, "the projection carries"), false);
  // The same control passes when the fold-out carries the disclosure, so it is not a constant.
  assert.equal(verdictOf({ ...poll, projection: 'Ungrounded: no material ground.\n\n' + poll.projection }, L, "the projection carries"), true);
});

// Final ledgers of two unrelated jobs run 2026-09-30 through POST /v1/documents (gemma2:2b, no web, no workspace):
// fixtures/er7-freewheel-* ("How a bicycle freewheel ...") and fixtures/er7-ungrounded-* ("Why a spinning top ...").
const load = n => ({ jobId: n, rows: parseLedger(fs.readFileSync(new URL(`./fixtures/er7-${n}-ledger.jsonl`, import.meta.url), 'utf8')).rows, projection: JSON.parse(fs.readFileSync(new URL(`./fixtures/er7-${n}-poll.json`, import.meta.url), 'utf8')).projection });
const FW = { isFunctionWord };
const pair = [load('freewheel'), load('ungrounded')];

test("the pipeline's whole piece supersedes the plan's cells and is not counted a stray", () => {
  for (const j of pair) {
    const C = cellsOf(j.rows);
    assert.equal(C.whole.length, 1);
    assert.equal(C.whole[0].giver, 'eoreader7:pipeline');
    assert.equal(C.unaddressed.length, 0);
  }
});

test('refuted on real bytes: both whole pieces drift off their tasks onto the same stale material', () => {
  const v = topicControl(pair, FW);
  assert.deepEqual(v.map(x => x.ok), [false, false]);
  for (const j of pair) { const t = cellsOf(j.rows).whole[0].text.toLowerCase(); assert.ok(/magazine/.test(t) && /plastic gun/.test(t)); }
});

test('the topic control passes when a whole piece is about its task, so it is not a constant', () => {
  const fixed = pair.map(j => ({ ...j, rows: j.rows.map(r => r.giver === 'eoreader7:pipeline' ? { ...r, text: j.rows.find(x => x.role === 'plan').text } : r) }));
  assert.deepEqual(topicControl(fixed, FW).map(x => x.ok), [true, true]);
});

// Two jobs run 2026-09-30 through the FIXED proxy (charter out of the vocabulary) with the same real workspace, one file
// (katherine-johnson-body.txt), web off: fixtures/er7-ground-on-* (task about Katherine Johnson at NASA) and
// fixtures/er7-ground-off-* (task about a bicycle freewheel). Both finished `unsatisfied`; neither pasted a document.
const gpair = [load('ground-on'), load('ground-off')];

test('REFUTED on real bytes: a bicycle answer built from an unrelated handed-over file is mostly about the file', () => {
  const v = topicControl(gpair, FW);
  assert.equal(v[0].ok, true, 'the on-topic job says more about Katherine Johnson: ' + v[0].detail);
  assert.equal(v[1].ok, false, 'the off-topic job does not: ' + v[1].detail);
  assert.ok(claimSentences(gpair[1].projection).some(x => /freewheel/.test(x)), 'it did write one bicycle sentence');
});

test('the same control passes the off-topic job once the file\'s sentences are removed, so it is not a constant', () => {
  const kept = gpair[1].projection.split('\n').filter(l => !/Johnson|NASA|Katherine/.test(l)).join('\n');
  assert.equal(topicControl([gpair[0], { ...gpair[1], projection: kept }], FW)[1].ok, true);
});

test('footnotes and quoted excerpt bullets are shown ground, never counted as what the piece says', () => {
  const c = claimSentences(gpair[0].projection);
  assert.ok(!c.some(x => /Jump to content|Footnotes|katherine-johnson-body\.txt/.test(x)));
});
