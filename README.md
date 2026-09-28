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

## Status

This is the live, ongoing home for this surface — active development happens here going forward, not in a local-only copy.
