# Holodeck

A single-page reading and research surface: paste, upload, or link anything, and it gets split into statements with every name, figure, and date traced back to where it appears — grounded, never paraphrased. Cross-document agreement, disagreement, and genuine topical clusters ("paradigms") are discovered from what's actually there, not declared.

There's no build step. `index.html` is the whole app (a Claude Design `.dc.html` export, hydrated by `support.js`); open it directly or serve the directory with any static file server.

```bash
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

## What's vendored, and why

`vendor/` carries in, unchanged, the pieces of two sibling projects this surface is built on top of rather than re-deriving:

- **eoreader7** (`vendor/eoreader7/native/`) — the kernel, organs, and text adapters for real grounding: span-accurate names, referents, relation extraction. Some of this is already wired in (the Records/Assertions view's query engine); some is vendored ahead of being wired in, for what's next.
- **the-fold** (`vendor/the-fold/fold.js`) and **bare-metal** (`vendor/bare-metal/`) — the fold/query engine (`data-chat.js`, `operators.js`) actually powering the Assertions view's "treat this as a relational database" query bar right now.

`VENDORING.md` is the real, dated provenance log: which upstream repo each file came from, and whether it was kept byte-identical or ported.

## Content

A fixed set of named sample corpora are fetched live from their own GitHub repos (e.g. `ohs`, from `clovenbradshaw-ctrl/ohs-custody`) — nothing here holds their data at rest. Anything you paste, upload, or link locally lands in a browser-local "Your content" workspace; nothing you add here is sent anywhere. Genuinely unrelated content you bring in can be split into its own workspace with "Fork" once it's recognized as a separate topic, rather than staying mixed in with everything else.

## Watching it read, and Archon Fort

Every ingest records a trace from the real reading functions and opens a replay (`holodeck-ingest-player.js`): the log on the left, the source text and the holograph folding on the right, with rewind and slow motion. `holodeck-media.js` makes images, sound, scores, math, spreadsheets and unknown bytes ingestible.

**Archon Fort** (`holodeck-fort.js`) flags what a person would stop and question: names glued together from pieces of other names, sentence-opening words caught as names, form labels, headlines, OCR misreadings, word salad. It then sends a swarm of small independent witnesses (ants) to try to falsify each flag. A flag *stands* only if every ant that speaks calls it an artifact. It is *falsified* if they all call it real, and *contested* if they disagree; both sides stay on the record. Fort flags things and never removes them. Standing oddities appear on the Added card with an Inspect link into the replay.

Measured against three blind graders (90–95% agreement) on 150 held-out OHS names:

| Fort standing | Share the graders called odd |
|---|---|
| stands | 83% |
| contested | 89% |
| falsified | 35% |
| never raised (base rate) | 60% |

Known misses: generic headings made of ordinary words, OCR slips outside its confusion table, and run-togethers where one side is a single word.

## Status

This is the live, ongoing home for this surface — active development happens here going forward, not in a local-only copy.
