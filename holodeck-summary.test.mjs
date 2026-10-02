// holodeck-summary.test.mjs — THE SUMMARY LADDER IS A CURATION OF THE SOURCE'S
// OWN SENTENCES, GROUNDED BY CONSTRUCTION, SELECTED BY HOLOGRAPHICAL SURPRISE.
//
// Falsifies the ladder against the real NTOR essay (fixtures/summary-goldens/
// no-turn-on-red.txt). The laws that HOLD and the one that is genuinely OPEN:
//
//   G  HOLDS  — every emitted line is a verbatim span of the source at its
//               offset (grounding is structural, never claimed);
//   M  HOLDS  — bigger budgets refine smaller ones (1 ⊆ 5 = 3-paragraph spans);
//   N  HOLDS  — a resolver's drop is null-controlled: word salad manufactures no
//               explanations;
//   A  HOLDS  — a declared prior is ATTESTED to a real source span or it is
//               inert (the void's guardrail: the model proposes, the source
//               disposes);
//   R  OPEN   — the 1-sentence pick is the argument's TURN, not its biggest
//               figure. OPEN because this essay's turn ("…these 59 seem good,
//               targeted policy") carries almost no holographic excess (it has
//               no figures); its surprise is rhetorical and lives in the VOID's
//               prior, not in the entity/figure holograph. Attestation is
//               necessary but the resolver is still degenerate (it selects the
//               most name-dense list). This test DOCUMENTS the gap rather than
//               tuning a constant until the golden passes.
//
//   node --test holodeck-summary.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { splitSentences } from './vendor/eoreader7/native/adapters/text/spans.js';
import { select, ladder, resolverEdges, attestPrior, turnAgainstPrior, tokens, observables, dmdBaseline, genreBaseline, excessOf, makeH, render, worth, conclusionOf, stanceOf } from './holodeck-summary.js';

const TEXT = readFileSync(fileURLToPath(new URL('./fixtures/summary-goldens/no-turn-on-red.txt', import.meta.url)), 'utf8');
const DOC = 'ntor';

// The analysis shape analyze() produces, built here with the same span
// discipline: sentences carry offsets; names are capitalized runs; figures are
// number-ish tokens; a claim is 8+ words with a verb.
const NAME_RUN = /\b(?:[A-Z][A-Za-z'’.-]+)(?:\s+(?:[A-Z][A-Za-z'’.-]+|of|the|and|on|for)){0,4}\b/g;
const FIG_RE = /\$?\d[\d,.]*\s?(?:%|percent|million|billion|feet|ft|people|deaths|incidents)?/gi;
const VERB_RE = /\b(is|are|was|were|has|have|had|does|do|did|will|would|can|could|should|shows?|found|reported|includes?|says?|said|makes?|took|taken|resulted|occurred|estimates?|recommends?|support|oppose|implement|pass|increase|decrease|reduc\w*|investigat\w*)\b/i;

function analysisFromText(text, docId) {
  const sents = splitSentences(text);
  const sts = sents.map((s, i) => {
    const names = [...new Set((s.text.match(NAME_RUN) || []).map((x) => x.trim()))].filter((n) => n.length > 2);
    const figs = (s.text.match(FIG_RE) || []).map((raw) => ({ raw: raw.trim(), value: parseFloat(raw.replace(/[^\d.]/g, '')), unit: /%|percent/i.test(raw) ? 'percent' : '' }));
    const words = (s.text.match(/[A-Za-z]{2,}/g) || []).length;
    return { id: docId + ':' + i, doc: docId, s: s.offset, e: s.offset + s.text.length, text: s.text, names, figs, ref: /^Figure \d|^Credit:|^nd$/i.test(s.text.trim()), claimy: words >= 8 && VERB_RE.test(s.text), year: 2026 };
  });
  const doc = { id: docId, title: 'By the Numbers: No Turn on Red', year: 2026, pubLabel: '2026' };
  return { docs: [doc], docById: { [docId]: doc }, sts, byId: Object.fromEntries(sts.map((s) => [s.id, s])), stsByDoc: { [docId]: sts } };
}

const A = analysisFromText(TEXT, DOC);
const clean = (s) => String(s).replace(/\s+/g, ' ').trim();

// ── G: grounding is structural ──────────────────────────────────────────────

