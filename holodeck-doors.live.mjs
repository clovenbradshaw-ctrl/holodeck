// holodeck-doors.live.mjs — falsify the document doorway against a LIVE eoreader7 proxy.
//   node holodeck-doors.live.mjs <jobId> [<jobId> ...]      (ER7_BASE overrides http://127.0.0.1:11436)
// Each control is a claim the pipeline makes about itself that its own ledger can refute. A failure is printed
// with the rows that refute it and the process exits 1. A control the current state cannot yet test says so.
import { isFunctionWord } from '../eoreader7/native/the-fold/pos-prior.js';
import { pollDocument, readLedger, liveHtmlUrl, doorControls, topicControl, identityControl } from './holodeck-doors.js';

const BASE = process.env.ER7_BASE || 'http://127.0.0.1:11436';
let failed = 0;
const verdict = (name, ok, detail) => { if (ok === null) console.log('  ·  ' + name + ' — not testable yet: ' + detail); else { console.log((ok ? '  ✓  ' : '  ✗  ') + name + (detail ? ' — ' + detail : '')); if (!ok) failed++; } };

const seen = [];
for (const jobId of process.argv.slice(2)) {
  const poll = await pollDocument(BASE, jobId); const L = await readLedger(BASE, jobId); seen.push({ jobId, rows: L.rows, projection: poll.projection || '' });
  console.log(`\n${jobId}: ${poll.status} · ${L.rows.length} ledger rows · ${L.malformed} malformed · projection ${poll.projection.length} chars`);

  for (const v of doorControls(poll, L)) verdict(v.name, v.ok, v.detail);

  const r = await fetch(liveHtmlUrl(BASE, jobId));
  const html = r.ok ? await r.text() : '';
  verdict('the live page is served and reads this job\'s ledger', r.ok && /text\/html/.test(r.headers.get('content-type') || '') && html.includes(jobId.replace(/:/g, '_') + '_1.jsonl'), 'HTTP ' + r.status);

}
if (seen.length > 1) { console.log('\nacross jobs (each is the others\' null):'); topicControl(seen, { isFunctionWord }).forEach((v, i) => verdict(seen[i].jobId + ': ' + v.name, v.ok, v.detail)); identityControl(seen).forEach(v => verdict(v.pair.join(' vs ') + ': ' + v.name, v.ok, v.detail)); }
else console.log('\n  ·  topic control — not testable with one job: the other jobs are its null');
console.log(failed ? `\n${failed} control(s) failed` : '\nno control failed');
process.exit(failed ? 1 : 0);
