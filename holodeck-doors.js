// Holodeck's thin client for eoreader7's document doorway (POST /v1/documents on the local proxy).
// The proxy runs the machine — void plan, per-cell composition, grounding, admission, fold — and keeps the
// append-only EOT ledger; this file only starts jobs, polls them, and reads that ledger back as cells.

export const ER7_BASE = 'http://127.0.0.1:11436';
const HOLONS = ['section', 'paragraph', 'sentence'];

export class DoorError extends Error { constructor(message, type, status) { super(message); this.type = type || 'door_error'; this.status = status || 0; } }

// A job id the proxy's ledger routes resolve unambiguously: they rewrite a trailing _N to :N, so none here.
export function newJobId(now = Date.now(), rand = Math.random) { return 'hd-' + now.toString(36) + rand().toString(36).slice(2, 7); }

async function asJson(r) { const t = await r.text(); try { return JSON.parse(t); } catch (e) { throw new DoorError('the proxy answered ' + r.status + ' with no JSON: ' + t.slice(0, 120), 'not_json', r.status); } }

export async function startDocument(base, { task, model, jobId, holonLevel = 'section', webConsent = false }, fetchImpl = fetch) {
  if (!String(task || '').trim()) throw new DoorError('the task is empty', 'empty_task');
  if (!HOLONS.includes(holonLevel)) throw new DoorError('holonLevel must be one of ' + HOLONS.join(', '), 'unknown_holon_level');
  let r; try { r = await fetchImpl(base + '/v1/documents', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task: String(task).trim(), model, sessionId: jobId, holonLevel, webConsent }) }); }
  catch (e) { throw new DoorError('eoreader7 is not answering at ' + base, 'unreachable'); }
  const j = await asJson(r);
  if (!r.ok) throw new DoorError((j.error && j.error.message) || 'HTTP ' + r.status, (j.error && j.error.type) || 'http_' + r.status, r.status);
  return j;
}

export async function pollDocument(base, jobId, fetchImpl = fetch) {
  const r = await fetchImpl(base + '/v1/documents/' + encodeURIComponent(jobId), { cache: 'no-store' });
  const j = await asJson(r); if (!r.ok) throw new DoorError((j.error && j.error.message) || 'HTTP ' + r.status, 'http_' + r.status, r.status);
  return j;
}

export async function readLedger(base, jobId, fetchImpl = fetch) {
  const r = await fetchImpl(base + '/v1/documents/' + encodeURIComponent(jobId) + '_1.jsonl', { cache: 'no-store' });
  if (r.status === 404) return { rows: [], malformed: 0, missing: true };
  if (!r.ok) throw new DoorError('HTTP ' + r.status + ' reading the ledger', 'http_' + r.status, r.status);
  return parseLedger(await r.text());
}

export const disclosureOf = rows => { const r = (rows || []).find(x => /^DISCLOSED UNGROUNDED/.test(String(x.text || ''))); return r ? String(r.text).split('\n')[0] : ''; };
export const liveHtmlUrl = (base, jobId) => base + '/v1/documents/' + encodeURIComponent(jobId) + '.html';

// A line that is not an EOT observation is counted, never silently dropped.
export function parseLedger(text) {
  const rows = []; let malformed = 0;
  for (const line of String(text || '').split('\n')) { if (!line.trim()) continue; let r; try { r = JSON.parse(line); } catch (e) { malformed++; continue; } if (!r || typeof r.role !== 'string') { malformed++; continue; } rows.push(r); }
  return { rows, malformed, missing: false };
}

