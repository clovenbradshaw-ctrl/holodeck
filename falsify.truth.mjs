// falsify.truth.mjs — the log is the truth; the index is a view. Try to break that.
//
// Generates a schema-faithful ground-reading JSONL (the exact Encounter@1 / DeltaFold@1 /
// EO* schema the real 1.67 GB reading uses), folds it with the real buildIndex (reading-index.js),
// then independently re-derives every number the index reports by direct replay over the raw
// lines and demands equality. Also tests replay determinism, per-source (seekable) replay, the
// referent trail, and the truth → binary pipeline end to end.
//
//   node falsify.truth.mjs

import { performance } from 'node:perf_hooks';
import { buildIndex, foldLines, newFoldState, projectIndex } from './reading-index.js';
import { packIndex, unpackIndex } from './idx-binary.js';

function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const rand = rng(2026);
const pick = a => a[Math.floor(rand() * a.length)];
const irand = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

const SOURCES = ['transcripts/2026-01-a.txt', 'transcripts/2026-01-b.txt', 'transcripts/2026-02-a.txt', 'transcripts/2026-02-b.txt', 'transcripts/2026-03-a.txt', 'reports/2026-02-report.txt', 'reports/2026-03-report.txt', 'memos/2026-01-memo.txt', 'memos/2026-02-memo.txt', 'memos/2026-03-memo.txt', 'captures/page-11.html', 'captures/page-12.html'];
const NAMES = ['Alice', 'Bob', 'Carol', 'Metro Council', 'Budget & Finance', 'Chief of Police', 'Public Works', 'Mayor', 'Audit Committee', 'OHS', 'Director', 'Vice Chair', 'Assistant Chief', 'Hearing Officer', 'Lieutenant', 'Sergeant', 'Precinct', 'Downtown', 'Hermitage', 'Donelson', 'Oversight', 'Grievance', 'Bodycam', 'Dashcam', 'Fraternal Order'];
const STAND = ['settled', 'contested', 'hypothesis', 'under_review', 'refused', ''];
const REL = ['works for', 'oversees', 'testifies before', 'investigates', 'trains', 'sues', 'appoints', 'hears'];
const TERRAIN = ['prose', 'transcript', 'procedural', 'excerpt'];
const KINDS = ['INS/announce', 'DEF/define', 'CON/relate', 'REC/reframe', 'EVA/judge'];
const OPS = ['INS', 'DEF', 'CON', 'REC', 'EVA'];
const ID_KINDS = ['identity_split', 'identity_reading_refused', 'identity_hypothesis_supported'];
const MENTIONS = irand(1, 40);

const OPS_POOL = [];
for (const [op, kind] of OPS.flatMap(op => KINDS.map(k => [op, k]))) OPS_POOL.push([op, kind]);

function payloadReferent() {
  const nm = pick(NAMES);
  return { schema: 'EOReferent@1', id: 'ref-' + nm.toLowerCase().replace(/[^a-z]/g, ''), surfaces: [nm, nm + ' ' + irand(2, 9)].slice(0, rand() < 0.5 ? 1 : 2), standing: pick(STAND), mentions: MENTIONS };
}
function payloadHyperedge() {
  const a = pick(NAMES), b = pick(NAMES);
  return { schema: 'EOHyperedge@1', participants: [{ surface: a }, { surface: b }], relation: pick(REL), meta: rand() < 0.2 ? { polarity: '-' } : { polarity: '+' } };
}
function payloadCanon() {
  const a = pick(NAMES), b = pick(NAMES);
  return { schema: 'EOCanonicalHyperedge@1', participants: [{ value: a, alternatives: rand() < 0.3 ? [a + ' II', a + ' Jr.'] : [] }, { value: b, alternatives: [] }] };
}
function payloadIdAlt() {
  const a = pick(NAMES), b = pick(NAMES);
  return { schema: 'EOIdentityAlternative@1', left: a, right: b };
}

