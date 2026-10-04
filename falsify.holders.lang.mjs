// falsify.holders.lang.mjs — THE HOLDER-INDEXED READING ON OTHER LANGUAGES, and
// the LATENT PERSPECTIVES it exposes: the beings a source names but never lets
// speak — their point of view is not included.
//
// The English build injects the English treebank verb prior and the app's own
// admitted cast. Here each language injects ITS OWN prior (pos-spa, pos-rus —
// never English read over another language, the repo's cardinal rule), and the
// projection is perspective.js's own: asserted holders vs the reader's
// witnessed beliefs, with every admitted referent that holds nothing at all
// reported as a latent perspective.
//
//   npm run serve                 # in another shell, :8813
//   node falsify.holders.lang.mjs # real es/ru corpora + synthetic dialogue
//
// THE FALSIFIERS
//   SAFETY    no fabricated holder, in any language or script — a holder that
//             is neither the reader nor an admitted referent fails.
//   NO-BLEED  the English prior read over Spanish/Russian must NOT attribute a
//             speaker (never another language's grammar silently).
//   PER-LANG  each language's own prior DOES attribute its own speech verbs.
//   LATENT    a being spoken of but never speaking is reported, not omitted.

import { openSurface } from './drive-holodeck.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { READER, BASIS, perspectiveOperation, projectPerspectives } from './vendor/eoreader7/native/kernel/perspective.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(path.join(HERE, p), 'utf8');

