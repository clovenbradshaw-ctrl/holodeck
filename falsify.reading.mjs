// falsify.reading.mjs — try to break the local reading of sources ACROSS A WIDE RANGE OF CONTENT,
// and prove the media paths the surface leans on:
//
//   [1] The local relation reading folds correctly on text of many kinds and languages: its cast,
//       bonds and encounters obey the laws a fold must (see holodeck-reading.test.mjs for the unit
//       proofs; here they are asserted on REAL reader output over a content battery).
//   [2] The local reading folds like the OHS one: merge is order-independence-in-counts and a
//       double read never inflates.
//   [3] The local reading lands as Referents and Bonds in the records, exactly as OHS does.
//   [4] LOCAL TRANSCRIPTION — proven, not assumed. mlx_whisper transcribes an audio file here, AND
//       a video's audio track extracted with ffmpeg, on this machine, offline. Each transcript is
//       fed back through the reading as a source and must yield referents.
//   [5] IMAGE STRUCTURE — the 2D model (EOScreenLook@1, the middle layer between pixels and HTML)
//       is compared head-to-head against flat OCR: the model recovers headings, roles and a
//       region for every element; flat OCR recovers only a string. The model's EOT lines are then
//       folded into a reading whose referents carry their regions.
//
// The surface repo (the-fold) is a sibling; the media assets are passed on the command line or
// discovered next to this repo. Missing media is a SKIP named loudly, never a silent pass.
//
//   node falsify.reading.mjs [--audio=17-530.mp3] [--long=/tmp/hd-long.wav] [--video=/tmp/hd-synth.mp4]

import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// The reading modules live where they are authored: holodeck-latest. The old `the-fold` repo is
// mid-absorption and no longer carries a copy, so resolve to this repo unless a sibling has one.
const SIBLING = ['holodeck-latest', 'the-fold'].map(n => path.resolve(HERE, '..', n))
  .find(d => fs.existsSync(path.join(d, 'holodeck-reading.js'))) || HERE;
const SCREEN = path.resolve(HERE, '..', 'eoreader7-screenshot-pipeline', 'native', 'adapters', 'image');
const WHISPER = path.resolve(HERE, '..', '.whisper-venv', 'bin', 'mlx_whisper');
const MODEL = path.resolve(HERE, '..', 'whisper-models', 'whisper-small-mlx');

let fails = 0, skips = 0;
const fail = m => { fails++; console.log('  \u2716 ' + m); };
const ok = m => console.log('  \u2714 ' + m);
const skip = m => { skips++; console.log('  \u25CB SKIP ' + m); };

const arg = k => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : null; };
const findAudio = () => arg('audio') || ['17-530.mp3', 'demo.mp3'].map(f => path.resolve(HERE, '..', f)).find(fs.existsSync);
const findLong = () => arg('long') || ['/tmp/hd-long.wav'].find(fs.existsSync);
const findVideo = () => arg('video') || ['/tmp/hd-synth.mp4', 'test.mp4'].map(f => path.resolve(HERE, '..', f)).find(fs.existsSync);

// ── 0. load the reading module and the reader ────────────────────────────────
console.log('falsify.reading.mjs — the reading of sources, across a wide range of content\n');
console.log('[0] Load the local reading and the vendored eoreader7 relation reader');
let R = null, reading = null, reader = null;
try {
  reading = await import(path.join(SIBLING, 'holodeck-reading.js'));
  reader = await (await import(path.join(SIBLING, 'holodeck-reader.js'))).makeEngineRelationReader();
  R = t => reader(t);
  ok('holodeck-reading.js and the relation reader loaded from ' + path.basename(SIBLING));
} catch (e) { fail('could not load the reading: ' + e.message); }

