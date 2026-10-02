// holodeck-profile.js — AN ENTITY'S PROFILE ON THE HOLODECK.
//
// Built on eoreader7's kind induction (vendored under vendor/eoreader7/native/
// kernel/). A being's profile is its induced kind(s) and its key parameters —
// whatever the relations are — each carrying the functional standing the kind
// earned (fixed · one at a time · many-valued · time unknown · unexposed). No
// parameter is declared here; the workspace's own witnessed bonds decide them.
//
// The relation source is the reading index's own bonds (holodeck's cast/bonds,
// eoreader7's witness of which referents are held together and how). A bond's
// dominant relation term is the verb; its two ends are the subject and object.
import { assertionsFromTriples, buildEntityProfiles, profileLines } from './vendor/eoreader7/native/kernel/entity-profile.js';

const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STANDING_LABEL = {
  fixed: 'fixed', 'one-at-a-time': 'one at a time', 'many-valued': 'many-valued',
  'time-unknown': 'time unknown', unexposed: 'unexposed', unknown: 'no kind',
};

/** The relation a bond witnessed most often — its dominant term, else nothing. */
export function dominantRel(rel) {
  const e = Object.entries(rel || {}).sort((a, b) => b[1] - a[1])[0];
  return e && clean(e[0]) ? clean(e[0]) : null;
}

