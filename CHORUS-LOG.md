## 2026-10-02 — the mechanical summary's real job is the VOID; wired as an additive fact (main, summary-ladder)
fast: 4 files · law: ok
| lens | citation | file:line | verdict | one line |
| Diaconis | the effect was measured on the wrong branch | holodeck-ask.js:181 | fixed | the earlier fold experiments measured a NO-MATERIAL turn (a contentless question retrieved 0 passages and fell to CHAT_PROMPT); the material-present run shows fold on/off a wash. Corrected in the header |
| Feynman | a verdict with no citation trail | holodeck-ask.js:342 | fixed | subjectSummary now returns a typed VOID (never null) with the closest grounded spans; the no-retrieval void is tested (holodeck-void.test.mjs) |
| Simon/Chekhov | a real mechanism shipped unwired | holodeck-ask.js:209 | fixed | hasMaterial now treats a void fold as material, so a research question the workspace is silent on gets the reporter prompt + void, not small talk (measured: "I'm ready to help!" → "The workspace is silent on this.") |
| Dijkstra | an absolute path / machine scope | holodeck-summary.js:545 | fixed | the stance re-export pointed at /Users/mlacy/.../eoreader7 (broke on any other machine) and left stanceOf in its temporal dead zone; vendored stance.js and imported it at the top |
clean: Holmes, Greenberg, Alexander, Ostrom

## 2026-10-02 — FALSIFIED: the "3/3 turn" was majority-echo; restated honestly (main, summary-ladder)
fast: 2 files · law: ok
| lens | citation | file:line | verdict | one line |
| Diaconis | the effect the test found is an artifact of the test | holodeck-ask.js:15 | fixed | the identity was set to -docStance, so the fold surfaced MAJORITY claims by construction and the metric rewarded echoing them (0/4 minority picks); a turn is a minority inversion the construction could not surface. Restated: held-identity fold carries the genuine turn 3/5 vs baseline 2/5, empty/null 0/5 on one specimen |
| Feynman | a verdict with no citation trail | holodeck-ask.js:17 | fixed | the 3/3 headline is retracted in the header with the actual measured numbers and the falsifier named (falsify-turn2.mjs) |
clean: Holmes, Frankfurt, Greenberg, Alexander, Ostrom

## 2026-10-02 — the subject fold improved to a decisive, grounded win; markup blanked (main, summary-ladder)
fast: 3 files · 24 tests pass · law: ok
| lens | citation | file:line | verdict | one line |
| Feynman | no constant tuned to a golden | holodeck-reader.js:120 | noted | blankMarkup is length-preserving and rule-based (CSS/tag/entity/URL), not tuned; the experiment's 3/3 vs 1/3 is reported as measured, not asserted |
| Greenberg | markup is not universal prose | holodeck-reader.js:112 | fixed | CSS/HTML is blanked before folding (a declared, script-agnostic rule); the reader never assumes markup is content |
| Alexander | composition seam | holodeck-ask.js:167 | fixed | the fold composes as a fact through Gary; subjectSummary and readCorpus both blank markup, so every reader path agrees |
| Simon/Chekhov | new/untested | holodeck-reader.test.mjs | fixed | blankMarkup pinned: length preserved, CSS/script gone, a prose sentence keeps its offset |
clean: Holmes, Frankfurt, Dijkstra, Ostrom