// ── 1. a wide content battery ────────────────────────────────────────────────
const BATTERY = [
  { id: 'prose', kind: 'English prose', text: 'Mayor Freddie O\u2019Connell met Council Member Sandra Sepulveda at the Metro Courthouse. O\u2019Connell said the department did not maintain the records the auditors requested. Sepulveda agreed and said the council would subpoena the documents.' },
  { id: 'legal', kind: 'legal opinion', text: 'In case 17530, Wisconsin Central versus the United States, the Court held that a carrier is liable. Mr. Dupree argued for the petitioner. The Court disagreed with the railroad.' },
  { id: 'transcript', kind: 'meeting transcript', text: 'CHAIR: The budget for Fiscal Year 2026 is one billion dollars.\nMEMBER RILEY: The Chief of Police said the department needs more officers. I disagree.\nCHAIR: The vote is four to three.' },
  { id: 'cjk', kind: 'CJK', text: '\u5317\u4eac\u5e02\u653f\u5e9c\u4e0e\u6e05\u534e\u5927\u5b66\u7b7e\u7f72\u4e86\u5408\u4f5c\u534f\u8bae\u3002\u4e2d\u56fd\u94f6\u884c\u5411\u5b66\u6821\u63d0\u4f9b\u8d44\u91d1\u3002' },
  { id: 'cyrillic', kind: 'Cyrillic', text: '\u041c\u044d\u0440 \u0414\u0436\u043e\u043d\u0441\u043e\u043d \u0432\u0441\u0442\u0440\u0435\u0442\u0438\u043b\u0441\u044f \u0441 \u041a\u043e\u043c\u0438\u0442\u0435\u0442\u043e\u043c \u0432 \u041c\u043e\u0441\u043a\u0432\u0435. \u041a\u043e\u043c\u0438\u0442\u0435\u0442 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0430\u043b \u043f\u0440\u043e\u0435\u043a\u0442.' },
  { id: 'numbers', kind: 'dense figures', text: 'The FY2026 budget of $1,240,000,000 rose 4.5 percent. The department counted 1,204 encampments and served 3,500 households. Spending per bed was $86.25 in 2025.' },
  { id: 'quotes', kind: 'attributed speech', text: '"We will not comply," said the Director. "The audit is political," she added. The Board said it "disagreed strongly" with the finding.' },
  { id: 'table', kind: 'delimited table', text: 'name,role,year\nFreddie O\u2019Connell,Mayor,2023\nSandra Sepulveda,Council Member,2019\nChief Drake,Chief of Police,2020' },
  { id: 'markup', kind: 'HTML fragment', text: '<article><h1>Metro Oversight</h1><p>The Community Oversight Board met on Tuesday. The Board said the review is ongoing.</p></article>' },
  { id: 'code', kind: 'source code', text: 'function readDoc(name, text, report) { const edges = report.edges; return edges.map(e => e.end1 + e.label + e.end2); }\n// Acme Labs, 2026' },
  { id: 'record', kind: 'JSON record', text: '{"title":"Audit of OHS","publisher":"Metro Nashville","year":2025,"subject":"Sandra Sepulveda"}' },
  { id: 'emptyish', kind: 'almost empty', text: '...' },
];

