// reading-worker.js — module worker. Decodes an EO reading (.jsonl.zst, reference zstd via wasm), keeps the bytes in OPFS,
// and builds a compact index of what the reader did: the cast it admitted, the bonds it witnessed, and the identities it kept revising.
const SRC_URL = 'https://raw.githubusercontent.com/clovenbradshaw-ctrl/ohs-custody/main/ground-readings/f3affd2e11370118-causalTextPerceiver_reviseTextFold_refresh25.jsonl.zst';
async function dirOf(path) { let d = await navigator.storage.getDirectory(); for (const p of path.split('/').filter(Boolean)) d = await d.getDirectoryHandle(p, { create: true }); return d; }
// zstd frame header → declared content size (null if the frame doesn't declare one). Lets us refuse a decoder that silently returns the wrong bytes.
function frameSize(b) { if (b[0] !== 0x28 || b[1] !== 0xB5 || b[2] !== 0x2F || b[3] !== 0xFD) throw new Error('not a zstd frame');
  const fhd = b[4], fcs = fhd >> 6, single = (fhd >> 5) & 1, did = [0, 1, 2, 4][fhd & 3]; let o = 5 + (single ? 0 : 1) + did;
  const n = fcs === 0 ? (single ? 1 : 0) : [0, 2, 4, 8][fcs]; if (!n) return null; let v = 0; for (let i = n - 1; i >= 0; i--) v = v * 256 + b[o + i]; return n === 2 ? v + 256 : v; }
