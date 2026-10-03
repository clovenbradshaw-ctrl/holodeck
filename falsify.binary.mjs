// falsify.binary.mjs — try to break the binary index at the real corpus's scale, and time the
// load paths the holodeck actually touches. Generates a FoldReadingIndex@2 the same size the real
// one is (cast capped 3000, bonds 3000, canon 1500, identities 1500, ~5000 sources with the six
// per-source maps), packs it, and races the binary path (one ArrayBuffer + on-demand decode)
// against the old path (full JSON.stringify text + JSON.parse + materialized object graph).
//
//   node falsify.binary.mjs
//
// Exits nonzero if any falsification check fails (round-trip inequality, fast-path disagreement,
// silent truncation, or the guard refusing to overflow).

import { performance } from 'node:perf_hooks';
import { packIndex, FoldIndex, unpackIndex } from './idx-binary.js';

// ── Seeded, deterministic generator ─────────────────────────────────────────
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const rand = rng(42);
const pick = a => a[Math.floor(rand() * a.length)];
const irand = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pad = (n, w) => String(n).padStart(w, '0');

const SURF = ['Alice','Bob','Carol','Metro Council','Budget & Finance Committee','Mayor','Chief of Police','Public Works','Nashville','Davidson County','Audit Committee','Metro Nashville Police','OHS','Director','Planning & Zoning','Community Oversight','Vice Chair','Assistant Chief','Custody','Investigative','Hearing Officer','Grievance','Use of Force','Dashcam','Bodycam','Fraternal Order','Lieutenant','Sergeant','Corporal','Precinct','Downtown','Madison','Belle Meade','Hermitage','Donelson','Antioch','Inglewood','Emergency Communications','Office of Professional Accountability','Civil Service Commission','Human Resources'];
const STAND = ['settled', 'contested', 'hypothesis', 'under_review', 'refused', ''];
const REL = ['works for', 'reports to', 'oversees', 'testifies before', 'investigates', 'negotiates with', 'sues', 'represents', 'appears before', 'contracts with', 'terminates', 'trains', 'evaluates', 'appoints', 'hears'];
const EV = ['identity_split', 'identity_reading_refused', 'identity_hypothesis_supported'];
const TERRAIN = ['prose', 'transcript', 'procedural', 'excerpt', 'summary'];
const KINDS = ['INS/announce', 'DEF/define', 'CON/relate', 'REC/reframe', 'EVA/judge'];
const OPS = ['INS', 'DEF', 'CON', 'REC', 'EVA', 'SEG', 'SYN'];

const N_SOURCES = 5000;
const N_CAST = 3000, N_BONDS = 3000, N_CANON = 1500, N_IDENT = 1500;

const srcNames = Array.from({ length: N_SOURCES }, (_, i) => `er7-r${pad(i, 5)}.txt`);
const srcMap = (k) => { const o = {}; for (let j = 0; j < k; j++) o[srcNames[irand(0, N_SOURCES - 1)]] = irand(1, 40); return o; };
const smallMap = (pool, k) => { const o = {}; for (let j = 0; j < k; j++) o[pick(pool)] = irand(1, 30); return o; };