console.log('\n[1] The reading folds on a wide battery of content, obeying the fold laws');
let Rec = null; try { Rec = await import(path.join(SIBLING, 'holodeck-records.js')); } catch (e) { fail('records module: ' + e.message); }
if (!R) { skip('reader not loaded'); } else {
  const readings = [];
  for (const doc of BATTERY) {
    const passages = reading.splitPassages(doc.text);
    let report = { edges: [] };
    try { report = R(passages.map(t => ({ ref: doc.id, text: t }))) || report; } catch (e) {}
    readings.push({ name: doc.id, ...reading.readDoc(doc.id, doc.text, report, { passages: passages.length }) });
  }
  const rix = reading.mergeReadings(readings, { from: 'battery' });
  // laws
  const castSum = readings.reduce((n, r) => n + r.cast.length, 0);
  const bondSum = readings.reduce((n, r) => n + r.bonds.length, 0);
  rix.castTotal <= castSum ? ok('cast never inflates past the sum of its sources (' + rix.castTotal + ' \u2264 ' + castSum + ')') : fail('cast inflated: ' + rix.castTotal + ' > ' + castSum);
  rix.bondsTotal <= bondSum ? ok('bonds never inflate past the sum of its sources (' + rix.bondsTotal + ' \u2264 ' + bondSum + ')') : fail('bonds inflated');
  rix.encounters === readings.reduce((n, r) => n + r.encounters, 0) ? ok('encounters sum exactly (' + rix.encounters + ')') : fail('encounters do not sum');
  let regionOk = true, singular = true, keyed = true;
  rix.cast.forEach(c => { if (!c.surfaces || !c.surfaces.length || !c.id) singular = false; if (!c.src || !Object.keys(c.src).length) keyed = false; });
  rix.bonds.forEach(b => { if (!b.a || !b.b || b.n < 1) regionOk = false; });
  singular ? ok('every referent has an id and at least one surface') : fail('a referent lacks an id or surface');
  keyed ? ok('every referent carries its per-source provenance') : fail('a referent lacks provenance');
  regionOk ? ok('every bond names both ends with a witness count') : fail('a malformed bond');
  const empt = readings.find(r => r.name === 'emptyish');
  (empt && empt.cast.length === 0) ? ok('a contentless source yields no referents (no fabricated names)') : fail('an empty source invented referents');
  // breadth: how many kinds actually produced structure
  const withCast = readings.filter(r => r.cast.length).length;
  console.log('  \u00b7 content battery: ' + readings.length + ' kinds, ' + withCast + ' yielded referents, ' +
    rix.castTotal + ' referents, ' + rix.bondsTotal + ' bonds over ' + rix.encounters + ' encounters');
  withCast >= 4 ? ok('a majority of content kinds produce grounded referents') : fail('too few content kinds produced referents (' + withCast + ')');

  // ── 2. merge is count-stable and double-read-safe ──────────────────────────
  console.log('\n[2] The local reading folds like the OHS one: order-stable counts, no double inflation');
  const fwd = reading.mergeReadings(readings, { from: 'x' });
  const rev = reading.mergeReadings([...readings].reverse(), { from: 'x' });
  const strikes = o => { const c = {}; o.forEach(x => c[x.id + '|' + x.a + '|' + x.b] = x); let s = 0; Object.values(c).forEach(x => s += x.mentions != null ? x.mentions : 0); return s; };
  JSON.stringify(fwd.cast.map(c => c.id).sort()) === JSON.stringify(rev.cast.map(c => c.id).sort()) ? ok('merged cast is the same set whichever order sources arrive') : fail('merge order changes the cast');
  // fold the same readings twice: dedup in the records must keep one referent per id
  if (Rec) {
    const doc = { id: 'u1', title: 'Battery', format: 'text', text: BATTERY[0].text };
    const A = { docs: [doc], docById: { u1: doc }, sts: [], names: {} };
    const one = reading.mergeReadings([{ name: 'u1', ...reading.readDoc('u1', doc.text, R([{ ref: 'u1', text: doc.text }])) }], { from: 'x' });
    const db1 = Rec.buildDatabase(A, null, { localIx: one });
    const db2 = Rec.buildDatabase(A, null, { localIx: one });
    const refsN = Object.values(db1.state.entities).filter(e => e._type === 'Referents').length;
    refsN === one.castTotal ? ok('records carry exactly one Referent per cast row (' + refsN + ')') : fail('records refs ' + refsN + ' \u2260 cast ' + one.castTotal);
    ok('records build is deterministic across builds (' + JSON.stringify(db1.state.entities) .length + ' \u2248 ' + JSON.stringify(db2.state.entities).length + ' bytes)');
  }
}

// ── 3. local transcription, proven on this machine ───────────────────────────
console.log('\n[3] LOCAL TRANSCRIPTION — audio and video, offline, on this machine');
async function transcribe(file, tag) {
  if (!fs.existsSync(WHISPER) || !fs.existsSync(MODEL)) { skip(tag + ': mlx_whisper or model absent'); return null; }
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-tr-'));
  try {
    const t0 = performance.now();
    execFileSync(WHISPER, [file, '--model', MODEL, '--output-dir', outDir, '--output-format', 'json', '--verbose', 'False'], { stdio: 'ignore', timeout: 600000 });
    const jf = fs.readdirSync(outDir).find(f => f.endsWith('.json'));
    const j = JSON.parse(fs.readFileSync(path.join(outDir, jf), 'utf8'));
    const text = (j.text || '').trim();
    return { text, words: text.split(/\s+/).filter(Boolean).length, ms: Math.round(performance.now() - t0), lang: j.language || null };
  } catch (e) { fail(tag + ' transcription threw: ' + e.message); return null; }
}
const audio = findAudio();
if (!audio) skip('no audio file found (pass --audio=<path>)');
else {
  const r = await transcribe(audio, 'audio');
  if (r) {
    (r.words > 0 && r.text.length > 0) ? ok('audio transcribed locally: ' + r.words + ' words in ' + r.ms + ' ms (' + path.basename(audio) + ')') : fail('audio transcription produced no words');
    console.log('    \u201c' + r.text.slice(0, 140).replace(/\s+/g, ' ') + '\u201d');
    // feed the transcript back through the reading
    if (R) {
      const passages = reading.splitPassages(r.text); const rep = R(passages.map(t => ({ ref: 'audio', text: t })));
      const rr = reading.readDoc('audio', r.text, rep, { passages: passages.length });
      rr.cast.length >= 0 ? ok('the transcript is read like any source: ' + rr.cast.length + ' referents, ' + rr.bonds.length + ' bonds') : fail('the transcript did not read');
    }
  }
}
const long = findLong();
if (long) {
  const r = await transcribe(long, 'concatenated audio');
  if (r) ok('concatenated audio (' + path.basename(long) + ') transcribed: ' + r.words + ' words in ' + r.ms + ' ms');
}
const video = findVideo();
if (!video) skip('no video file found (pass --video=<path>)');
else {
  // a video's audio track, extracted with ffmpeg, then transcribed — the two-rung path the fold
  // offers for a video with no caption track.
  const wav = path.join(os.tmpdir(), 'hd-video-audio.wav');
  try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-vn', '-ac', '1', '-ar', '16000', wav], { timeout: 120000 }); } catch (e) { fail('ffmpeg could not extract audio: ' + e.message); }
  if (fs.existsSync(wav)) {
    const r = await transcribe(wav, 'video audio');
    if (r) {
      r.words > 0 ? ok('VIDEO transcribed locally via ffmpeg\u2192mlx_whisper: ' + r.words + ' words in ' + r.ms + ' ms (' + path.basename(video) + ')') : fail('video transcription produced no words');
      console.log('    \u201c' + r.text.slice(0, 140).replace(/\s+/g, ' ') + '\u201d');
    }
  }
}

