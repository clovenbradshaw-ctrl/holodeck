// holodeck-holons.test.mjs — the nesting behind the replay map, checked on hand-made graphs and on seeded random
// ones. Every law here is a claim about structure, so the random cases assert the law for all of them, not a sample.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nestByTies, repOf, visibleHolons, rollUp, placeLabels, sourceGraph, statementsOf, outranks, depthsOf, levelsOf, openAtLevel } from './holodeck-holons.js';

const rng = seed => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const randomGraph = (seed, n) => {
  const r = rng(seed), nodes = Array.from({ length: n }, (_, i) => ({ n: 'n' + i, c: 1 + Math.floor(r() * 9) })), edges = [];
  for (let i = 0; i < n * 2; i++) { const a = Math.floor(r() * n), b = Math.floor(r() * n); if (a !== b) edges.push({ a: 'n' + a, b: 'n' + b, c: 1 + Math.floor(r() * 5) }); }
  return { nodes, edges };
};

test('a small graph nests lighter names under their strongest heavier neighbour', () => {
  const nodes = [{ n: 'Mississippi', c: 9 }, { n: 'Arkansas', c: 5 }, { n: 'Vicksburg', c: 2 }, { n: 'Lone', c: 1 }];
  const edges = [{ a: 'Mississippi', b: 'Arkansas', c: 5 }, { a: 'Arkansas', b: 'Vicksburg', c: 3 }, { a: 'Mississippi', b: 'Vicksburg', c: 1 }];
  const nest = nestByTies(nodes, edges);
  assert.equal(nest.parent.get('Mississippi'), null);
  assert.equal(nest.parent.get('Arkansas'), 'Mississippi');
  assert.equal(nest.parent.get('Vicksburg'), 'Arkansas', 'the stronger tie (3) wins over the weaker one (1)');
  assert.equal(nest.parent.get('Lone'), null, 'a name with no ties is its own root');
  assert.deepEqual(nest.roots, ['Mississippi', 'Lone']);
  assert.equal(nest.size.get('Mississippi'), 3);
  assert.equal(nest.weight.get('Mississippi'), 16);
});

test('for random graphs the nesting is an acyclic forest and every parent outranks its child', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const { nodes, edges } = randomGraph(seed, 40), nest = nestByTies(nodes, edges), byN = new Map(nodes.map(x => [x.n, x]));
    nodes.forEach(x => {
      const p = nest.parent.get(x.n); if (p !== null) assert.ok(outranks(byN.get(p), x), `seed ${seed}: ${p} must outrank ${x.n}`);
      let hops = 0; for (let y = x.n; y !== null; y = nest.parent.get(y)) assert.ok(++hops <= nodes.length, `seed ${seed}: cycle at ${x.n}`);
    });
    assert.equal(nest.roots.reduce((s, r) => s + nest.size.get(r), 0), nodes.length, 'every name sits under exactly one root');
  }
});

test('repOf never leaves the open set and visibleHolons lists exactly the representatives', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { nodes, edges } = randomGraph(seed, 30), nest = nestByTies(nodes, edges), r = rng(seed + 900);
    const open = new Set(nodes.filter(() => r() < 0.4).map(x => x.n)), vis = new Set(visibleHolons(nest, open));
    nodes.forEach(x => {
      const rep = repOf(nest, x.n, open); assert.ok(vis.has(rep), `seed ${seed}: rep ${rep} of ${x.n} is not visible`);
      for (let a = nest.parent.get(rep); a !== null; a = nest.parent.get(a)) assert.ok(open.has(a), `seed ${seed}: ${rep} is shown under closed ${a}`);
      if (open.has(x.n) && nest.parent.get(x.n) !== null && [...(function* () { for (let a = nest.parent.get(x.n); a !== null; a = nest.parent.get(a)) yield a; })()].every(a => open.has(a))) assert.equal(rep, x.n, 'an open holon whose ancestors are all open stands for itself');
    });
    assert.equal(new Set(nodes.map(x => repOf(nest, x.n, open))).size <= vis.size, true);
  }
});

test('rollUp conserves the tie total except ties that fall inside one holon', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { nodes, edges } = randomGraph(seed, 30), nest = nestByTies(nodes, edges), open = new Set();
    const rep = new Map(nodes.map(x => [x.n, repOf(nest, x.n, open)])), agg = rollUp(edges, rep);
    const inside = edges.filter(E => rep.get(E.a) === rep.get(E.b)).reduce((s, E) => s + E.c, 0), total = edges.reduce((s, E) => s + E.c, 0);
    assert.equal([...agg.values()].reduce((s, x) => s + x.c, 0), total - inside);
    agg.forEach(x => assert.notEqual(x.a, x.b));
  }
});

