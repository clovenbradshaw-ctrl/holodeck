// holodeck-holders.js — the holder-indexed reading of prose, per statement.
//
// Perspective = Interpretation × Figure = Lens (cube.js's TERRAIN_BY_DOMAIN).
// One holder's reading of one claim. The kernel names the cell
// (perspective.js); this module fills it for the surface, read-only, without
// inventing a holder. Every statement leaves here carrying `heldBy`:
//
//   { holder, depth, via, basis, gap }
//
// with `basis` in perspective.js's own closed set (witnessed | asserted |
// reported | inherited) and `gap` a TYPED absence where no holder could be
// admitted — never a fabricated one.
//
// READ THROUGH THE PIPELINE, NOT A BYTE WINDOW. An earlier cut leaned on
// attribution.js's ±90-character `before`/`after` slices and paired any verb
// with an adjacent name — a heuristic that over-attributed (a Russian work
// title in guillemets made "России" a speaker) and could not tell a REPORTING
// FRAME from an ordinary subject clause. This version reads the material the
// way the rest of the pipeline does:
//
//   * THE CLAUSE LAYER (clause-spans.js) bounds what is read.
//   * THE SVO READER (relations.js) reads each sentence's matrix
//     {subject, verb, object} — the reader the engine already uses, not a
//     second grammar.
//   * A REPORTING FRAME is structural: a matrix clause whose object is a
//     CLAUSE OF ITS OWN — it carries a finite verb AND a subject nominal
//     before that verb. `X said the policy would change` is a frame;
//     `X met the board` is not; `"not comply"` is not; `the man who left` is
//     rejected by the relative-clause it carries. No hand-typed speech-verb
//     list is consulted, and no word's meaning is assumed.
//   * DECLARED SPEAKERS come from the pipeline's own speaker organ
//     (speaker.js::speakerSections/speakerAt) — an epistolary heading, a
//     letter, a journal, a named section. That is the modality's own
//     declaration, read as a binding, never inferred.
//
// MEDIUM-BLIND (READING-SPEC S6). `relationsOf`, `isVerb`, `isNominal` and
// `referentFor` are INJECTED — the app's received POS prior and its own
// admitted cast. None may invent: `isVerb`/`isNominal` only classify a
// surface, and `referentFor` only returns a referent the reading already
// witnessed (P3 — priors are injected, never derived).
//
// THE HONEST GAPS ARE THE RESULT. `attribution_unwitnessed` (a reporting
// frame whose subject is not an admitted referent — "the minister said"),
// `embedded_speaker_unattributed` (a statement carrying a quotation, which
// this cut does not attribute), and `no_frame` (nothing read a frame; the
// reader's own witnessed belief) are each a NAMED missing perspective.
//
// MEASURED, DISCLOSED LIMITS (falsify.holders.mjs / falsify.holders.lang.mjs):
//   1. QUOTED SPEECH IS A GAP. The SVO reader's object ends at the comma
//      before a quotation, so `X said, "…"` reads no frame; a statement
//      carrying quote marks with no frame is reported unowned, never handed
//      to the reader. A clause-bound quotation reader is the next work, and
//      this gap names it.
//   2. PRE-VERBAL ATTRIBUTION is a gap's neighbour: `According to X, P`
//      reads `the plan is sound`, whose object bears no verb, so no frame is
//      found. Named here, not silently handed to the reader in a later cut.
//   3. THE SVO READER IS ENGLISH/SVO. On another language it is the WRONG
//      reader unless the caller binds that language's own role reader
//      (relations-positional.js with its RoleConfig); the POS prior alone
//      does not make an English matcher read Spanish or Russian.

import { clauseSpans } from './vendor/eoreader7/native/adapters/text/clause-spans.js';
import { READER, BASIS } from './vendor/eoreader7/native/kernel/perspective.js';