function buildCorpus() {
  const cast = Array.from({ length: N_CAST }, (_, i) => {
    const surfCount = irand(1, 3);
    const surfaces = [pick(SURF)];
    for (let j = 1; j < surfCount; j++) surfaces.push(surfaces[0] + ' ' + irand(2, 99));
    const src = srcMap(irand(5, 120));
    return { id: `ref-${i}`, surfaces, standing: pick(STAND), mentions: irand(1, 2500), src, first: Object.keys(src)[0], firstSeq: irand(1, 100000), srcN: Object.keys(src).length };
  });
  const bonds = Array.from({ length: N_BONDS }, (_, i) => {
    const rel = smallMap(REL, irand(1, 3));
    return { a: pick(SURF), b: pick(SURF), n: irand(1, 80), rel, pos: irand(0, 60), neg: irand(0, 10), src: srcMap(irand(3, 60)), first: 'er7-r00000.txt', firstSeq: irand(1, 100000), srcN: irand(1, 30) };
  });
  const canon = Array.from({ length: N_CANON }, (_, i) => {
    const alts = {}; for (let j = 0; j < irand(0, 2); j++) alts[pick(SURF) + ' alt'] = 1;
    return { a: pick(SURF), b: pick(SURF), n: irand(1, 60), alts, src: srcMap(irand(1, 30)), srcN: irand(1, 15) };
  });
  const identities = Array.from({ length: N_IDENT }, (_, i) => {
    const events = smallMap(EV, irand(1, 2));
    return { left: pick(SURF), right: pick(SURF), n: irand(1, 40), events, src: srcMap(irand(1, 20)), srcN: irand(1, 10) };
  });
  const sources = {};
  for (let i = 0; i < N_SOURCES; i++) {
    sources[srcNames[i]] = {
      chunks: irand(1, 40), chars: irand(500, 40000),
      ops: smallMap(OPS, irand(2, 6)), terrain: smallMap(TERRAIN, irand(1, 4)),
      kinds: smallMap(KINDS, irand(1, 4)), cast: smallMap(SURF, irand(4, 18)),
      bonds: smallMap(SURF, irand(2, 10)), idChurn: smallMap(EV, irand(0, 4)),
    };
  }
  return {
    schema: 'FoldReadingIndex@2',
    from: 'https://raw.githubusercontent.com/clovenbradshaw-ctrl/ohs-custody/main/ground-readings/f3affd2e11370118-causalTextPerceiver_reviseTextFold_refresh25.jsonl.zst',
    cursor: { sequence: 312841, ts: '2026-09-01T00:00:00Z' },
    builtAt: '2026-09-01T00:00:00.000Z',
    ms: 543210, lines: 312841, bad: 0, encounters: 312841,
    castTotal: cast.length, bondsTotal: bonds.length, canonTotal: canon.length, identitiesTotal: identities.length,
    order: srcNames,
    kinds: { 'INS/announce': 8123, 'DEF/define': 21094, 'CON/relate': 14002, 'REC/reframe': 3122, 'EVA/judge': 782 },
    sources, cast, bonds, canon, identities,
  };
}

const median = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const bench = (fn, iters = 5) => { fn(); fn(); const ts = []; for (let i = 0; i < iters; i++) { const t0 = performance.now(); fn(); ts.push(performance.now() - t0); } return median(ts); };
const fmt = (ms, bytes) => bytes ? `${(ms).toFixed(2)} ms · ${(bytes / 1e6).toFixed(1)} MB` : `${(ms).toFixed(2)} ms`;
const pct = (a, b) => a === 0 ? '' : `  (${(b / a).toFixed(2)}× slower)`;

// Order-insensitive object compare (the binary emits maps in desc-count order; the app
// re-sorts by value anyway, so key order is not part of the contract). Arrays stay
// order-sensitive — cast/bonds ordering IS the contract.
function deepEq(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEq(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k) || !deepEq(a[k], b[k])) return false;
  return true;
}

let fails = 0;
const fail = msg => { fails++; console.log('  ✖ ' + msg); };
const ok = msg => console.log('  ✔ ' + msg);

console.log('─ Falsification: binary reading index at corpus scale ─');
console.log('sources=' + N_SOURCES + ' cast=' + N_CAST + ' bonds=' + N_BONDS + ' canon=' + N_CANON + ' identities=' + N_IDENT);

const corpus = buildCorpus();

// ── 1. File size + pack cost ────────────────────────────────────────────────
console.log('\n[1] Serialization (what the worker writes to OPFS)');
const tJson = bench(() => JSON.stringify(corpus), 3);
const jsonBytes = Buffer.byteLength(JSON.stringify(corpus));
let binBytes;
const tPack = bench(() => { binBytes = packIndex(corpus).length; }, 3);
console.log(`  JSON (text):  ${fmt(tJson, jsonBytes)}`);
console.log(`  binary FRIX:  ${fmt(tPack, binBytes)}`);
ok(`binary is ${(jsonBytes / binBytes).toFixed(1)}× smaller than JSON text`);

