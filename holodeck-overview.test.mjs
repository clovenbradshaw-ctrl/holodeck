import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { parseHTML } from 'linkedom';
import { mountOverview, overviewSources } from './holodeck-overview.js';
const docs = () => [{ id: 's', title: 'Council report', text: 'é🙂 Tenants are affected.\nThe council approved it.' }];
function setup(initial = docs()) {
  const { document, window } = parseHTML('<html><body><div id="root"></div></body></html>');
  globalThis.document = document; const store = new Map();
  globalThis.localStorage = { getItem: k => store.get(k), setItem: (k, v) => store.set(k, v) };
  const root = document.getElementById('root'), read = [];
  const ui = mountOverview(root, { docs: initial, workspace: 'test', onRead: id => read.push(id) });
  const form = root.querySelector('form');
  // linkedom omits this native form API; supply only its DOM-backed lookup.
  Object.defineProperty(form, 'elements', { value: { namedItem: name => form.querySelector('[name="' + name + '"]') } });
  const field = (n, v) => { const el = form.elements.namedItem(n); el.value = v; el.dispatchEvent(new window.Event('input', { bubbles: true })); };
  const submit = () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  return { root, form, ui, read, field, submit, window };
}
async function settled(root) {
  for (let i = 0; i < 100; i++) {
    const s = root.querySelector('[data-status]').textContent;
    if (s.startsWith('Byte provenance') || s.startsWith('Cannot build')) return s;
    await new Promise(r => setTimeout(r, 5));
  }
  throw new Error('overview did not settle');
}
test('surface builds model-free evidence and exposes negative space, sources, and export', async () => {
  const { root, field, submit } = setup();
  field('expected', 'Tenant testimony'); field('basis', 'Tenant impacts deserve inquiry'); field('gapQuery', 'I am a tenant'); field('next', 'Seek tenant testimony');
  submit(); assert.match(await settled(root), /Byte provenance replay passed/);
  const frame = root.querySelector('iframe'); assert.equal(frame.hidden, false); assert.match(frame.srcdoc, /coverage is incomplete/);
  assert.equal(root.querySelector('[data-actions]').hidden, false);
  assert.match(frame.srcdoc, /Versioned source text/); assert.match(frame.srcdoc, /No user understanding|do not establish understanding/);
});
test('changed sources hide stale evidence and export, even when existing quote survives', async () => {
  const { root, submit, ui } = setup(); submit(); await settled(root);
  ui.update({ docs: [{ ...docs()[0], text: docs()[0].text + '\nNew testimony' }] });
  assert.equal(root.querySelector('iframe').hidden, true); assert.equal(root.querySelector('[data-actions]').hidden, true);
  assert.match(root.querySelector('[data-status]').textContent, /stale/);
});
test('frame and scope changes invalidate an existing artifact; rebuild clears staleness', async () => {
  const { root, submit, field, window } = setup(); submit(); await settled(root);
  field('viewpoint', 'Council oversight'); assert.equal(root.querySelector('iframe').hidden, true);
  submit(); await settled(root); assert.match(root.querySelector('iframe').srcdoc, /Council oversight/);
  const box = root.querySelector('input[type=checkbox]'); box.checked = false; box.dispatchEvent(new window.Event('change'));
  assert.equal(root.querySelector('[data-actions]').hidden, true);
  submit(); assert.match(await settled(root), /source scope/);
});
test('incomplete negative-space recipe refuses; speaker and extraction coverage are never invented', async () => {
  const { root, field, submit } = setup(); field('expected', 'Resident testimony'); submit();
  assert.match(await settled(root), /expectation.basis/);
  const [s] = overviewSources(docs()); assert.equal(s.coverage, 'partial'); assert.equal(s.giver, null);
  assert.equal(overviewSources([{ id: 'v', title: 'Video', text: 'Title only', aboutOnly: true }])[0].coverage, 'unread');
});
test('frame edits during async construction do not publish an outdated result', async () => {
  const { root, submit, field } = setup(); submit(); field('viewpoint', 'Changed while building');
  assert.match(await settled(root), /framing changed during construction/);
  assert.equal(root.querySelector('[data-actions]').hidden, true);
});
test('untrusted titles and source bytes are inert in surface and exported HTML', async () => {
  const { root, submit } = setup([{ id: 's', title: '<img src=x onerror=evil()>', text: '</script><script>evil()</script>' }]);
  assert.equal(root.querySelector('img'), null); submit(); await settled(root);
  assert.ok(!root.querySelector('iframe').srcdoc.includes('<script>evil()</script>'));
});
test('native workspace navigation opens only current evidence', async () => {
  const { root, submit, read } = setup(); submit(); await settled(root);
  root.querySelector('[data-read] button').click();
  for (let i=0; i<100 && !read.length; i++) await new Promise(r=>setTimeout(r,5));
  assert.deepEqual(read, ['s']);
});
test('inline component compiles and new view has a reachable summary and navigation entry', () => {
  const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const { document } = parseHTML(html); const script = document.querySelector('[data-dc-script]').textContent;
  assert.doesNotThrow(() => new Function('DCLogic', script));
  assert.match(script, /id: 'overview', label: 'Evidence overview'/);
  assert.match(html, /id="overview-surface"/); assert.match(script, /goOverview:.*go\('overview'\)/);
});
test('vendored contracts match their pinned hashes and available canonical siblings', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('./vendor/overview-manifest.json', import.meta.url),'utf8'));
  for (const f of manifest.files) {
    const local = fs.readFileSync(new URL('./' + f.local, import.meta.url));
    assert.equal(createHash('sha256').update(local).digest('hex'), f.sha256);
    const upstream = new URL('../' + f.repository.split('/')[1] + '/' + f.source, import.meta.url);
    if (fs.existsSync(upstream)) assert.equal(local.toString(), fs.readFileSync(upstream,'utf8'));
  }
});
test('new plain text retains received bytes rather than the rendered extraction', () => {
  const s = overviewSources([{ id:'p', title:'Pasted', text:'normalized text', overviewReceivedText:'é🙂\r\n  original whitespace  ' }])[0];
  assert.equal(s.text, 'é🙂\r\n  original whitespace  '); assert.equal(s.space, 'received-utf8-text'); assert.equal(s.coverage, 'complete');
  const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8'); assert.match(html,/overviewReceivedText: x.text/);
});
test('every portable fragment link resolves after browser URL decoding', async () => {
  const { materializeOverview } = await import('./vendor/penelope/organs/generation/overview.mjs');
  const p = await materializeOverview({ sources: overviewSources(docs()), frame: { question:'Q', viewpoint:'V', owner:'O', experiencer:'E', selection:'All lines', query:'' }, expectations:[] });
  const { document } = parseHTML(p.html);
  for (const a of document.querySelectorAll('a[href^="#"]')) assert.ok(document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))), 'unresolved '+a.getAttribute('href'));
});
test('exported source reader restores exact CRLF, Unicode and NUL bytes before reverse selection', async () => {
  const vm = await import('node:vm');
  const { materializeOverview } = await import('./vendor/penelope/organs/generation/overview.mjs');
  const raw = 'é🙂\r\nfirst\0line\r\nlast';
  const p = await materializeOverview({ sources: overviewSources([{id:'raw',title:'Raw',overviewReceivedText:raw}]), frame:{question:'Q',viewpoint:'V',owner:'O',experiencer:'E',selection:'All lines',query:''},expectations:[] });
  const { document } = parseHTML(p.html);
  const script = [...document.querySelectorAll('script')].find(s=>!s.type).textContent;
  vm.runInNewContext(script,{document,TextEncoder,getSelection:()=>({rangeCount:0})});
  assert.equal(document.querySelector('[data-overview-source]').textContent, raw);
});
