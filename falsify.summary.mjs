// falsify.summary.mjs — THE FOUR INVARIANTS OF THE SUMMARY LADDER, AGAINST A
// HELD-OUT SOURCE (the-fold's own build-order step 5, fixtures/summary-
// goldens/DERIVATION.md §4). Falsification lived inside holodeck-summary.test.mjs;
// this is the standalone driver the derivation calls for, runnable over any
// source the ladder was NOT tuned on.
//
// The invariants (DERIVATION.md §3):
//   G  GROUNDING    every emitted line is a verbatim substring at its claimed
//                   offset, at every size — a paraphrase fails even if equal.
//   N  NO REPEAT    no two emitted spans overlap, and no two carry topic
//                   vectors above the MMR threshold (λ).
//   M  MONOTONE     bigger budgets refine smaller ones: the 1-sentence pick is
//                   a span within the 5-sentence set (five ⊆ abstract ⊆ paper
//                   by construction — the blocks are grouped, never re-worded).
//   S  SHUFFLE-NULL random claim sentences score worse, and a resolver's drop
//                   vanishes under the shuffled baseline: word salad
//                   manufactures no explanations, or the edge is co-occurrence
//                   dressed as explanation and is rejected.
//
// A summary that violates any of these is not a summary of the source. This
// file exits non-zero with the violations named — the falsifier, never a
// passing feature mistaken for one.
//
//   node falsify.summary.mjs [--text FILE] [--doc ID] [--json]
//
// With no --text it runs the derivation's OWN source (NTOR) as a SELF-CHECK and
// says so — a held-out run needs a source the ladder was not derived on.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { splitSentences } from './vendor/eoreader7/native/adapters/text/spans.js';
import { extractSurfaces } from './vendor/eoreader7/native/adapters/text/surfaces.js';
import { select, ladder, resolverEdges, tokens, vectors, cosine } from './holodeck-summary.js';

const FIG_RE = /\$?\d[\d,.]*\s?(?:%|percent|million|billion|feet|ft|people|deaths|incidents)?/gi;
const VERB_RE = /\b(is|are|was|were|has|have|had|does|do|did|will|would|can|could|should|shows?|found|reported|includes?|says?|said|makes?|took|taken|resulted|occurred|estimates?|recommends?|support|oppose|implement|pass|increase|decrease|reduc\w*|investigat\w*)\b/i;
const clean = (s) => String(s).replace(/\s+/g, ' ').trim();

/** The analysis the ladder consumes, built from a raw source with the REAL
 *  reader's discipline: sentences by `splitSentences` (not a regex), names by
 *  `extractSurfaces` (the material's own surface reader — a name is a surface
 *  the reader individuates, never a capitalized run), figures by token.
 *
 *  WHY THE REAL READER (2026-10-02, the experiment's own finding): the
 *  stand-in capitalized-run heuristic read a wikitext stylesheet
 *  (".mw-parser-output .wn-social-bookmarks-box{background-color:#FFFFFF…}")
 *  as claims and made it the document's "turn" — a summary folded at an
 *  identity picked CSS. The reader that the fold must ride is the one that
 *  segments prose and individuates names, so the surfaces reader supplies the
 *  names and the splitter supplies the spans. A source with no individuated
 *  surfaces keeps whatever names it has; the figures are always read from the
 *  bytes. */
export function analysisFromText(text, docId) {
  const sents = splitSentences(text);
  // Names, per sentence, from the reader's own surface evidence: each surface
  // is mapped to the sentences whose bytes contain it.
  const surfaces = extractSurfaces([{ name: docId, text }], {}) || [];
  const bySentence = new Map();
  for (const s of surfaces) {
    if (!s.surface || s.surface.length < 3) continue;
    const idx = text.indexOf(s.surface);
    if (idx < 0) continue;
    const at = bySentence.get(idx);
    if (at) at.push(s.surface); else bySentence.set(idx, [s.surface]);
  }
  const sts = sents.map((s, i) => {
    const names = [...new Set((bySentence.get(s.offset) || []).filter((n) => n.length > 2))];
    const figs = (s.text.match(FIG_RE) || []).map((raw) => ({ raw: raw.trim(), value: parseFloat(raw.replace(/[^\d.]/g, '')), unit: /%|percent/i.test(raw) ? 'percent' : '' }));
    const words = (s.text.match(/[A-Za-z]{2,}/g) || []).length;
    return { id: docId + ':' + i, doc: docId, s: s.offset, e: s.offset + s.text.length, text: s.text, names, figs, ref: /^Figure \d|^Credit:|^nd$/i.test(s.text.trim()), claimy: words >= 8 && VERB_RE.test(s.text), year: 2026 };
  });
  return { docs: [{ id: docId, title: docId, year: 2026 }], docById: { [docId]: { id: docId, title: docId, year: 2026 } }, sts, byId: Object.fromEntries(sts.map((s) => [s.id, s])), stsByDoc: { [docId]: sts } };
}