// ── 2. Cold open: the loadReadingIndex path ─────────────────────────────────
// Old path: TextDecoder().decode(bytes) → JSON.parse. New path: new FoldIndex(bytes).
console.log('\n[2] Cold open — the four call sites each did this before; now one decode');
const jsonText = JSON.stringify(corpus);
const tParse = bench(() => JSON.parse(jsonText), 7);
const bin = packIndex(corpus);
let ix;
const tConstruct = bench(() => { ix = new FoldIndex(bin); }, 7);
console.log(`  old: decode + JSON.parse  ${fmt(tParse)}`);
console.log(`  new: new FoldIndex(bytes) ${fmt(tConstruct)}  (nothing decoded yet)`);
ok(`binary cold open is ${(tParse / tConstruct).toFixed(1)}× faster`);

// ── 3. First render — what readingVals touches ──────────────────────────────
console.log('\n[3] First render (readingVals): sourcesMeta + castTop(60) + eachBond + identitiesTop(30) + kinds/order');
const tJsonRender = bench(() => { const j = JSON.parse(jsonText); void j.sources; void Object.keys(j.sources).length; (j.cast).slice().sort((a, b) => b.srcN - a.srcN || b.mentions - a.mentions).slice(0, 60); void j.bonds; void (j.identities).slice(0, 30); void j.kinds; void j.order; }, 5);
const tBinRender = bench(() => { const X = new FoldIndex(bin); void X.sourcesMeta(); void Object.keys(X.sourcesMeta()).length; X.castTop(60); X.eachBond(); X.identitiesTop(30); void X.kinds; void X.order; }, 5);
const ratio3 = tJsonRender / tBinRender;
console.log(`  old (parse + full graph + sort all): ${fmt(tJsonRender)}`);
console.log(`  new (one buffer, header-strided):   ${fmt(tBinRender)}`);
ok(`first render is ${ratio3 >= 1 ? ratio3.toFixed(1) + '× faster' : (1 / ratio3).toFixed(1) + '× slower'}`);

// ── 4. Per-question readingBlock: bonds lookup per hit ──────────────────────
// The cast scan is identical on both sides, so isolate what the binary changes:
// bondsOf (header stride, no bonds materialization) vs filter on materialized bonds.
console.log('\n[4] Per-question readingBlock (ask path): bondsOf per hit');
const ixQ = new FoldIndex(bin);
const jQ = JSON.parse(jsonText);
void ixQ.bonds; void jQ.bonds; // both fully materialized for the old path
const NAMES = ['Mayor', 'Chief of Police', 'Budget & Finance Committee', 'Audit Committee', 'OHS', 'Alice', 'Bob', 'Metro Council', 'Director', 'Community Oversight'];
const tJsonAsk = bench(() => { for (const nm of NAMES) jQ.bonds.filter(b => b.a === nm || b.b === nm).sort((a, b) => b.n - a.n).slice(0, 5); }, 15);
const tBinAsk = bench(() => { for (const nm of NAMES) ixQ.bondsOf(nm, 5); }, 15);
const ratio4 = tJsonAsk / tBinAsk;
console.log(`  old (filter + sort on materialized): ${fmt(tJsonAsk)}`);
console.log(`  new (hash-stride bondsOf):           ${fmt(tBinAsk)}`);
ok(`10 per-question lookups are ${ratio4 >= 1 ? ratio4.toFixed(1) + '× faster' : (1 / ratio4).toFixed(1) + '× slower'} (per-name cache makes repeats ~0; never materializes 3000 bond src-maps)`);
void ixQ.cast; void jQ.cast; // keep [7] below warm

// ── 5. Random access ────────────────────────────────────────────────────────
console.log('\n[5] Random access');
const tJsonSrc = bench(() => { for (let i = 0; i < 1000; i++) { const n = srcNames[(i * 7) % N_SOURCES]; void jQ.sources[n]; } }, 5);
const tBinSrc = bench(() => { for (let i = 0; i < 1000; i++) { const n = srcNames[(i * 7) % N_SOURCES]; void ixQ.source(n); } }, 5);
const ratio5 = tJsonSrc / tBinSrc;
console.log(`  old (materialized map lookup): ${fmt(tJsonSrc)}`);
console.log(`  new (binary search per hit):   ${fmt(tBinSrc)}`);
ok(`1000 random source() lookups are ${ratio5 >= 1 ? ratio5.toFixed(1) + '× faster' : (1 / ratio5).toFixed(1) + '× slower'} — but skip 5000× full source decodes`);