## 2026-10-02 — the mechanical summary folds the whole corpus instantly, wired into the chat and the reader (main, summary-ladder)
fast: 6 files · 30 tests pass · law: ok
| lens | citation | file:line | verdict | one line |
| Greenberg | capitalisation gate / script scope | holodeck-ask.js:275 | fixed | the question's named subject is read by `\p{Lu}` (any cased script, the engine's own name rule), never an English `[A-Z]`; a caseless script (Chinese, Arabic) offers no name and that absence is disclosed, never guessed |
| Dijkstra | locale/allowlist standing in for identity | holodeck-ask.js:274 | noted | `nameFold` is a NAMING CONVENTION (diacritic fold + case), declared, used only to pick which claims are about the question's subject — it never merges referents |
| Feynman | a numeric constant / swallowed error | holodeck-reader.js:152 | fixed | reader/read failures are no longer swallowed — each is pushed to `report.gaps` with a reason; the ladder's minimum is a NAMED constant (MIN_CLAIMS_FOR_LADDER), not a bare 4 |
| Alexander | composition seam | holodeck-reader.js:98 | fixed | the chunked corpus read discloses its gaps; chunking is measured not to lose claims (holodeck-reader.test.mjs: chunked ≥ single-pass) |
| Holmes | identity fold from surface | holodeck-ask.js:259 | clean | the fold selects the subject's claims, it does not fuse referents; identity stays the engine's |
| Simon/Chekhov | new/untested source | holodeck-reader.js | fixed | readCorpus has holodeck-reader.test.mjs (grounding by content, chunking does not lose the reading, a tiny source yields nothing) |
| Ostrom | scope of absence | holodeck-summary.test.mjs:32 | clean | scoping is per-doc via stsByDoc |
| Frankfurt | placeholder | index.html:664 | clean | hasSyn guards a real block |
clean: Diaconis, Pearl, Kondo

## 2026-10-02 — perspectives read the text's own words; the surface sheds its chrome, and an import opens its reading replay by itself (main, merge + kondo)
fast: 3 files · 14 tests pass · law: ok (WARN pre-existing S17/S96 duplicates in eoreader7/native/READING-SPEC.md, not this diff)
| lens | citation | file:line | verdict | one line |
| Feynman | a numeric constant in a comparison | holodeck-reader.js:277 | noted | the lemma pick is length ≥ 3 then shortest — a register rule, not a tuned threshold |
| Dijkstra | locale/script scope | holodeck-reader.js:284 | noted | the head is read through the English pos prior by design; it picks an act label, never merges referents |
| Greenberg | capitalisation gate / script scope | holodeck-reader.js:246 | fixed | the comment now declares the prior and register English: a script the prior cannot tag yields no act, shown as no chip; isNameWord only chooses "the" in an English label |
| Holmes | identity fold from surface | holodeck-reader.js:276 | noted | canonical() folds a verb's forms via the lemmatizer, not referents; nothing is fused |
| Ostrom | scope of the count | index.html:236 | noted | p.n counts the scoped statements the reading was derived from; the preview names "of N statements" |
| Frankfurt | placeholder | index.html:237 | noted | the rows are computed labels carrying the material's own hits |
| Simon/Chekhov | real mechanism shipped unwired | holodeck-ingest-player.js | noted | open() is hdFinish's dynamic import target; verified live (replay auto-opens, 33 events), chipFor retired by request |
clean: none

## 2026-10-02 — the summary function, over anything, grounded and clickable (main, summary-ladder)
fast: 3 files added · 16 tests pass · law: ok
| lens | citation | file:line | verdict | one line |
| Greenberg | language-specific mechanism disclosed | holodeck-eot.js:126 | fixed | the projection leg is declared English (EWT order/forms, verb-late head rule), not universal; GFP stays neutral |
| Feynman | no constant tuned to a golden | holodeck-summary.js:121 | noted | stemmer length rule is structural, tests assert the gap (R OPEN) rather than hide it |
| Diaconis | null touched | holodeck-summary.test.mjs | noted | resolver edges are null-controlled (word salad manufactures none) |
| Simon/Chekhov | new organs tested | holodeck-summary.test.mjs | noted | 16 pins; the engine path is a manual integration, not yet a test import |
clean: Dijkstra (identity is exact-string by design), Pearl, Ostrom, Frankfurt, Alexander, Kondo

