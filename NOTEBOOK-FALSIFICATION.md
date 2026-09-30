# Can a scientist actually use the notebook page? — criteria written BEFORE the build

Registered 2026-09-30, before tabs, forks and export bundles existed. Each criterion says how it would be **falsified**. Results are
appended below the line at the bottom, whatever they are; a criterion that fails is reported as failed, and nothing is reworded to pass.

The claim under test: *in the notebook page, a scientist or academic can ingest their own data, ask questions in plain words, get results
they can check, keep several lines of inquiry open at once, fork a conversation to try a variant, and take the work away and re-run it
somewhere else — in a way that is familiar from Jupyter and adds auditability rather than removing control.*

| # | Criterion | Falsified if |
|---|---|---|
| F1 | **Portable.** An exported bundle (notebook + data + the helper library) re-run in a clean directory with plain `python3` and no fold server reproduces every `#finding` and `#result` line of every code cell. | any line differs, or any cell cannot run outside the fold |
| F2 | **Familiar.** The page does the Jupyter basics: add / edit / run a cell, Shift+Enter runs and moves on, figures show inline, markdown notes render, Run-all works, and the exported `.ipynb` carries the fields nbformat 4 requires. | a basic is missing, or the export lacks a required nbformat field |
| F3 | **Deterministic.** Run-all twice gives identical outputs. | any output differs between the two runs (run time excluded) |
| F4 | **Every reported number is traceable.** Each number in a "What was found" line occurs in the stored output of a sealed run. | a reported number appears in no run's output |
| F5 | **Forks are honest.** A fork's log begins with the parent's exact entries (same hashes), records its parent and the point it left from, cannot change the parent, and does not inherit the parent's promotions (a decision belongs to the ledger it was made on). | any parent hash changes, the prefix differs, the lineage is missing, or a promotion is silently carried |
| F6 | **Tabs are isolated and typed.** Several conversations open at once, each flagged chat / generate / notebook; state, files and cells do not leak between them; changing a flag is recorded and changes only the drawing. | any cell, file or claim from one conversation is visible in another, or a flag change alters a log |
| F7 | **Nulls are said.** On a column with no structure the notebook says nothing cleared the bar; a method whose control does not fail is refused. | it reports structure in noise, or admits a method whose control passed |
| F8 | **Methods are written from the ledger.** The Generate view produces a Methods paragraph naming every null, sample count and seed behind each claim shown, and the environment (python, numpy, library version). | a claim's null, count or seed is missing from the paragraph |
| F9 | **Declared out of scope (expected to fail).** Typeset equations, citation management, real-time co-editing. | — recorded as absent, not as passed |

---

## Results — 2026-09-30, against the Holodeck "Ask the Fold → Data notebook" page

**Setup.** holodeck `1021736` (branch `ccr-f706e8c6-ymunv8`) served by `python3 -m http.server`; eoreader7 `42272b4` (same branch name) `holodeck.mjs --by human:michael` on 127.0.0.1:8900 with a fresh workspace and ledger directory, `ER7_SWARM_ROUNDS=2 ER7_SWARM_ANTS=10`, no model (the colony is the learner); python 3.11.15, numpy 2.4.6, matplotlib 3.11.2, cells network-isolated (`unshare -rn`); headless Chromium 141 driven over CDP by `tools/notebook-falsify.mjs` (holodeck repo) — real clicks, typing, Shift+Enter and a dropped file on the page. Fixture: a synthetic 9,000-row CSV with one bursty column and one white-noise column, and a separate white-noise CSV. The run is re-runnable; this is run 7.

### Run 7 (final)