const freeze = Object.freeze;
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu;
const QUOTE_MARK = /["\u201C\u201D\u00AB\u00BB]/;

const words = (t) => [...String(t ?? '').matchAll(WORD)].map((m) => m[0]);

/** A relative clause sitting inside the object makes it a modified noun, not
 *  a reported clause (`the man who left` is not `said`'s complement). */
const relativeInside = (clauses, objectOffset) => clauses.some((c) => c.relation === 'relative' && c.start >= objectOffset);

/** A clause of its own: a finite verb, with a nominal subject before it.
 *  `the policy would change` yes; `not comply` no (verb, no subject);
 *  `to reporters` no; `sound` no. */
function isOwnClause(text, isVerb, isNominal) {
  const toks = words(text);
  const vi = toks.findIndex((w) => isVerb(w));
  if (vi < 0) return false;
  return toks.slice(0, vi).some((w) => isNominal(w));
}

/**
 * Attribute every statement in `sts` to a holder.
 *
 * Injected (P3 — this organ derives none):
 *   relationsOf(text) -> [{ subject, verb, object, subjectOffset, objectOffset }]
 *                        the pipeline's SVO reader (relations.js), bound to the
 *                        material's own verb vocabulary
 *   isVerb(word)   -> boolean  the received POS prior's verb reading
 *   isNominal(word)-> boolean  the received POS prior's nominal reading
 *   referentFor(surface) -> canonical admitted referent | null
 * Optional:
 *   clausesOf(text) -> clause spans (defaults to the vendored clause-spans.js)
 *   speakerSectionsOf(text) -> declared sections (pipeline speaker.js)
 *   speakerAt(sections, offset) -> declared speaker | null
 */
export function attributeStatements(sts, docs = [], {
  relationsOf = null,
  isVerb = null,
  isNominal = null,
  referentFor = null,
  clausesOf = (t) => clauseSpans(t),
  speakerSectionsOf = null,
  speakerAt = null,
} = {}) {
  if (typeof relationsOf !== 'function' || typeof isVerb !== 'function' || typeof isNominal !== 'function' || typeof referentFor !== 'function') {
    throw new TypeError('attributeStatements: relationsOf, isVerb, isNominal and referentFor are injected — this organ derives none (P3)');
  }
  const sections = new Map();
  for (const d of docs || []) if (speakerSectionsOf) { try { sections.set(d.id, speakerSectionsOf(d.text || '')); } catch (e) { sections.set(d.id, []); } }

  const out = new Map();
  for (const st of sts || []) {
    // 1. DECLARED — the modality says who is speaking (epistolary heading,
    //    letter, journal, named section). Read as a binding, never inferred.
    if (speakerAt && sections.has(st.doc)) {
      const declared = speakerAt(sections.get(st.doc), st.s);
      if (declared) { out.set(st.id, freeze({ holder: referentFor(declared) || declared, depth: 1, via: freeze(['section']), basis: BASIS.ASSERTED, gap: null })); continue; }
    }
    // 2. REPORTING FRAME — the matrix clause whose object is a clause of its
    //    own. The holder is the matrix subject, when the reading has admitted it.
    let frame = null;
    try {
      const clauses = clausesOf(st.text);
      for (const rel of relationsOf(st.text) || []) {
        const at = Number.isFinite(rel.objectOffset) ? rel.objectOffset : null;
        if (at == null) continue;
        if (relativeInside(clauses, at)) continue;
        if (!isOwnClause(st.text.slice(at), isVerb, isNominal)) continue;
        frame = rel; break;
      }
    } catch (e) { /* an organ failure leaves no frame — a gap, never a guess */ }
    if (frame) {
      const subject = referentFor(frame.subject);
      if (subject) out.set(st.id, freeze({ holder: subject, depth: 1, via: freeze([]), basis: BASIS.ASSERTED, gap: null }));
      else out.set(st.id, freeze({ holder: null, depth: 0, via: freeze([]), basis: null, gap: freeze({ type: 'attribution_unwitnessed', detail: 'a reporting frame was read but its subject is not an admitted referent — a holder slot left unfilled, which is a result' }) }));
      continue;
    }
    // 3. A quotation with no frame read: the speaker is not read here. Unowned,
    //    never handed to the reader — the reader did not say the quoted words.
    if (QUOTE_MARK.test(st.text)) {
      out.set(st.id, freeze({ holder: null, depth: 0, via: freeze([]), basis: null, gap: freeze({ type: 'embedded_speaker_unattributed', detail: 'this statement carries a quotation whose speaker is not read by the clause/SVO layer — the line is unowned, which is a result' }) }));
      continue;
    }
    // 4. PLAIN — the reading's own witnessed belief (perspective.js). A real
    //    holder, not an absence: the reader holds it on its own behalf.
    out.set(st.id, freeze({ holder: READER, depth: 0, via: freeze([]), basis: BASIS.WITNESSED, gap: null }));
  }
  return out;
}

/** Roll a statement list's heldBy records into the surface's summary: which
 *  holders were found, the typed gaps, and the admitted names that are spoken
 *  of but never speak (the latent cast — their point of view is not included). */
export function summarizeHolders(sts, names = {}) {
  const holders = new Map();
  const gaps = new Map();
  const speakerNames = new Set();
  for (const st of sts || []) {
    const h = st.heldBy;
    if (!h) { gaps.set('no_record', (gaps.get('no_record') || 0) + 1); continue; }
    if (h.holder) {
      holders.set(h.holder, (holders.get(h.holder) || 0) + 1);
      if (h.basis === BASIS.ASSERTED) speakerNames.add(h.holder);
    } else if (h.gap) {
      gaps.set(h.gap.type, (gaps.get(h.gap.type) || 0) + 1);
    }
  }
  const silent = Object.keys(names || {}).filter((n) => !speakerNames.has(n)).sort();
  return freeze({
    schema: 'EOHoldersSummary@1',
    statements: (sts || []).length,
    holders: freeze([...holders.entries()].sort((a, b) => b[1] - a[1]).map(([holder, n]) => freeze({ holder, statements: n }))),
    gaps: freeze([...gaps.entries()].sort((a, b) => b[1] - a[1]).map(([type, n]) => freeze({ type, statements: n }))),
    silent,
  });
}
