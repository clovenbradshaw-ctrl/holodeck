// holodeck-ask.js — The Fold, inside Holodeck. A conversation over this workspace's own sources, answered by a
// model in this tab (WebLLM on WebGPU, Gemma 2 2B by default; Ollama on localhost if it is running) and held to
// The Fold's rules: retrieval is mechanical, the model is never shown an address or asked to cite, every sentence
// is attributed afterwards by what it shares with a passage, figures and names are checked against the bytes, and
// each turn folds to a one-line paraphrase (System 1) and an addressed record (System 2). What is sent on turn
// 400 is the summary, the records, and the last exchanges — never the transcript. Whatever the model is, it only
// ever rides in as the mouth of this full pipeline — it never runs outside it.
import * as FOLD from './vendor/the-fold/fold.js';
import { chunkSource, retrieve, buildSourceBlock, openQuestions, readRange, tokenize, foldDiacritics } from './vendor/eoreader7/native/organs/source.js';
import { meetingBoundaries } from './vendor/eoreader7/native/organs/speaker.js';
import { buildFactBlock, dedupeSourceText } from './vendor/eoreader7/native/organs/fact-block.js';
import { makeEngineRelationReader, readCorpus } from './holodeck-reader.js';
let _reader = null; const reader = () => _reader || (_reader = makeEngineRelationReader());
import { ladder, conclusionOf, stanceOf, select } from './holodeck-summary.js';
import { coverage, stripSelfCitations } from './vendor/eoreader7/native/organs/cite.js';
import { checkGrounding, unsupportedClaims } from './vendor/eoreader7/native/organs/grounding.js';
export { FOLD, retrieve };