| # | Verdict | What was checked and seen |
|---|---|---|
| F1 | **PASS** | bundle from the page's ⤓ Bundle route, unzipped into /tmp/f1-clean-OoncAk/b, run with plain python3 (PATH only, no fold server, no PYTHONPATH): exit 0; reproduced 28 of 28 recorded run(s); 37 #finding/#result lines compared; no cell skipped |
| F2 | **PASS** | drop-to-ingest true; last expression shown (6*7 → 42) true; markdown renders (heading, bold, code) true; + Code then Shift+Enter ran the cell true and moved focus to the next cell true; matplotlib figure inline true; Run all ran every code cell true; exported .ipynb nbformat-4 required fields all present |
| F3 | **PASS** | Run all twice over 28 code cells (incl. 24 check/control cells the colony's methods wrote): every output, #scope, #result and figure hash identical (run time excluded) |
| F4 | **PASS** | 78 number(s) read from the chat view's “What was found” lines; every one occurs in the stored output of a sealed exec entry (chain re-verified in the page) |
| F5 | **PASS** | forked c1 at cell k-white-6225e7 from its ⑂ button → c2: first 71 entries hash-identical to the parent's true; parent unchanged by the fork true and by a write in the fork true; lineage recorded (parent c1, cut seal 9931d7a2bace) and shown: “⑂ forked from “Notebook 1” (c1) after k-white-6225e7 — cut at seal 9931d7a2bace; 1 promotion(s) stayed with the parent. The first entries ar”; parent's promotion (k-bursty-7d6df8) not carried true |
| F6 | **PASS** | 3 tabs open (GENERATE Notebook 1 × / NOTEBOOK fork of Notebook 1 ⑂ / CHAT Chat 3); the new chat tab c3 shows no file of c1 true, no cell true, and its ledger is empty true; flag change notebook→generate on c1 added 1 workspace entry (retype) and changed no notebook hash true |
| F7 | **PASS** | on a white-noise column the colony's answer says “Nothing cleared the bar” true and makes 0 claim(s); a method taught with a control that returns true is refused: “✕ refused: the control did NOT fail: it says the claim holds on data where it is false by construction (shuffle in time, phase-randomise, swap labels…), so the check cann” |
| F8 | **PASS** | 12 claim row(s) in the Generate view, 12 claim(s) on the ledger; Methods names null, n and seed for 12/12; environment (python, numpy, library hash) named |
| F9 | **ABSENT (as declared)** | typeset equations, citation management and real-time co-editing: absent from the pane (markdown renders headings, bold, italic, code and bullets only; no citation store; one person per server, no shared cursor). Recorded as absent, not as passed. |
| R4 (not a registered criterion) | **PASS** | PASS — off without a reason refused (“✕ Switching a method off needs a reason — it is what the next person reads.”); after switching all learned analyses off (reason recorded), the same question was refused: “✕ all learned analyses are switched off (human:michael: falsification run: are off methods really unused?). I will not learn a new method around that ”; library size 6 → 6 (nothing written around it); audit shows the switch and all chains verify here: true |
| chain-break (not a registered criterion) | **PASS** | a /state whose first notebook entry was altered in transit is shown as “CHAIN BROKEN” |
| R8-phone (not a registered criterion) | **FAIL** | at a 390px phone: tab strip overflow-x auto; drawer/visible width 390/504px; the host page's own layout is 0px wider than its viewport (not the pane's) |
| console (not a registered criterion) | **PASS** | no console errors or exceptions during the run |

**R8-phone, read honestly:** the pane's drawer is `100vw` (390 px, the phone's width) and its tab strip scrolls, but the *host page's own layout* is ~520 px wide on a 390 px phone before the pane is even opened (start page: document 524 px, visual viewport 390 px), so the browser zooms out and the drawer does not cover the screen. The pane does not widen the page (504 px with it open). Not fixed here — it is the host layout, outside this change.

### Runs 1–6 (kept, not replaced)

Each earlier run failed, and each failure was traced before anything was changed. What was wrong, and where it was fixed:

- **Runs 1–4 — the page's own bugs and the runner's.** A file dropped on the pane bubbled up to the Holodeck's page-wide drop handler (ingested as a reading source too, re-rendering the view and remounting the pane) — fixed in the pane (`stopPropagation`; one pane instance moved into whatever element the host hands it). The pane cleared "busy" before drawing the new state — fixed. The runner's waits raced the pane — fixed.
- **Run 4 & 5 — F2 read false although every action was on the ledger:** the command bar's hook `data-line` was shared with the toolbar's Data/Tools/Commands buttons, so in the Notebook view **Enter went to the Data button and the command bar did nothing** — a real pane bug, fixed (`data-cmd`).
- **Run 5 — F5/F6/F7 read the wrong conversation:** the runner asked the server for "the current" conversation, which is the server's first tab, not the page's — runner fixed. **Chain-break read "verifies":** a pane mounted with a tampering fetch first drew the *cached, true* state — fixed (a pane never starts from another pane's state). **R4** failed only on the wording changed by the upstream fix below.
- **Upstream defect found by the run (R4):** with "all learned analyses" switched off, a question matching no existing method fell through to the learners, which would write and use a new method — a replacement written around the switch. Fixed in eoreader7 (`b314d17`, `conformance/notebook-switch-wall.test.mjs`); also, methods silenced by the parent switch had been described as "conceded".
- **Run 6 — F3 FAILED for real:** the same failing cell recorded different output on two runs because its traceback named the runner's random temp directory. Fixed in eoreader7 (`42272b4`, `conformance/notebook-determinism.test.mjs`). **F2 figure and F7 failed** because the command bar was a single-line input that silently dropped newlines from pasted code — fixed (a textarea: Enter sends, Shift+Enter adds a line). **R8-phone:** the drawer was clipped to the content column (an ancestor contained `position:fixed`) — fixed (a body-level portal); what remains is the host-layout width above.

### Known limits of this run
- One synthetic dataset, one seed schedule, no model: F4/F8 were exercised on colony-written methods only; a model-written or person-taught method's Methods line was not run through the page here (it is covered by the upstream unit tests).
- F1 was run on this machine (same python/numpy as the recorded runs), in a clean directory with only `PATH` set; a different numpy was not tried.
- The switched-off-method re-find guard (upstream) is in place but was not exercised by a colony that actually re-found a switched-off pipeline.
- There is no static (Pyodide) mode: every result above needs the local notebook server.