test('G — HOLDS: every emitted span is the source text at its offset, at every size', () => {
  for (const size of [1, 5, 3]) {
    const r = select(A, DOC, { size });
    for (const sp of r.spans) assert.equal(TEXT.slice(sp.s, sp.e), A.byId[sp.id].text, `size ${size}: span ${sp.id} is not the source at its offset`);
  }
});

test('G — HOLDS: no emitted line introduces a word the source does not contain', () => {
  const L = ladder(A, DOC);
  const src = new Set(tokens(TEXT));
  for (const line of [...L.one.lines, ...L.five.lines, ...L.three.lines]) {
    for (const w of tokens(line)) assert.ok(src.has(w), `generated token "${w}" not in the source`);
  }
});

test('P — HOLDS: every proposition carries its provenance — span, signals, and names', () => {
  const L = ladder(A, DOC);
  for (const size of [L.one, L.five, L.three]) {
    assert.equal(size.proves.length, size.spans.length, 'one provenance record per proposition');
    for (const p of size.proves) {
      assert.ok(p.id, 'the statement id');
      assert.equal(TEXT.slice(p.span.s, p.span.e), A.byId[p.id].text, 'the span is the source at its offset');
      for (const k of ['excess', 'figures', 'centrality', 'resolverDrop', 'overFigure', 'score']) assert.ok(k in p.signals, `signal ${k} present`);
      assert.ok(Array.isArray(p.names) && Array.isArray(p.measures), 'what it is about, as read');
    }
  }
});

test('P — HOLDS: a proposition never leaves as NL — it carries a GFP (Ground·Figure·Pattern) and an EOT record', () => {
  const L = ladder(A, DOC);
  for (const p of L.five.proves) {
    assert.ok(p.gfp, 'the language-neutral GFP is present');
    assert.match(p.gfp.schema, /GfpClaim/);
    assert.ok(p.gfp.ground.startsWith('/doc/' + DOC), 'the Ground is the source holon (byte-addressed)');
    assert.ok(p.gfp.rel, 'the Pattern (relation) is present');
    assert.ok(p.gfp.roles && p.gfp.roles.ARG0, 'the Figure is by ROLE, not word order');
    assert.ok(['+', '-'].includes(p.gfp.polarity), 'polarity is carried');
    assert.ok(p.eot && p.eot.schema === 'EOTObservation@1', 'the EOT record is present');
    assert.deepEqual(p.eot.at, [p.span.s, p.span.e], 'the EOT addresses the same bytes as the span');
  }
});

test('P — HOLDS: rendering goes through a GFP lens, never an English default', () => {
  const L = ladder(A, DOC);
  const p = L.one.proves[0];
  const svo = render(p, 'SVO');
  assert.ok(svo.split(' ').length >= 2, 'SVO renders the claim');
  const sov = render(p, 'SOV');
  assert.notEqual(svo, sov, 'a different lens is a different word order — the core is order-free');
  assert.throws(() => render(p, 'klingon'), /not a GFP lens|no lens/, 'an unregistered lens throws, never a silent English fallback');
});

test('P — HOLDS: a proposition that resolved a turn carries that resolver with its own span', () => {
  const L = ladder(A, DOC);
  const withRes = L.five.proves.filter((p) => p.resolver);
  for (const p of withRes) {
    assert.equal(TEXT.slice(p.resolver.span.s, p.resolver.span.e), A.byId[p.resolver.id].text, 'the resolver cites its own source span');
    assert.ok(p.resolver.drop > 0, 'the resolver states how much surprise it removed');
  }
});

// ── M: monotone across budgets ──────────────────────────────────────────────

test('M — HOLDS: the 1-sentence pick is the first of the 5, which are the 3 paragraphs', () => {
  const L = ladder(A, DOC);
  assert.equal(L.one.lines.length, 1);
  assert.equal(L.five.lines.length, 5);
  assert.ok(L.three.lines.length >= 1 && L.three.lines.length <= 3);
  assert.ok(L.monotone, 'one ⊆ five by construction');
  // the 3 paragraphs are a regrouping of the same 5 spans, no new content
  const fiveText = L.five.lines.join(' ');
  for (const p of L.three.lines) for (const w of tokens(p)) assert.ok(new Set(tokens(fiveText)).has(w), `paragraph introduced "${w}" beyond the 5-sentence set`);
});

// ── N: resolver edges are null-controlled ───────────────────────────────────