function genTruth() {
  const lines = [];
  for (const src of SOURCES) {
    lines.push(JSON.stringify({ schema: 'Encounter@1', source: src, extent: irand(2000, 40000) }));
    const nOps = irand(8, 20);
    for (let i = 0; i < nOps; i++) {
      const n = irand(1, 3);
      const operations = [];
      for (let j = 0; j < n; j++) {
        const [operator, kind] = pick(OPS_POOL);
        const op = { operator, consequence: { kind }, terrain: pick(TERRAIN) };
        const r = rand();
        if (r < 0.45) op.payload = { schema: 'EOReferent@1', value: payloadReferent() };
        else if (r < 0.7) op.payload = { schema: 'EOHyperedge@1', value: payloadHyperedge() };
        else if (r < 0.82) op.payload = { schema: 'EOCanonicalHyperedge@1', value: payloadCanon() };
        else if (r < 0.92) op.payload = { schema: 'EOIdentityAlternative@1', value: payloadIdAlt() };
        else { op.consequence.kind = pick(ID_KINDS); op.consequence.identity = 'id-' + irand(1, 5); op.inputs = [pick(NAMES), pick(NAMES)]; }
        operations.push(op);
      }
      lines.push(JSON.stringify({ schema: 'DeltaFold@1', operations }));
    }
  }
  return lines;
}

// ── Order-insensitive object equality (maps may come back in desc-count order) ──
function deepEq(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!deepEq(a[i], b[i])) return false; return true; }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k) || !deepEq(a[k], b[k])) return false;
  return true;
}
const trim25 = o => Object.fromEntries(Object.entries(o || {}).sort((a, b) => b[1] - a[1]).slice(0, 25));
const key2 = (x, y) => [x, y].sort().join(' — ');

let fails = 0;
const fail = msg => { fails++; console.log('  ✖ ' + msg); };
const ok = msg => console.log('  ✔ ' + msg);

console.log('─ Falsification: the lens agrees with the truth ─');
const truth = genTruth();
const url = 'https://raw.githubusercontent.com/clovenbradshaw-ctrl/ohs-custody/main/ground-readings/f3affd2e11370118-causalTextPerceiver_reviseTextFold_refresh25.jsonl.zst';
const cursor = { sequence: truth.filter(l => /Encounter@1/.test(l)).length };
const t0 = Date.now();
const index = buildIndex(truth, url, cursor, t0);
console.log('truth: ' + truth.length + ' lines, ' + cursor.sequence + ' encounters; index: ' + JSON.stringify({ bad: index.bad, encounters: index.encounters, sources: Object.keys(index.sources).length, castTotal: index.castTotal, bondsTotal: index.bondsTotal, canonTotal: index.canonTotal, identitiesTotal: index.identitiesTotal }));

ok('the log folds cleanly: ' + index.bad + ' unparsable lines, ' + index.encounters + ' encounters (cursor agrees)');

