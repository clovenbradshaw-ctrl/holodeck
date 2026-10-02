// holodeck-lang.test.mjs — THE SUMMARY RENDERS IN ANY LANGUAGE, ZERO MODEL:
// GFP → a language's specific grammar → its natural language. Falsifies the
// lens against hand-checkable claims —
//
//   1. WORD-ORDER LAW: a lens's declared order (SVO/SOV/VSO) is exactly the
//      position of its copula/verb relative to the end1 and the kind in the
//      sentence it renders. An SVO lens puts the verb between; an SOV lens
//      puts it last; a VSO lens first.
//   2. INFLECTION LAW: a language with a UniMorph-derived prior inflects
//      (English pluralizes, regular + the attested irregular tail; Russian
//      lemmatizes through the declension rules). A word with no paradigm
//      passes through UNCHANGED and is marked — never fabricated.
//   3. OMNILINGUAL LAW: every registered lens renders its own scaffolding in
//      its own language; the end1 and its kind always appear.
//   4. ZERO-MODEL LAW: the render path is pure — no fetch, no network, no
//      model — and an unregistered language is refused, never read as English.
//
//   node --test holodeck-lang.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { LANGS, languageOf, lensFor, plural, rusLemma, englishIrregular, setPriors, renderSummary, summaryVals, langOptions } from './holodeck-lang.js';

const ENG = JSON.parse(fs.readFileSync(new URL('./vendor/eoreader7/native/priors/morphology-eng.json', import.meta.url), 'utf8'));
const RUS = JSON.parse(fs.readFileSync(new URL('./vendor/eoreader7/native/priors/declension-rus.json', import.meta.url), 'utf8'));

// A hand-made profile (the same shape buildFromTriples returns) so the render
// path is tested without the induction machinery.
const PROFILE = {
  id: 'Althea', established: true,
  kinds: [{ kindKey: 'k1', signatures: ['office', 'party'] }],
  parameters: [
    { rel: 'office', kindCharacteristic: true, standing: 'fixed', informationWeight: 2.3, values: [{ value: 'Mayor', count: 1 }] },
    { rel: 'about', kindCharacteristic: true, standing: 'many-valued', informationWeight: 1.9, values: [{ value: 'transit', count: 1 }, { value: 'funding', count: 1 }] },
    { rel: 'year', kindCharacteristic: false, standing: 'time-unknown', informationWeight: 0.8, values: [{ value: '2024', count: 1 }] },
  ],
};
const BUILT = { surfaceOfId: new Map(), byId: new Map([[PROFILE.id, PROFILE]]) };

test('word-order law: the declared order is the verb’s real position in the sentence', () => {
  for (const l of LANGS) {
    const lens = lensFor(l.code);
    assert.ok(!lens.gap, `lens exists for ${l.code}`);
    const s = lens.phrases.readAs('SUBJ', 'KIND');
    assert.ok(s.includes('SUBJ') && s.includes('KIND'), `${l.code} renders both the being and its kind`);
    const iv = s.indexOf(lens.verb), ie = s.indexOf('SUBJ'), ik = s.indexOf('KIND');
    assert.ok(iv >= 0, `${l.code} carries its verb in the sentence`);
    if (l.order === 'SVO') assert.ok(ie < iv && iv < ik, `${l.code}: SVO — verb between end1 and kind: "${s}"`);
    else if (l.order === 'SOV') assert.ok(ie < ik && ik < iv, `${l.code}: SOV — verb last: "${s}"`);
    else if (l.order === 'VSO') assert.ok(iv < ie, `${l.code}: VSO — verb first: "${s}"`);
  }
});

test('inflation-law: English pluralizes content words, irregulars attested by the UniMorph prior', () => {
  setPriors({ engMorph: ENG, rusDecl: RUS });
  assert.ok((ENG.forms.mice || []).includes('mouse'), 'UniMorph eng attests mice → mouse');
  assert.equal(plural('statement', 'en').word, 'statements');
  assert.equal(plural('council', 'en').word, 'councils');
  assert.equal(plural('city', 'en').word, 'cities');
  assert.equal(plural('child', 'en').word, 'children', 'the irregular tail rides the prior');
  assert.equal(plural('mouse', 'en').word, 'mice', 'an attested irregular is taken from the prior');
  assert.equal(plural('mayor', 'en').word, 'mayors');
  setPriors({});
});

