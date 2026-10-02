// holodeck-profile.test.mjs — THE SUMMARY FIELD IS A READ OF THE PROFILE, AND
// EVERY PROPOSITION CARRIES FULL PROVENANCE TO THE SOURCE MATERIAL. Falsifies
// the summary against a hand-made analysis where the witness statements are
// known, so a proposition may only appear if the corpus asserted it and its
// cited counts may only name statements that really carried it. No model, no
// network — the summary is derived from the induced profile + the analysis.
//
//   node --test holodeck-profile.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFromTriples, triplesFromAnalysis, provenanceFor, summaryProps, summaryText, renderPanel, renderSummary } from './holodeck-profile.js';

// A tiny analysis with known witnesses. Althea appears in two statements:
// s1 (The Ledger) carries office · transit · the figure $12M · year 2024 and
// the company Metro Council; s2 (The Post) carries funding · year 2025 and
// Metro Council again.
const A = {
  names: {
    'Althea': { name: 'Althea', type: 'mayor', aliases: ['A. Vance'], sts: ['s1', 's2'] },
    'Metro Council': { name: 'Metro Council', type: 'council', aliases: [], sts: ['s1', 's2'] },
  },
  byId: {
    s1: { id: 's1', doc: 'd1', text: 'Althea holds office and plans transit.', frame: 'fact', names: ['Althea', 'Metro Council'], topics: ['transit'], figs: [{ raw: '$12M' }], dates: [{ year: 2024 }], where: 'p.2' },
    s2: { id: 's2', doc: 'd2', text: 'Althea is about funding with Metro Council.', frame: 'quote', names: ['Althea', 'Metro Council'], topics: ['funding'], figs: [], dates: [{ year: 2025 }] },
  },
  docById: {
    d1: { id: 'd1', title: 'The Ledger', pubLabel: '2024' },
    d2: { id: 'd2', title: 'The Post', pubLabel: '2025' },
  },
};

function buildFor(a = A) {
  const tri = triplesFromAnalysis(a);
  const beings = [...new Set(tri.map((t) => t.subject))];
  return buildFromTriples(tri, { beings, exposureFloor: 2, draws: 99, alpha: 0.05, seed: 5 });
}

test('provenanceFor cites per-statement relations to exactly the carrying statements', () => {
  const prov = provenanceFor(A, 'Althea');
  const ids = (k) => (prov.get(k) || []).map((s) => s.id);
  assert.deepEqual(ids('about\u0001transit'), ['s1']);
  assert.deepEqual(ids('about\u0001funding'), ['s2']);
  assert.deepEqual(ids('year\u00012024'), ['s1']);
  assert.deepEqual(ids('figure\u0001$12M'), ['s1']);
  assert.deepEqual(ids('appears with\u0001Metro Council'), ['s1', 's2']);
  assert.equal(prov.get('about\u0001transit')[0].docTitle, 'The Ledger');
  assert.equal(prov.get('about\u0001transit')[0].where, 'p.2');
});

test('provenanceFor cites name-level relations to every statement the name appears in', () => {
  const prov = provenanceFor(A, 'Althea');
  assert.deepEqual((prov.get('typed\u0001mayor') || []).map((s) => s.id).sort(), ['s1', 's2']);
  assert.deepEqual((prov.get('also written\u0001A. Vance') || []).map((s) => s.id).sort(), ['s1', 's2']);
});

test('provenanceFor returns an empty map for a name the corpus never read', () => {
  assert.equal(provenanceFor(A, 'Nobody').size, 0);
});

test('summaryProps carries each proposition’s relation, star, standing and raw values', () => {
  const built = buildFor();
  const props = summaryProps(built.byId.get('Althea'), built);
  const byRel = new Map(props.map((p) => [p.rel, p]));
  assert.ok(byRel.has('about'), 'the corpus’s own about-relations are the propositions');
  const about = byRel.get('about');
  assert.ok(about.vals.some((v) => v.raw === 'transit' && v.text === 'transit'));
  assert.equal(about.vals.some((v) => v.raw === 'transit' && v.n >= 1), true);
  for (const p of props) assert.ok(p.standing, 'every proposition carries the kind’s standing');
});

test('summaryText grows small → medium → full, and only full cites source counts', () => {
  const built = buildFor();
  const p = built.byId.get('Althea');
  const prov = provenanceFor(A, 'Althea');
  const small = summaryText(p, built, { size: 'small', provenance: prov });
  const medium = summaryText(p, built, { size: 'medium', provenance: prov });
  const full = summaryText(p, built, { size: 'full', provenance: prov });
  assert.ok(small.length < medium.length, 'a bigger field is a bigger read');
  assert.ok(medium.length < full.length);
  assert.match(small, /Althea/);
  assert.ok(!/source statement/.test(small), 'small does not drown the line in counts');
  assert.match(full, /transit · 1 source statement/, 'full cites the exact statement count');
  assert.match(full, /Metro Council ×2 · 2 source statements/);
  assert.equal(summaryText(null, built), null, 'no profile → no summary');
});

test('full provenance law: every cited count equals the real witness statements, nothing fabricated', () => {
  const built = buildFor();
  const p = built.byId.get('Althea');
  const prov = provenanceFor(A, 'Althea');
  const props = summaryProps(p, built);
  for (const prop of props) {
    for (const v of prop.vals) {
      const real = (prov.get(prop.rel + '\u0001' + String(v.raw)) || []).length;
      const full = summaryText(p, built, { size: 'full', provenance: prov });
      const shown = v.text + (v.n > 1 ? ' ×' + v.n : '') + (real ? ' · ' + real + ' source statement' + (real === 1 ? '' : 's') : '');
      if (real === 0) assert.ok(!full.includes(shown), `${prop.rel}: ${v.text} must not be cited when no statement carries it`);
      else assert.ok(full.includes(shown), `${prop.rel}: ${v.text} must be cited ${real}× — it was`);
    }
  }
});

test('a summary proposition only exists for relations the corpus actually asserted', () => {
  const built = buildFor();
  const rels = new Set(summaryProps(built.byId.get('Althea'), built).map((p) => p.rel));
  const asserted = new Set(['typed', 'also written', 'said with', 'named in', 'figure', 'year', 'about', 'appears with']);
  for (const r of rels) assert.ok(asserted.has(r), `relation ${r} was not in the analysis`);
});

test('renderSummary is expandable and renderPanel embeds it; provenance rides each value', () => {
  const built = buildFor();
  const prov = provenanceFor(A, 'Althea');
  const block = renderSummary(built, 'Althea', { provenance: prov, onCite: (st) => st.docTitle });
  assert.match(block, /What it is about/);
  assert.match(block, /hp-full/, 'the expand toggle is present');
  assert.match(block, /Metro Council<i>×2<\/i><i class="hp-scite">2 stmts<\/i>/);
  const panel = renderPanel(built, 'Althea', { provenance: prov, onCite: (st) => st.docTitle });
  assert.match(panel, /hp-summary/);
  assert.match(panel, /hp-rows/);
});