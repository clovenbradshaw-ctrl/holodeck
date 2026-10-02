# the fold

**The Fold is the whole system (naming, 2026-10-01); this is its reading and
research surface.** The khora (the eoreader7 repo) perceives and produces
ground; penelope keeps the record and owns the mouth; this repo is where the
hand comes back to the loom — previously called the holodeck, now named for the
whole it serves. The former `the-fold` repo's surface is being absorbed here;
its machinery is being absorbed by plane (generation → penelope,
information-processing → eoreader7, surfacing → this repo).

A single-page reading and research surface: paste, upload, or link anything, and it gets split into statements with every name, figure, and date traced back to where it appears — grounded, never paraphrased. Cross-document agreement, disagreement, and genuine topical clusters ("paradigms") are discovered from what's actually there, not declared.

There's no build step. `index.html` is the whole app (a Claude Design `.dc.html` export, hydrated by `support.js`); open it directly or serve the directory with any static file server.

```bash
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

## What's vendored, and why

`vendor/` carries in, unchanged, the pieces of two sibling projects this surface is built on top of rather than re-deriving:

- **eoreader7** (`vendor/eoreader7/native/`) — the kernel, organs, and text adapters for real grounding: span-accurate names, referents, relation extraction. Some of this is already wired in (the Records/Assertions view's query engine); some is vendored ahead of being wired in, for what's next.
- **the-fold's engines** (`vendor/the-fold/fold.js`, `vendor/bare-metal/`) — the fold/query engine (`data-chat.js`, `operators.js`) actually powering the Assertions view's "treat this as a relational database" query bar right now. Vendored from the former `the-fold` repo before its absorption; the engines themselves are moving into the khora (eoreader7) as the repo's functionality is absorbed.

`VENDORING.md` is the real, dated provenance log: which upstream repo each file came from, and whether it was kept byte-identical or ported.

## Content

The workspace starts empty — there are no built-in sample corpora. Add anything: paste text, drop files, point the omni bar at any URL, or give the Add panel a GitHub repo (`owner/repo` or a `github.com` URL) and its text files are pulled in and read. Everything you add lives in a browser-local "Your content" workspace. There is no relay of our own: a page is fetched **directly** from its own site first. Genuinely unrelated content you bring in can be split into its own workspace with "Fork" once it's recognized as a separate topic, rather than staying mixed in with everything else.

## Reading a page that blocks being read

Not every page can be read directly. A static page cannot fetch a site that refuses cross-origin requests, and a page whose article exists only after its own scripts have run (most news sites) has no text to fetch in the first place.

When a direct read is refused, the surface tries, in turn: **public CORS proxies** that return the page's HTML; a **stable anchored version** — see below; and **text readers** that render the page server-side and return its *text* (a JavaScript-rendered article cannot come back as HTML, but it can come back as text, which is worth more than nothing). Each is a third party that fetches the page for the browser, so it sees the address — this is disclosed in the ingest trace. The text readers are `r.jina.ai` and Microlink; Jina will also take a key, kept in `localStorage hd:jina`. (There is no web or news search for the same reason: it needed a relay of our own.)

**The anchor loop — a stable anchored version of any page.** `holodeck-anchor.js` runs **DEF → EVA → REC**, the three operators the records view folds. **DEF** declares the archive gates — a Memento (RFC 7089) timegate per public archive. The list is *data*, not code: a person's own list in `localStorage hd:archives` wins, else the shipped registry **`archives.json`** is fetched at runtime, else the built-in defaults, so the set of archives stays current without a code change. **EVA** asks every gate, in parallel, for the Mementos it holds and scores each (served status, size, recency), recording what every gate answered — including the misses. No single archive can stall the loop: archive.org in particular rate-limits and often refuses behind a VPN, and a 429 is just a recorded miss. **REC** keeps the surviving anchor — the best Memento any gate actually served — and the runners-up. Nothing is guessed; an anchor is only set to a URI a gate served. When a gate answers with a human-check — the archive's own check, not ours; a person is not a bot — the surface offers **“Prove you are human — open it ↗”** and, beside it, **“I've proved it — try again”**, which reads the page again *in-app* carrying the archive's clearance cookie. If it went through, the blocked shell is replaced by the readable source; if not, the buttons stay so they can try once more.

For the pages none of that can read, the page is shown live and offered for capture from the reader's own browser. On **Add & publish**, drag **✦ Explore this page** to the bookmarks bar, once. After that, when a page cannot be read directly, open it in the browser and click **✦ Explore this page**: the page *as it is rendered* — scripts already run, whatever is actually on screen — is handed to this surface, read and grounded, with no third party involved. GitHub, Wikipedia and the Internet Archive can still be searched directly.

For automatic capture, install the small **`extension/`** (Load unpacked): it reads a page only when the fold opens it as `<url>#fold-capture` (or when you press its toolbar button), waits for any human-check to clear, and hands the rendered page back — no click. It needs `host_permissions: <all_urls>` to be able to read the page you are looking at, and it stores nothing. See `extension/README.md` (set `FOLD_URL` there to wherever the fold is served).

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