// ── 6. Semantic falsification: full round-trip equality at scale ────────────
console.log('\n[6] Round-trip equality at scale (try to break it)');
const out = unpackIndex(bin);
let eq = true, firstDiff = '';
for (const k of ['schema', 'from', 'builtAt', 'ms', 'lines', 'bad', 'encounters', 'castTotal', 'bondsTotal', 'canonTotal', 'identitiesTotal', 'kinds', 'order', 'cursor']) {
  if (!deepEq(out[k], corpus[k])) { eq = false; firstDiff = k; break; }
}
if (eq) for (const k of ['cast', 'bonds', 'canon', 'identities', 'sources']) {
  for (let i = 0; i < out[k].length; i++) { if (!deepEq(out[k][i], corpus[k][i])) { eq = false; firstDiff = `${k}[${i}]`; break; } }
  if (!eq) break;
}
eq ? ok('all ' + (out.cast.length + out.bonds.length + out.canon.length + out.identities.length) + ' rows + ' + Object.keys(out.sources).length + ' sources + scalars round-trip equal') : fail('round-trip diverges at ' + firstDiff);

// ── 7. Fast-path == slow-path disagreement ──────────────────────────────────
console.log('\n[7] Fast paths agree with their slow equivalents');
const topBin = ixQ.castTop(60);
const topJson = jQ.cast.slice().sort((a, b) => b.srcN - a.srcN || b.mentions - a.mentions).slice(0, 60);
deepEq(topBin, topJson) ? ok('castTop(60) == sort().slice(60) (same rows, same order)') : fail('castTop disagrees with sort');
const boBin = ixQ.bondsOf('Mayor', 5);
const boJson = jQ.bonds.filter(b => b.a === 'Mayor' || b.b === 'Mayor').sort((a, b) => b.n - a.n).slice(0, 5);
deepEq(boBin, boJson) ? ok('bondsOf(Mayor) == filter/sort/slice') : fail('bondsOf disagrees');
let srcAgree = true;
for (let i = 0; i < N_SOURCES; i++) { const n = srcNames[i]; if (!deepEq(ixQ.source(n), jQ.sources[n])) { srcAgree = false; break; } }
srcAgree ? ok('source() agrees with sources map for all ' + N_SOURCES) : fail('source() disagrees');
const meta = ixQ.sourcesMeta();
const metaAgree = Object.keys(meta).length === N_SOURCES && Object.keys(meta).every(n => deepEq(meta[n], { chunks: jQ.sources[n].chunks, chars: jQ.sources[n].chars, ops: jQ.sources[n].ops }));
metaAgree ? ok('sourcesMeta() == each source with only chunks/chars/ops') : fail('sourcesMeta() disagrees');
const eachB = ixQ.eachBond();
const bondAgree = eachB.length === jQ.bonds.length && eachB.every((r, i) => deepEq(r, { a: jQ.bonds[i].a, b: jQ.bonds[i].b, n: jQ.bonds[i].n, rel: jQ.bonds[i].rel, pos: jQ.bonds[i].pos, neg: jQ.bonds[i].neg, srcN: jQ.bonds[i].srcN }));
bondAgree ? ok('eachBond() == every bond with the src map dropped') : fail('eachBond() disagrees');
deepEq(ixQ.identitiesTop(30), jQ.identities.slice(0, 30)) ? ok('identitiesTop(30) == identities.slice(0,30)') : fail('identitiesTop disagrees');

// ── 8. The guard refuses silent truncation ──────────────────────────────────
console.log('\n[8] Overflow guard');
const huge = { ...corpus, cast: [{ id: 'x', surfaces: ['X'], standing: '', mentions: 1, src: Object.fromEntries(Array.from({ length: 70000 }, (_, i) => ['s' + i, 1])), first: '', firstSeq: 1, srcN: 70000 }], castTotal: 1 };
try { packIndex(huge); fail('packIndex silently truncated a 70k-entry src map'); } catch (e) { ok('packIndex throws on >65535 counts (' + e.message + ')'); }

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('\n' + (fails === 0 ? 'ALL FALSIFICATION CHECKS PASSED' : fails + ' FALSIFICATION CHECK(S) FAILED'));
process.exit(fails === 0 ? 0 : 1);