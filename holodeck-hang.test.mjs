// holodeck-hang.test.mjs — the hang organ against held-out bytes and hostile
// near-misses. Every hang must fire where its structure lives and stay quiet
// where it does not; the tester itself is tested (a wrong expectation REFUTEs).
// Fixtures are real bytes from this workspace, never invented:
//   repo ..... holodeck/holodeck-reader.js (the reader's own source)
//   report ... nine-jobs.md (a prose report)
//   grid ..... pdftotext -layout -f 11 -l 11 tufte-ch2-5.pdf (the NYT gasoline-
//              scale table, book p.61) — six aligned rows, kept verbatim
//   audio .... type-gated: an mp3 ingests as Audio via sniff magic (see the
//              17-530.mp3 run: media hang, no text measured)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import H from './holodeck-hang.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = p => fs.readFileSync(path.join(HERE, p), 'utf8');
const D0 = []; // no directions: the measured ranking alone

const REPO = { type: 'JS', title: 'holodeck-reader.js', text: read('holodeck-reader.js') };
const REPORT = { type: 'Notes', title: 'nine-jobs.md', text: read('../nine-jobs.md') };
// Verbatim from `pdftotext -layout -f 11 -l 11 /tmp/opencode/tufte/tufte-ch2-5.pdf -`
// (reproduce with that command; rows 5-10 of the gasoline-scale table):
const GRID = {
  type: 'Text', title: 'tufte-p61-scales.txt',
  text: [
    '     During this time               one vertical inch equals',
    '     1973 —1978                     $8.00',
    '    January-March 1979              $4.73',
    '    April-June 1979                 $4.37',
    '    July-September 1979             $4.16',
    '    October-December 1979           $3.92',
  ].join('\n'),
};
const AUDIO = { type: 'Audio', title: 'sonnet.mp3', text: '' };
const SCAN = { type: 'PDF', title: 'scan.pdf', text: '   ' };

test('repo hangs as code, report as prose, table as grid — each cross-quiet', () => {
  const repo = H.readHanging(REPO, { directions: D0 });
  assert.equal(repo.hang, 'code');
  assert.equal(repo.basis, 'measured');
  assert.ok(!repo.viable.includes('prose') || repo.scores.code > repo.scores.prose);
  const report = H.readHanging(REPORT, { directions: D0 });
  assert.equal(report.hang, 'prose');
  assert.equal(report.scores.code ?? 0, 0);
  const grid = H.readHanging(GRID, { directions: D0 });
  assert.equal(grid.hang, 'grid');
  assert.equal(grid.scores.code ?? 0, 0);
});

test('near-miss each way: prose must not hang as code, code must not hang as prose', () => {
  const f = H.falsify([
    { label: 'report hung as code', content: REPORT, directions: D0, expect: 'code' },
    { label: 'repo hung as prose', content: REPO, directions: D0, expect: 'prose' },
    { label: 'table hung as prose', content: GRID, directions: D0, expect: 'prose' },
  ]);
  assert.equal(f.standing, 'REFUTED');
  for (const r of f.rows) assert.equal(r.verdict, 'counterexample');
});

test('audio hangs timeline and scan hangs pages by media basis, no text measured', () => {
  const a = H.readHanging(AUDIO, { directions: D0 });
  assert.equal(a.hang, 'timeline');
  assert.equal(a.basis, 'media-sniff');
  assert.deepEqual(a.scores, {});
  const s = H.readHanging(SCAN, { directions: D0 });
  assert.equal(s.hang, 'pages');
  assert.equal(s.basis, 'media-sniff');
});

test('empty text is a typed gap, never a guess', () => {
  const r = H.readHanging({ type: 'Text', title: 'empty.txt', text: '\n  \n' }, { directions: D0 });
  assert.equal(r.hang, 'undecided');
  assert.equal(r.basis, 'gap');
});

test('mixed workspace recommends small-multiples; single kind stays single', () => {
  const mixed = H.workspaceHang([
    H.readHanging(REPO, { directions: D0 }),
    H.readHanging(REPORT, { directions: D0 }),
  ]);
  assert.deepEqual(mixed.hangs.sort(), ['code', 'prose']);
  assert.equal(mixed.recommendation, 'small-multiples');
  const single = H.workspaceHang([
    H.readHanging(REPORT, { directions: D0 }),
    H.readHanging({ type: 'Notes', title: 'arrival.md', text: read('../arrival-is-not-a-finish-line.md') }, { directions: D0 }),
  ]);
  assert.equal(single.recommendation, 'single');
});

test('directions are ordinal input on the record: flip, then supersede, both preserved', () => {
  const d1 = H.addDirection({ prefer: 'prose', over: 'code', scope: { type: 'JS' }, reason: 'read the comments first', giver: 'test' });
  const flipped = H.readHanging(REPO);
  assert.equal(flipped.hang, 'prose');
  assert.equal(flipped.basis, 'direction');
  assert.ok(flipped.applied.includes(d1.id));
  const d2 = H.addDirection({ prefer: 'code', over: 'prose', scope: { type: 'JS' }, reason: 'changed my mind: graph first', giver: 'test', supersedes: d1.id });
  const back = H.readHanging(REPO);
  assert.equal(back.hang, 'code');
  const rows = H.listDirections();
  assert.ok(rows.find(r => r.id === d1.id).supersededBy === d2.id, 'superseded entry preserved with pointer');
  assert.ok(rows.find(r => r.id === d2.id), 'superseding entry preserved');
  // out-of-scope directions do not leak: a Notes doc is unaffected
  const report = H.readHanging(REPORT);
  assert.equal(report.hang, 'prose');
  assert.equal(report.basis, 'measured');
});

test('falsify reports HELD honestly and REFUTED honestly (the tester is tested)', () => {
  const good = H.falsify([
    { label: 'repo', content: REPO, directions: D0, expect: 'code' },
    { label: 'report', content: REPORT, directions: D0, expect: 'prose' },
    { label: 'table', content: GRID, directions: D0, expect: 'grid' },
    { label: 'audio', content: AUDIO, directions: D0, expect: 'timeline' },
  ]);
  assert.equal(good.standing, 'HELD');
  const bad = H.falsify([{ label: 'wrong', content: REPORT, directions: D0, expect: 'grid' }]);
  assert.equal(bad.standing, 'REFUTED');
});
