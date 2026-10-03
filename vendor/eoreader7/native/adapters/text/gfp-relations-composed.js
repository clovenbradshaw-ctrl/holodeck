// native/adapters/text/gfp-relations-composed.js — THE COMPOSED READER, NO MODEL.
//
// Two model-free readers exist, each at its own grain:
//   RECURRENCE (relations-gfp.js) — figure-connector-figure arrangements over
//     the whole text; broad coverage, but the connector between two SPARSE
//     figure mentions can be a whole clause (measured: "NDOT —, includes a plan
//     to roll out→ No Turn").
//   POSITIONAL (relations-positional.js) — ONE main clause per sentence, roles
//     by position under a MEASURED RoleConfig@1; precise connector (the verb),
//     but narrow coverage (measured: 4 of 155 sentences on a real essay).
//
// COMPOSED: for each sentence, prefer the POSITIONAL clause's connector when
// the positional reader settles one (it names the head that does the
// connecting); otherwise fall back to the recurrence arrangement. Same public
// shape out ({end1, label, end2, cell, grain, polarity, offset}), so every
// downstream consumer is unchanged. Neither reader calls a model.
//
// REMEMBER REFERENTS: the referent index (`figures`) is passed IN, built once
// by the caller, so a read and its re-read measure the same beings.
import { extractGfpRelations } from "./relations-gfp.js";
import { relationExtractorsFor } from "./relations-language.js";
import { splitSentences } from "./spans.js";

/**
 * composedRelations(text, { posPrior, figures, roleConfig, classifyWord,
 * dominantClass, minRec }) -> the composed arrangements, one list, same shape.
 * `roleConfig`/`classifyWord`/`dominantClass` enable the positional leg; absent
 * them the reader degrades to recurrence alone, disclosed.
 */
export function composedRelations(text, { posPrior = null, figures = null, roleConfig = null, classifyWord = null, dominantClass = null, verbForms = null, minRec = 2, clauseAware = true } = {}) {
  const body = String(text ?? "");
  // the recurrence leg: the arrangement yield over the whole text
  const recurrence = extractGfpRelations(body, { posPrior, figures, minRec, clauseAware });

  // the positional leg: one clause per sentence, its connector the precise head
  let positional = [];
  let positionalRan = false;
  if (roleConfig && posPrior && classifyWord && dominantClass) {
    positionalRan = true;
    const readers = relationExtractorsFor({ language: roleConfig.language ?? "eng", roleConfig, posPrior, classifyWord, dominantClass, ...(verbForms ? { verbForms } : {}) });
    for (const s of splitSentences(body)) {
      const st = s.text ?? s;
      const r = readers.extractRelations(st, {});
      for (const rel of r) if (rel.end1 && rel.label && rel.end2) positional.push({ ...rel, sentence: st, basis: "positional clause" });
    }
  }

  // COMPOSE: a positional clause OWNS its sentence's connector. Index the
  // recurrence arrangements by the sentence they fall in; where a positional
  // clause settled, its arrangement replaces the recurrence ones for that
  // sentence's figure pair (the precise connector wins). Every recurrence
  // arrangement in a sentence the positional reader did NOT settle is kept.
  const settledPairs = new Set(positional.map((p) => `${String(p.end1).toLowerCase()}|${String(p.end2).toLowerCase()}`));
  const out = [...positional];
  for (const r of recurrence) {
    const pair = `${String(r.end1).toLowerCase()}|${String(r.end2).toLowerCase()}`;
    if (settledPairs.has(pair)) continue; // the clause reader already said this, precisely
    out.push({ ...r, basis: r.basis ?? "recurrence arrangement" });
  }
  // de-duplicate by (end1, label-head, end2), keeping the first (positional
  // was pushed first, so the precise connector is the survivor)
  const seen = new Set();
  const unique = [];
  for (const a of out) {
    const k = `${String(a.end1).toLowerCase()}|${String(a.end2).toLowerCase()}|${String(a.label).toLowerCase().split(/\s+/)[0]}`;
    if (seen.has(k)) continue;
    seen.add(k); unique.push(a);
  }
  return { relations: unique, positional: positional.length, recurrence: recurrence.length, positionalRan, basis: positionalRan ? "composed: positional clause connector where it settled, recurrence arrangement elsewhere" : "recurrence only — positional leg disabled (roleConfig/posPrior/classifyWord/dominantClass not all supplied), disclosed" };
}

export default composedRelations;