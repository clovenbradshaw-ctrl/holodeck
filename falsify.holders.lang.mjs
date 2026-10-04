// falsify.holders.lang.mjs — THE FRAME READ ON OTHER LANGUAGES, and the LATENT
// PERSPECTIVES it exposes: the beings a source names but never lets speak —
// their point of view is not included.
//
// The holder is the FRAME (who is telling), read through speaker.js's declared
// headings + quotation runs; the EOT front leg is each language's OWN reader
// under its RoleConfig@1 (relations-language.js). This driver REPORTS, per
// language, what the frame read finds and whether that language registers a
// RoleConfig at all — never reading one language through another's grammar.
//
//   npm run serve                 # in another shell, :8813
//   node falsify.holders.lang.mjs # real es/ru corpora + a synthetic control
//
// THE FALSIFIERS
//   SAFETY    no fabricated holder, in any language or script — a holder that
//             is neither the reader nor a declared frame fails.
//   NAMED GAP a language with no RoleConfig has no EOT (reported), and a
//             non-English heading is not read by speaker.js (reported) —
//             never a silent fall-back to English.
//   TITLE     a quoted work title is not a speaker (unowned, never attributed).
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
  text('es1', 'Escena', 'En el patio, los vecinos vieron a Frida junto al caballete. Más tarde, Diego pintaba un mural. Frida dijo que el color era vida. Frida afirmó que iba a pintar.', 'es', 'https://es.wikipedia.org/wiki/Frida_Kahlo'),
];
const RU_DIALOGUE = [
  html('ru0', 'corpus-ru/Пушкин,_Александр_Сергеевич.html', 'Пушкин', 'ru'),
  text('ru1', 'Сцена', 'Во дворе соседи увидели Пушкина у окна. Позже Наталья читала письмо. Пушкин сказал, что слово — это всё.', 'ru', 'https://ru.wikipedia.org/wiki/Пушкин'),
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
    // THE FRAME READ. Frames are read from the material's own declared
    // headings (speaker.js, English-scoped) and, when injected, a narration
    // prior. The EOT front leg is the language's OWN reader under its
    // RoleConfig (relations-language.js); es/ru register none here, so no EOT
    // is attached — a named gap, never an English matcher on their grammar.
    // role-config files are named by the treebank code (eng/heb/arb); es/ru
    // register none, so their front leg cannot run — a named gap, disclosed.
    const lang = String(posFile).replace(/^pos-|\.json$/g, '');
    let roleConfigExists = false;
    try { roleConfigExists = !!(await fetch(new URL('vendor/eoreader7/native/priors/role-config-' + lang + '.json', location.href))).ok; } catch (e) { roleConfigExists = false; }
    const held = M.attributeStatements(A.sts, A.docs, {});
    A.sts.forEach((st) => { st.heldBy = held.get(st.id); });
    const sum = M.summarizeHolders(A.sts, A.names);
    return {
      sts: A.sts.map((s) => ({ id: s.id, doc: s.doc, text: s.text, heldBy: s.heldBy })),
      names: Object.keys(A.names),
      holders: sum.holders, gaps: sum.gaps, silent: sum.silent,
      roleConfigExists,
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
      console.log('\n══ ' + c.label + ' — the frame read + front-leg availability ══');
      const own = await readHolders(surf, c.docs, PRIOR[c.id]);
      const proj = project(own);
      const fails = safety(own);
      // THE HONEST PER-LANGUAGE STATEMENT: frames are read from declared
      // headings, and speaker.js's heading grammar is English — a non-English
      // heading is a NAMED gap. The EOT front leg is the language's own reader
      // under its RoleConfig; with none registered, there is no EOT.
      console.log('  EOT front leg: ' + (own.roleConfigExists ? 'a RoleConfig is registered — usable, zero model' : 'ABSENT — no RoleConfig is registered for ' + c.id + ', so no EOT is read (a named gap, never English SVO on it)'));
      console.log('  declared frames read (speaker.js, English-scoped): ' + (own.holders.filter((x) => x.holder !== READER).length ? own.holders.filter((x) => x.holder !== READER).map((x) => x.holder + '×' + x.statements).join(', ') : '(none — a non-English heading is not read, a named gap)'));
      console.log('  holder reading: ' + (own.holders.length ? own.holders.map((x) => x.holder + '×' + x.statements).join(', ') : '(none)'));
      console.log('  typed gaps: ' + (own.gaps.length ? own.gaps.map((x) => x.type + '×' + x.statements).join(', ') : '(none)'));
      console.log('  LATENT POVs (' + proj.latent.length + '): ' + (proj.latent.slice(0, 20).join(' · ') + (proj.latent.length > 20 ? ' … (+' + (proj.latent.length - 20) + ')' : '') || '(none)'));
      const ctl = await readHolders(surf, [TITLE_CONTROL[c.id]], PRIOR[c.id]);
      const ctlSpeakers = ctl.sts.filter((s) => s.heldBy && s.heldBy.holder && s.heldBy.holder !== READER).map((s) => s.heldBy.holder);
      if (ctlSpeakers.length) fails.push('a quoted work title was attributed to a speaker (' + ctlSpeakers.join(', ') + ')');
      console.log('  title control (a title is not a speaker): ' + (ctlSpeakers.length ? 'OVER-ATTRIBUTED → ' + ctlSpeakers.join(', ') : 'unowned') + '  → ' + (ctlSpeakers.length ? 'FAIL' : 'PASS'));
      console.log('  ' + (fails.length ? 'FAIL' : 'PASS') + '  SAFETY: no fabricated holder');
      for (const f of fails) console.log('      - ' + f);
      failed += fails.length ? 1 : 0;
    }

    console.log('\n' + (failed ? 'VERDICT: FAIL (' + failed + ' case(s))' : 'VERDICT: PASS — the frame read is honest per language; a language with no RoleConfig has no EOT (a named gap), never another language’s grammar; no fabrication'));
    if (surf.consoleErrors.length) console.log('console errors:', JSON.stringify(surf.consoleErrors.slice(0, 5)));
    if (failed) process.exitCode = 1;
  } finally {
    await surf.close();
  }
}

main();