test('N — HOLDS: every resolver that forms shares the turn’s subject and is selective (no flood)', () => {
  const edges = resolverEdges(A, DOC, { top: 8 });
  // On this essay the rhetorical verdict has no clean mechanical resolver, so
  // ZERO edges is a legitimate outcome (the OPEN item). What must ALWAYS hold
  // is the shape of any edge that does form.
  for (const e of edges) {
    assert.ok(e.drop > 0.5, `resolver ${e.resolver.id} drop ${e.drop} below the edge floor`);
    const tn = new Set(e.turn.names); const rn = new Set(e.resolver.names);
    assert.ok([...rn].some((n) => tn.has(n)), 'an explanation must share the turn’s subject, not merely flood entities');
  }
  // A resolver explains ONE turn: no resolver is reused.
  const used = edges.map((e) => e.resolver.id);
  assert.equal(new Set(used).size, used.length, 'the same sentence may not “resolve” two different turns');
});

test('N — HOLDS: a FIRST-asserted turn carries excess, and a resolver forms for it', () => {
  // WAS OPEN (2026-10-02). Two inherited holes: (1) excessOf scored a bond only
  // when BOTH names had already recurred (ca>=2 && cb>=2) or one had (ca||cb) —
  // the BOTH-NEW first assertion fell through and scored 0; (2) fieldsOf kept
  // only multi-word names and ALL-CAPS acronyms, dropping every single proper
  // noun, so a first assertion about one had no name to bond. Fixed: a both-new
  // bond takes the bond weight at the formula's own variable (min(ca,cb)=0 →
  // weight 1, the strongest entry), a single capitalized word is a name unless
  // the document writes it lowercase (CODING-LESSONS 63), and the turn's own
  // subject is a legitimate resolver link even when it is the document's most
  // common name (a resolver must be about the turn; `claimed` still bounds the
  // flooder to one turn). The first, load-bearing claim now resolves.
  const DOC2 = 'x';
  const mk = (id, text, names, s) => ({ id, doc: DOC2, text, names, figs: [], ref: false, claimy: true, frame: 'fact', s, e: s + text.length, year: 2026 });
  const sts = [
    mk('t', 'Kupin advanced the bill to constrain the process today', ['Kupin', 'the bill'], 0),
    mk('r', 'Kupin owns the meeting hall where the vote was held', ['Kupin', 'the meeting hall'], 100),
    mk('n', 'Weather in a distant county was mild and unremarkable', ['a distant county'], 200),
  ];
  const A2 = { sts, byId: Object.fromEntries(sts.map((s) => [s.id, s])), stsByDoc: { [DOC2]: sts }, docById: { [DOC2]: { id: DOC2, title: 'x', year: 2026 } } };
  const empty = makeH();
  assert.ok(excessOf(A2.byId.t, empty, A2).excess > 0, 'a first-asserted bond carries excess (the first-assertion signal)');
  const edges = resolverEdges(A2, DOC2, { top: 3 });
  assert.ok(edges.some((e) => e.turn.id === 't' && e.resolver.id === 'r'), 'a resolver forms for the first-asserted turn, sharing its subject');
});

test('N — HOLDS: word salad manufactures no explanations (the null control)', () => {
  const shuffled = analysisFromText(tokens(TEXT).join(' '), DOC);
  const edges = resolverEdges(shuffled, DOC, { top: 8 });
  assert.ok(edges.length <= 1, `word salad should not manufacture explanations, got ${edges.length}`);
});

// ── A: the void's priors are attested or inert ──────────────────────────────

test('A — HOLDS: a prior the source states is attested to its own span; one it does not is inert', () => {
  const stated = attestPrior(A, DOC, 'NTOR unnecessarily constrains the existing engineering process');
  assert.ok(stated.ok, 'the source quotes this objection, so it is attested');
  assert.equal(TEXT.slice(stated.span.s, stated.span.e), A.byId[stated.span.id].text);
  const invented = attestPrior(A, DOC, 'there is no demonstrated pedestrian safety problem downtown');
  assert.equal(invented.ok, false, 'the source never states this prior, so it is inert and cannot drive selection');
});

test('A — HOLDS: an unattested prior yields no turn (it cannot select)', () => {
  const inert = attestPrior(A, DOC, 'zoning reform will lower rents across the county');
  assert.equal(turnAgainstPrior(A, DOC, inert), null);
});

// ── B: the baseline is a genre, never the document itself ───────────────────

test('B — HOLDS: with no measured genre prior the summary refuses to treat the document as its own ground', async () => {
  const b = await genreBaseline(null, [], {});
  assert.match(b.gap || '', /no_genre_prior/);
  assert.ok(!b.modes.length, 'no modes → no self-serving baseline');
});