// The void plan's questions are the cells. A ledger holds many plans (resumes, turns, re-plans), so each part is
// addressed by the plan that PRECEDES it in the append-only order, never by the last plan in the file. A part whose
// title is no question of its plan is kept, named unaddressed. Revision rows name no cell (their supersedes is empty
// and they land before their part in a code turn, after several parts in an essay turn), so they stay with their
// plan, unbound — assigning them to a cell by position would be a guess.
export function cellsOf(rows) {
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const sets = []; let cur = null; const unaddressed = []; let orphanParts = 0;
  for (const r of rows) {
    if (r.role === 'plan') { const qs = String(r.text || '').split('\n').map(l => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean); cur = { planId: r.id, plan: qs, cells: qs.map(q => ({ q, parts: [] })), revisions: [] }; sets.push(cur); }
    else if (r.role === 'part') {
      if (!cur) { orphanParts++; unaddressed.push(r); continue; }
      const t = norm(r.title); const c = cur.cells.find(x => { const q = norm(x.q); return q === t || q.startsWith(t) || t.startsWith(q); });
      if (c) c.parts.push(r); else unaddressed.push(r);
    } else if (r.role === 'revision' && cur) cur.revisions.push(r);
  }
  const current = sets.length ? sets[sets.length - 1] : { planId: null, plan: [], cells: [], revisions: [] };
  return { sets, current, unaddressed, orphanParts };
}

// The doorway's claims about itself, checked against its own ledger and projection. Each verdict is true, false,
// or null (the state cannot test it yet) — never a pass by default.
const DOC_STATUSES = new Set(['writing', 'complete', 'unsatisfied', 'truncated', 'error', 'unknown']);
export function doorControls(poll, ledger) {
  const rows = ledger.rows; const out = [];
  const add = (name, ok, detail) => out.push({ name, ok, detail });
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  add('status is one the doorway documents', DOC_STATUSES.has(poll.status), poll.status);
  add('every ledger line is an EOT observation', ledger.malformed === 0 && rows.every(r => r.schema === 'EOTObservation@1'), ledger.malformed + ' malformed');
  const fPlan = rows.findIndex(r => r.role === 'plan'), fPart = rows.findIndex(r => r.role === 'part');
  add('the void plan is committed before any cell is composed', fPart < 0 ? null : fPlan >= 0 && fPlan < fPart, fPart < 0 ? 'no part yet' : 'plan at row ' + fPlan + ', first part at row ' + fPart);
  const C = cellsOf(rows); const nParts = rows.filter(r => r.role === 'part').length;
  const beats = C.unaddressed.filter(r => /^[a-z]+(, [a-z]+)+$/.test(r.title)); const strays = C.unaddressed.filter(r => !beats.includes(r));
  add('every part answers a question of the plan before it (fold beats excepted)', nParts ? strays.length === 0 : null, nParts ? (nParts - C.unaddressed.length) + ' addressed, ' + beats.length + ' fold beats, ' + strays.length + ' strays' + (strays.length ? ': ' + strays.map(r => JSON.stringify(String(r.title).slice(0, 60))).join(', ') : '') : 'no part yet');
  const paras = String(poll.projection || '').split(/\n{2,}/).map(norm).filter(p => p.length > 40 && !/^#/.test(p) && !/^\d+\. /.test(p));
  const held = rows.map(r => norm(r.text)).join('\n'); const orphan = paras.filter(p => !held.includes(p.slice(0, 120)));
  add('every projected paragraph is held in the ledger', paras.length ? orphan.length === 0 : null, paras.length ? (paras.length - orphan.length) + ' of ' + paras.length + ' found' + (orphan.length ? '; first orphan: ' + JSON.stringify(orphan[0].slice(0, 90)) : '') : 'nothing projected yet');
  const disc = rows.find(r => /^DISCLOSED UNGROUNDED/.test(String(r.text || '')));
  add("the projection carries the ledger's ungrounded disclosure", disc && String(poll.projection || '').trim() ? /ungrounded|no material ground/i.test(poll.projection) : null, disc ? (String(poll.projection || '').trim() ? 'ledger row ' + disc.id + ' discloses it' : 'nothing projected yet') : 'the ledger discloses nothing');
  add('complete means the plan is satisfied', poll.status === 'complete' ? !!(poll.job && poll.job.satisfaction && poll.job.satisfaction.ok) : null, poll.status === 'complete' ? JSON.stringify(poll.job && poll.job.satisfaction).slice(0, 120) : 'status is ' + poll.status);
  return out;
}