const html = (id, file, title, lang) => ({ id, title, format: 'html', html: read(file), url: 'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(title), lang });
const text = (id, title, body, lang, url) => ({ id, title, format: 'text', text: body, url, lang });

const ES_DIALOGUE = [
  html('es0', 'corpus-es/Frida_Kahlo.html', 'Frida Kahlo', 'es'),
  text('es1', 'Escena', 'En el patio, los vecinos vieron a Frida junto al caballete. Más tarde, Diego pintaba un mural. “Voy a pintar”, dijo Frida. “El color es vida”, afirmó Frida.', 'es', 'https://es.wikipedia.org/wiki/Frida_Kahlo'),
];
const RU_DIALOGUE = [
  html('ru0', 'corpus-ru/Пушкин,_Александр_Сергеевич.html', 'Пушкин', 'ru'),
  text('ru1', 'Сцена', 'Во дворе соседи увидели Пушкина у окна. Позже Наталья читала письмо. «Я буду писать», — сказал Пушкин. «Слово — это всё», — заявил Пушкин.', 'ru', 'https://ru.wikipedia.org/wiki/Пушкин'),
];
// A quotation that is NOT speech: a work title in guillemets, with an admitted
// subject in front of a normal verb. The adapter accepts ANY verb beside an
// admitted name as a speech tag, so this is where it over-reaches. The control
// asserts the statement is UNOWNED — a title has no speaker.
const TITLE_CONTROL = {
  es: text('c0', 'Control', 'Los vecinos vieron a España en el mapa. España celebró el congreso «Mundo».', 'es', 'https://es.wikipedia.org/wiki/España'),
  ru: text('c0', 'Control', 'В 2006 году в России прошёл саммит «Большой восьмёрки».', 'ru', 'https://ru.wikipedia.org/wiki/Россия'),
};

const REAL = [
  { id: 'es', label: 'Spanish (real)', lang: 'es', docs: [
    html('es0', 'corpus-es/Frida_Kahlo.html', 'Frida Kahlo', 'es'),
    html('es1', 'corpus-es/Gabriel_García_Márquez.html', 'Gabriel García Márquez', 'es'),
    text('es2', 'Madrid', JSON.parse(read('corpus-es/Madrid.json')).extract, 'es', 'https://es.wikipedia.org/wiki/Madrid'),
    text('es3', 'Frida Kahlo', JSON.parse(read('corpus-es/Frida_Kahlo.json')).extract, 'es', 'https://es.wikipedia.org/wiki/Frida_Kahlo'),
  ] },
  { id: 'ru', label: 'Russian (real)', lang: 'ru', docs: [
    html('ru0', 'corpus-ru/Пушкин,_Александр_Сергеевич.html', 'Пушкин', 'ru'),
    html('ru1', 'corpus-ru/Путин,_Владимир_Владимирович.html', 'Путин', 'ru'),
    text('ru2', 'Москва', JSON.parse(read('corpus-ru/Москва.json')).extract, 'ru', 'https://ru.wikipedia.org/wiki/Москва'),
    text('ru3', 'Путин', JSON.parse(read('corpus-ru/Путин,_Владимир_Владимирович.json')).extract, 'ru', 'https://ru.wikipedia.org/wiki/Путин'),
  ] },
];

const PRIOR = { es: 'pos-spa.json', ru: 'pos-rus.json', en: 'pos-eng.json' };
const cut = (s, n = 58) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

// Run analyze in the page, then re-attribute with the chosen language's prior.
async function readHolders(surf, docs, posFile) {
  return surf.page.evaluate(async ({ docs, posFile }) => {
    const A = window.__holodeck.analyze({ docs });
    const M = await import(new URL('holodeck-holders.js', location.href).href);
    let forms = null;
    try { const r = await fetch(new URL('vendor/eoreader7/native/priors/' + posFile, location.href)); if (r.ok) forms = (await r.json()).forms || null; } catch (e) {}
    const isVerb = (w) => {
      if (!forms) return false;
      const k = String(w || '').toLowerCase().replace(/['’]s$/, '');
      const c = forms[k]; if (!c) return false;
      const e = Object.entries(c).sort((a, b) => b[1] - a[1]);
      return !!e[0] && (e[0][0] === 'VERB' || e[0][0] === 'AUX');
    };
    const admitted = new Set(Object.keys(A.names));
    const byAlias = new Map();
    Object.values(A.names).forEach((n) => { byAlias.set(n.name, n.name); (n.aliases || []).forEach((a) => byAlias.set(a, n.name)); });
    const referentFor = (s) => { if (!s) return null; if (byAlias.has(s)) return byAlias.get(s); return admitted.has(s) ? s : null; };
    const held = M.attributeStatements(A.sts, A.docs, { isVerb, referentFor });
    A.sts.forEach((st) => { st.heldBy = held.get(st.id); });
    const sum = M.summarizeHolders(A.sts, A.names);
    return {
      sts: A.sts.map((s) => ({ id: s.id, doc: s.doc, text: s.text, heldBy: s.heldBy })),
      names: Object.keys(A.names),
      holders: sum.holders, gaps: sum.gaps, silent: sum.silent,
    };
  }, { docs, posFile });
}

// perspective.js's own projection over the heldBy records: who holds, and who
// is admitted to the material but holds nothing (a latent point of view).
function project(read) {
  const log = [];
  for (const st of read.sts) {
    const h = st.heldBy; if (!h || !h.holder) continue;
    log.push(perspectiveOperation({ holder: h.holder, claim: st.id, basis: h.basis === BASIS.ASSERTED ? BASIS.ASSERTED : BASIS.WITNESSED }));
  }
  const p = projectPerspectives(log);
  const holders = p.holders.filter((x) => x !== READER);
  const latent = read.names.filter((n) => !p.perspectives[n]).sort();
  return { holders, latent, asserted: holders.filter((h) => p.perspectives[h].beliefs.some((b) => b.basis === BASIS.ASSERTED)) };
}

function safety(read) {
  const fails = [];
  const admitted = new Set(read.names);
  for (const st of read.sts) {
    const h = st.heldBy;
    if (h && h.holder && h.holder !== READER && !admitted.has(h.holder)) fails.push('fabricated holder ' + JSON.stringify(h.holder) + ' on “' + cut(st.text) + '”');
  }
  return fails;
}

async function main() {
  const surf = await openSurface({ headless: true });
  let failed = 0;
  try {
    await surf.page.waitForFunction(() => window.__holodeck && typeof window.__holodeck.analyze === 'function', null, { timeout: 60000 });
    await surf.page.waitForFunction(() => window.__holodeck.hdEngineReady && window.__holodeck.hdEngineReady(), null, { timeout: 60000 });
    await surf.page.waitForFunction(() => window.__holodeck.hdReaderReady && window.__holodeck.hdReaderReady(), null, { timeout: 60000 });
    await surf.page.waitForFunction(() => window.__holodeck.hdAttrReady && window.__holodeck.hdAttrReady(), null, { timeout: 60000 });

    for (const c of REAL) {
      const t0 = Date.now();
      const read = await readHolders(surf, c.docs, PRIOR[c.lang]);
      const proj = project(read);
      const fails = safety(read);
      console.log('\n══ ' + c.label + ' ══════════════════════════════════════════════');
      console.log('  statements: ' + read.sts.length + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + 's) · admitted referents: ' + read.names.length);
      console.log('  holders found: ' + (read.holders.length ? read.holders.map((x) => x.holder + '×' + x.statements).join(', ') : '(none)'));
      console.log('  typed gaps:    ' + (read.gaps.length ? read.gaps.map((x) => x.type + '×' + x.statements).join(', ') : '(none)'));
      console.log('  LATENT POVs (admitted, hold nothing — their point of view is not included):');
      console.log('    ' + (proj.latent.length ? proj.latent.slice(0, 24).join(' · ') + (proj.latent.length > 24 ? ' … (+' + (proj.latent.length - 24) + ')' : '') : '(none)'));
      console.log('  ' + (fails.length ? 'FAIL' : 'PASS') + '  SAFETY: no fabricated holder' + (fails.length ? ' →' : ''));
      for (const f of fails) console.log('      - ' + f);
      failed += fails.length ? 1 : 0;
    }

    for (const c of [{ id: 'es', label: 'Spanish', docs: ES_DIALOGUE }, { id: 'ru', label: 'Russian', docs: RU_DIALOGUE }]) {
      console.log('\n══ ' + c.label + ' — synthetic dialogue + cross-language control ══');
      const own = await readHolders(surf, c.docs, PRIOR[c.id]);
      const proj = project(own);
      const fails = safety(own);
      const speaker = proj.asserted;
      console.log('  own prior (' + PRIOR[c.id] + '):');
      for (const st of own.sts.filter((s) => s.heldBy && s.heldBy.holder && s.heldBy.holder !== READER)) console.log('    ' + cut(st.text).padEnd(60) + ' → ' + st.heldBy.holder);
      const okOwn = speaker.length > 0;
      if (!okOwn) fails.push('the language’s own prior found no speaker — the organ did not run in ' + c.label);
      console.log('    asserted speakers: ' + (speaker.join(', ') || '(none)') + '  → ' + (okOwn ? 'PASS PER-LANG' : 'FAIL PER-LANG'));
      console.log('    LATENT (' + proj.latent.length + '): ' + (proj.latent.slice(0, 20).join(' · ') + (proj.latent.length > 20 ? ' … (+' + (proj.latent.length - 20) + ')' : '') || '(none)'));
      // NO-BLEED: the English prior must not attribute a Spanish/Russian speaker.
      const eng = await readHolders(surf, c.docs, PRIOR.en);
      const engSpeakers = project(eng).asserted;
      const bleed = engSpeakers.length > 0;
      const engFails = safety(eng);
      if (bleed) fails.push('the English prior attributed ' + engSpeakers.join(', ') + ' in ' + c.label + ' — another language’s grammar leaked in');
      console.log('    English prior on ' + c.label + ': asserted speakers = ' + (engSpeakers.join(', ') || '(none)') + '  → ' + (bleed ? 'FAIL NO-BLEED' : 'PASS NO-BLEED'));
      for (const f of engFails) fails.push(f);
      // TITLE CONTROL: a quoted work title has no speaker. The adapter accepts
      // any verb beside an admitted name as a speech tag — this is the rule's
      // over-reach, and the falsification it names.
      const ctl = await readHolders(surf, [TITLE_CONTROL[c.id]], PRIOR[c.id]);
      const ctlSpeakers = ctl.sts.filter((s) => s.heldBy && s.heldBy.holder && s.heldBy.holder !== READER).map((s) => s.heldBy.holder + ' @ “' + cut(s.text, 46) + '”');
      if (ctlSpeakers.length) fails.push('a quoted work title was attributed to a speaker (' + ctlSpeakers.join('; ') + ') — the adapter reads any verb beside an admitted name as a speech tag');
      console.log('    title control (a title is not a speaker): ' + (ctlSpeakers.length ? 'OVER-ATTRIBUTED → ' + ctlSpeakers.join('; ') : 'unowned') + '  → ' + (ctlSpeakers.length ? 'FAIL PRECISION' : 'PASS'));
      console.log('  ' + (fails.length ? 'FAIL' : 'PASS'));
      for (const f of fails) console.log('      - ' + f);
      failed += fails.length ? 1 : 0;
    }

    console.log('\n' + (failed ? 'VERDICT: FAIL (' + failed + ' case(s))' : 'VERDICT: PASS — holders attributed per language, latent POVs reported, no fabrication, no language bleed'));
    if (surf.consoleErrors.length) console.log('console errors:', JSON.stringify(surf.consoleErrors.slice(0, 5)));
    if (failed) process.exitCode = 1;
  } finally {
    await surf.close();
  }
}

main();
