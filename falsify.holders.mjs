// falsify.holders.mjs — THE HOLDER-INDEXED READING: does every statement carry
// its holder, and where it cannot, does it say so instead of inventing one?
//
// Feeds the live analysis pipeline (window.__holodeck.analyze) real prose whose
// holders are known, and checks the per-statement `heldBy` record against
// perspective.js's own vocabulary. Prints, per source, the holders FOUND, the
// typed GAPS, and the cast spoken of but never speaking (the silent names).
//
//   npm run serve            # in another shell, serves :8813
//   node falsify.holders.mjs
//
// The falsifiers (a held-by record that resolves to a fabricated holder; a
// named speaker beside a speech verb that goes unfilled; an unowned quotation
// that is given an owner; a plain statement attributed to someone other than
// the reader) are the rule. The measured gaps on role nouns ("the minister")
// and pre-verbal attribution ("according to …") are the honest bottleneck this
// step exists to expose — they are REPORTED, not hidden.

import { openSurface } from './drive-holodeck.mjs';
import { READER } from './vendor/eoreader7/native/kernel/perspective.js';

const doc = (id, html, title = 'Source') => ({ id, title, format: 'html', html, url: 'https://example.test/' + id });

// Seeded so single-token speakers recur mid-sentence and are admitted by the
// app's own name detector (a lone capital at a sentence start carries no
// evidence of a name — the detector's rule, truthfully applied).
const DIALOGUE = [doc('d0', `<p>At the inn, the travelers met Clerval in the hall.</p>
<p>Later, the travelers met Elizabeth by the fire.</p>
<p>“I will go,” said Clerval.</p>
<p>Elizabeth replied, “I will stay.”</p>
<p>“You must not,” said Clerval.</p>`)];

const REPORT = [doc('d0', `<p>Later, officials praised Alice Barlow for the plan.</p>
<p>Alice Barlow said the policy would change.</p>
<p>The minister said the policy would change.</p>
<p>According to Alice Barlow, the plan is sound.</p>
<p>The report also named Charles Babbage as an adviser.</p>`)];

const STRAIGHT = [doc('d0', `<p>At the inn, the travelers met Clerval in the hall.</p>
<p>"I will go," said Clerval.</p>`)];

const PLAIN = [doc('d0', `<p>The bridge opened in 1998.</p>
<p>It carries four lanes.</p>`)];

const CASES = [
  {
    id: 'dialogue', label: 'dialogue — trailing and leading tags (curly)', docs: DIALOGUE,
    want: [
      { has: 'met Clerval in the hall', holder: READER, gap: null },
      { has: '“I will go,”', holder: 'Clerval', gap: null },
      { has: 'Elizabeth replied', holder: 'Elizabeth', gap: null },
      { has: '“You must not,”', holder: 'Clerval', gap: null },
    ],
  },
  {
    id: 'report', label: 'report prose — named, role, and pre-verbal attribution', docs: REPORT,
    want: [
      { has: 'Alice Barlow said', holder: 'Alice Barlow', gap: null },
      // the honest bottleneck, named not hidden:
      { has: 'minister said', holder: null, gap: 'attribution_unwitnessed' },
      { has: 'According to', holder: null, gap: 'attribution_unwitnessed' },
    ],
    wantSilent: ['Charles Babbage'],
  },
  {
    id: 'straight', label: 'straight-quote convention', docs: STRAIGHT,
    want: [{ has: '"I will go,"', holder: 'Clerval', gap: null }],
  },
  {
    id: 'plain', label: 'unattributed prose — the reader’s own', docs: PLAIN,
    want: [
      { has: 'bridge opened', holder: READER, gap: null },
      { has: 'four lanes', holder: READER, gap: null },
    ],
  },
];

const cut = (s, n = 62) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