test('B — HOLDS: with no genre trajectory there is no mode (a 1-hot state has no dynamics)', async () => {
  const prior = { genre: 'test', prior_terms: [{ term: 'shall', g2: 9 }] };
  const b = await genreBaseline(prior, [], {});
  assert.match(b.gap || '', /no_genre_trajectory/);
});

test('B — HOLDS: DMD over a genre trajectory yields stable and decaying modes, not a uniform blob', async () => {
  // A synthetic genre: documents share a steady vocabulary, alternate a figure,
  // and carry one term that fades — DMD must resolve the frequencies.
  const docs = [];
  for (let i = 0; i < 12; i++) { const s = new Map(); s.set('term:shall', 3); s.set('term:section', 2); s.set('term:person', 1 + (i % 3)); s.set('term:state', 2); if (i % 2) s.set('fig:percent', 1); docs.push(s); }
  const b = await dmdBaseline(docs, { rank: 4 });
  assert.ok(b.modes.length >= 2, 'a real trajectory has more than one mode');
  const mags = b.modes.map((z) => z.magnitude);
  assert.ok(Math.max(...mags) > Math.min(...mags) + 0.1, 'a steady mode and a decaying mode must separate, not all read alike');
  const freqs = b.modes.map((z) => Math.abs(z.frequency));
  assert.ok(freqs.some((f) => f > 0.5), 'the alternating figure shows as a nonzero frequency — a count cannot reach this');
});

// ── R: OPEN — the turn, not the biggest figure ──────────────────────────────

test('R — OPEN (quantified): the verdict is a claim but the entity/figure measure cannot see it', () => {
  // Measured 2026-10-02: the verdict ("…these 59 NTOR signage seems to be
  // good, targeted policy…") IS a claim, but it ranks 30th of 104 by worth()
  // (excess 2.96 against the top pick's ~18; one figure; NO resolver), and its
  // RESIDUAL DROP is NEGATIVE — adding it to a baseline does not explain any
  // other claim. So NO reweighting of the entity/figure score can surface it:
  // its surprise is rhetorical (the reader's prior's inversion), not
  // holographic. Closing R needs a VOID-keyed frame signal — the declared
  // prior and the claim that answers it — which is a new measure, not a
  // tuned constant (the derivation's own guard: "do not tune a constant to
  // hide it"). THIS is where folding at a PERSPECTIVE (the void) is required:
  // a verdict is visible only as a turn against the perspective it overturns.
  const { score, claims } = worth(A, DOC);
  const rows = claims.map((st) => ({ id: st.id, s: score.get(st.id).s })).sort((a, b) => b.s - a.s);
  const rank = rows.findIndex((r) => /targeted policy/i.test(A.byId[r.id].text));
  assert.ok(rank >= 0, 'the verdict is a claim');
  assert.ok(rank > 5, `the verdict ranks ${rank + 1} of ${rows.length} — far below the data picks`);
  const one = select(A, DOC, { size: 1 });
  assert.equal(/targeted policy|limited data/i.test(one.lines[0]), false, 'OPEN: the 1-sentence pick is a data claim, not the verdict');
});

test('R — the fold at an identity: a verdict is visible ONLY as a turn against the perspective it overturns', () => {
  // The law: the world folds at a POINT — an identity — and what belongs is
  // what makes a difference TO IT. At the empty point the verdict is invisible
  // (the test above). Folded at the reader's identity (the prior the essay
  // argues against), the pick must be a claim that INVERTS that identity's
  // stance — the turn — not arbitrary salience. The identity's held evaluation
  // is carried by conclusionOf's stance (an English evaluative lens, giver:
  // STANCE_GIVER).
  const prior = 'The NTOR bill is unnecessary government overreach and the whining about pedestrian safety is nonsense';
  const identity = { id: 'prior', doc: DOC, s: 0, e: prior.length, text: prior, names: ['The NTOR'], figs: [], ref: false, claimy: true, frame: 'fact', year: 2026 };
  const conclusion = conclusionOf([identity], A);
  assert.equal(conclusion.stance, -1, 'the reader holds a negative stance on the bill');
  const one = select(A, DOC, { size: 1, forWhom: { conclusion } });
  const pick = A.byId[one.spans[0].id];
  assert.ok(pick, 'the folded pick is a source claim');
  assert.notEqual(stanceOf(pick.text), conclusion.stance, 'the pick is a turn against the identity — its stance inverts the held one');
});