export const WEBLLM_MODELS = [
  { id: 'gemma-2-2b-it-q4f16_1-MLC', label: 'Gemma 2 2B · in this tab', size: '1.4 GB' },
  { id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC', label: 'SmolLM2 1.7B · in this tab', size: '1.0 GB' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 1.5B · in this tab', size: '1.1 GB' },
  // DeepSeek is NOT offered in-tab: every DeepSeek build WebLLM prebuilds is an R1-Distill reasoning model
  // (it thinks first, then answers), and the fold wants the answer only, with the pipeline doing the reasoning.
  // Over a full token budget an R1 model will burn the whole thing thinking at a trivial prompt and never reach
  // the answer. DeepSeek's non-reasoning option is the MoE (Coder-V2-Lite / V2-Lite, 16B total, 2.4B active) —
  // run it via Ollama, where it flows through this same full pipeline and is listed automatically.
];
// Reasoning/thinking models are kept out of the roster: the fold does the reasoning itself, and a reasoner
// over-thinks simple prompts — it loops and can spend the whole token budget before it ever answers. Neither
// lane exposes a capability flag, so this is name-based; it covers the models people actually pull (deepseek-r1,
// qwq, qwen3 which thinks by default, the *-reasoning/thinker family), and is applied to both lanes.
const THINKING_RE = /(^|[^a-z0-9])(deepseek[-_]?r1|qwq|qwen3(?![-_]?coder)|reasoning|openthinker|smallthinker|exaone[-_]?deep|magistral|marco[-_]?o1|skywork[-_]?o1)([^a-z0-9]|$)/i;
export function isThinkingModel(name) { return THINKING_RE.test(String(name || '')); }
export const DEFAULT_MODEL = 'webllm:gemma-2-2b-it-q4f16_1-MLC';
export function webgpu() { return typeof navigator !== 'undefined' && !!navigator.gpu; }
let _wl = null, _wlId = null, _wlP = null;
// The engine downloads the weights once (the browser caches them), then runs them on this machine's GPU. Nothing leaves the tab.
export async function loadWebLLM(id, onProgress) {
  if (_wl && _wlId === id) return _wl;
  if (_wlP && _wlId === id) return _wlP;
  if (_wl && _wlId !== id) { try { await _wl.unload(); } catch (e) {} _wl = null; }
  _wlId = id;
  _wlP = (async () => { const W = await import('https://esm.run/@mlc-ai/web-llm'); const e = await W.CreateMLCEngine(id, { initProgressCallback: p => onProgress && onProgress(p) }); _wl = e; return e; })();
  try { return await _wlP; } catch (e) { _wlP = null; _wlId = null; throw e; }
}
export function webllmLoaded(id) { return !!_wl && _wlId === id; }
async function chatWebLLM(id, messages, { onToken, format, maxTokens, signal } = {}) {
  const eng = await loadWebLLM(id);
  // Gemma's chat template has no system turn: the system block rides at the head of the first user message instead.
  let msgs = messages;
  if (/gemma/i.test(id)) { const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n'); msgs = messages.filter(m => m.role !== 'system').map(m => ({ ...m })); const u = msgs.find(m => m.role === 'user'); if (sys && u) u.content = sys + '\n\n' + u.content; }
  const req = { messages: msgs, temperature: 0.2, ...(maxTokens ? { max_tokens: maxTokens } : {}) };
  if (format) req.response_format = { type: 'json_object', schema: JSON.stringify(format) };
  const onAbort = () => { try { eng.interruptGenerate(); } catch (e) {} };
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
  try {
    if (!onToken) { const r = await eng.chat.completions.create({ ...req, stream: false }); return { text: (r.choices[0] && r.choices[0].message.content) || '', stats: { eval_count: r.usage && r.usage.completion_tokens, prompt_eval_count: r.usage && r.usage.prompt_tokens } }; }
    const it = await eng.chat.completions.create({ ...req, stream: true, stream_options: { include_usage: true } }); let out = '', usage = null, t0 = performance.now();
    for await (const ch of it) { const d = ch.choices && ch.choices[0] && ch.choices[0].delta && ch.choices[0].delta.content; if (d) { out += d; onToken(out); } if (ch.usage) usage = ch.usage; }
    if (signal && signal.aborted) throw new Error('aborted');
    return { text: out, stats: { eval_count: usage && usage.completion_tokens, prompt_eval_count: usage && usage.prompt_tokens, total_duration: (performance.now() - t0) * 1e6 } };
  } finally { if (signal) signal.removeEventListener('abort', onAbort); }
}
export const OLLAMA = 'http://localhost:11434';
export const BASE_PROMPT = 'You are helping a reporter read the documents in their workspace: audits, meeting transcripts, reports, pages and records. Answer the question in plain prose. Where the passages below cover it, answer from them. Where they do not, say what is missing instead of filling it in.';
// Plain conversation — no material, or small talk that is not a research
// question at all. Never mentions reporters, documents, passages, or the
// workspace unless the person asked about them. A greeting gets a greeting,
// not a request for passages.
export const CHAT_PROMPT = 'You are a helpful conversational assistant. Reply directly, briefly, and naturally, the way a person would. Do not mention reporters, documents, passages, sources, or a workspace unless the person asked about them. If they just say hi or ask how you are, answer in kind and offer to help — never ask them to provide passages.';
const SMALLTALK_RE = /^(hi|hey|hello|yo|sup|good\s?(morning|afternoon|evening)|how are you|how's it going|how is it going|thanks|thank you|bye|goodbye|good night|see you)\b/i;
export function isSmallTalk(question) {
  const q = String(question ?? '').trim();
  return q.length > 0 && q.length < 60 && SMALLTALK_RE.test(q);
}

export async function probe(base = OLLAMA) {
  try {
    const r = await fetch(base + '/api/tags', { cache: 'no-store' });
    if (!r.ok) return { ok: false, why: 'Ollama answered ' + r.status };
    const j = await r.json(); const models = (j.models || []).map(m => ({ name: m.name, size: m.size, family: m.details && m.details.family, params: m.details && m.details.parameter_size }));
    return { ok: true, models };
  } catch (e) { return { ok: false, why: String(e && e.message || e) }; }
}

// Passages: every kept source, chunked by the engine's own boundaries (blank lines, tabular rows), addressed by byte range.
export function index(docs) {
  const t0 = Date.now(); const chunks = []; const texts = {}; const docOf = {}; const used = new Map();
  for (const d of docs) { const text = d.text || ''; if (text.length < 40) continue;
    let name = String(d.title || d.id).replace(/#/g, '').slice(0, 90); const k = used.get(name) || 0; used.set(name, k + 1); if (k) name += ' (' + (k + 1) + ')';
    texts[name] = text; docOf[name] = d.id;
    let boundaries;
    try { const turns = meetingBoundaries(text); if (turns.length >= 3) boundaries = turns.map((t, i) => ({ start: t.start, end: i + 1 < turns.length ? turns[i + 1].start : text.length, label: t.speaker || null })).filter(b => b.end > b.start); } catch (e) {}
    try { for (const c of chunkSource(name, text, boundaries ? { boundaries } : {})) chunks.push(c); } catch (e) { try { for (const c of chunkSource(name, text)) chunks.push(c); } catch (e2) {} } }
  return { chunks, texts, docOf, ms: Date.now() - t0 };
}

async function chat(base, model, messages, opts = {}) {
  if (String(model).startsWith('webllm:')) return chatWebLLM(String(model).slice(7), messages, opts);
  const { onToken, format, maxTokens, signal } = opts;
  const body = { model, messages, stream: !!onToken, keep_alive: '3600s', options: { num_ctx: 4096, temperature: 0.2, ...(maxTokens ? { num_predict: maxTokens } : {}) } };
  if (format) body.format = format;
  const r = await fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!r.ok) throw new Error('Ollama ' + r.status + ': ' + (await r.text()).slice(0, 200));
  if (!onToken) { const j = await r.json(); return { text: (j.message && j.message.content) || '', stats: j }; }
  const rd = r.body.getReader(); const dec = new TextDecoder(); let buf = '', out = '', stats = null;
  for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
      let j; try { j = JSON.parse(line); } catch (e) { continue; }
      if (j.message && j.message.content) { out += j.message.content; onToken(out); }
      if (j.done) stats = j; } }
  return { text: out, stats };
}