This is the live, ongoing home for this surface — active development happens here going forward, not in a local-only copy. It is **the fold**, the reading/research surface of The Fold, and inherits the former `the-fold` repo's surface role.

## DeepSeek experiment (result: not in-tab)

Tried putting DeepSeek in the browser. WebLLM only prebuilds the R1-Distill **reasoning** models (`DeepSeek-R1-Distill-Llama-8B`, `DeepSeek-R1-Distill-Qwen-7B`), and a reasoning model is the wrong tool here: the fold does the reasoning itself and wants the answer only. Asked something trivial ("hi"), an R1 model over-thinks, loops, and can spend the whole token budget before it ever reaches the answer. Hiding the thinking trace does not fix that — the compute is still spent. So no DeepSeek is offered in-tab.

DeepSeek's non-reasoning option is the MoE (V2-Lite / Coder-V2-Lite, 16 B total but 2.4 B active per token). It has no published webgpu `.wasm`, so it runs through the Ollama lane (`deepseek-coder-v2:lite`) instead — non-reasoning, minimal per-token compute, and it flows through the identical full pipeline (listed in the model dropdown automatically when Ollama is up).

The roster filters reasoning models out of **both** lanes, by name (`isThinkingModel` in `holodeck-ask.js`): `deepseek-r1`, `qwq`, `qwen3` (thinks by default), and the `*-reasoning` / `*thinker` family. A reasoner over-thinks a simple prompt, loops, and can spend the whole budget before answering — the opposite of the fold, which does the reasoning itself. `qwen3-coder` and `deepseek-coder-v2` are not thinking models and stay.

## Compute workers — Heimdall invites (2026-10-01)

Settings → **Compute workers · Heimdall**: mint a heimdall compute invite under your own Matrix account. The fleet room is born with a short local alias, so the invite link is just `?r=<code>` — something you can actually type by hand on a remote computer (`clovenbradshaw-ctrl.github.io/heimdall/?r=h7q2x`). Record the worker's 6-digit pairing code into the account's `org.heimdall.codes` registry — the same registry the heimdall site confirms acceptance against, so an invite minted here is confirmable there and vice versa. Pure logic in `holodeck-heimdall.js` (the fold's `heimdall-invite.js` pattern); the crossings live in `fold-net.js`.

## The engine reads first

Each added document is posted to eoreader7's `POST /v1/read` (model-free; tries `localStorage hd:engine`, then `127.0.0.1:11436`, then `:11476`). The replay draws the engine's own events under an **Engine** stage, and its beings are a *witness* beside the Holodeck's finder: it adds lowercase names and recurring descriptions the local finder cannot see (`kutuzov`, `the contractor`, `the camp`), after the same hygiene every local name passes, and Fort gets an `engine` ant that votes *real* when the engine also admitted a name and stays silent otherwise. If the proxy is down the document is read locally and the Added card says so.

It does **not** replace the local finder, because measured on three real workspace documents the engine reader agreed with only 10/81, 9/60 and 18/119 of the local names. Its known defects (for the engine, not for a Holodeck workaround): it breaks names at "of" ("Continuum of Care"), admits months and "on tuesday" as beings, splits "Freddie O'Connell" to "O'Connell", and misses "Lauren Riley" and "Department of Law". Documents already in the workspace are still read locally only.

The vetting of engine additions (month and weekday names, function words) is English-only, like the rest of the local hygiene; other scripts pass through unvetted.

## Penelope (2026-10-01)

App generation lives in the sibling `penelope/` repo now (pipeline,
organs, layout library, ladder records). Nothing here changes: ingest,
hang, and the local finder are untouched, and the engine-reader
relationship above is as measured. Builds that need generated artifacts
route through Penelope's doors, not through ingest.
