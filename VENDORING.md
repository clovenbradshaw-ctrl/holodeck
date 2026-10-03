repo: clovenbradshaw-ctrl/ohs-custody
branch: main

## Vendored reading fixture (2026-10-02, delink from clovenbradshaw at runtime)

`fixtures/reading/f3affd2e11370118-causalTextPerceiver_reviseTextFold_refresh25.jsonl.index.json`
and its `.cursor` are vendored byte-identical from `ohs-custody` `ground-readings/`. The
reading view (`reading-worker.js`) now reads the pre-built `FoldReadingIndex@2` beside the
app instead of fetching `raw.githubusercontent.com/clovenbradshaw-ctrl/ohs-custody` at
runtime, so the view survives the migration's clovenbradshaw delink (FOLD-MIGRATION Step 4:
"vendor the fixture, or gate the view on absence"). Only the index and cursor are vendored;
the 7.7 MB `.jsonl.zst` is left upstream — the pre-built index is the path actually used,
and the `.zst` path is only the key the index sits beside. `localStorage hd:reading`
overrides the source with any absolute `.jsonl.zst` (or sibling `.index.json`) URL.

## Last sync
date: 2026-09-25T19:46:51Z

### Updated in this project
- Upstream added ground-readings/…refresh25.jsonl.zst and its .cursor (1 commit after 40cf318)
- Reading view now reads the .zst from ohs-custody (already wired); decode is refused unless byte count matches the zstd frame header, every line parses, and encounter count matches the cursor (8,358)

## Screen map
| Screen | Repo files |
|---|---|
| Fold Explorer v6.dc.html — OHS corpus | sources.structured.json, sources.enriched.json, derived/*.txt, bytes/*.bin |
| Fold Explorer v6.dc.html — meeting transcripts | sources.json, readings/*-TRANSCRIPT.json, transcripts/*.segments.json, transcripts/*.txt |
| Fold Explorer v6.dc.html — demo drop | research/opioid-settlement-audit/extracted-text.txt |
| Fold Explorer v6.dc.html — Reader · Restated | derived/*.txt (tested against derived/AUD-HID-2023.txt) |
| Fold Explorer v6.dc.html — What changed the picture | clovenbradshaw-ctrl/eoreader7: native/docs/THE-HOLOGRAPH.md |
| Fold Explorer v6.dc.html — Reading (reading-worker.js) | ground-readings/f3affd2e11370118-causalTextPerceiver_reviseTextFold_refresh25.jsonl.zst, .jsonl.cursor |

| Fold Explorer v7.dc.html — Records (holodeck-records.js) | clovenbradshaw-ctrl/bare-metal-eo-matrix-app: src/fold.js, public/data-chat.js (vendored unchanged under vendor/bare-metal/; src/operators.js replaced by a local no-network shim) |
| Fold Explorer v7.dc.html — Ask the Fold (holodeck-ask.js, holodeck-reader.js) | clovenbradshaw-ctrl/the-fold: fold.js, holon.js (surf-and-fold wiring, ported); eoreader7: native/the-fold/reader-bundle.js (ported to fetch-loaded priors), native/organs/{source,measure,cite,grounding,web,speaker,hypergraph,fact-block,aposiopesis,cast,asserted,heard-surfaces,kind-standing}.js, native/adapters/text/{priors,spans,surfaces,pronouns,relations-language,relations-gfp,relations-positional,clause-spans,grain-typing,wordclass,morphology}.js, native/{memory,kernel}/*, native/priors/{pos,morphology}-eng.json (vendored unchanged) |
| Fold Explorer v7.dc.html — Read three ways (holodeck-perspectives.js) | eoreader7: native/kernel/{perspective,bayes-surprise}.js (vendored byte-identical; diffed against upstream on copy). Three readers, one per live_priors genre, each a Dirichlet holograph over what a sentence does to the picture (never words); scored read-only against the workspace; kept apart with perspective.js divergence(). native/adapters/text/priors.js closed classes reused. |
| Referent links (holodeck-links.js) — arrow-of-time gate | eoreader7: native/organs/regime.js (vendored byte-identical under vendor/eoreader7/native/organs/; its only import, native/kernel/cube.js `GRAINS`, was already vendored). The identity gate's arrow-of-time check rides Kelsen's validity-window precedence (step 1 of the fixed order), never a re-derived temporal rule |
| Omnilingual summary lens (holodeck-lang.js) — UniMorph priors | eoreader7: native/priors/declension-rus.json (vendored byte-identical under vendor/eoreader7/native/priors/; the English irregular tail morphology-eng.json and pos-eng.json were already vendored). Loaded as data, injected via `setPriors` — never a model |

| Fold Explorer v7.dc.html — Ask the Fold → Data notebook (holodeck-notebook.js) | clovenbradshaw-ctrl/eoreader7: native/kernel/sha256.js, native/the-fold/surface/{bench,notebook,notebook-store,notebook-workspace}.mjs — **byte-identical**, copied by `node vendor-sync.mjs`, hashes and commit in `vendor/eoreader7/NOTEBOOK-VENDOR.json`; `node vendor-sync.mjs --check` fails on drift |

## Sync history
- 2026-10-02 · Persistent Jupyter integration: workspace/store files copied byte-identically from EOReader7; individual source commits and hashes are in NOTEBOOK-VENDOR.json. The new local runtime lives in tools/notebook-server.mjs and tools/jupyter-session.py.
- 2026-09-30 · eoreader7 @f18069e (branch ccr-f706e8c6-ymunv8, not yet on main) — Data notebook pane: the three ledger files vendored by script; the notebook server itself is NOT vendored (it runs from an eoreader7 checkout)
- 2026-09-25T19:11:34Z · ohs-custody @40cf318 — no upstream changes; same-bytes badges, Ingest & publish view
- 2026-09-25T17:10:00Z · ohs-custody @40cf318 — 49 meeting transcripts lazy-loaded via OPFS, large documents folded, video viewer beside transcript
- 2026-09-25T16:12:39Z · ohs-custody — transcript discovery from readings/, "View a source", holograph grounding
- 2026-09-24T18:46:38Z · ohs-custody — Restated mode, Junctions mode, Belief shift kept as second mode
- 2026-09-24T15:32:00Z · ohs-custody — surprise view + live_priors normal, repo panel, original mode
- 2026-09-24T15:05:34Z · ohs-custody — kinds/medium, meeting video, attribution
- 2026-09-24T14:25:59Z · ohs-custody — bytes captures, headings, surprise view, filters in hero/side panel
- 2026-09-24T05:53:55Z · ohs-custody — first load of the manifest and derived texts into v5
- 2026-09-23T22:39:49Z · clovenbradshaw-ctrl/eoreader7 (native/) — kernel terrain, patterns, shadow/echo → Fold Explorer.dc.html