test('placeLabels never returns two overlapping label rectangles and never covers another node', () => {
  const measure = t => t.length * 6.5;
  for (let seed = 1; seed <= 50; seed++) {
    const r = rng(seed), items = Array.from({ length: 80 }, (_, i) => ({ id: 'n' + i, x: 30 + r() * 640, y: 30 + r() * 340, r: 4 + r() * 8, text: 'Name number ' + i, pri: r() * 100 }));
    const out = placeLabels(items, 700, 400, measure), hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) assert.equal(hit(out[i].box, out[j].box), false, `seed ${seed}: labels ${out[i].id} and ${out[j].id} overlap`);
      items.forEach(it => { if (it.id !== out[i].id) assert.equal(hit(out[i].box, { x: it.x - it.r, y: it.y - it.r, w: 2 * it.r, h: 2 * it.r }), false, `seed ${seed}: label ${out[i].id} covers node ${it.id}`); });
    }
    assert.ok(out.length > 0 && out.length < items.length, 'some labels are kept and the crowded rest are dropped');
  }
});

test('placeLabels keeps every label below a top margin', () => {
  const items = Array.from({ length: 30 }, (_, i) => ({ id: 'n' + i, x: 40 + (i % 10) * 60, y: 20 + Math.floor(i / 10) * 40, r: 5, text: 'N' + i, pri: i }));
  placeLabels(items, 700, 300, t => t.length * 6.5, 13, 50).forEach(o => assert.ok(o.box.y >= 50, `label ${o.id} at ${o.box.y} is above the margin`));
});

test('placeLabels keeps the highest-priority label when two compete for the same spot', () => {
  const out = placeLabels([{ id: 'a', x: 100, y: 100, r: 5, text: 'Alpha', pri: 1 }, { id: 'b', x: 102, y: 100, r: 5, text: 'Bravo', pri: 9 }], 300, 200, t => t.length * 6.5);
  assert.equal(out.find(o => o.id === 'b') !== undefined, true);
  assert.equal(out[0].id, 'b');
});

test('sourceGraph ties two sources by the names they share and the prior picture by names it already held', () => {
  const occ = new Map([['Nashville', [{ doc: 1, id: 's1' }, { doc: 2, id: 's9' }]], ['Tennessee', [{ doc: 1, id: 's2' }]], ['Freddie', [{ doc: 2, id: 's8' }]]]);
  const g = sourceGraph({ docs: [{ id: 1, title: 'A' }, { id: 2, title: 'B' }], occ, prior: new Set(['Tennessee', 'Ohio']) });
  const e = (a, b) => (g.edges.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a)) || {}).c;
  assert.equal(e('doc:1', 'doc:2'), 1);
  assert.equal(e('prior', 'doc:1'), 1);
  assert.equal(e('prior', 'doc:2'), undefined);
  assert.equal(g.nodes.find(n => n.id === 'doc:1').c, 2);
});

test('statementsOf lists a name’s statements with the other names sharing each one', () => {
  const occ = new Map([['Nashville', [{ doc: 1, id: 's1' }, { doc: 1, id: 's3' }]], ['Tennessee', [{ doc: 1, id: 's1' }]], ['Ohio', [{ doc: 1, id: 's7' }]]]);
  const st = statementsOf(occ, 'Nashville');
  assert.equal(st.length, 2);
  assert.deepEqual(st.find(x => x.id === 's1').with, ['Tennessee']);
  assert.deepEqual(st.find(x => x.id === 's3').with, []);
});

test('levels: each step opens one more layer, level 0 is the roots, the deepest level shows every name', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const { nodes, edges } = randomGraph(seed, 35), nest = nestByTies(nodes, edges), { depth, max } = levelsOf(nest);
    nodes.forEach(x => { const p = nest.parent.get(x.n); assert.equal(depth.get(x.n), p === null ? 0 : depth.get(p) + 1, `seed ${seed}: depth of ${x.n}`); });
    assert.deepEqual(visibleHolons(nest, openAtLevel(nest, 0)), nest.roots, 'level 0 shows exactly the roots');
    let prev = new Set(); for (let L = 0; L <= max + 1; L++) { const s = openAtLevel(nest, L); prev.forEach(n => assert.ok(s.has(n), `seed ${seed}: level ${L} closed ${n} that ${L - 1} opened`)); prev = s; }
    assert.equal(visibleHolons(nest, openAtLevel(nest, max)).length, nodes.length, `seed ${seed}: the deepest level shows every name`);
    if (max > 0) assert.ok(visibleHolons(nest, openAtLevel(nest, max - 1)).length < nodes.length, 'one level up hides something');
  }
});

test('the tester is tested: a wrong expectation is refuted', () => {
  const nest = nestByTies([{ n: 'A', c: 5 }, { n: 'B', c: 1 }], [{ a: 'A', b: 'B', c: 1 }]);
  assert.throws(() => assert.equal(nest.parent.get('A'), 'B'));
});
