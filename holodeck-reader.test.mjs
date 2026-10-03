// holodeck-reader.test.mjs — the chunked, content-anchored corpus reader.
//
// The reader was built for CHUNK-shaped passages; reading a whole book as one
// passage is superlinear. readCorpus chunks, reads each chunk, and anchors each
// claim by its own verbatim text into the source's raw bytes. This test pins the
// two laws that make it trustworthy: (1) every returned claim's span is the
// source text at its offset — grounding is structural, never claimed; (2) the
// chunked read finds at least as many claims as reading the same material in
// one passage, so chunking does not silently lose the reading.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readCorpus, makeEngineRelationReader, blankMarkup } from './holodeck-reader.js';

// A real paragraph of English with recurring names and a relation the engine reads.
const PARA = [
  'Martin Seligman and Steven Maier ran the experiment that named a generation of depression research.',
  'The dogs learned helplessness: when the harness gave them no control, they stopped trying to escape.',
  'Seligman later said the finding changed how the field thought about depression and about agency.',
  'Maier and Seligman wrote, fifty years on, that the original interpretation had overshot the evidence.',
].join('\n\n');

const DOC = { id: 'dogs', title: 'Learned Helplessness', text: PARA };

test('readCorpus — every claim span is the source text at its offset (grounding is structural)', async () => {
  const R = await makeEngineRelationReader();
  const { A } = await readCorpus([DOC], { reader: R });
  assert.ok(A.sts.length > 0, 'the reader heard at least one claim');
  for (const st of A.sts) {
    assert.equal(PARA.slice(st.s, st.e), st.readText, `span ${st.id} is not the source at its offset`);
    assert.ok(st.doc === DOC.id, 'the claim knows its document');
    assert.ok(st.names.length > 0, 'the claim names its participants');
  }
});

test('readCorpus — chunking does not lose the reading (chunked ≥ single-pass count)', async () => {
  const R = await makeEngineRelationReader();
  const single = R([{ ref: 'x', text: PARA }]).read(PARA).claims || [];
  const { A } = await readCorpus([DOC], { reader: R, chunkChars: 60 });
  assert.ok(A.sts.length >= single.length, `chunked ${A.sts.length} < single ${single.length}`);
});

test('blankMarkup — CSS and tags are blanked, length is preserved, prose survives', () => {
  const src = 'News today. .mw-parser-output .box{color:#FFFFFF;border:1px solid red} More news here. <script>var x=1</script> Done.';
  const out = blankMarkup(src);
  assert.equal(out.length, src.length, 'length preserved — every offset still reads back');
  assert.ok(!/color:#FFFFFF|border:1px|var x=1/.test(out), 'no CSS declaration or script body survives');
  // the words that remain sit at the same index as in the source
  assert.equal(out.indexOf('More news here.'), src.indexOf('More news here.'), 'a prose sentence keeps its offset');
  assert.ok(out.includes('News today.'), 'prose survives');
  assert.ok(out.includes('Done.'), 'prose survives');
});

test('readCorpus — a source too small to read yields no claims, never a fabricated one', async () => {
  const R = await makeEngineRelationReader();
  const { A } = await readCorpus([{ id: 'tiny', title: 'Tiny', text: 'Hi.' }], { reader: R });
  assert.equal(A.sts.length, 0, 'nothing to fold from a source with no relations');
});