// One turn. `conv` = { summary, history, turns }. `computed` is an optional block of values computed from the
// Records database (never asked of the model); it rides into the prompt as material and onto the record.
export async function turn(conv, IX, question, { base = OLLAMA, model = DEFAULT_MODEL, computed = null, reading = null, retrievalQ = null, resolved = null, ctx = 4096, onToken, onStage, signal, deferFold = false, onFold = null, docs = null, summarize = true } = {}) {
  const t0 = Date.now(); const turnNo = (conv.summary.turnCount || 0) + 1;
  const folded = conv.summary.records.flatMap(r => r.refs || []);
  onStage && onStage('retrieving');
  const qTerms = [...new Set(tokenize(retrievalQ || question))];
  const ranked = retrieve(IX.chunks, retrievalQ || question, 8, folded).map(c => narrow(c, qTerms));
  const history = conv.history.slice(-2).map(m => ({ ...m, content: m.content.length > 1200 ? m.content.slice(0, 1200) + '…' : m.content }));
  // THE SURF AND FOLD (eoreader7 / the-fold holon.js): the passages are read by the engine's own relation reader,
  // and what the model receives is that reading as defeasible NOTES plus only the byte-addressed spans that bound
  // each note — never the retrieved chunks themselves. A passage no note came from is withheld, and if nothing
  // bound at all, the model is told so in plain words instead of being handed raw text to fill from memory.
  onStage && onStage('reading');
  let relations = null, factBlock = null;
  try { const R = await reader(); relations = R(ranked); factBlock = buildFactBlock(relations, ranked, question); } catch (e) { factBlock = null; }
  const spanBlock = factBlock && factBlock.spans && factBlock.spans.length ? factBlock.spans.map(sp => '"' + sp.text + '"').join('\n\n') : null;
  // Greetings and materialless small talk are never run under the reporter
  // prompt: with no passages in view that prompt's "say what is missing"
  // instruction makes the model answer "how are you" with a request for
  // passages. Plain conversation gets the plain prompt instead.
  // THE GROUNDED SUMMARY, for the turn. When the caller hands the workspace's
  // docs (or nothing, but the index was built from them), fold the source at a
  // point and hand the model the source's OWN selected sentences — never a
  // paraphrase. This is zero model and instantaneous on the chunked reader.
  let synopsis = null;
  if (summarize) {
    try {
      const src = docs || IX.docs || null;
      if (src && src.length) { onStage && onStage('summarizing'); synopsis = await sourceSummary(src, { question, reader: await reader() }); }
    } catch (e) { synopsis = null; }
  }
  let offered = ranked.slice();
  const hasMaterial = offered.length > 0 || !!((computed && computed.text) || (reading && reading.text) || (synopsis && synopsis.text));
  const chatMode = isSmallTalk(question) || !hasMaterial;
  const activePrompt = chatMode ? CHAT_PROMPT : BASE_PROMPT;
  const build = (off, facts) => {
    const raw = facts && !facts.empty ? spanBlock : buildSourceBlock(dedupeSourceText(off, relations));
    let sb = [facts ? facts.text : null, raw].filter(Boolean).join('\n\n');
    // the source summarized from its own sentences, grounded, at the top so
    // the model reads the material's own turns before the passages
    if (synopsis && synopsis.text) sb = (sb ? sb + '\n\n' : '') + 'The source summarized from its own sentences (verbatim, no paraphrase):\n' + synopsis.text;
    if (reading && reading.text) sb = (sb ? sb + '\n\n' : '') + 'What the reader established about the names asked about:\n' + reading.text;
    if (computed && computed.text) sb = (sb ? sb + '\n\n' : '') + 'Counted from the workspace records:\n' + computed.text;
    return FOLD.buildTurnMessages({ basePrompt: activePrompt, summary: conv.summary, history, question, sourceBlock: sb }); };
  let messages = build(offered, factBlock);
  while (offered.length > 1 && approxTokens(messages) > ctx - 760) { offered = offered.slice(0, -1); messages = build(offered, factBlock); }
  if (approxTokens(messages) > ctx - 760 && factBlock && factBlock.lines) { const fb = { ...factBlock, text: factBlock.text.split('\n').slice(0, 14).join('\n') }; messages = build(offered.slice(0, 2).map(c => ({ ...c, text: c.text.slice(0, 500) })), fb); }
  const notes = factBlock ? { lines: factBlock.lines || [], coverage: factBlock.coverage || 0, empty: !!factBlock.empty, omitted: factBlock.omitted || 0, spans: (factBlock.spans || []).length, sentences: factBlock.sentenceCount || 0 } : null;
  const sentChars = FOLD.charCount(messages);
  const transcriptChars = conv.history.reduce((n, m) => n + (m.content || '').length, 0) + question.length;
  onStage && onStage('answering');
  const res = await chat(base, model, messages, { onToken, signal, maxTokens: 700 });
  const answer = stripSelfCitations(res.text).text;
  onStage && onStage('checking');
  const attr = offered.length ? coverage(answer, offered, IX.chunks) : [];
  const castSet = new Set(((reading && reading.surfaces) || []).map(x => foldDiacritics(String(x).toLowerCase())));
  const resolveName = castSet.size ? n => castSet.has(foldDiacritics(String(n).toLowerCase())) : null;
  const grounding = checkGrounding(answer, offered, { question, resolveName });
  const unsupported = unsupportedClaims(grounding);
  const used = [...new Set(attr.map(a => a.ref).filter(Boolean))];
  const open = openQuestions(question, offered, used);
  const channels = [synopsis && synopsis.text ? 'summary' : null, notes && !notes.empty ? 'notes' : null, offered.length ? 'material' : null, reading ? 'reading' : null, computed && computed.text ? 'records' : null, 'model'].filter(Boolean);
  const record = FOLD.buildWarrantRecord({ turn: turnNo, plane: 'world', gist: FOLD.mechanicalFoldLine(question, answer), channels, refs: used, unsupported, open });
  const withRecord = FOLD.addWarrantRecord(conv.summary, record);
  const foldLine = FOLD.mechanicalFoldLine(question, answer);
  // The turn is recorded the moment its answer and addressed record exist. The summary refresh (System 2's
  // discourse fold) is a SECOND model call, and it is never allowed to hold up the record or the next message:
  // when deferred it runs after this returns, and the caller folds its result back in when it lands.
  const refreshSummary = async (from, sig) => {
    try {
      const up = FOLD.buildSummaryUpdatePrompt(from, [...(from.folds || []), foldLine]);
      const r2 = await chat(base, model, [{ role: 'system', content: FOLD.FOLD_SYSTEM_PROMPT }, { role: 'user', content: up }], { format: FOLD.FOLD_SCHEMA, maxTokens: 300, signal: sig });
      const next = FOLD.updateSummaryWithFold(from, foldLine, r2.text);
      const w = FOLD.extractSummaryFindings(from.entities, next.entities, { records: FOLD.projectRecords(next), folds: next.folds });
      if (w.ok) return { summary: next, refresh: { ok: true } };
      return { summary: FOLD.advanceSummaryFold(from, foldLine), refresh: { ok: false, why: w.findings.map(f => f.detail).join('; ') } };
    } catch (e) { return { summary: FOLD.advanceSummaryFold(from, foldLine), refresh: { ok: false, why: sig && sig.aborted ? '' : String(e.message || e) }, aborted: !!(sig && sig.aborted) }; }
  };
  // Advance immediately so the turn number and the fold list are right for the next turn whether or not the
  // refresh ever lands; the refresh only refines the discourse fields on top of this same base.
  let summary = FOLD.advanceSummaryFold(withRecord, foldLine);
  let refresh = { ok: false, why: '', pending: !!deferFold };
  let fold = null;
  if (deferFold) {
    const foldAc = new AbortController();
    const onOuterAbort = () => { try { foldAc.abort(); } catch (e) {} };
    if (signal) signal.addEventListener('abort', onOuterAbort, { once: true });
    fold = { abort: () => { try { foldAc.abort(); } catch (e) {} }, promise: refreshSummary(withRecord, foldAc.signal).then(f => { if (signal) signal.removeEventListener('abort', onOuterAbort); if (onFold && !f.aborted) { try { onFold(f.summary, f.refresh); } catch (e) {} } return f; }) };
  } else {
    onStage && onStage('folding');
    const f = await refreshSummary(withRecord, signal); summary = f.summary; refresh = f.refresh;
  }
  const t = { n: turnNo, question, answer, used: used.map(ref => ({ ref, text: String(readRange(IX.texts, ref) || '').trim().slice(0, 700) })), offered: offered.map(c => ({ ref: c.ref, source: c.source, start: c.start, end: c.end, label: c.label, text: c.text.slice(0, 700) })),
    attr: attr.map(a => ({ text: a.text, ref: a.ref || null, via: a.via || null })), findings: (grounding.findings || []).map(f => ({ text: f.text, kind: f.atomKind, start: f.start, end: f.end, echoesQuestion: !!f.echoesQuestion })),
    examined: !!grounding.examined, record, foldLine, refresh, computed, synopsis, reading: reading ? { lines: reading.lines } : null, notes, resolved: resolved && resolved.length ? resolved : null, sentChars, transcriptChars, messages, model, ms: Date.now() - t0,
    tokens: res.stats ? { out: res.stats.eval_count, in: res.stats.prompt_eval_count, secs: res.stats.total_duration ? res.stats.total_duration / 1e9 : null } : null };
  return { conv: { summary, history: [...conv.history, { role: 'user', content: question }, { role: 'assistant', content: answer }], turns: [...conv.turns, t] }, turn: t, fold };
}