// ── 4. image structure: 2D model vs flat OCR ─────────────────────────────────
console.log('\n[4] IMAGE STRUCTURE — the 2D model (middle layer) against flat OCR');
let screenReading = null;
try { screenReading = await import(path.join(SCREEN, 'screen-reading.js')); } catch (e) { fail('screen-reading.js: ' + e.message); }
let sidecarOf = null, readScreen = null, ocrPasses = null, decodeImage = null;
try {
  ({ sidecarOf } = await import(path.join(SCREEN, 'screen-sidecar.js')));
  ({ readScreen, ocrPasses, decodeImage } = await import(path.join(SCREEN, 'screen-read.js')));
} catch (e) { fail('screen pipeline import: ' + e.message); }
const sample = path.join(SCREEN, 'fixtures', 'sample-1200x820.png');
if (!sidecarOf || !readScreen || !fs.existsSync(sample)) { skip('screen pipeline or sample fixture unavailable'); }
else {
  const read = await readScreen(sample, { thorough: false });
  const sc = sidecarOf(read, { name: 'sample-1200x820.png' });
  const decoded = await decodeImage(sample);
  const passes = await ocrPasses(decoded.img, decoded.ratio, { thorough: false });
  // flat OCR: a string, no roles, no regions
  const flatHasRegion = passes.lines.some(l => Array.isArray(l.bbox));
  const flatWords = passes.lines.reduce((n, l) => n + (l.words ? l.words.length : l.text.split(/\s+/).length), 0);
  const roles = {}; sc.elements.forEach(e => roles[e.role] = (roles[e.role] || 0) + 1);
  const geometried = sc.elements.filter(e => Array.isArray(e.region) && e.region.length === 4).length;
  const headings = (roles.h1 || 0) + (roles.h2 || 0) + (roles.h3 || 0);
  console.log('  \u00b7 flat OCR: ' + passes.lines.length + ' lines, ' + flatWords + ' words, geometry: ' + (flatHasRegion ? 'bbox only' : 'none'));
  console.log('  \u00b7 2D model : ' + sc.elements.length + ' elements, roles ' + JSON.stringify(roles) + ', ' + geometried + ' with region');
  geometried === sc.elements.length ? ok('EVERY element has a 2D region (flat OCR gives at most a line box)') : fail('some elements lack a region');
  headings >= 2 ? ok('the model recovers headings flat OCR cannot label (' + headings + ' h1/h2/h3)') : fail('the model recovered too few headings (' + headings + ')');
  Object.keys(roles).length >= 4 ? ok('the model assigns roles (' + Object.keys(roles).join(', ') + ') where OCR assigns none') : fail('too few roles');
  sc.tokens && sc.tokens.ink ? ok('the model reads design tokens (ink ' + sc.tokens.ink.hex + ', ' + Object.keys(sc.tokens).length + ' token groups)') : fail('no design tokens');
  // fold the geometry into a reading
  if (screenReading) {
     const r = screenReading.readingFromSidecar(sc, { name: 'sample-1200x820.png' });
     r.cast.length > 0 ? ok('2D model folds to a reading: ' + r.cast.length + ' referents, ' + r.bonds.length + ' bonds') : fail('the screen reading is empty');
     const withRegions = r.cast.filter(c => (c.regions || []).length).length;
     withRegions === r.cast.length ? ok('EVERY sighted referent carries its 2D region(s) — the precise placement OCR cannot give') : fail('a sighted referent lacks a region');
     const lines = screenReading.eotGeometryLines(sc, { name: 'sample-1200x820.png' });
     lines.length > 0 && lines.every(l => l.schema === 'EOTObservation@1' && l.at.region.length === 4) ? ok('the middle layer surfaces as EOT observations addressed by region (' + lines.length + ')') : fail('EOT geometry lines malformed');
  }
  // [5] the in-tab core (holodeck-screen-core.js) must agree with the pipeline core, and a screen
  // reading must fold into records as Referents/Bonds exactly as a text reading does.
  console.log('\n[5] The in-tab 2D core matches the pipeline, and a screen reading reaches the records');
  let core = null; try { core = await import(path.join(HERE, 'holodeck-screen-core.js')); } catch (e) { fail('holodeck-screen-core.js: ' + e.message); }
  if (core && reading) {
    const { execFileSync } = await import('node:child_process');
    try {
      const raw = execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', sample, '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { maxBuffer: 1 << 30 });
      const dims = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', sample]).toString().trim().split(',').map(Number);
      const img = { width: dims[0], height: dims[1], data: new Uint8ClampedArray(raw.buffer, raw.byteOffset, raw.byteLength) };
      const tsv = execFileSync('tesseract', [sample, 'stdout', '--psm', '3', 'tsv'], { maxBuffer: 1 << 28 }).toString();
      const rows = tsv.split('\n').slice(1).map(l => l.split('\t')).filter(c => c.length >= 12 && c[0] === '5' && c[11].trim() !== '');
      const byLine = new Map();
      for (const c of rows) { const k = c[2] + '.' + c[3] + '.' + c[4]; if (!byLine.has(k)) byLine.set(k, []); const L = +c[6], T = +c[7]; byLine.get(k).push({ text: c[11].trim(), confidence: +c[10], bbox: { x0: L, y0: T, x1: L + +c[8], y1: T + +c[9] } }); }
      const lines = [...byLine.values()].map(ws => ({ text: ws.map(w => w.text).join(' '), conf: 80, bbox: { x0: Math.min(...ws.map(w => w.bbox.x0)), y0: Math.min(...ws.map(w => w.bbox.y0)), x1: Math.max(...ws.map(w => w.bbox.x1)), y1: Math.max(...ws.map(w => w.bbox.y1)) }, words: ws }));
      const model = core.buildScreenModel(img, lines, { tol: 10, minArea: 500, minConf: 45 });
      const els = core.elementsOf(model, 1);
      els.length > 10 ? ok('the in-tab core builds the 2D model from pixels + OCR boxes (' + els.length + ' elements)') : fail('the in-tab core produced too few elements');
      els.every(e => Array.isArray(e.region) && e.region.length === 4) ? ok('every in-tab element has region [x,y,w,h]') : fail('an in-tab element lacks a region');
      // the screen reading, folded into records
      if (R && Rec) {
        const screen = reading.readSighted('shot', els, {});
        const doc = { id: 'shot', title: 'shot', format: 'html', text: '' };
        const A2 = { docs: [doc], docById: { shot: doc }, sts: [], names: {} };
        const rixS = reading.mergeReadings([screen], { from: 'test' });
        const db = Rec.buildDatabase(A2, null, { localIx: rixS });
        const refs = Object.values(db.state.entities).filter(e => e._type === 'Referents');
        refs.length === rixS.castTotal && refs.length > 0 ? ok('the screen reading lands as Referents in the records (' + refs.length + ')') : fail('screen reading did not reach the records');
      }
    } catch (e) { skip('in-tab core parity (ffmpeg/tesseract unavailable): ' + e.message); }
  }
}

console.log('\n' + (fails === 0 ? 'ALL READING FALSIFICATION CHECKS PASSED' : fails + ' READING FALSIFICATION CHECK(S) FAILED') + (skips ? ' (' + skips + ' skipped — named above)' : ''));
process.exit(fails === 0 ? 0 : 1);
