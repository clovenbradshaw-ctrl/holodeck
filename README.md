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

## Status

This is the live, ongoing home for this surface — active development happens here going forward, not in a local-only copy.

## DeepSeek experiment (result: not in-tab)

Tried putting DeepSeek in the browser. WebLLM only prebuilds the R1-Distill **reasoning** models (`DeepSeek-R1-Distill-Llama-8B`, `DeepSeek-R1-Distill-Qwen-7B`), and a reasoning model is the wrong tool here: the fold does the reasoning itself and wants the answer only. Asked something trivial ("hi"), an R1 model over-thinks, loops, and can spend the whole token budget before it ever reaches the answer. Hiding the thinking trace does not fix that — the compute is still spent. So no DeepSeek is offered in-tab.

DeepSeek's non-reasoning option is the MoE (V2-Lite / Coder-V2-Lite, 16 B total but 2.4 B active per token). It has no published webgpu `.wasm`, so it runs through the Ollama lane (`deepseek-coder-v2:lite`) instead — non-reasoning, minimal per-token compute, and it flows through the identical full pipeline (listed in the model dropdown automatically when Ollama is up).

The roster filters reasoning models out of **both** lanes, by name (`isThinkingModel` in `holodeck-ask.js`): `deepseek-r1`, `qwq`, `qwen3` (thinks by default), and the `*-reasoning` / `*thinker` family. A reasoner over-thinks a simple prompt, loops, and can spend the whole budget before answering — the opposite of the fold, which does the reasoning itself. `qwen3-coder` and `deepseek-coder-v2` are not thinking models and stay.
