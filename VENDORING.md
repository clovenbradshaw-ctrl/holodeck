repo: clovenbradshaw-ctrl/ohs-custody
branch: main

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
| Referent links (holodeck-links.js) — arrow-of-time gate | eoreader7: native/organs/regime.js (vendored byte-identical under vendor/eoreader7/native/organs/; its only import, native/kernel/cube.js `GRAINS`, was already vendored). The identity gate's arrow-of-time check rides Kelsen's validity-window precedence (step 1 of the fixed order), never a re-derived temporal rule |
| Omnilingual summary lens (holodeck-lang.js) — UniMorph priors | eoreader7: native/priors/declension-rus.json (vendored byte-identical under vendor/eoreader7/native/priors/; the English irregular tail morphology-eng.json and pos-eng.json were already vendored). Loaded as data, injected via `setPriors` — never a model |

## Sync history
- 2026-09-25T19:11:34Z · ohs-custody @40cf318 — no upstream changes; same-bytes badges, Ingest & publish view
- 2026-09-25T17:10:00Z · ohs-custody @40cf318 — 49 meeting transcripts lazy-loaded via OPFS, large documents folded, video viewer beside transcript
- 2026-09-25T16:12:39Z · ohs-custody — transcript discovery from readings/, "View a source", holograph grounding
- 2026-09-24T18:46:38Z · ohs-custody — Restated mode, Junctions mode, Belief shift kept as second mode
- 2026-09-24T15:32:00Z · ohs-custody — surprise view + live_priors normal, repo panel, original mode
- 2026-09-24T15:05:34Z · ohs-custody — kinds/medium, meeting video, attribution
- 2026-09-24T14:25:59Z · ohs-custody — bytes captures, headings, surprise view, filters in hero/side panel
- 2026-09-24T05:53:55Z · ohs-custody — first load of the manifest and derived texts into v5
- 2026-09-23T22:39:49Z · clovenbradshaw-ctrl/eoreader7 (native/) — kernel terrain, patterns, shadow/echo → Fold Explorer.dc.html