function check(read, c) {
  const fails = [];
  const admitted = new Set(read.names);
  for (const st of read.sts) {
    const h = st.heldBy;
    // SAFETY: a holder that is neither the reader nor an admitted referent is a
    // fabricated holder — the one thing this whole build may never do.
    if (h && h.holder && h.holder !== READER && !admitted.has(h.holder)) {
      fails.push('fabricated holder ' + JSON.stringify(h.holder) + ' on “' + cut(st.text) + '”');
    }
  }
  for (const w of c.want || []) {
    const st = read.sts.find((s) => s.text.includes(w.has));
    if (!st) { fails.push('no statement matched ' + JSON.stringify(w.has)); continue; }
    const h = st.heldBy || {};
    if ((h.holder ?? null) !== (w.holder ?? null)) fails.push('“' + cut(st.text) + '” held by ' + JSON.stringify(h.holder ?? null) + ', wanted ' + JSON.stringify(w.holder ?? null));
    if (w.gap != null && (h.gap && h.gap.type) !== w.gap) fails.push('“' + cut(st.text) + '” gap ' + JSON.stringify(h.gap && h.gap.type) + ', wanted ' + JSON.stringify(w.gap));
  }
  for (const name of c.wantSilent || []) {
    if (!read.silent.includes(name)) fails.push('expected ' + JSON.stringify(name) + ' to be silent, but it spoke or is absent');
  }
  return fails;
}

async function main() {
  const surf = await openSurface({ headless: true });
  try {
    await surf.page.waitForFunction(() => window.__holodeck && typeof window.__holodeck.analyze === 'function', null, { timeout: 20000 });
    await surf.page.waitForFunction(() => window.__holodeck.hdEngineReady && window.__holodeck.hdEngineReady(), null, { timeout: 20000 });
    await surf.page.waitForFunction(() => window.__holodeck.hdReaderReady && window.__holodeck.hdReaderReady(), null, { timeout: 20000 });
    await surf.page.waitForFunction(() => window.__holodeck.hdAttrReady && window.__holodeck.hdAttrReady(), null, { timeout: 20000 });
    await surf.page.waitForFunction(() => window.__holodeck.hdPos && window.__holodeck.hdPos('said'), null, { timeout: 20000 });
    let failed = 0;
    for (const c of CASES) {
      const read = await surf.page.evaluate((docs) => {
        const A = window.__holodeck.analyze({ docs });
        const sum = window.__holodeck.summarizeHolders(A.sts, A.names) || { holders: [], gaps: [], silent: [] };
        return {
          sts: A.sts.map((s) => ({ id: s.id, text: s.text, frame: s.frame, heldBy: s.heldBy })),
          names: Object.keys(A.names),
          holders: sum.holders, gaps: sum.gaps, silent: sum.silent,
        };
      }, c.docs);
      console.log('\n── ' + c.id + ' · ' + c.label + ' ─────────────────────────────');
      for (const st of read.sts) {
        const h = st.heldBy;
        const who = !h ? '∅ no record' : h.holder ? h.holder + ' (' + h.basis + ', d' + h.depth + ')' : 'GAP ' + (h.gap && h.gap.type);
        console.log('  ' + cut(st.text).padEnd(64) + ' → ' + who);
      }
      console.log('  holders found: ' + (read.holders.length ? read.holders.map((x) => x.holder + '×' + x.statements).join(', ') : '(none)'));
      console.log('  typed gaps:    ' + (read.gaps.length ? read.gaps.map((x) => x.type + '×' + x.statements).join(', ') : '(none)'));
      console.log('  silent cast:   ' + (read.silent.length ? read.silent.join(', ') : '(none)'));
      const fails = check(read, c);
      console.log('  ' + (fails.length ? 'FAIL' : 'PASS'));
      for (const f of fails) console.log('      - ' + f);
      failed += fails.length ? 1 : 0;
    }
    console.log('\n' + (failed ? 'VERDICT: FAIL (' + failed + ' case(s))' : 'VERDICT: PASS (' + CASES.length + '/' + CASES.length + ' cases; gaps above are the measured bottleneck)'));
    if (surf.consoleErrors.length) console.log('console errors:', JSON.stringify(surf.consoleErrors.slice(0, 6)));
    if (failed) process.exitCode = 1;
  } finally {
    await surf.close();
  }
}

main();
