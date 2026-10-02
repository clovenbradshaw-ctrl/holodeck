# Deriving a grounded summary ladder — working backward from the NTOR goldens

Companion to `no-turn-on-red.golden.json`. The goldens are the *target*; this is the
*derivation*: for each size, what must be true for a machine to produce it with no
model call, and where a model call is the disclosed last resort.

## 0. The one law that decides everything

A summary is **not written**. Writing prose is a model call and a paraphrase is not
grounded. So a summary is a **curation of the source's own sentences**: select, order,
and stitch verbatim spans. Length is a *selection budget*, not a generation budget.
Grounding is therefore structural: every line already exists in the source at an offset.

That single decision is why the current source "summary" fails — it shows one
`headlines()` pick, which is a *headline*: no budget, no coverage, no ordering, no
resolution. It is not a summary at any size.

## 1. What the source actually is (and why the goldens look like that)

NTOR is an argument with a **turn**. The reader arrives with a prior — "the bill is
overreach; nobody is getting hurt." The essay's whole payroll is spent dissolving that
prior:

- the turn: the data shows 1,286 pedestrian/cyclist injuries near crosswalks, 146 at the
  exact 59 proposed NTOR sites, 15 deaths — so the targeted bill is warranted;
- the resolver: the reason it wasn't already done is not engineering but a business
  interest (DZL, via the CM's own presentation).

So the goldens are not "the most important facts." They are the **turn and its
resolvers**. This is the holographic-surprise model, not occurrence surprise:

- occurrence surprise would ask "is a pedestrian crash rare?" — it isn't, and that's
  irrelevant here;
- holographic surprise asks "does this statement reorganize the picture *against the
  baseline the reader already holds*?" The baseline is the workspace prior (rare-topic
  IDF + name weights) plus the shuffle-null floor. `excess(a)` is how far `a` moves the
  picture over what the baseline already predicts.
- the resolver `b` is the statement that, **added to the baseline**, drops `a`'s excess:
  `S(a | B ∪ {b}) < S(a | B)`. That is baseline augmentation — a counterfactual over the
  *holograph*, never over whether an event was likely.

`There are ... 2,560 incidents (or 95%)` is *evidence*, not the turn. The turn is the
verdict that follows it. A summarizer that ranks by salience will grab the biggest
number; this one must grab the claim that number *resolves*.

## 2. Walking backward, size by size

### Paper (full)
**Target:** every non-furniture claim sentence, sectioned by the source's own headings,
verbatim, with offsets.
**Needs to be true:** sentence segmentation with offsets (already exists, `analyze()`
`st.s`/`st.e`); a furniture filter that drops figure captions, credit lines, the
`nd` artifact, and reference matter (already exists, `isJunk` + `st.ref` + the
`recordD`/`measuredD` exclusions); section assignment by heading offset (new, trivial —
headings already carry offsets in the DOM walk); verbatim concatenation with citation
(the **Restated** renderer already does exactly this — `index.html isRestated`, "the
document restated from its own structure: no model, every clause from the text").
**Generation needed:** none. The paper *is* the source, re-ordered, not re-worded.

### Abstract (~8–12, sectioned)
**Target:** one lead per heading + the top global turns, in document order.
**Needs to be true:** everything Paper needs, plus per-section scoring. Because each
section already has an offset range, "one lead per section" is just the 1-sentence
argmax *restricted to that section's statements*.
**Generation needed:** possibly one bounded phrase per section, and only when the
section's top claim is not self-contained (a section that opens "But I digress..." has a
top claim that needs its subject named). Bounded, disclosed, and each emitted token still
checked against a source span. This is the one legitimate place a call appears.

### Five sentences
**Target:** the turn, its mechanism, the scale, the targeting, the remedy — five
*independent* residuals.
**Needs to be true:**
1. topic/name vectors per statement (exists — `analyze()` tf-idf `topics` + `names`);
2. **MMR coverage** (new): pick the top-excess claim, then each next pick maximizes
   `score − λ·max cosine(picked)`, so five sentences can't be five restatements;
3. **resolver edges** (new): `holodeck-surprise` — for each top-excess statement, the
   `b` minimizing `S(a | B ∪ {b})`, with the edge kept only if the delta is positive and
   vanishes under the shuffled baseline;
4. document-order re-sort of the picks (exists — `st.s`).
**Generation needed:** none. Five source sentences with their resolvers, listed in
document order. Connectives are optional; a list is already honest.

### One sentence
**Target:** the turn — the claim whose excess is high *and* whose resolver is either
cheap or already implied.
**Needs to be true:** a per-statement `S(a | B)` field (exists in spirit as the `_su`
shift/excess; it needs to be exposed per statement), and an argmax over it with a
"resolves a prior" gate. At this size the turn must be the top by itself; the resolver is
not spendable.
**Generation needed:** none for the normal case. Only to break a near-tie between two
turns — a tie-break, not prose.

## 3. The invariants that make it falsifiable

1. **Grounding** — every emitted line is a verbatim substring at its claimed offset. A
   paraphrase fails even if semantically equivalent.
2. **No repeat** — no two lines overlap, and no two carry topic vectors above the MMR
   threshold.
3. **Monotone** — bigger budgets refine smaller ones: the 1-sentence turn is contained as
   a span in the 5-sentence set; the 5 in the abstract; the abstract in the paper.
4. **Shuffle-null** — random claim sentences score worse on `(excess + coverage)`, and a
   resolver's delta vanishes under the shuffled baseline. An edge that survives the null
   is co-occurrence dressed as explanation, and is rejected.

## 4. The build order this licenses

1. expose `S(a | B)` per statement from the existing `_su`/`_fold` state (no new math);
2. `holodeck-surprise.js`: emit `(turn, resolver, deltaBits)` edges, null-controlled;
3. `summaryLadder(A, docId, size)`: argmax / MMR+resolvers / per-section / verbatim;
4. wire it over the **source** panel the way `summaryText` already works over the entity
   `profile` — sizes small/medium/full become 1 / 5 / abstract, with paper as the
   Restated view that already exists;
5. `falsify.summary.mjs`: the four invariants above against a held-out source.

The reason this is worth doing at all is the same reason the profile summary was: the
"summary" is a *read of the material's own propositions*, instant, citable, and
zero-model — so the alternative (a model call that paraphrases and cannot be checked) is
strictly worse at every size. The model is the last resort not on principle but because
it is the only component that can produce an ungrounded line.