const overlaps = (a, b) => a.s < b.e && b.s < a.e;

/** falsify(text, docId, { lambda }) -> { ok, invariants: [{ id, ok, detail }] } */
export function falsify(text, docId, { lambda = 0.6 } = {}) {
  const A = analysisFromText(text, docId);
  const invariants = [];
  const sizes = [1, 5, 3];

  // G — GROUNDING: every emitted span is the source at its offset.
  {
    const bad = [];
    for (const size of sizes) for (const sp of select(A, docId, { size }).spans) {
      if (text.slice(sp.s, sp.e) !== A.byId[sp.id]?.text) bad.push(`${size}:${sp.id}`);
    }
    invariants.push({ id: 'G', ok: bad.length === 0, detail: bad.length ? `spans not verbatim at their offsets: ${bad.slice(0, 5).join(', ')}` : `every span verbatim at its offset at sizes ${sizes.join('/')}` });
  }

  // N — NO REPEAT: emitted spans do not overlap; no two exceed the MMR threshold.
  {
    const r = select(A, docId, { size: 5 });
    const ov = [];
    for (let i = 0; i < r.spans.length; i++) for (let j = i + 1; j < r.spans.length; j++) if (overlaps(r.spans[i], r.spans[j])) ov.push(`${r.spans[i].id}~${r.spans[j].id}`);
    const claims = r.spans.map((s) => A.byId[s.id]).filter(Boolean);
    const V = vectors(claims, { namesOf: (st) => st.names || [] });
    let red = [];
    for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) if (cosine(V[i], V[j]) > lambda) red.push(`${i}~${j} (${cosine(V[i], V[j]).toFixed(2)})`);
    invariants.push({ id: 'N', ok: ov.length === 0 && red.length === 0, detail: ov.length ? `overlapping spans: ${ov.join(', ')}` : red.length ? `topic vectors above λ=${lambda}: ${red.join(', ')}` : `no overlap; no pair above λ=${lambda}` });
  }

  // M — MONOTONE: the 1-sentence pick is a span within the 5-sentence set.
  {
    const L = ladder(A, docId, { lambda });
    const five = new Set(L.five.spans.map((s) => s.id));
    const miss = L.one.spans.filter((s) => !five.has(s.id)).map((s) => s.id);
    invariants.push({ id: 'M', ok: miss.length === 0, detail: miss.length ? `the 1-sentence pick ${miss.join(', ')} is not in the 5-sentence set` : `the 1-sentence pick is contained in the 5-sentence set (${L.five.spans.length} spans)` });
  }

  // S — SHUFFLE-NULL: word salad manufactures no explanations.
  {
    const real = resolverEdges(A, docId, { top: 8 });
    const shuffled = analysisFromText(tokens(text).join(' '), docId);
    const nullEdges = resolverEdges(shuffled, docId, { top: 8 });
    const realSound = real.every((e) => e.drop > 0.5);
    invariants.push({ id: 'S', ok: nullEdges.length <= 1 && realSound, detail: `real edges ${real.length} (all drop > 0.5: ${realSound}); shuffled edges ${nullEdges.length} (floor: <= 1)` });
  }

  return { docId, ok: invariants.every((i) => i.ok), invariants };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (f, fb) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : fb; };
  const file = arg('--text', null);
  const docId = arg('--doc', file ? file.replace(/^.*\//, '').replace(/\.[a-z]+$/i, '') : 'ntor');
  const text = file ? readFileSync(file, 'utf8') : readFileSync(fileURLToPath(new URL('./fixtures/summary-goldens/no-turn-on-red.txt', import.meta.url)), 'utf8');
  const r = falsify(text, docId);
  if (!file) console.log('SELF-CHECK — the derivation\'s own source (NTOR), not held-out; pass --text FILE for a real falsification.');
  for (const i of r.invariants) console.log(`  ${i.ok ? 'HOLDS ' : 'FAILS '} ${i.id} — ${i.detail}`);
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  console.log(r.ok ? `\nALL INVARIANTS HOLD${file ? '' : ' (self-check)'} — ${docId}` : `\nFALSIFIED — ${docId}`);
  process.exit(r.ok ? 0 : 1);
}