// A passage too long for a small model's window is narrowed to the stretch where the question's own words are
// densest. The window is a real byte range of the same source, so it keeps an address that reads back.
const WIN = 1400;
function narrow(c, qTerms) {
  if (c.text.length <= WIN) return c;
  const low = c.text.toLowerCase(); const hits = [];
  for (const t of qTerms) { let i = -1; while ((i = low.indexOf(t, i + 1)) >= 0 && hits.length < 400) hits.push(i); }
  hits.sort((a, b) => a - b); let best = 0, bestN = -1;
  for (let i = 0, j = 0; i < hits.length; i++) { while (hits[i] - hits[j] > WIN) j++; if (i - j > bestN) { bestN = i - j; best = hits[j]; } }
  let a = Math.max(0, best - 200); const nl = c.text.lastIndexOf('. ', a); if (nl > a - 300 && nl >= 0) a = nl + 2;
  const b = Math.min(c.text.length, a + WIN); const off = c.text.indexOf(c.text.slice(0, 40)); const baseStart = c.start + (off > 0 ? off : 0);
  const text = c.text.slice(a, b); const start = baseStart + a, end = start + text.length;
  return { ...c, start, end, text, ref: c.source + '#' + start + '-' + end, terms: new Set(tokenize(text)), narrowed: true };
}
const approxTokens = msgs => Math.ceil(msgs.reduce((n, m) => n + (m.content || '').length, 0) / 3.2);