## 2026-10-02 — local work swept in: topic scoping chips, conversation tabs, notes toggle, the pyodide fallback engine, the four summary-fold experiment drivers, and the holodeck-latest lineage merged (main, merge)
fast: 7 files · 59 tests pass (jupyter-runtime passes with ~/holodeck-notebook-venv on PATH; ipykernel/nbformat were missing from homebrew python3) · law: ok (WARN pre-existing cites P186 P199 P22 P232 P244 P32 P4 P55 P80 and dup S17/S96 — carried by earlier commits in range, not this one)
| lens | citation | file:line | verdict | one line |
| Simon/Chekhov | real mechanism shipped unwired | holodeck-pyodide.js | noted | wired: holodeck-notebook.js:135 browserEngine() is the no-server fallback; verified import path |
| Kondo | stray root drivers | experiment-codegen-summary.mjs | noted | the four summary-fold drivers are scratch nothing imports; committed per explicit user instruction, named in the commit message |
| Diaconis | merge resolution | index.html:7641 | fixed | the Summary mode (HEAD) and Regions mode (merged lineage) both kept, additive props, no shared state touched |
| Marshall | merge legality | — | noted | both lineages merged without amending either; holodeck-latest's branch and backup tag untouched |
clean: Holmes, Pearl, Ostrom, Frankfurt, Alexander, Greenberg (no new language-scoped or identity logic added; the merged screen-regions code was already linted in its own lineage)

## 2026-10-03 — the in-tab Pyodide runtime: no server, no install — the pane starts its own Python (main, pyodide-fallback)
fast: 5 files · 21 tests pass (incl. the real-browser pyodide-notebook.browser.mjs: cells, numpy, matplotlib inline, ledgers verified, reload, nbformat 4 export) · law: ok
| lens | citation | file:line | verdict | one line |
| Feynman | a swallowed error | holodeck-pyodide.js:327 | noted | the empty catch on URL parsing is best-effort: on failure the raw string is tried as the path, and the route checks simply miss — no wrong claim |
| Dijkstra | host allowlist | holodeck-notebook.test.mjs:71 | noted | hostsIn + BASELINE pin that the page adds NO new hosts; cdn.jsdelivr.net (Pyodide) is asserted already on the baseline, so the CDN is not a new dependency |
| Ostrom | scope of the absence | holodeck-notebook.test.mjs:78 | noted | "no new external hosts" is claimed against the pre-existing baseline, not an invented one |
| Frankfurt | placeholder | index.html:792 | noted | the hint-placeholder-val attributes are the standing dc-template pattern; the notes toggle they guard is real (notesOpen wired) |
| Alexander | composition seam | holodeck-notebook.js:239 | noted | the starting/connect empty states are mutually exclusive alternatives; retry only exists off the starting path, engine.fetch composes with the pane's F() |
| Simon/Chekhov | real mechanism shipped unwired | holodeck-notebook.js:135 | fixed | the pyodide fallback was already wired here; what was UNWIRED was the hang organ — holodeck-hang.js:275's ESM export broke the classic script parse on every page load since f7a3690, so hang decisions never ran in the browser; index.html now loads it type=module, verified live (HDHang on page, zero pageerrors) |
clean: Holmes, Pearl, Diaconis, Greenberg, Kondo, Marshall

## 2026-10-03 — the falsification record gains the dated Pyodide addendum (main, doc)
fast: 1 file · none affected (doc only) · law: WARN pre-existing S17/S96 in ../eoreader7/native/READING-SPEC.md
| lens | citation | file:line | verdict | one line |
| Alexander | composition seam | NOTEBOOK-FALSIFICATION.md:66 | noted | the addendum says the mode exists AND that run 7's F1–F9 results are not widened by it — the two claims compose without overclaiming |
clean: no other lens routed (doc change, no source touched)