// ── 1. Independent re-derivation of every number the lens reports ────────────
console.log('\n[1] Lens ≡ truth: every index number re-derived by direct replay');
const cast = new Map(), bonds = new Map(), canon = new Map(), ids = new Map(), kinds = {}, order = [];
const src = {};
const S = s => src[s] || (src[s] = { chunks: 0, chars: 0, ops: {}, terrain: {}, kinds: {}, cast: {}, bonds: {}, idChurn: {} });
let cur = null, seq = 0;
for (const l of truth) {
  if (!l) continue;
  const j = JSON.parse(l);
  if (j.schema === 'Encounter@1') { cur = j.source; seq++; const X = S(cur); X.chunks++; X.chars += j.extent || 0; if (!order.includes(cur)) order.push(cur); continue; }
  if (j.schema !== 'DeltaFold@1' || !cur) continue;
  const X = S(cur);
  for (const o of j.operations || []) {
    const c = o.consequence || {};
    const k = o.operator + '/' + (c.kind || '?');
    kinds[k] = (kinds[k] || 0) + 1; X.kinds[k] = (X.kinds[k] || 0) + 1; X.ops[o.operator] = (X.ops[o.operator] || 0) + 1; X.terrain[o.terrain] = (X.terrain[o.terrain] || 0) + 1;
    const v = o.payload && o.payload.value;
    if (v && v.schema === 'EOReferent@1') {
      let R = cast.get(v.id);
      if (!R) { R = { id: v.id, surfaces: [], standing: v.standing, mentions: 0, src: {} }; cast.set(v.id, R); }
      for (const s of v.surfaces || []) if (!R.surfaces.includes(s)) R.surfaces.push(s);
      R.mentions = Math.max(R.mentions, v.mentions || 0); R.standing = v.standing || R.standing;
      R.src[cur] = (R.src[cur] || 0) + 1;
      const surf = (v.surfaces || [v.id])[0]; X.cast[surf] = (X.cast[surf] || 0) + 1;
    } else if (v && v.schema === 'EOHyperedge@1') {
      const P = (v.participants || []).map(p => p.surface || p.surfaceKey || '?');
      if (P.length < 2) continue;
      const key = P.slice(0, 2).sort().join(' — ');
      let B = bonds.get(key);
      if (!B) { B = { a: P[0], b: P[1], n: 0, rel: {}, pos: 0, neg: 0, src: {} }; bonds.set(key, B); }
      B.n++; B.rel[v.relation || '?'] = (B.rel[v.relation || '?'] || 0) + 1;
      if ((v.meta && v.meta.polarity) === '-') B.neg++; else B.pos++;
      B.src[cur] = (B.src[cur] || 0) + 1; X.bonds[key] = (X.bonds[key] || 0) + 1;
    } else if (v && v.schema === 'EOCanonicalHyperedge@1') {
      const P = (v.participants || []).map(p => p.value);
      if (P.length < 2) continue;
      const key = P.slice(0, 2).sort().join(' — ');
      let B = canon.get(key);
      if (!B) { B = { a: P[0], b: P[1], n: 0, alts: {}, src: {} }; canon.set(key, B); }
      B.n++;
      for (const p of v.participants || []) for (const a of p.alternatives || []) if (a !== p.value) B.alts[a] = (B.alts[a] || 0) + 1;
      B.src[cur] = (B.src[cur] || 0) + 1;
    } else if (v && v.schema === 'EOIdentityAlternative@1') {
      const key = v.left + ' ↔ ' + v.right;
      let I = ids.get(key);
      if (!I) { I = { left: v.left, right: v.right, n: 0, events: {}, src: {} }; ids.set(key, I); }
      I.n++; I.events[c.kind || v.standing || '?'] = (I.events[c.kind || v.standing || '?'] || 0) + 1;
      I.src[cur] = (I.src[cur] || 0) + 1; X.idChurn[key] = (X.idChurn[key] || 0) + 1;
    } else if (c.kind === 'identity_split' || c.kind === 'identity_reading_refused' || c.kind === 'identity_hypothesis_supported') {
      const key = c.identity || (o.inputs || []).join(' ↔ ');
      let I = ids.get(key);
      if (!I) { I = { left: (o.inputs || [])[0] || key, right: (o.inputs || [])[1] || '', n: 0, events: {}, src: {} }; ids.set(key, I); }
      I.n++; I.events[c.kind] = (I.events[c.kind] || 0) + 1;
      I.src[cur] = (I.src[cur] || 0) + 1; X.idChurn[key] = (X.idChurn[key] || 0) + 1;
    }
  }
}
const rank = (m, sc) => [...m.values()].sort((a, b) => sc(b) - sc(a)).map(x => ({ ...x, srcN: Object.keys(x.src || {}).length }));
const idxCast = new Map(index.cast.map(c => [c.id, c]));
const idxBonds = new Map(index.bonds.map(b => [b.a + ' ↔ ' + b.b, b]));
const idxCanon = new Map(index.canon.map(c => [c.a + ' ↔ ' + c.b, c]));

// The re-derivation produces the raw counts; the lens adds first/firstSeq/srcN metadata.
// Compare the counts the lens reports against the truth, field by field.
let castOk = true, castMismatch = '';
for (const [id, R] of cast) { const X = idxCast.get(id); if (!X || X.id !== R.id || X.mentions !== R.mentions || X.srcN !== Object.keys(R.src).length || !deepEq(X.src, R.src) || !deepEq(X.surfaces, R.surfaces) || X.standing !== R.standing) { castOk = false; castMismatch = id; break; } }
castOk && cast.size === index.castTotal ? ok('cast: all ' + cast.size + ' referents match their trail (surfaces/standing/mentions/src/srcN)') : fail('cast diverges at ' + castMismatch);