test('inflation-law: a word with no paradigm passes through unchanged and is marked', () => {
  const fr = plural('Metro Council', 'fr');
  assert.equal(fr.word, 'Metro Council');
  assert.equal(fr.inflected, false, 'the lens never fabricates an inflection it has no prior for');
});

test('declension law: Russian lemmatizes through the UniMorph declension rules', () => {
  setPriors({ engMorph: ENG, rusDecl: RUS });
  const le = rusLemma('источников');
  assert.equal(le.word, 'источник', 'declension rules strip the genitive plural -ов');
  assert.equal(rusLemma('источник').word, 'источник', 'a lemma already in lemma form is unchanged');
  assert.ok(rusLemma('xyzzy').inflected !== true, 'an unknown Russian word is left alone');
  setPriors({});
});

test('omnilingual-law: every lens renders its own scaffolding and keeps the being + kind', () => {
  for (const l of LANGS) {
    const v = summaryVals(PROFILE, BUILT, { code: l.code });
    assert.ok(v.has, `${l.code}: lens present`);
    assert.ok(v.aboutLabel && v.aboutLabel !== 'What it is about' || l.code === 'en', `${l.code}: its own "about" label`);
    assert.equal(v.autonym, l.autonym);
    for (const size of ['small', 'medium', 'full']) {
      const t = renderSummary(PROFILE, BUILT, { code: l.code, size });
      assert.ok(t && t.includes('Althea'), `${l.code} ${size}: names the being`);
      assert.ok(t.includes('office'), `${l.code} ${size}: carries the proposition`);
    }
  }
});

test('zero-model law: an unregistered language is refused, never read as English', () => {
  assert.equal(languageOf('xx'), null);
  assert.ok(lensFor('xx').gap, 'an unregistered language is a typed gap');
  assert.throws(() => renderSummary(PROFILE, BUILT, { code: 'xx' }), /no_lens/, 'rendering it throws — never a silent English read');
  assert.equal(summaryVals(PROFILE, BUILT, { code: 'xx' }).has, false);
});

test('zero-model law: the render path never fetches or calls a model', () => {
  const src = fs.readFileSync(fileURLToPath(new URL('./holodeck-lang.js', import.meta.url)), 'utf8');
  assert.ok(!/fetch\(|XMLHttpRequest|import\(['"]https?|createRequire/.test(src), 'no network or model reach in the lens');
  const before = { fetch: globalThis.fetch, XMLHttpRequest: globalThis.XMLHttpRequest };
  setPriors({ engMorph: ENG, rusDecl: RUS });
  const out = renderSummary(PROFILE, BUILT, { code: 'ja', size: 'full' });
  setPriors({});
  assert.equal(globalThis.fetch, before.fetch, 'rendering changed nothing about the environment');
  assert.ok(out.includes('Althea'));
});

test('a BCP-47 tag resolves to the lens, and the picker lists every lens', () => {
  assert.equal(languageOf('en-US'), 'en');
  assert.equal(languageOf('de-DE'), 'de');
  assert.equal(languageOf('FR_fr'), 'fr');
  assert.equal(languageOf('日本語'), 'ja', 'an autonym resolves');
  const opts = langOptions();
  assert.equal(opts.length, LANGS.length);
  assert.ok(opts.every((o) => lensFor(o.code).code === o.code));
});

test('the full-size text carries per-language source counts when provenance is given', () => {
  const prov = new Map([
    ['office\u0001Mayor', [{ id: 's1', doc: 'd1', docTitle: 'The Ledger', date: '2024', where: '', text: 'Althea holds office.' }]],
    ['about\u0001transit', [{ id: 's1', doc: 'd1', docTitle: 'The Ledger', date: '2024', where: '', text: 'Althea holds office.' }]],
  ]);
  const de = renderSummary(PROFILE, BUILT, { code: 'de', size: 'full', provenance: prov });
  assert.match(de, /Quellenaussage/, 'German full mode cites its own source-word');
  const ru = renderSummary(PROFILE, BUILT, { code: 'ru', size: 'full', provenance: prov });
  assert.match(ru, /исходных предложений|исходное предложение/, 'Russian full mode cites with Russian number agreement');
});