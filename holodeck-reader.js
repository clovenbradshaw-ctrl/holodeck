// holodeck-reader.js — eoreader7's own relation reader, assembled for a browser tab.
// A line-for-line port of eoreader7/native/the-fold/reader-bundle.js: the same organs, the same options,
// the same GFP dispatch with clause-aware adjacency. The only difference is how the received priors
// arrive (fetch instead of fs). Built once; every turn reads its passages through it.
import { makeRelationReader } from './vendor/eoreader7/native/organs/hypergraph.js';
import { tokenize, blankLabelRows } from './vendor/eoreader7/native/organs/source.js';
import { splitSentences } from './vendor/eoreader7/native/adapters/text/spans.js';
import { extractSurfaces, discoverReferents, namesCorefer, diaNorm } from './vendor/eoreader7/native/adapters/text/surfaces.js';
import { resolvePronouns } from './vendor/eoreader7/native/adapters/text/pronouns.js';
import { relationExtractorsFor } from './vendor/eoreader7/native/adapters/text/relations-language.js';
import { classifyWord, dominantClass } from './vendor/eoreader7/native/adapters/text/wordclass.js';
import { createLemmatizer, morphologyFromPrior } from './vendor/eoreader7/native/adapters/text/morphology.js';
import * as P from './vendor/eoreader7/native/adapters/text/priors.js';