let bondsOk = true, bondsMismatch = '';
for (const [key, B] of bonds) { const X = idxBonds.get(B.a + ' ↔ ' + B.b); if (!X || X.n !== B.n || X.pos !== B.pos || X.neg !== B.neg || X.srcN !== Object.keys(B.src).length || !deepEq(X.rel, B.rel) || !deepEq(X.src, B.src)) { bondsOk = false; bondsMismatch = key; break; } }
bondsOk && bonds.size === index.bondsTotal ? ok('bonds: all ' + bonds.size + ' pairs match (n/rel/polarity/src/srcN)') : fail('bonds diverge at ' + bondsMismatch);

let canonOk = true, canonMismatch = '';
for (const [key, B] of canon) { const X = idxCanon.get(B.a + ' ↔ ' + B.b); if (!X || X.n !== B.n || X.srcN !== Object.keys(B.src).length || !deepEq(X.alts, B.alts) || !deepEq(X.src, B.src)) { canonOk = false; canonMismatch = key; break; } }
canonOk && canon.size === index.canonTotal ? ok('canon: all ' + canon.size + ' canonical pairs match (n/alts/src/srcN)') : fail('canon diverges at ' + canonMismatch);

let idsOk = true, idsMismatch = '';
const used = new Set();
for (const [key, I] of ids) {
  // Two internal keys can produce the same left ↔ right pair (an EOIdentityAlternative and an
  // identity_* op over the same names), so match each re-derived row to an unconsumed index row.
  const match = index.identities.findIndex((X, i) => !used.has(i) && X.left === I.left && X.right === I.right && X.n === I.n && deepEq(X.events, I.events) && deepEq(X.src, I.src));
  if (match < 0) { idsOk = false; idsMismatch = key; break; }
  used.add(match);
}
idsOk && ids.size === index.identitiesTotal ? ok('identities: all ' + ids.size + ' hypotheses match (n/events/src/srcN)') : fail('identities diverge at ' + idsMismatch);

let srcOk = true, srcMismatch = '';
for (const [name, X] of Object.entries(src)) {
  const Y = index.sources[name];
  const want = { chunks: X.chunks, chars: X.chars, ops: X.ops, terrain: X.terrain, kinds: X.kinds, cast: trim25(X.cast), bonds: trim25(X.bonds), idChurn: trim25(X.idChurn) };
  if (!Y || !deepEq(Y, want)) { srcOk = false; srcMismatch = name; break; }
}
srcOk ? ok('sources: all ' + Object.keys(src).length + ' per-source views match (chunks/chars/ops/terrain/kinds/cast/bonds/idChurn)') : fail('sources diverge at ' + srcMismatch);

deepEq(index.kinds, kinds) ? ok('kinds: operator/kind tallies match') : fail('kinds diverge');
deepEq(index.order, order) ? ok('order: encounter order matches') : fail('order diverges');
index.castTotal === cast.size && index.bondsTotal === bonds.size && index.canonTotal === canon.size && index.identitiesTotal === ids.size
  ? ok('totals match') : fail('totals diverge');

// The lens sorts cast by (mentions*10 + srcKeys) desc; verify order.
const wantCastOrder = rank(cast, x => x.mentions * 10 + Object.keys(x.src).length).map(c => c.id);
const gotCastOrder = index.cast.map(c => c.id);
deepEq(gotCastOrder, wantCastOrder) ? ok('cast is ranked by (mentions*10 + source-count) desc') : fail('cast order diverges from the documented rank');

// Per-source byte ranges, built once and reused by [2] and [3].
const ranges = {};
{
  let start = -1;
  for (let i = 0; i < truth.length; i++) { const j = JSON.parse(truth[i]); if (j.schema === 'Encounter@1') { if (start >= 0) ranges[JSON.parse(truth[start]).source] = [start, i - 1]; start = i; } }
  ranges[JSON.parse(truth[start]).source] = [start, truth.length - 1];
}