// What eoreader7's own reading of the corpus says about the names a question uses: the referent, how it is
// written, its standing, and who it is held together with. Read off the ground reading's index, never a model.
export function readingBlock(rix, question) {
  if (!rix || !Array.isArray(rix.cast)) return null;
  const q = ' ' + foldDiacritics(String(question).toLowerCase()).replace(/[^a-z0-9\s]/g, ' ') + ' ';
  const norm = x => foldDiacritics(String(x).toLowerCase()).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const hits = [];
  for (const c of rix.cast) { const surf = (c.surfaces || [c.id]).filter(Boolean); let hit = null;
    for (const x of surf) { const k = norm(x); if (k.length >= 4 && q.includes(' ' + k + ' ')) { hit = { c, m: x, k }; break; } }
    if (hit) hits.push(hit); }
  hits.sort((a, b) => b.k.length - a.k.length || (b.c.mentions || 0) - (a.c.mentions || 0));
  const seen = new Set(); const refs = []; const taken = [];
  for (const h of hits) {
    if (seen.has(h.c.id)) continue;
    if (taken.some(t => t.includes(h.k) || h.k.includes(t))) continue; // an overlapping fragment of an already-accepted match (compared on the same normalized form used to find it) -- same underlying phrase, not a distinct entity
    seen.add(h.c.id); taken.push(h.k); refs.push(h.c); if (refs.length >= 3) break;
  }
  if (!refs.length) return null;
  const lines = refs.map(c => { const surf = (c.surfaces || []).slice(0, 5); const nm = surf[0] || c.id;
    const bonds = (rix.bonds || []).filter(b => b.a === nm || b.b === nm).sort((a, b) => b.n - a.n).slice(0, 5).map(b => (b.a === nm ? b.b : b.a) + ' (' + b.n + ')');
    return { name: nm, text: nm + (surf.length > 1 ? ', also written ' + surf.slice(1).join(', ') : '') + '. Mentioned ' + (c.mentions || 0) + ' times across ' + (c.srcN || Object.keys(c.src || {}).length) + ' sources' + (c.standing ? '; standing: ' + c.standing : '') + '.' + (bonds.length ? ' Held together most often with ' + bonds.join(', ') + '.' : ''), surfaces: surf }; });
  return { lines, text: lines.map(l => l.text).join('\n'), surfaces: refs.flatMap(c => c.surfaces || []) };
}

