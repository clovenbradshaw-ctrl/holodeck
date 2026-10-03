// holodeck-screen-core.test.mjs — the in-tab 2D model must agree with the pipeline's own core.
// Parity is the whole point of porting it: the browser twin (holodeck-screen-core.js) and the
// node original (screen-core.cjs) must produce the same model from the same pixels and words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScreenModel, elementsOf, tokensOf, gapsOf, readingTextOf } from './holodeck-screen-core.js';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PIPELINE = path.resolve(HERE, '..', 'eoreader7-screenshot-pipeline', 'native', 'adapters', 'image');
const FIXTURE = path.join(PIPELINE, 'fixtures', 'sample-1200x820.png');

// decode the PNG to RGBA with ffmpeg (already a dependency of the pipeline), once.
let _img = null;
function decode() {
  if (_img) return _img;
  const raw = execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', FIXTURE, '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { maxBuffer: 1 << 30 });
  const { execFileSync: ex } = { execFileSync }; // dims via ffprobe
  const dims = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', FIXTURE]).toString().trim().split(',').map(Number);
  return (_img = { width: dims[0], height: dims[1], data: new Uint8ClampedArray(raw.buffer, raw.byteOffset, raw.byteLength) });
}
// OCR word boxes via the tesseract CLI (TSV), parsed exactly as the pipeline's linesFromTsv does
// (word rows only; columns left=6, top=7, w=8, h=9, conf=10, text=11; grouped page.block.par.line).
function ocrLines() {
  const tsv = execFileSync('tesseract', [FIXTURE, 'stdout', '--psm', '3', 'tsv'], { maxBuffer: 1 << 28 }).toString();
  const rows = tsv.split('\n').slice(1).map(l => l.split('\t')).filter(c => c.length >= 12 && c[0] === '5' && c[11].trim() !== '');
  const byLine = new Map();
  for (const c of rows) {
    const k = c[2] + '.' + c[3] + '.' + c[4];
    if (!byLine.has(k)) byLine.set(k, []);
    const left = +c[6], top = +c[7];
    byLine.get(k).push({ text: c[11].trim(), confidence: +c[10], bbox: { x0: left, y0: top, x1: left + +c[8], y1: top + +c[9] } });
  }
  return [...byLine.values()].map(ws => ({
    text: ws.map(w => w.text).join(' '), conf: ws.reduce((s, w) => s + w.confidence, 0) / ws.length,
    bbox: { x0: Math.min(...ws.map(w => w.bbox.x0)), y0: Math.min(...ws.map(w => w.bbox.y0)), x1: Math.max(...ws.map(w => w.bbox.x1)), y1: Math.max(...ws.map(w => w.bbox.y1)) }, words: ws,
  }));
}

test('the in-tab core builds a model from pixels and words (no browser, no server)', () => {
  const img = decode(); const model = buildScreenModel(img, ocrLines(), { tol: 10, minArea: 500, minConf: 45 });
  assert.ok(model.stats.boxes >= 1, 'boxes were found');
  assert.equal(model.root.w, img.width); assert.equal(model.root.h, img.height);
  const els = elementsOf(model, 1);
  assert.ok(els.length > 10, 'the model yields a page of elements');
  els.forEach(e => { assert.equal(e.region.length, 4); e.region.forEach(v => assert.ok(Number.isFinite(v))); });
  const roles = {}; els.forEach(e => roles[e.role] = (roles[e.role] || 0) + 1);
  assert.ok((roles.p || 0) >= 1, 'text is read and typed');
  assert.ok(/[A-Za-z]/.test(els.filter(e => e.text).map(e => e.text).join(' ')), 'the text was read, not empty');
  const t = tokensOf(model);
  assert.ok(t.ink && t.background, 'tokens read ink and background');
  assert.ok(gapsOf({ lines: [] }, model).some(g => g.kind === 'image_regions_unread'), 'unread image regions are a typed gap');
  assert.ok(readingTextOf({ width: img.width, height: img.height, tokens: t, elements: els }).includes('Structure:'), 'the reading text names the structure');
});

test('in-tab core and the pipeline core agree on the same pixels and words', () => {
  if (!fs.existsSync(path.join(PIPELINE, 'screen-core.cjs'))) return; // pipeline not present: parity is moot here
  const img = decode(); const lines = ocrLines();
  const mine = buildScreenModel(img, lines, { tol: 10, minArea: 500, minConf: 45 });
  // The pipeline core is a UMD .cjs; require it and run the same model.
  const CV = require(path.join(PIPELINE, 'screen-core.cjs'));
  const model = CV.analyze(img, lines, { tol: 10, minArea: 500, minConf: 45, dpr: 1, ratio: 1, images: true });
  assert.equal(mine.stats.boxes, model.stats.boxes, 'same box count');
  assert.equal(mine.stats.texts, model.stats.texts, 'same text/paragraph count');
  assert.equal(mine.stats.images, model.stats.images, 'same image count');
  assert.equal(mine.stats.rules, model.stats.rules, 'same rule count');
});