// ── 2. Replay determinism ───────────────────────────────────────────────────
// The fold attributes every event to the *currently open* source, so it is not
// commutative: a whole-log shuffle mis-attributes events across sources. The design
// relies on the weaker, true claim — within a source's own block, arrival order of
// the DeltaFold lines never changes the tallies. Both are asserted, honestly.
console.log('\n[2] Replay determinism');
const countEq = (a, b) => {
  if (!deepEq(a.kinds, b.kinds)) return false;
  if (a.castTotal !== b.castTotal || a.bondsTotal !== b.bondsTotal || a.canonTotal !== b.canonTotal || a.identitiesTotal !== b.identitiesTotal) return false;
  const m = (x, key) => new Map(x.map(r => [key(r), r]));
  const c1 = m(a.cast, c => c.id), c2 = m(b.cast, c => c.id);
  for (const [k, v] of c1) { const w = c2.get(k); if (!w || w.mentions !== v.mentions || w.srcN !== v.srcN || !deepEq(w.src, v.src) || !deepEq([...w.surfaces].sort(), [...v.surfaces].sort())) return false; }
  const b1 = m(a.bonds, x => x.a + '|' + x.b), b2 = m(b.bonds, x => x.a + '|' + x.b);
  for (const [k, v] of b1) { const w = b2.get(k); if (!w || w.n !== v.n || w.pos !== v.pos || w.neg !== v.neg || !deepEq(w.rel, v.rel) || !deepEq(w.src, v.src)) return false; }
  const s1 = a.sources, s2 = b.sources;
  for (const [k, v] of Object.entries(s1)) { const w = s2[k]; if (!w || !deepEq(w, v)) return false; }
  return true;
};
const shuffled = [...truth].sort(() => rand() - 0.5);
const index2 = buildIndex(shuffled, url, cursor, t0);
const srcAttribChanged = !deepEq(index.sources, index2.sources) || !deepEq(index.cast.find(c => c.id === 'ref-alice')?.src, index2.cast.find(c => c.id === 'ref-alice')?.src);
srcAttribChanged ? ok('whole-log shuffle DOES mis-attribute events to sources (the fold is not commutative — documented)') : ok('whole-log shuffle preserved attribution (suspicious; corpus may not have crossed boundaries)');

const blockShuffled = [];
for (const name of SOURCES) {
  const [a, b] = ranges[name];
  const block = truth.slice(a, b + 1);
  blockShuffled.push(block[0], ...block.slice(1).sort(() => rand() - 0.5));
}
const index3 = buildIndex(blockShuffled, url, cursor, t0);
const blockEq = countEq(index, index3);
blockEq ? ok('within-source shuffle reproduces every tally (kinds/totals/cast/bonds/sources)') : fail('within-source shuffle diverged');
const seqMoved = index3.cast.some(c => index.cast.find(d => d.id === c.id)?.firstSeq !== c.firstSeq);
seqMoved ? ok('firstSeq moved under block shuffle (first-mention sequence is arrival-order-dependent, as documented)') : ok('firstSeq coincidentally stable under this block shuffle');

// ── 3. Per-source replay (the seekable read): fold one source's range → its view ──
console.log('\n[3] Per-source replay: a byte-range fold reproduces the source view');
let rangeOk = true, rangeBad = '';
for (const name of SOURCES) {
  const [a, b] = ranges[name];
  const mini = buildIndex(truth.slice(a, b + 1), url, cursor, t0);
  if (!deepEq(mini.sources[name], index.sources[name])) { rangeOk = false; rangeBad = name; break; }
  if (mini.encounters !== 1) { rangeOk = false; rangeBad = name + ' (encounters)'; break; }
}
rangeOk ? ok('replaying each source\'s own byte range reproduces its per-source view (' + SOURCES.length + ' sources)') : fail('range replay diverges at ' + rangeBad);

