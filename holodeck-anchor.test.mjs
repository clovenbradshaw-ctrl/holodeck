import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAnchor, parseTimemap, scoreMemento, compileGates, loadGates, looksLikeChallenge } from './holodeck-anchor.js';

const TM = [
  '<https://web.archive.org/web/20240101000000/https://example.com>; rel="memento"; datetime="Mon, 01 Jan 2024 00:00:00 GMT"; status="200"; length="4096"',
  '<https://web.archive.org/web/20250101000000/https://example.com>; rel="memento"; datetime="Wed, 01 Jan 2025 00:00:00 GMT"; status="200"; length="8192"',
  '<https://example.com>; rel="original"',
].join('\n');

test('parseTimemap keeps Mementos, drops the original', () => {
  const ms = parseTimemap(TM);
  assert.equal(ms.length, 2);
  assert.ok(ms.every(m => m.uri.includes('/web/')));
  assert.equal(ms[0].status, 200);
  assert.equal(ms[1].length, 8192);
});

test('scoreMemento prefers served, larger, more recent', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  const older = { status: 200, length: 1000, ts: Date.parse('2019-01-01') };
  const recent = { status: 200, length: 8000, ts: Date.parse('2025-12-01') };
  const gone = { status: 404, length: 8000, ts: Date.parse('2025-12-01') };
  assert.ok(scoreMemento(recent, now) > scoreMemento(older, now));
  assert.ok(scoreMemento(recent, now) > scoreMemento(gone, now));
});

function responder(map) { return url => Promise.resolve(map[url] || { ok: false, status: 404, text: async () => '' }); }

test('DEF → EVA → REC: a rate-limited gate is a recorded miss, another gate wins', async () => {
  const url = 'https://news.example/story';
  const gates = [
    { id: 'wayback', label: 'Wayback', timegate: u => 'gate:wayback:' + u },
    { id: 'archive.today', label: 'archive.today', timegate: u => 'gate:at:' + u },
    { id: 'empty', label: 'Empty Gate', timegate: u => 'gate:empty:' + u },
  ];
  const fetchImpl = responder({
    ['gate:wayback:' + url]: { ok: false, status: 429, text: async () => '' },
    ['gate:at:' + url]: { ok: true, status: 200, text: async () => TM },
    ['gate:empty:' + url]: { ok: true, status: 200, text: async () => '' },
  });
  const r = await resolveAnchor(url, { gates, fetchImpl, now: Date.parse('2026-01-01T00:00:00Z') });
  assert.equal(r.ok, true);
  assert.equal(r.anchor.gate, 'archive.today');
  assert.ok(r.anchor.uri.includes('/web/20250101000000/'));
  const eva = r.log.filter(e => e.op === 'EVA');
  assert.equal(eva.length, 3);
  assert.equal(eva.find(e => e.gate === 'wayback').status, 429);
  assert.equal(eva.find(e => e.gate === 'empty').ok, false);
});

test('REC records the miss when no gate holds a Memento', async () => {
  const url = 'https://news.example/new';
  const gates = [{ id: 'a', label: 'A', timegate: u => 'g:a:' + u }];
  const r = await resolveAnchor(url, { gates, fetchImpl: responder({ ['g:a:' + url]: { ok: true, status: 200, text: async () => '' } }) });
  assert.equal(r.ok, false);
  assert.equal(r.anchor, null);
  assert.equal(r.log.filter(e => e.op === 'REC')[0].ok, false);
});

test('the wayback replay strips the toolbar (id_)', async () => {
  const url = 'https://example.com';
  const gates = [{ id: 'wayback', label: 'Wayback', timegate: u => 'g:' + u, replay: m => m.replace(/^(\S*\/web\/\d+)(\/)/, '$1id_$2') }];
  const r = await resolveAnchor(url, { gates, fetchImpl: responder({ ['g:' + url]: { ok: true, status: 200, text: async () => TM } }) });
  assert.match(r.anchor.uri, /\/web\/20250101000000id_\//);
});

test('DEF is data: a registry list compiles into gates, {url} substituted, wayback replay named', () => {
  const g = compileGates([
    { id: 'wayback', label: 'Wayback', timegate: 'https://web.archive.org/web/timemap/link/{url}', replay: 'wayback-id' },
    { id: 'at', label: 'archive.today', timegate: 'https://archive.ph/timemap/link/{url}' },
    { id: 'bad', label: 'no timegate' },
  ]);
  assert.equal(g.length, 2);
  assert.equal(g[0].timegate('https://x.test/a'), 'https://web.archive.org/web/timemap/link/https://x.test/a');
  assert.match(g[0].replay('https://web.archive.org/web/20250101000000/https://x.test/a'), /id_\//);
});

test('loadGates falls back to the shipped registry file when nothing else is set', async () => {
  const seen = [];
  const fetchImpl = (u) => { seen.push(String(u)); return Promise.resolve({ ok: true, status: 200, json: async () => ({ gates: [{ id: 'r1', label: 'R1', timegate: 'https://r/{url}' }] }) }); };
  globalThis.localStorage = undefined;
  const g = await loadGates({ fetchImpl });
  assert.ok(seen.some(u => u === 'archives.json'));
  assert.equal(g.length, 1);
  assert.equal(g[0].timegate('z'), 'https://r/z');
});

test('a rate limit (429) is NOT dressed as a human-check; a WAF block (403) is', async () => {
  assert.equal(looksLikeChallenge(429, ''), false, 'a bare 429 is a rate limit, not a human-check');
  assert.equal(looksLikeChallenge(403, ''), true);
  assert.equal(looksLikeChallenge(200, '<title>Just a moment...</title>'), true);
  const url = 'https://news.example/story';
  const gates = [
    { id: 'wayback', label: 'Wayback', timegate: u => 'g:wb:' + u },
    { id: 'at', label: 'archive.today', timegate: u => 'g:at:' + u },
  ];
  const rate = responder({
    ['g:wb:' + url]: { ok: false, status: 429, text: async () => 'Too many requests' },
    ['g:at:' + url]: { ok: true, status: 200, text: async () => TM },
  });
  const r = await resolveAnchor(url, { gates, fetchImpl: rate });
  assert.equal(r.ok, true);
  assert.equal(r.anchor.gate, 'at');
  assert.equal(r.challenge, null, 'a rate limit is not a human-check');
  assert.ok(r.rateLimited && r.rateLimited.status === 429 && r.rateLimited.gate === 'wayback');

  // only a rate-limited gate answers: REC must say so, and still offer no human-check button
  const onlyRate = await resolveAnchor(url, { gates: [gates[0]], fetchImpl: responder({ ['g:wb:' + url]: { ok: false, status: 429, text: async () => '' } }) });
  assert.equal(onlyRate.ok, false);
  assert.equal(onlyRate.challenge, null);
  assert.ok(onlyRate.rateLimited);

  // a 403 WAF block IS a human-check, carried with the gate's home
  const waf = await resolveAnchor(url, { gates: [{ id: 'loc', label: 'LOC', home: 'https://webarchive.loc.gov/', timegate: u => 'g:loc:' + u }],
    fetchImpl: responder({ ['g:loc:' + url]: { ok: false, status: 403, text: async () => 'Attention Required' } }) });
  assert.ok(waf.challenge && waf.challenge.status === 403 && waf.challenge.url === 'https://webarchive.loc.gov/');
});
