// native/organs/stance.js — THE ENGLISH EVALUATIVE LENS, ONE giver for the
// whole system. Handle: the adapter's own grammar.
//
// A text carries a STANCE — the evaluation it puts on what it names: good/bad,
// warranted/overreach, success/failure. "Is this an improvement or an unwanted
// constraint?" is carried as much by "boondoggle" vs "common sense" as by any
// number. This organ reads that stance, so the rest of the engine can only ever
// compare it — the fold (the-fold/holodeck-summary.js) reads an identity's held
// stance, and the archons (the-fold/archon-rules.js) catch a piece that
// asserts a stance the material contradicts.
//
// THE LEXICON IS ENGLISH, AND RECORDED AS AN ENGLISH CONVENTION, with a giver,
// exactly like the language-law priors. It is a LENS, never the kernel: a
// language's stance markers are that language's own (a negative stance in
// English is often a suffix or a particle elsewhere). Swap this file and the
// judgment is unchanged — the material still states an evaluation; only how
// English words it is this file's.
//
// It classifies STANCE, not content. Used to compare two stances, it can say a
// piece asserts the opposite of what it describes; it can never say what the
// piece is about. Every caller must carry the giver beside any finding.
export const GIVER = "English evaluative lens (adapter grammar) — not universal; replace per language";

const POS = /\b(good|best|better|warranted|justified|support(?:s|ed)?|effective(?:ness)?|reasonable|sensible|targeted|necessary|needed|solved?|improve(?:s|d)?|improvement|safe|safety|benefit(?:s|ed|ial)?|recommend(?:s|ed|ation)?|valuable|worthwhile|smart|common sense|success(?:ful|es)?|fairness|fair|progress|helpful|achievement|triumph|praise(?:s|d)?|commend(?:s|ed)?|excellent|positive|right(?:ly)?)\b/i;
const NEG = /\b(overreach|unnecessary|waste(?:ful|s)?|problem(?:s|atic)?|harm(?:s|ed|ful)?|danger(?:ous|s)?|bad|fail(?:s|ed|ure|ures)?|broken|boondoggle|whin(?:e|es|ing|y)|wrong|risk(?:s|y)?|costly|excessive|unwarranted|fraud(?:ulent)?|dismiss(?:es|ed|ive)?|affront|silly|nonsense|threat(?:s|ening)?|burden(?:s|some)?|illegitimate|abuse(?:s|d)?|corrupt(?:ion)?|detriment(?:al)?|unfair|injustic(?:e|es)|loss(?:es)?|suffer(?:s|ed|ing)?|harsh(?:ly)?|cruel|oppress(?:ion|ive|ed)?|punish(?:ment|ed|ing)?|coerc(?:ion|ive|ed)?|exploit(?:ation|ed|ative)?)\b/i;

/** stanceOf(text) -> +1 | -1 | 0 on the English lens. +1 = evaluatively
 *  positive, -1 = negative, 0 = neutral (no stance word, or a tie). A word
 *  that is a bare fact ("work was provided") is not a stance word; the lexicon
 *  is deliberate, recorded, and never a content classifier. */
export function stanceOf(text) {
  const t = String(text ?? "");
  const pos = (t.match(new RegExp(POS, "gi")) || []).length;
  const neg = (t.match(new RegExp(NEG, "gi")) || []).length;
  return Math.sign(pos - neg);
}

/** stanceWords(text) -> { pos, neg, of } — the evidence, so a finding can cite
 *  the words that carried the stance, never just the sign. */
export function stanceWords(text) {
  const t = String(text ?? "");
  const pos = t.match(new RegExp(POS, "gi")) || [];
  const neg = t.match(new RegExp(NEG, "gi")) || [];
  return { pos, neg, of: Math.sign(pos.length - neg.length) };
}