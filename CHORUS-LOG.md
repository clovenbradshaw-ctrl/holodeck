
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

## 2026-10-02 — the summary function, over anything, grounded and clickable (main, summary-ladder)
fast: 3 files added · 16 tests pass · law: ok
| lens | citation | file:line | verdict | one line |
| Greenberg | language-specific mechanism disclosed | holodeck-eot.js:126 | fixed | the projection leg is declared English (EWT order/forms, verb-late head rule), not universal; GFP stays neutral |
| Feynman | no constant tuned to a golden | holodeck-summary.js:121 | noted | stemmer length rule is structural, tests assert the gap (R OPEN) rather than hide it |
| Diaconis | null touched | holodeck-summary.test.mjs | noted | resolver edges are null-controlled (word salad manufactures none) |
| Simon/Chekhov | new organs tested | holodeck-summary.test.mjs | noted | 16 pins; the engine path is a manual integration, not yet a test import |
clean: Dijkstra (identity is exact-string by design), Pearl, Ostrom, Frankfurt, Alexander, Kondo
