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

The workspace starts empty — there are no built-in sample corpora. Add anything: paste text, drop files, point the omni bar at any URL, or give the Add panel a GitHub repo (`owner/repo` or a `github.com` URL) and its text files are pulled in and read. Everything you add lives in a browser-local "Your content" workspace; nothing you add here is sent anywhere except the repo files you explicitly fetch. Genuinely unrelated content you bring in can be split into its own workspace with "Fork" once it's recognized as a separate topic, rather than staying mixed in with everything else.

The first time the page opens, it deletes the persisted history of the old fixed sample corpora (localStorage, the file store, and IndexedDB) — one-time cleanup, so no trace of those links remains in this browser.

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

## What counts as normal

Whether something is unusual depends on where it is. A capitalised "Contractor" is normal in a contract that defines it; "Label:" lines are a form's furniture. `holodeck-region.js` answers "is this normal here?" against the smallest region that can be told apart from its surroundings. The ladder runs from the document, to documents of the same kind, to the workspace, to **General English** from `live_priors` (8 books, 31 encyclopedia articles and 27 statutes, received with their file list and cached in the browser), and finally to eoreader7's English part-of-speech prior. At each step the region is compared against 199 same-size draws from the next region out. It sets the normal only when it falls outside every draw; otherwise the question moves outward. The workspace can override General English only where it measurably differs, so a corpus full of junk can't declare its junk normal.

The name finder uses this ground. It drops a sentence-opening word that is normally lowercase ("Developer Adam Rosenberg" → "Adam Rosenberg"), unless that word and the next are written capitalised mid-sentence elsewhere ("Open Table Nashville"). It also strips words that have no noun or name reading ("Whether OHS" → "OHS"), drops runs that are clauses or headlines, and drops form labels. Every change is logged in the ingest replay with the region that decided it.

In a blind three-grader panel on 100 random multi-word names from the OHS workspace (graders agreed 87–98%), the share judged junk fell from 71% (95% interval 62–80%) to 50% (40–60%). What remains is mostly truncated fragments, form labels, OCR slips, headlines and generic headings.

## How things are hung

A repo, a report, and a recording don't share affordances, so every ingest is hung before it is read (`holodeck-hang.js`): witness-line counts for imports/definitions, sentence terminals, and grid alignment decide among code/graph, prose/sequence, and table — winner must strictly beat its runner-up, a tie is a recorded gap, never a guess. Media kinds keep the hang their sniff magic earned. Your input is ordinal ("prefer X over Y here"), kept append-only in `hd:hang-directions` — superseded, never edited — and every decision lands on the ingest replay under a Hang stage. Mixed kinds share no lens: one panel per kind.

## Status

This is the live, ongoing home for this surface — active development happens here going forward, not in a local-only copy.

## Ask the Fold → Data notebook

"Ask the Fold" has two panes. **Sources** is the conversation over this workspace's reading, answered by a model in the tab (unchanged). **Data notebook** (`holodeck-notebook.js`) is for your own data: several conversations in tabs, each flagged chat / generate / notebook (the flag changes only the drawing, and the change is recorded); **⑂ fork** on any cell or answer opens a tab that begins with the parent's exact entries, seal for seal, and does not carry the parent's promotions; one workspace **dataset** of everything ingested and everything generated in any tab (generated items are labelled and never counted as evidence); learned analyses as **skills** you can switch off (a reason and your name are recorded; a switched-off method is never used and nothing is written around it) with an **audit** from claim to method to author to admission runs to every switch; **⤓ Bundle** (notebook + data + helper library + `run_all.py`, which re-runs in a clean `python3` and compares every `#finding`/`#result` line); and a **Methods** paragraph in the Generate view written from the ledger.

It runs on a notebook server **on your machine** — Python, the ledgers and the ant colony live there; the page draws and asks, and re-verifies every hash chain it is shown with the vendored eoreader7 code (a chain that does not verify is shown as CHAIN BROKEN, whatever the server says). From an eoreader7 checkout, with `python3` and `numpy`:

```bash
node native/the-fold/surface/holodeck.mjs --by human:<your name>      # 127.0.0.1:8900; loopback origins only
node native/the-fold/surface/holodeck.mjs --by human:<you> --allow-origin https://<where this page is served>
```

A page served from somewhere other than localhost must be named with `--allow-origin`: the server runs code as you, so it refuses every other website. There is no in-browser (Pyodide) mode yet; without the server the pane says so. Tests: `node --test holodeck-notebook.test.mjs`. The falsification run (F1–F9, in a real Chromium): `node tools/notebook-falsify.mjs` — see `NOTEBOOK-FALSIFICATION.md`.

## The engine reads first

Each added document is posted to eoreader7's `POST /v1/read` (model-free; tries `localStorage hd:engine`, then `127.0.0.1:11436`, then `:11476`). The replay draws the engine's own events under an **Engine** stage, and its beings are a *witness* beside the Holodeck's finder: it adds lowercase names and recurring descriptions the local finder cannot see (`kutuzov`, `the contractor`, `the camp`), after the same hygiene every local name passes, and Fort gets an `engine` ant that votes *real* when the engine also admitted a name and stays silent otherwise. If the proxy is down the document is read locally and the Added card says so.

It does **not** replace the local finder, because measured on three real workspace documents the engine reader agreed with only 10/81, 9/60 and 18/119 of the local names. Its known defects (for the engine, not for a Holodeck workaround): it breaks names at "of" ("Continuum of Care"), admits months and "on tuesday" as beings, splits "Freddie O'Connell" to "O'Connell", and misses "Lauren Riley" and "Department of Law". Documents already in the workspace are still read locally only.

The vetting of engine additions (month and weekday names, function words) is English-only, like the rest of the local hygiene; other scripts pass through unvetted.