// ── 4. Referent trail: the log holds every event the lens aggregates ─────────
console.log('\n[4] Referent trail: the truth contains the trail behind a sampled referent');
const sampleIds = [...cast.keys()].filter((_, i) => i % 7 === 0).slice(0, 5);
let trailOk = true, trailBad = '';
for (const id of sampleIds) {
  const R = cast.get(id);
  const events = truth.reduce((n, l) => { const j = JSON.parse(l); return n + (j.operations || []).filter(o => o.payload && o.payload.value && o.payload.value.schema === 'EOReferent@1' && o.payload.value.id === id).length; }, 0);
  const inIndex = idxCast.get(id);
  const srcTotal = Object.values(inIndex.src).reduce((s, n) => s + n, 0);
  if (events !== srcTotal) { trailOk = false; trailBad = id + ' (trail ' + events + ' occurrences, index src total ' + srcTotal + ', srcN ' + inIndex.srcN + ')'; break; }
  if (inIndex.srcN !== Object.keys(R.src).length) { trailOk = false; trailBad = id; break; }
}
trailOk ? ok('sampled referent trails: every EOReferent event is in the log and the lens counts it once per source (' + sampleIds.length + ' referents)') : fail('trail inconsistency at ' + trailBad);

// ── 5. Truth → lens → binary, end to end ────────────────────────────────────
console.log('\n[5] Truth → lens → FRIX binary, end to end');
const packed = packIndex(index);
const back = unpackIndex(packed);
deepEq(back, index) ? ok('binary round-trip of the truth-derived lens is exact') : fail('binary round-trip diverged');
const truthBytes = Buffer.byteLength(truth.join('\n'));
const indexJson = Buffer.byteLength(JSON.stringify(index));
console.log('  truth JSONL ' + (truthBytes / 1e6).toFixed(2) + ' MB → lens JSON ' + (indexJson / 1e6).toFixed(2) + ' MB → FRIX ' + (packed.length / 1e6).toFixed(2) + ' MB (' + (truthBytes / packed.length).toFixed(0) + '× reduction)');

// ── 6. Cached fold ≡ full fold: an append-only log folds only its tail ──────
console.log('\n[6] Cached fold: the fold is a left fold, so a checkpoint + tail == full replay');
// The ground reading is append-only: a revision appends encounters. The worker should hold the
// folded STATE (the checkpoint) and fold only the new tail, never re-decompress + re-fold the
// whole log. This asserts projectIndex(foldLines(foldLines(s, head), tail)) == buildIndex(all).
const full = buildIndex(truth, url, cursor, t0);
const splitPoints = [
  { at: 'between sources', cursor: truth.findIndex(l => JSON.parse(l).schema === 'Encounter@1' && JSON.parse(l).source !== SOURCES[0]) },
  { at: 'mid-source (inside the 4th block)', cursor: (() => { const [a] = ranges[SOURCES[3]]; return a + Math.floor((ranges[SOURCES[3]][1] - a) / 2); })() },
  { at: 'after one line (tiny head)', cursor: 1 },
];
let ckOk = true, ckBad = '';
// builtAt/ms are per-projection wall-clock stamps, not lens content.
const strip = o => { const { builtAt, ms, ...rest } = o; return rest; };
for (const sp of splitPoints) {
  const head = truth.slice(0, sp.cursor);
  const tail = truth.slice(sp.cursor);
  const state = newFoldState();
  foldLines(state, head);
  const headIndex = projectIndex(state, url, cursor, t0, head.length);
  if (!deepEq(strip(headIndex), strip(buildIndex(head, url, cursor, t0)))) { ckOk = false; ckBad = sp.at + ' (head checkpoint disagrees)'; break; }
  foldLines(state, tail);
  const merged = projectIndex(state, url, cursor, t0, truth.length);
  if (!deepEq(strip(merged), strip(full))) { ckOk = false; ckBad = sp.at + ' (checkpoint + tail != full)'; break; }
}
ckOk ? ok('checkpoint + tail folds to the same lens as a full replay at ' + splitPoints.length + ' split cursors (incl. mid-source)') : fail('cached fold diverges at ' + ckBad);

console.log('\n' + (fails === 0 ? 'ALL TRUTH-LENS FALSIFICATION CHECKS PASSED' : fails + ' TRUTH-LENS FALSIFICATION CHECK(S) FAILED'));
process.exit(fails === 0 ? 0 : 1);