## 2026-10-03 — the Overview page is the when + the cards/table of sources; the separate Sources view retires (main, kondo-simplify)
fast: 2 files · 1 browser test pass (unit hang/overview failures pre-existing on the base) · law: ok
| lens | citation | file:line | verdict | one line |
| Ostrom | absence assigned at the right scope | index.html:497 | clean | the sources gaps ("What to check") still say "Gaps in these sources, not proof that something is absent" on the merged page |
| Frankfurt | a number standing in for a missing prior | index.html:374 | noted | hasFacets stays hardcoded false on the merged page (pre-existing on gh), so the facets block renders nothing — noted, not re-wired, in this diff |
| Kondo | dead or cluttering | index.html:373 | fixed | the summary page's editorial stack (topic input, paradigms + forkParadigm, About This, Lead statements + headlines(), Worth checking, noGround, goal cards + the dead GOALS/goalNav/counts/heads/ex/readScore tree, goOverview button, seenLine/Review) is removed and stashed (STASH.md 2026-10-03); the Sources view body moved into v.summary, its nav item and view id retired, go('sources') call sites re-aimed at summary |
clean: LeviStrauss (nothing in the stash solves an open problem this diff names; nothing reclaimed)

## 2026-10-03 — merge PR #2 (Ask the Fold → Data notebook) against a moved main (merge/pr2)
fast: 2 files (plus the merge) · none affected (phone-fit is a person-run tool; the pane and its tests came from main) · law: WARN pre-existing S17/S96 in ../eoreader7/native/READING-SPEC.md
| lens | citation | file:line | verdict | one line |
| Feynman | a numeric constant in a comparison | tools/phone-fit.mjs:9 | noted | the W<700 is the CDP mobile-emulation profile, not a pass threshold; the fit check itself is scrollWidth <= visualViewport.width |
| Simon/Chekhov | new source no test imports | tools/phone-fit.mjs | noted | a person-run CDP driver (like tools/notebook-falsify.mjs); run live at 320/390/600 with no overflow and no console errors |
clean: no other lens routed (every conflicted file resolves to main)

## 2026-10-03 — topics are the holograph's paradigms, wired to filter; the read-as 3×3 retires and perspective names hold to 1–4 words; the shared module-cache that made heroBarBase read GENRES off the reader is fixed (_readerM) (main, the-fold)
fast: 2 files · 14 affected tests pass · law: WARN pre-existing S17/S96 in ../eoreader7/native/READING-SPEC.md
| lens | citation | file:line | verdict | one line |
| Feynman | a numeric constant in a comparison | index.html:6872 | false-positive-on-review | slice(0,4)/> 4 decide how many source titles one topic row previews; display truncation, unchanged from before the diff, not a threshold any test was tuned to |
| Dijkstra | allowlist / locale logic | holodeck-reader.js:316 | false-positive-on-review | the new 4-word cap splits on whitespace (language-agnostic); it gates the pre-existing English-register labeller, not a locale decision |
| Frankfurt | placeholder | index.html:223 | false-positive-on-review | hint-placeholder-* are the standing dc-template compile metadata, not a value standing in for missing data |
| Greenberg | capitalisation gate with no declared scope | holodeck-reader.js:316 | noted | isNameWord (/^[A-Z]/) and gerund order are English, and perspectivesOf's own comment declares it ("the prior and the register are English — a script it cannot tag yields no act, shown as no chip") |
clean: no other lens routed

## 2026-10-04 — the Kondo sweep of dead value keys after the one-filter strip (main, working)
fast: 2 files · 1 affected test pass · law: ok (WARN pre-existing dup eoreader7 READING-SPEC S17/S96, carried)
| lens | citation | file:line | verdict | one line |
| Feynman | — | index.html:7225 | false-positive-on-review | `sourceKindsUseful: tabs.length > 2` is a disclosure gate on the line we edited, not a tuned verdict; logic unchanged |
| Holmes | — | index.html:5590 | false-positive-on-review | `identitiesTotal`/`↔` display is pre-existing context on the same edited line; no merge added |
| Kondo | P10 | index.html (sweep) | fixed | removed `corrVals`, `rdPanel`/`rdReading`, `readerHint`, `isOriginal`/`faithOn`, `repo` modal, `openNewWs`/`openTask`, `just` panel, `svGroups`, `hasSrcRows`, `showLabels`, `setFw`, `_o`; all stashed with addresses; `S.just` state kept (NEW badge) |
| Lévi-Strauss | — | — | noted | no stashed piece matches this diff's open problems; 2 matches are pre-existing eoreader7/vendor |
clean: none further routed