// A bond's connecting term is often a pure connector ("of", "and") rather than
// a relation. This is the CALLER'S classification of which relation names may
// define a kind — the same licence kind-functional-induction.js's `inProfile`
// grants ("a caller filters out bookkeeping relations with a GIVEN
// classification, never a list typed here"). It is STRUCTURAL, not a topic
// list: a term must carry at least one word of three letters and, if it is a
// single word, not be a bare English function word.
const CONNECTOR = new Set(['of', 'and', 'with', 'the', 'for', 'to', 'that', 'this', 'by', 'as', 'at', 'from', 'or', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its', 'in', 'on', 'a', 'an', 's', 't', 'd', 'll', 're', 've', 'm']);
export function contentRel(term) {
  const t = clean(term).toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  if (!/[a-z]{3,}/.test(t)) return null;
  const words = t.split(/\s+/).filter((w) => w.length >= 3);
  if (!words.length) return null;
  if (t.split(/\s+/).length === 1 && CONNECTOR.has(t)) return null;
  return clean(term);
}

/** The reading index's bonds as triples, in the shape kind induction runs on. */
export function triplesFromBonds(bonds = [], { identity = (x) => x, limit = 6000, contentOnly = true } = {}) {
  const out = [];
  for (const b of bonds) {
    if (out.length >= limit) break;
    const raw = dominantRel(b.rel);
    const verb = contentOnly ? contentRel(raw) : raw;
    if (!verb || !b.a || !b.b) continue;
    out.push({ id: `bond:${b.a}|${b.b}`, subject: b.a, verb, object: b.b, witnessed: (b.n ?? b.pos ?? 1) > 0, seq: b.firstSeq ?? null });
  }
  return out;
}

/** Surface ⇄ id maps from the cast, so a bond's surface names resolve to one
 *  referent and a profile reads back under the name a person sees. */
export function castIndex(cast = []) {
  const idOfSurface = new Map();
  const surfaceOfId = new Map();
  for (const c of cast) {
    const surf = (c.surfaces || [])[0] || c.id;
    surfaceOfId.set(c.id, surf);
    for (const s of c.surfaces || [c.id]) idOfSurface.set(String(s).toLowerCase(), c.id);
    idOfSurface.set(String(c.id).toLowerCase(), c.id);
  }
  return { idOfSurface, surfaceOfId };
}

/** buildFromReading(index, opts) -> { schema, byId, idOfSurface, surfaceOfId, diagnostics }
 *  One kind induction for the whole cast, one profile per referent. */
export function buildFromReading(index, { exposureFloor = 2, kindMethod = 'characteristic-sets', draws = 60, alpha = 0.05, seed = 5, limit = 6000 } = {}) {
  const cast = index?.cast || [];
  const { idOfSurface, surfaceOfId } = castIndex(cast);
  const referents = cast.map((c) => c.id);
  const identity = (x) => idOfSurface.get(String(x).toLowerCase()) ?? x;
  const triples = triplesFromBonds(index?.bonds || [], { identity, limit });
  const by = assertionsFromTriples(triples, { referents, identity });
  const built = buildEntityProfiles(by, { referents, exposureFloor, kindMethod, kindOptions: { population: 'holodeck:reading', draws, alpha, seed } });
  return { ...built, idOfSurface, surfaceOfId };
}

/** triplesFromObservations(lines) — the corpus's own per-referent observations
 *  (referents.eot.jsonl: `observe` fields + `alias` surfaces). Each field is a
 *  relation to its value; the relations repeat, so kinds can be induced. */
export function triplesFromObservations(lines = []) {
  const out = [];
  for (const l of lines) {
    if (!l || !l.id) continue;
    if (l.schema === 'observe') {
      for (const [k, v] of Object.entries(l.fields || {})) {
        if (v == null || v === '') continue;
        out.push({ id: `${l.id}:${k}`, subject: l.id, verb: k, object: String(v), witnessed: l.confidence !== 'uncertain', seq: l.ts ? Date.parse(l.ts) || null : null });
      }
    } else if (l.schema === 'alias' && l.surface) {
      out.push({ id: `${l.id}:alias:${l.surface}`, subject: l.id, verb: 'also written', object: l.surface, witnessed: l.confidence !== 'uncertain' });
    }
  }
  return out;
}

/** triplesFromAnalysis(A) — the holodeck's OWN reading of a workspace, as
 *  relations that repeat: the kind of being each name is (`typed`), a short
 *  form (`also written`), the frame of the statements it appears in (`said
 *  with`), the sources that name it (`named in`), the beings it keeps company
 *  with (`appears with`), the figures and dates its statements carry
 *  (`figure` · `year`), and what its statements are about (`about`). Clean and
 *  structural, so a being gets a real profile and kinds can form. */
export function triplesFromAnalysis(A, { maxCompany = 24, maxTopics = 8 } = {}) {
  const out = []; const seen = new Set();
  const push = (s, v, o) => { if (!s || !v || !o) return; const k = s + '\u0001' + v + '\u0001' + o; if (seen.has(k)) return; seen.add(k); out.push({ subject: s, verb: v, object: o, witnessed: true }); };
  const byId = A?.byId || {};
  for (const n of Object.values(A?.names || {})) {
    push(n.name, 'typed', n.type || 'other');
    for (const al of n.aliases || []) push(n.name, 'also written', al);
    const frames = new Set(); const docs = new Set(); const company = new Map(); const topics = new Map(); const figs = new Set(); const years = new Set();
    for (const id of n.sts || []) {
      const st = byId[id]; if (!st) continue;
      frames.add(st.frame || 'fact'); docs.add(st.doc);
      for (const o of st.names || []) if (o !== n.name) company.set(o, (company.get(o) || 0) + 1);
      for (const g of st.figs || []) { const raw = g.raw || (g.value != null ? String(g.value) : null); if (raw) figs.add(clean(raw).slice(0, 40)); }
      for (const g of st.dates || []) if (g.year) years.add(String(g.year));
      for (const w of st.topics || []) topics.set(w, (topics.get(w) || 0) + 1);
    }
    for (const f of frames) push(n.name, 'said with', f);
    for (const d of docs) push(n.name, 'named in', d);
    for (const v of figs) push(n.name, 'figure', v);
    for (const y of years) push(n.name, 'year', y);
    for (const [o] of [...company.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxCompany)) push(n.name, 'appears with', o);
    for (const [w] of [...topics.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxTopics)) push(n.name, 'about', w);
  }
  return out;
}

/** buildFromTriples(triples, opts) — profile a population from any relation
 *  stream. `beings` is the population; omit it to profile only asserted ends. */
export function buildFromTriples(triples, { beings = null, exposureFloor = 2, kindMethod = 'characteristic-sets', draws = 99, alpha = 0.05, seed = 5 } = {}) {
  const referents = beings ? [...beings].map(String) : null;
  const by = assertionsFromTriples(triples, { referents });
  return buildEntityProfiles(by, { referents, exposureFloor, kindMethod, kindOptions: { population: 'holodeck', draws, alpha, seed } });
}

/** profileFor(built, name) — the profile of the referent a surface name names. */
export function profileFor(built, name) {
  if (!built || !name) return null;
  const id = built.idOfSurface?.get(String(name).toLowerCase()) || String(name);
  return built.byId.get(id) || built.byId.get(String(name)) || null;
}

/** paramRows(profile, built) — the rows a template binds: one per parameter,
 *  its standing, its star (kind-characteristic) and its values as surfaces. */
export function paramRows(profile, built) {
  if (!profile || !profile.parameters.length) return [];
  const label = (v) => built?.surfaceOfId?.get(v) ?? String(v);
  return profile.parameters.map((p) => ({
    rel: p.rel,
    star: p.kindCharacteristic ? '★' : '',
    standing: STANDING_LABEL[p.standing] ?? p.standing,
    cls: 'st-' + String(p.standing).replace(/[^a-z]+/gi, '-'),
    weight: p.informationWeight,
    values: p.values.slice(0, 8).map((v) => ({ text: label(v.value), n: v.count })),
    more: p.values.length > 8 ? '+' + (p.values.length - 8) : '',
  }));
}

/** The profile's own words: kind line + parameter rows + basis, no HTML. */
export function profileText(profile, built) {
  if (!profile) return [];
  const lines = profileLines(profile);
  const label = (v) => built?.surfaceOfId?.get(v) ?? String(v);
  return lines.map((l) => l.replace(/(→ )(.+)$/, (m, a, rest) => a + rest.split(', ').map((x) => { const [v, n] = x.split('×'); return (label(v) || v) + (n ? '×' + n : ''); }).join(', ')));
}

/** renderPanel(built, name) — a self-contained holodeck-styled panel (for a
 *  surface that renders HTML rather than binding rows). */
export function renderPanel(built, name, { title = null } = {}) {
  const p = profileFor(built, name);
  if (!p) return '';
  const kind = p.kinds.map((k) => k.signatures.slice(0, 4).join(' · ') || k.kindKey).join(' / ');
  const head = `<div class="hp-head"><b>${esc(title || built.surfaceOfId?.get(p.id) || p.id)}</b>`
    + (p.established ? `<span class="hp-kind" title="${esc(p.kinds.map((k) => k.kindKey).join(' · '))}">${esc(kind)}</span>` : `<span class="hp-kind none">no kind established</span>`)
    + `<span class="hp-count">${p.parameters.length} parameter${p.parameters.length === 1 ? '' : 's'}</span></div>`;
  const rows = paramRows(p, built).map((r) =>
    `<div class="hp-row"><span class="hp-rel">${r.star ? `<b class="hp-star">★</b>` : ''}${esc(r.rel)}</span>`
    + `<span class="hp-st ${r.cls}">${esc(r.standing)}</span>`
    + `<span class="hp-vals">${r.values.map((v) => `<span class="hp-val">${esc(v.text)}${v.n > 1 ? `<i>×${v.n}</i>` : ''}</span>`).join('')}${r.more ? `<span class="hp-more">${esc(r.more)}</span>` : ''}</span></div>`).join('');
  return `<div class="hp-panel" data-entity="${esc(p.id)}">${head}${rows ? `<div class="hp-rows">${rows}</div>` : `<p class="hp-empty">no relations witnessed — nothing to profile</p>`}</div>`;
}

export function mountPanel(host, built, name, opts) { if (host) host.innerHTML = renderPanel(built, name, opts); }

export const PROFILE_CSS = `
.hp-panel{border:1px solid var(--line,#2b2450);border-radius:10px;padding:10px 12px;background:var(--s1,#fff);font:13px/1.45 'Hanken Grotesk',system-ui,sans-serif;color:var(--ink)}
.hp-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.hp-kind{font:600 10px 'JetBrains Mono';letter-spacing:.06em;text-transform:uppercase;color:var(--acc);border:1px solid var(--line2);border-radius:99px;padding:1px 8px}
.hp-kind.none{color:var(--mut);border-style:dashed}
.hp-count{margin-left:auto;font:500 11px 'JetBrains Mono';color:var(--mut)}
.hp-row{display:grid;grid-template-columns:minmax(80px,1.3fr) auto minmax(0,2fr);gap:8px;align-items:center;padding:3px 0;border-top:1px solid var(--line)}
.hp-row:first-child{border-top:0}
.hp-rel{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hp-star{color:var(--acc)}
.hp-st{font:600 10px 'JetBrains Mono';border-radius:99px;padding:1px 7px;border:1px solid var(--line2);color:var(--mut);white-space:nowrap}
.hp-st.st-fixed{color:#2f9e63;border-color:#2f9e63}
.hp-st.st-one-at-a-time{color:#b7791f;border-color:#b7791f}
.hp-st.st-many-valued{color:#c53030;border-color:#c53030}
.hp-vals{display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;min-width:0}
.hp-val{background:var(--s2);border-radius:5px;padding:0 6px;font:500 11px 'Hanken Grotesk';max-width:18ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hp-val i{color:var(--mut);font-style:normal;font-size:10px;margin-left:2px}
.hp-more{color:var(--mut);font-size:11px}
.hp-empty{color:var(--mut);margin:4px 0 0;font-size:12px}
`;