async function dropCache(dir, name) { for (const n of [name, name + '.ok']) await dir.removeEntry(n).catch(() => {}); }
async function ensureJsonl(url, name) {
  const dir = await dirOf('ohs-custody');
  try { const fh = await dir.getFileHandle(name); const f = await fh.getFile(); const ok = await (await dir.getFileHandle(name + '.ok')).getFile().then(x => x.text()).catch(() => ''); if (f.size > 1000 && ok === 'v2:' + f.size) return f; } catch (e) {}
  postMessage({ stage: 'downloading' }); const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  postMessage({ stage: 'decompressing', mb: Math.round(buf.length / 1e6) });
  const M = await import('https://esm.sh/@bokuweb/zstd-wasm@0.0.27'); await M.init(); const raw = M.decompress(buf);
  const want = frameSize(buf); if (want !== null && raw.length !== want) throw new Error('decoder produced ' + raw.length + ' bytes; the zstd frame declares ' + want + '. Refusing a silent mis-decode.');
  if (raw.length < 1000 || raw[0] !== 123) throw new Error('decoder produced ' + raw.length + ' bytes that are not JSON lines');
  const fh = await dir.getFileHandle(name, { create: true }); const acc = await fh.createSyncAccessHandle(); acc.truncate(0);
  const STEP = 64 << 20; for (let o = 0; o < raw.length; o += STEP) { acc.write(raw.subarray(o, Math.min(raw.length, o + STEP)), { at: o }); postMessage({ stage: 'writing', pct: Math.round(o / raw.length * 100) }); }
  acc.flush(); acc.close(); const okh = await dir.getFileHandle(name + '.ok', { create: true }); const w = await okh.createWritable(); await w.write('v2:' + raw.length); await w.close();
  return (await dir.getFileHandle(name)).getFile();
}
const inc = (o, k, n) => { o[k] = (o[k] || 0) + (n || 1); };
self.onmessage = async e => {
  try {
    const { url = SRC_URL, file = 'reading-refresh25.jsonl', out = 'reading-refresh25.index.json' } = e.data || {};
    const f = await ensureJsonl(url, file); const t0 = Date.now();
    let cur = null, seq = 0, lines = 0, bad = 0;
    const src = {}; const S = s => src[s] || (src[s] = { chunks: 0, chars: 0, ops: {}, terrain: {}, kinds: {}, cast: {}, bonds: {}, idChurn: {} });
    const cast = new Map(); const bonds = new Map(); const canon = new Map(); const ids = new Map(); const kinds = {}; const order = [];
    const onLine = l => { if (!l) return; lines++; let j; try { j = JSON.parse(l); } catch (x) { bad++; return; }
      if (j.schema === 'Encounter@1') { cur = j.source; seq++; const X = S(cur); X.chunks++; X.chars += j.extent || 0; if (!order.includes(cur)) order.push(cur); return; }
      if (j.schema !== 'DeltaFold@1' || !cur) return; const X = S(cur);
      for (const o of j.operations || []) { const c = o.consequence || {}; const k = o.operator + '/' + (c.kind || '?'); inc(kinds, k); inc(X.kinds, k); inc(X.ops, o.operator); inc(X.terrain, o.terrain);
        const v = o.payload && o.payload.value; if (!v) continue;
        if (v.schema === 'EOReferent@1') { const id = v.id; let R = cast.get(id); if (!R) { R = { id, surfaces: [], standing: v.standing, mentions: 0, src: {}, first: cur, firstSeq: seq }; cast.set(id, R); } (v.surfaces || []).forEach(s => { if (!R.surfaces.includes(s)) R.surfaces.push(s); }); R.mentions = Math.max(R.mentions, v.mentions || 0); R.standing = v.standing || R.standing; inc(R.src, cur); inc(X.cast, (v.surfaces || [id])[0]); }
        else if (v.schema === 'EOHyperedge@1') { const P = (v.participants || []).map(p => p.surface || p.surfaceKey || '?'); if (P.length < 2) continue; const key = P.slice(0, 2).sort().join(' \u2014 '); let B = bonds.get(key); if (!B) { B = { a: P[0], b: P[1], n: 0, rel: {}, pos: 0, neg: 0, src: {}, first: cur, firstSeq: seq }; bonds.set(key, B); } B.n++; inc(B.rel, v.relation || '?'); if ((v.meta && v.meta.polarity) === '-') B.neg++; else B.pos++; inc(B.src, cur); inc(X.bonds, key); }
        else if (v.schema === 'EOCanonicalHyperedge@1') { const P = (v.participants || []).map(p => p.value); if (P.length < 2) continue; const key = P.slice(0, 2).sort().join(' \u2014 '); let B = canon.get(key); if (!B) { B = { a: P[0], b: P[1], n: 0, alts: {}, src: {} }; canon.set(key, B); } B.n++; (v.participants || []).forEach(p => (p.alternatives || []).forEach(a => { if (a !== p.value) inc(B.alts, a); })); inc(B.src, cur); }
        else if (v.schema === 'EOIdentityAlternative@1') { const key = v.left + ' \u2194 ' + v.right; let I = ids.get(key); if (!I) { I = { left: v.left, right: v.right, n: 0, events: {}, src: {} }; ids.set(key, I); } I.n++; inc(I.events, c.kind || v.standing || '?'); inc(I.src, cur); inc(X.idChurn, key); }
        else if (c.kind === 'identity_split' || c.kind === 'identity_reading_refused' || c.kind === 'identity_hypothesis_supported') { const key = c.identity || (o.inputs || []).join(' \u2194 '); let I = ids.get(key); if (!I) { I = { left: (o.inputs || [])[0] || key, right: (o.inputs || [])[1] || '', n: 0, events: {}, src: {} }; ids.set(key, I); } I.n++; inc(I.events, c.kind); inc(I.src, cur); inc(X.idChurn, key); }
      } };
    const rd = f.stream().pipeThrough(new TextDecoderStream()).getReader(); let tail = '', seen = 0, tick = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; seen += value.length; const parts = (tail + value).split('\n'); tail = parts.pop(); for (const l of parts) onLine(l); if (++tick % 200 === 0) postMessage({ stage: 'indexing', pct: Math.round(seen / f.size * 100), lines }); }
    onLine(tail);
    const cur2 = await fetch(url.replace(/\.zst$/, '.cursor')).then(r => r.ok ? r.json() : null).catch(() => null);
    if (cur2 && cur2.sequence && cur2.sequence !== seq) { await dropCache(await dirOf('ohs-custody'), file); throw new Error('Decoded ' + seq + ' encounters; the reading\u2019s cursor records ' + cur2.sequence + '. Cache cleared, nothing indexed.'); }
    if (bad) { await dropCache(await dirOf('ohs-custody'), file); throw new Error(bad + ' of ' + lines + ' lines failed to parse. The decoded bytes are not the reading; cache cleared, nothing indexed.'); }
    const top = (m, n, sc) => [...m.values()].sort((a, b) => sc(b) - sc(a)).slice(0, n).map(x => ({ ...x, srcN: Object.keys(x.src || {}).length }));
    const trim = o => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 25));
    Object.values(src).forEach(X => { X.cast = trim(X.cast); X.bonds = trim(X.bonds); X.idChurn = trim(X.idChurn); });
    const index = { schema: 'FoldReadingIndex@2', from: url, cursor: cur2, builtAt: new Date().toISOString(), ms: Date.now() - t0, lines, bad, encounters: seq, order, sources: src, kinds,
      castTotal: cast.size, cast: top(cast, 3000, x => x.mentions * 10 + Object.keys(x.src).length),
      bondsTotal: bonds.size, bonds: top(bonds, 3000, x => x.n + 3 * Object.keys(x.src).length),
      canonTotal: canon.size, canon: top(canon, 1500, x => x.n),
      identitiesTotal: ids.size, identities: top(ids, 1500, x => x.n) };
    const dir = await dirOf('ohs-custody'); const fh = await dir.getFileHandle(out, { create: true }); const w = await fh.createWritable(); await w.write(JSON.stringify(index)); await w.close();
    postMessage({ done: true, index: { lines, bad, encounters: seq, sources: Object.keys(src).length, cast: cast.size, bonds: bonds.size, canon: canon.size, identities: ids.size, ms: index.ms, topCast: index.cast.slice(0, 12).map(c => c.surfaces[0] + ' (' + c.mentions + ', ' + c.srcN + ' sources, ' + c.standing + ')'), topBonds: index.bonds.slice(0, 10).map(b => b.a + ' \u2014 ' + b.b + ' \u00d7' + b.n + ' in ' + b.srcN), churn: index.identities.slice(0, 8).map(i => i.left + ' \u2194 ' + i.right + ' \u00d7' + i.n + ' ' + JSON.stringify(i.events)) } });
  } catch (err) { postMessage({ err: String(err && err.message || err) }); }
};