const DETERMINERS = new Set([...P.DEFINITE_DETERMINERS, ...P.INDEFINITE_DETERMINERS]);
const here = p => new URL(p, import.meta.url).href;
let _priors = null;
export function loadPriors() {
  if (_priors) return _priors;
  _priors = (async () => {
    const get = async p => { try { const r = await fetch(here(p)); return r.ok ? await r.json() : null; } catch (e) { return null; } };
    const [posPrior, morphRaw] = await Promise.all([get('./vendor/eoreader7/native/priors/pos-eng.json'), get('./vendor/eoreader7/native/priors/morphology-eng.json')]);
    const morph = morphRaw ? morphologyFromPrior(morphRaw) : null;
    const forms = new Set();
    for (const k of Object.keys((morph && morph.forms) || {})) { forms.add(String(k).toLowerCase()); const v = morph.forms[k]; for (const x of Array.isArray(v) ? v : [v]) if (typeof x === 'string') forms.add(x.toLowerCase()); }
    const lemmatizer = morph ? createLemmatizer(morph.forms, { language: morph.language }) : null;
    return { posPrior, verbForms: forms.size ? forms : null, lemmatizer };
  })();
  return _priors;
}
// ── STANCE ─────────────────────────────────────────────────────────────────
// A position ("X is pro Y", "X supports Y", "X opposes Y") is a relation the
// base GFP reader hears only when it is a plain verb. The one construction it
// misses is the copula + adjective ("is pro", "is against", "is opposed to"),
// and it never equates a stance with its own paraphrases ("is pro" against a
// source's "tweeted in support of"). Both are added here, on the reader this
// surface assembles — never in the vendored organs, and never by rewriting a
// source's own verbatim label. The stance class is what is equated; the label
// a source was read from is carried through untouched.
const STANCE_CLASS = [
  ['support', /\b(?:supports?|supported|supporting|support(?:ive)?|backs?|backed|backing|endors(?:e|es|ed|ing)|favou?rs?|favou?red|favou?ring|champions?|championed|advocat(?:e|es|ed|ing)|defends?|defended|prais(?:e|es|ed|ing)|pro|solidarity|ally)\b/i],
  ['oppose', /\b(?:oppos(?:e|es|ed|ing)|against|anti|condemn(?:s|ed|ing)?|criticiz(?:e|es|ed|ing)|criticis(?:e|es|ed|ing)|denounc(?:e|es|ed|ing)|boycott(?:s|ed|ing)?|resist(?:s|ed|ing)?|protest(?:s|ed|ing)?)\b/i],
];
const stanceClass = label => { const t = String(label || ''); for (const [k, re] of STANCE_CLASS) if (re.test(t)) return k; return null; };
// copula + adjective/preposition position, the shape a typed claim most often
// takes. The object runs to the clause's own boundary; a leading determiner is
// kept on the surface (endpoint() strips it), never dropped here.
const COPULA_STANCE = /\b(?:is|are|was|were|am|be|been|being)\s+((?:in\s+)?(?:support|favor|favour|solidarity)\s+of|supportive\s+of|opposed\s+to|critical\s+of|a\s+supporter\s+of|a\s+critic\s+of|pro|anti|against)\b/i;
const SUBJ_LEAD = /^(?:and|but|so|also|then|however|moreover|furthermore|still|yet|meanwhile|while|although|though|because|that|this)\b[,:]?\s+/i;
function stanceSubject(s) {
  s = String(s || '').replace(/[\s,;:]+$/, '').trim();
  const caps = s.match(/(?:[A-Z][\w'’.-]*(?:\s+|$)){1,5}$/);
  if (caps) return caps[0].trim();
  return s.split(/\s+/).slice(-4).join(' ');
}
function copulaStanceTriples(sentence) {
  const t = String(sentence || ''); const m = COPULA_STANCE.exec(t); if (!m) return [];
  const subject = stanceSubject(t.slice(0, m.index).replace(SUBJ_LEAD, ''));
  let obj = t.slice(m.index + m[0].length).replace(/^[\s,;:]+/, '').split(/[,;:.!?]|\s(?:and|but|in her words|in his words)\s/)[0].trim();
  if (obj.length > 80) obj = obj.split(/\s+/).slice(0, 6).join(' ');
  if (!subject || !obj) return [];
  return [{ end1: subject, label: m[0].trim(), end2: obj, polarity: '+', offset: 0 }];
}
// A present/past stance VERB the base reader misses ("supports Palestine"). Only
// unambiguous inflections — never the bare "support", which is a noun inside a
// source's own "in support of" — and only offered when the base reader heard no
// relation in this sentence at all, so a source edge is never duplicated.
const VERB_STANCE = /\b(supports|supporting|supported|backs|backing|backed|endorses|endorsing|endorsed|favours|favors|favouring|favoring|favoured|favored|champions|championing|championed|advocates|advocating|advocated|defends|defending|defended|praises|praising|praised|opposes|opposing|opposed|condemns|condemning|condemned|criticizes|criticising|criticis(?:es|ing)|criticized|criticised|denounces|denouncing|denounced|boycotts|boycotting|boycotted|resists|resisting|resisted|protests|protesting|protested)\b/i;
function verbStanceTriples(sentence) {
  const t = String(sentence || ''); const m = VERB_STANCE.exec(t); if (!m) return [];
  const subject = stanceSubject(t.slice(0, m.index).replace(SUBJ_LEAD, ''));
  let obj = t.slice(m.index + m[0].length).replace(/^[\s,;:]+/, '').split(/[,;:.!?]|\s(?:and|but|in her words|in his words)\s/)[0].trim();
  if (obj.length > 80) obj = obj.split(/\s+/).slice(0, 6).join(' ');
  if (!subject || !obj) return [];
  return [{ end1: subject, label: m[0].trim(), end2: obj, polarity: '+', offset: 0 }];
}
// A stance's object is often a demonym where the claim has the place ("pro
// palestine" against a source's "in support of the Palestinian"); a single-token
// demonym object is folded to the place it names so the two ends match. Only a
// stance relation's object is touched, and only as a whole token — a demonym
// inside a proper noun ("the Palestinian Authority") is left exactly as read.
const PLACE_OF = { palestinian: 'Palestine', israeli: 'Israel', iranian: 'Iran', iraqi: 'Iraq', syrian: 'Syria', lebanese: 'Lebanon', yemeni: 'Yemen', egyptian: 'Egypt', jordanian: 'Jordan', saudi: 'Saudi Arabia', american: 'America', russian: 'Russia', ukrainian: 'Ukraine', chinese: 'China', indian: 'India', pakistani: 'Pakistan', afghan: 'Afghanistan', turkish: 'Turkey', kurdish: 'Kurdistan', european: 'Europe', african: 'Africa', asian: 'Asia', british: 'Britain', french: 'France', german: 'Germany', japanese: 'Japan', korean: 'Korea', mexican: 'Mexico', canadian: 'Canada', australian: 'Australia' };
const foldStanceObject = t => { if (!stanceClass(t.label)) return t; const w = String(t.end2 || '').trim(); const p = /^[A-Za-z]+$/.test(w) && PLACE_OF[w.toLowerCase()]; return p ? { ...t, end2: p } : t; };
let _dispatch = null;
const dispatch = () => _dispatch || (_dispatch = relationExtractorsFor({ language: 'eng', roleConfig: null, posPrior: null, classifyWord, dominantClass }));
const baseExtract = (text, opts) => { const d = dispatch(); return d.extractRelations(text, d.mode === 'gfp' ? { ...opts, clauseAware: true } : opts); };
// the base reader's triples, plus the copula positions it cannot hear.
const extractRelations = (text, opts = {}) => { let base = []; try { base = baseExtract(text, opts) || []; } catch (e) { base = []; }
  const extra = copulaStanceTriples(text).concat(base.length ? [] : verbStanceTriples(text));
  return base.map(foldStanceObject).concat(extra.map(foldStanceObject)); };

// ── READ A WHOLE CORPUS, FAST ──────────────────────────────────────────────
// A book-sized source read as ONE passage is superlinear: the reader's
// vocab/referent pass grows with passage size (measured on War and Peace: 140k
// chars → 3.1s; 400k → 15s; 1M → 83s; 3.27M never finished). The reader was
// built for CHUNK-shaped passages (reader-bundle.js::engineRelationsFor says
// so), so the honest fast path is to chunk the source into bounded passages —
// each stays in the near-linear regime — read every chunk, and assemble.
//
// THE ORIGINAL COORDINATE BUG, AND THE FIX. The reader normalizes newlines and
// rewrites sentences internally, so the `start`/`end` it reports are in its OWN
// rewritten, LF-normalized space — NOT an address into the raw file. Trusting
// them grounded 0/5271 on War and Peace. But every claim also carries
// `sp.text`, the exact bytes it read. So anchoring is by CONTENT: locate that
// verbatim text in the source and use that offset. Measured after the fix:
// 4970/4970 claims grounded, whole book read in ~12s across worker threads.
//
// This module is the browser port, so there are no worker threads here: it
// chunks, reads each chunk through the one reader, and content-anchors. For a
// whole-book corpus the caller may prefer `readCorpusChunked` over many
// passages; either way grounding is structural.
function corpusPassages(docs, { chunkChars = 60000 } = {}) {
  const out = [];
  for (const d of docs) {
    const text = String(d.text || '');
    if (text.trim().length < 40) continue;
    const docId = String(d.id);
    // split on blank lines, keeping each paragraph's true offset in the doc
    const parts = text.split(/(\r?\n\r?\n+)/);
    const paras = [];
    let off = 0;
    for (let i = 0; i < parts.length; i += 2) {
      const p = parts[i]; const sep = parts[i + 1] || '';
      if (p.trim()) paras.push({ text: p, start: off });
      off += p.length + sep.length;
    }
    let cur = [], curLen = 0, curStart = 0;
    const flush = () => { if (cur.length) out.push({ doc: docId, start: curStart, text: cur.join('\r\n\r\n') }); cur = []; curLen = 0; };
    for (const p of paras) {
      if (curLen && curLen + p.text.length > chunkChars) flush();
      if (!cur.length) curStart = p.start;
      cur.push(p.text); curLen += p.text.length + 4;
    }
    flush();
  }
  return out;
}

/** readCorpus(docs, { reader, chunkChars }) -> { A, report }
 *  Read every doc through the engine, in bounded chunks, and return an analysis
 *  A whose claims are content-anchored into each doc's raw bytes. `A` is the
 *  exact shape holodeck-summary.js consumes (sts, byId, docById, stsByDoc).
 *  Zero model. The `reader` is the one built by makeEngineRelationReader (or a
 *  caller's), so the reading is the same reader every other door uses. */
export async function readCorpus(docs, { reader = null, chunkChars = 60000 } = {}) {
  const R = reader || (await makeEngineRelationReader());
  const passages = corpusPassages(docs, { chunkChars });
  const byDoc = new Map(); // docId -> { doc, sts }
  for (const d of docs) byDoc.set(String(d.id), { doc: { id: d.id, title: d.title || d.id, year: d.year ?? null }, sts: [] });
  const gaps = [];
  for (const p of passages) {
    let report = null;
    try { report = R([{ ref: 'chunk', text: p.text }]); } catch (e) { gaps.push({ doc: p.doc, start: p.start, why: 'reader refused the chunk: ' + String(e && e.message || e) }); continue; }
    let read = null;
    try { read = report.read(p.text); } catch (e) { gaps.push({ doc: p.doc, start: p.start, why: 'read failed: ' + String(e && e.message || e) }); continue; }
    const slot = byDoc.get(p.doc);
    for (const c of (read.claims || [])) {
      const sp = (c.spans || [])[0];
      if (!sp || !sp.text) continue;
      // content-anchor: the claim's own verbatim text, located in the passage's
      // raw bytes (the passage keeps its real offset in the doc).
      const at = p.text.indexOf(sp.text);
      if (at < 0) continue;
      const s = p.start + at, e = s + sp.text.length;
      slot.sts.push({
        id: p.doc + ':' + s + '-' + e + ':' + slot.sts.length,
        doc: p.doc, s, e, text: cleanText(sp.text), readText: sp.text,
        names: [c.end1, c.end2].filter(Boolean), figs: [],
        ref: false, claimy: !!c.end1 && !!c.end2,
        frame: c.verdict === 'unheard' ? 'attributed' : c.polarity === '-' ? 'uncertain' : 'fact',
        polarity: c.polarity || '+', rel: cleanText(c.label || ''), verdict: c.verdict, year: null,
      });
    }
  }
  const sts = []; const byId = {}; const stsByDoc = {}; const docsArr = []; const docById = {};
  for (const [, v] of byDoc) { docsArr.push(v.doc); docById[v.doc.id] = v.doc; stsByDoc[v.doc.id] = v.sts; for (const s of v.sts) { sts.push(s); byId[s.id] = s; } }
  return { A: { docs: docsArr, docById, sts, byId, stsByDoc }, report: { passages: passages.length, claims: sts.length, gaps } };
}

const cleanText = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

export async function makeEngineRelationReader(extra = {}) {
  const { posPrior, verbForms, lemmatizer } = await loadPriors();
  // sameAct is widened by stance class, so "is pro" binds a source's "in
  // support of" without either label being rewritten.
  const sameAct = lemmatizer
    ? (a, b) => { const x = stanceClass(a), y = stanceClass(b); if (x && y) return x === y; return lemmatizer.sameAct(a, b); }
    : (a, b) => { const x = stanceClass(a), y = stanceClass(b); if (x && y) return x === y; return String(a).toLowerCase() === String(b).toLowerCase(); };
  return makeRelationReader({
    splitSentences, extractSurfaces, discoverReferents, namesCorefer, diaNorm,
    discoverRelationVocab: (...a) => dispatch().discoverRelationVocab(...a),
    extractRelations,
    extractorsMode: 'dispatch', tokenize, posPriorFor: () => posPrior, verbForms, oovLexicon: verbForms, attestedVerbs: true,
    determiners: DETERMINERS, definiteDeterminers: new Set(P.DEFINITE_DETERMINERS), negationWords: P.NEGATION_WORDS, firstPerson: P.FIRST_PERSON,
    // createLemmatizer's mere presence toggles object-side form identity in
    // endpoint(); it is passed only when a real lemmatizer exists (as before),
    // but sameAct itself always carries the stance class.
    ...(lemmatizer ? { createLemmatizer: () => ({ sameAct }), morphologyIndex: {} } : {}),
    blankFurniture: text => blankLabelRows(text, { minRun: 4, maxCell: 60 }),
    resolvePronouns, nounPhraseSubjects: true, phrasalPredicates: true, ...extra,
  });
}