// THE GROUNDED SUMMARY (holodeck-summary.js): the world folded at a point. A
// source at three sizes — one sentence, five, three paragraphs — is a CURATION
// of that source's OWN sentences, selected by the difference that makes a
// difference to the reader's identity and grounded by construction (every line
// is a verbatim span of the source). Zero model. This is what rides into the
// turn as a computed block so the model reads the source's own turns instead of
// being handed raw text to summarize from memory.
//
// The identity (`forWhom`) is the reader's held picture: when a question names a
// subject, the identity's conclusion is built from the material's own claims
// ABOUT that subject, so a claim that overturns it (a stance inversion, a new
// name/measure/frame) is the turn. Without a question the fold is at the empty
// point and selection falls back to holographical excess.
// A ladder is monotone only with at least four claims (the 1-sentence pick must
// be one of the 5, and the 5 are the 3 paragraphs); below that there is nothing
// to select between. Named, not a bare literal.
const MIN_CLAIMS_FOR_LADDER = 4;
// A question's named subject, read by the engine's own rule — a run of name-
// LETTERS in ANY cased script (\p{Lu}, Unicode; the same rule identity uses),
// never an English `[A-Z]`. A script with no case (Chinese, Arabic) offers no
// name here, and that is disclosed by the absence, never guessed.
const QNAME_RE = /(?:^|[\s(“"''])(\p{Lu}[\p{L}\p{M}'’.-]*(?:\s+\p{Lu}[\p{L}\p{M}'’.-]*)*)/gu;
function questionNames(question) {
  const out = []; for (const m of String(question || '').matchAll(QNAME_RE)) if (m[1]) out.push(m[1]);
  return [...new Set(out)];
}
// Identity fold: a name matches by the engine's own diacritic fold and a
// case-fold that is a NAMING CONVENTION, not identity (declared: this matches
// how the surface spells a name, not what the name means).
const nameFold = (x) => String(x == null ? '' : x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export async function sourceSummary(docs, { question = '', size = 5, reader: R = null } = {}) {
  let A;
  try { ({ A } = await readCorpus(docs, { reader: R })); } catch (e) { return null; }
  if (!A || !A.sts.length) return null;
  // per-doc ladders; for a single doc this is the whole source
  const docsOut = [];
  for (const d of A.docs) {
    const sts = A.stsByDoc[d.id] || [];
    if (sts.length < MIN_CLAIMS_FOR_LADDER) continue;
    let forWhom = null;
    const qNames = questionNames(question);
    if (qNames.length) {
      const qlower = qNames.map(nameFold);
      const about = sts.filter(st => (st.names || []).some(n => { const nn = nameFold(n); return qlower.some(q => nn.includes(q) || q.includes(nn)); }));
      if (about.length) forWhom = { conclusion: conclusionOf(about, A) };
    }
    let L;
    try { L = ladder(A, d.id, forWhom ? { forWhom } : {}); } catch (e) { continue; }
    docsOut.push({ id: d.id, title: d.title, n: sts.length, forWhom: !!forWhom, ladder: L });
  }
  if (!docsOut.length) return null;
  const lines = [];
  for (const d of docsOut) {
    lines.push(d.title + (d.forWhom ? ' (folded at the names in the question)' : '') + ':');
    lines.push('One sentence: ' + d.ladder.one.lines[0]);
    if (size >= 5) for (const l of d.ladder.five.lines) lines.push('· ' + l);
  }
  return { text: lines.join('\n'), docs: docsOut.map(d => ({ id: d.id, title: d.title, n: d.n, forWhom: d.forWhom, one: d.ladder.one.lines[0], five: d.ladder.five.lines, three: d.ladder.three.lines, spans: d.ladder.five.spans, monotone: d.ladder.monotone })) };
}

export function emptyConv() { return { summary: FOLD.emptySummary(), history: [], turns: [] }; }

// DataChat's plan → execute path, with the plan proposed by the local model. The plan's SHAPE is decoding grammar
// (a JSON schema handed to Ollama); DataChat's executor then validates every table and field against the live
// schema, so the model can only ever propose a read. Mirrors bare-metal's planWithLLM, pointed at Ollama.
const PLAN_SCHEMA = { type: 'object', properties: {
  intent: { type: 'string', enum: ['query', 'aggregate', 'profile', 'search'] }, type: { type: 'string' }, record: { type: 'string' },
  filters: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, op: { type: 'string', enum: ['eq', 'neq', 'contains', 'gt', 'gte', 'lt', 'lte', 'empty', 'notempty'] }, value: { type: 'string' } }, required: ['field', 'op', 'value'] } },
  agg: { type: 'object', properties: { fn: { type: 'string', enum: ['count', 'sum', 'avg', 'min', 'max'] }, field: { type: 'string' }, groupBy: { type: 'string' } } },
  sort: { type: 'object', properties: { field: { type: 'string' }, dir: { type: 'string', enum: ['asc', 'desc'] } } }, limit: { type: 'integer' } },
  required: ['intent', 'type', 'filters'] };
const PLAN_SYSTEM = 'You translate a question about a database into a query plan. Pick table and field names only from the schema given.';
export async function planQuery(DC, state, q, model = DEFAULT_MODEL, base = OLLAMA) {
  const user = DC.schemaPrompt(state, q) + '\n\nQuestion: ' + q;
  const r = await chat(base, model, [{ role: 'system', content: PLAN_SYSTEM }, { role: 'user', content: user }], { format: PLAN_SCHEMA, maxTokens: 220 });
  const plan = DC.parsePlanJSON(r.text); if (!plan) return null;
  if (plan.agg && plan.agg.fn && !plan.agg.agg) plan.agg.agg = plan.agg.fn;
  if (plan.type) plan.type = DC.matchType(state, ' ' + plan.type + ' ') || (DC.knownTypes(state).includes(plan.type) ? plan.type : null);
  return plan;
}
export function reopen(IX, ref) { return readRange(IX.texts, ref); }

// ---------- The notebook, folded in ----------
// A turn run in the Notebook is kept two ways at once, from the same conversation object: as a REAL .ipynb
// (nbformat 4.5 — each turn is a code cell whose output is the answer, with the whole fold record in the cell
// metadata) and as a plain log, which Holodeck adds to the workspace as a source, so the notebook's own
// activity can be read and asked about like any other document. Nothing here re-asks a model or invents an
// address: it only re-presents what turn() already computed.
const oneLine = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const nbLines = s => { const a = String(s == null ? '' : s).split('\n'); return a.map((x, i) => i < a.length - 1 ? x + '\n' : x); };
const nbOrd = (n, a, b) => n + ' ' + (n === 1 ? a : (b || a + 's'));

function foldMarkdown(t) {
  const rec = t.record || {};
  const bits = [nbOrd((rec.refs || []).length, 'address', 'addresses') + ' checked', (rec.unsupported || []).length ? (rec.unsupported || []).length + ' not in the material' : 'nothing unsupported', ...(rec.open || [])];
  const out = [String(t.answer || '').trim()];
  const srcs = (t.used || []).filter(u => u && u.ref);
  if (srcs.length) out.push('', '**Addressed sources**', ...srcs.map(u => '- `' + u.ref + '` — ' + oneLine(u.text).slice(0, 280)));
  out.push('', '---', '*On record · turn ' + t.n + ' · ' + bits.join(' · ') + '*');
  if (t.foldLine) out.push('', '*Folded to: ' + t.foldLine + '*');
  out.push('', '*Sent ' + (t.sentChars || 0).toLocaleString() + ' characters in place of a ' + (t.transcriptChars || 0).toLocaleString() + '-character transcript · ' + (t.model || '') + '*');
  return out.join('\n');
}

// The log, as plain text Holodeck can chunk and address like any other source. Blank lines are the chunk
// boundaries the Fold's own chunker uses, so each cell's question and answer land as their own statements.
export function notebookLog(conv, meta = {}) {
  const turns = (conv && conv.turns) || [];
  const title = meta.title || 'Notebook';
  const L = [];
  L.push(title + ' — the log of the notebook');
  L.push('This is the record of a notebook run inside The Fold: each cell is a question put to the workspace, its output is the answer, and every sentence of every answer was checked afterwards against the workspace\'s own passages. Passages are named by their own address.');
  if (meta.generated) L.push('Last run ' + meta.generated + '.');
  turns.forEach(t => {
    L.push('');
    L.push('In [' + t.n + '] ' + oneLine(t.question));
    L.push('');
    if (String(t.answer || '').trim()) L.push(String(t.answer).trim());
    const refs = (t.used || []).filter(u => u && u.ref).map(u => u.ref);
    if (refs.length) { L.push(''); L.push('Addresses checked: ' + refs.join(', ')); }
    const rec = t.record || {};
    L.push('');
    L.push('On record · turn ' + t.n + ' · ' + (rec.refs || refs).length + ' addresses checked · ' + ((rec.unsupported || []).length ? (rec.unsupported || []).length + ' not in the material' : 'nothing unsupported'));
    if (t.foldLine) L.push('Folded to: ' + t.foldLine);
    if (t.model) L.push('Answered by ' + t.model + '.');
  });
  return L.join('\n');
}

// Each turn as a Jupyter cell: the question is the source, the answer rides below it as the cell's output,
// and metadata.the_fold carries the record, the addresses and what the reader contributed.
export function notebookCells(conv) {
  return ((conv && conv.turns) || []).map(t => {
    const refs = (t.used || []).filter(u => u && u.ref).map(u => ({ ref: u.ref, text: oneLine(u.text).slice(0, 400) }));
    const offered = (t.offered || []).map(c => ({ ref: c.ref, source: c.source, start: c.start, end: c.end }));
    const findings = (t.findings || []).map(f => ({ text: f.text, kind: f.kind, echoesQuestion: !!f.echoesQuestion }));
    const rec = t.record || {};
    return {
      cell_type: 'code',
      execution_count: Number(t.n) || null,
      metadata: { the_fold: {
        kind: 'ask', turn: t.n, question: t.question,
        channels: rec.channels || [], refs: rec.refs || refs.map(r => r.ref),
        unsupported: rec.unsupported || [], open: rec.open || [],
        fold: t.foldLine || '', addresses: refs, offered, findings,
        notes: t.notes || null, reading: t.reading ? t.reading.lines : null,
        computed: t.computed ? { head: t.computed.head, lines: t.computed.lines, said: t.computed.said } : null,
        resolved: t.resolved || null,
        sentChars: t.sentChars || 0, transcriptChars: t.transcriptChars || 0, model: t.model || ''
      } },
      source: nbLines(t.question),
      outputs: [{ output_type: 'display_data', data: { 'text/markdown': nbLines(foldMarkdown(t)) }, metadata: {} }]
    };
  });
}

export function toIpynb(conv, meta = {}) {
  const cells = [];
  const head = ['# ' + (meta.title || 'Notebook'), '', 'A notebook run inside The Fold. Every cell is a question put to the workspace; its output is the answer, and below the answer is the address of every passage it was checked against. The cell metadata carries the full fold record. This is not Python in a Python kernel — it is the notebook\'s own log, made openable.'];
  if (meta.generated) head.push('', 'Run ' + meta.generated + '.');
  cells.push({ cell_type: 'markdown', metadata: {}, source: nbLines(head.join('\n')) });
  const body = notebookCells(conv); cells.push(...body);
  return {
    cells,
    metadata: {
      kernelspec: { display_name: 'The Fold', language: 'the-fold', name: 'the-fold' },
      language_info: { name: 'the-fold', mimetype: 'text/markdown', file_extension: '.fold.md' },
      the_fold: { tool: 'holodeck', workspace: meta.workspace || null, generated: meta.generated || null, turns: body.length, version: 1 }
    },
    nbformat: 4, nbformat_minor: 5
  };
}
