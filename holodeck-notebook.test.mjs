// node --test holodeck-notebook.test.mjs
// The Data notebook pane's own guarantees, and the vendored ledger code it re-verifies with — run against the VENDORED copies (the
// same files the page loads), so a drift between vendor/ and upstream shows up here and in `node vendor-sync.mjs --check`.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import { createHash } from "node:crypto";
import { sha256 } from "./vendor/eoreader7/native/kernel/sha256.js";
import { seal, verifyChain, emptyBench, addCard, addRun, promote, statusOf, phrase } from "./vendor/eoreader7/native/the-fold/surface/bench.mjs";
import { emptyNotebook, addCell, editCell, recordExec, sourceOf, stale, verify, cellOf } from "./vendor/eoreader7/native/the-fold/surface/notebook.mjs";
import { serverBase, mdToHtml, verifyState, turnsOf, DEFAULT_SERVER } from "./holodeck-notebook.js";
import { createPyodideEngine, toIpynb, PYODIDE_VERSION, PYODIDE_INDEX } from "./holodeck-pyodide.js";

const H = "human:me";

test("vendored sha256 is byte-identical to node:crypto (the page's hash is the server's hash)", () => {
  for (const s of ["", "abc", "a".repeat(64), "Natásha 🎉 北京", "x".repeat(100001)]) assert.equal(sha256(s), createHash("sha256").update(s).digest("hex"));
});

test("ported: the log is append-only and sealed — an altered entry breaks the chain", () => {
  let s = emptyNotebook(); s = addCell(s, { id: "m", type: "markdown", source: "x", author: H }).state;
  assert.ok(verify(s).notebook.ok);
  assert.equal(verify({ ...s, nb: { ...s.nb, entries: [{ ...s.nb.entries[0], source: "y" }] } }).notebook.ok, false);
});

test("ported: an edit supersedes and keeps the past; a claim is never edited", () => {
  let s = emptyNotebook(); s = addCell(s, { id: "c", type: "code", lang: "python", source: "1", author: H }).state;
  s = editCell(s, { cell: "c", source: "2", by: H }).state; assert.equal(sourceOf(s.nb, "c"), "2"); assert.equal(s.nb.entries[0].source, "1");
  s = addCell(s, { id: "k", type: "claim", source: "claim", author: H }).state; assert.match(editCell(s, { cell: "k", source: "wider", by: H }).error, /new claim/);
});

test("ported: a run states its own scope and result; stale says why; env is sealed with it", () => {
  let s = emptyNotebook(); s = addCell(s, { id: "c", type: "code", lang: "python", source: "x", author: H }).state;
  const r = recordExec(s, { cell: "c", output: '#scope {"kind":"sample","n":40,"seed":0,"label":"40 shuffles"}\n#result true', ok: true, env: { python: "3.11", numpy: "2.4" } });
  s = r.state; assert.equal(r.exec.scope.n, 40); assert.equal(r.exec.env.numpy, "2.4"); assert.equal(stale(s, "c"), null);
  s = editCell(s, { cell: "c", source: "y", by: H }).state; assert.match(stale(s, "c"), /source changed/);
  assert.ok(verify(s).notebook.ok);
});

test("ported: the ladder is the bench's — no promotion without a failed control, never by a model", () => {
  let log = addCard(emptyBench(), { id: "k", text: "x is small", author: H }).log;
  log = addRun(log, { id: "r1", card: "k", role: "check", code: "c", output: '#scope {"kind":"range","lo":1,"hi":3}\n#result true' }).log;
  assert.match(promote(log, { card: "k", to: "computed_in_range", by: H }).error, /control/);
  log = addRun(log, { id: "r2", card: "k", role: "control", code: "c", output: '#scope {"kind":"range","lo":1,"hi":3}\n#result false' }).log;
  assert.match(promote(log, { card: "k", to: "conjectured", by: "model:x" }).error, /never a model/);
  log = promote(log, { card: "k", to: "computed_in_range", by: H }).log; assert.equal(statusOf(log, "k"), "computed_in_range");
  assert.match(phrase(log, "k"), /Checked over every case from 1 to 3/); assert.ok(verifyChain(log).ok);
});

test("the pane only ever talks to a loopback server", () => {
  assert.equal(serverBase("http://127.0.0.1:9000/"), "http://127.0.0.1:9000");
  assert.equal(serverBase("http://localhost:8901"), "http://localhost:8901");
  for (const bad of ["https://example.org", "http://localhost.evil.com:8900", "http://10.0.0.2:8900", "javascript:alert(1)", ""]) assert.equal(serverBase(bad), DEFAULT_SERVER);
});

test("markdown is escaped before it is formatted", () => {
  const h = mdToHtml("# T\n**b** `c` <img src=x onerror=alert(1)>\n- a");
  assert.match(h, /<h3>T<\/h3>/); assert.match(h, /<b>b<\/b>/); assert.match(h, /<code>c<\/code>/); assert.ok(!h.includes("<img")); assert.match(h, /&lt;img/);
});

test("verifyState re-checks every chain it is shown, and names where one breaks", () => {
  let s = emptyNotebook(); s = addCell(s, { id: "ask1", type: "markdown", source: "**Asked:** q\n\nnote", author: H }).state; s = addCell(s, { id: "c", type: "code", lang: "python", source: "1", author: H }).state; s = addCell(s, { id: "ans1", type: "markdown", source: "found", author: H }).state;
  const ws = seal({ entries: [] }, { kind: "create", id: "c1", type: "chat", by: H });
  const S = { ledgers: { nb: s.nb.entries, bench: s.bench.entries, workspace: ws.entries, analyses: [] } };
  assert.deepEqual(Object.values(verifyState(S)).map((v) => v.ok), [true, true, true, true]);
  const bad = { ledgers: { ...S.ledgers, nb: S.ledgers.nb.map((e, i) => (i === 1 ? { ...e, source: "2" } : e)) } };
  const v = verifyState(bad); assert.equal(v.nb.ok, false); assert.equal(v.nb.at, 1);
  const t = turnsOf(s.nb); assert.equal(t.length, 1); assert.equal(t[0].work.length, 1); assert.equal(t[0].ans.id, "ans1");
});

// The page loaded many non-localhost hosts before this work (CDNs, fonts, Wikipedia, a Cloudflare worker). This work may add NONE.
const BASELINE = ["api.allorigins.win", "api.codetabs.com", "api.github.com", "archive.org", "archive.ph", "cdn.jsdelivr.net", "clovenbradshaw-ctrl.github.io", "corsproxy.io", "en.wikipedia.org", "eolab.substack.com", "esm.run", "esm.sh", "example.com", "fonts.googleapis.com", "github.com", "holodeck-proxy.prometheoid.workers.dev", "httpbin.org", "i.ytimg.com", "r.jina.ai", "raw.githubusercontent.com", "unpkg.com", "web.archive.org", "www.youtube.com"]; // at holodeck 72aef8b
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === ".git" ? [] : walk(`${d}/${e.name}`)) : [`${d}/${e.name}`]));
const hostsIn = (txt) => [...txt.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)].map((m) => m[1].toLowerCase()).filter((h) => !/^(localhost|127\.0\.0\.1)$/.test(h));
test("notebook modules introduce no external hosts", () => {
  for (const f of ["holodeck-notebook.js", "vendor-sync.mjs", "tools/cdp.mjs", "tools/notebook-falsify.mjs", ...walk("vendor/eoreader7/native/the-fold"), "vendor/eoreader7/native/kernel/sha256.js"]) assert.deepEqual(hostsIn(fs.readFileSync(f, "utf8")), [], f);
});

test("the in-tab Pyodide module names only the CDN the page already loads from", () => {
  const hosts = [...new Set(hostsIn(fs.readFileSync("holodeck-pyodide.js", "utf8")))];
  assert.deepEqual(hosts, ["cdn.jsdelivr.net"]);
  assert.ok(BASELINE.includes("cdn.jsdelivr.net"), "and that host is already on the page's baseline, so no new host is introduced");
  assert.equal(PYODIDE_INDEX, `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`);
});

// The in-tab engine, exercised without a browser: autoload:false and a Map-backed store. Runs need Pyodide and are
// covered by tests/pyodide-notebook.browser.mjs; everything the pane relies on around them is checked here.
const mapStore = () => { const m = new Map(); return { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, v) }; };
test("the in-tab engine serves the pane's routes: tabs, edits, datasets, forks, imports and re-verified chains", async () => {
  const eng = createPyodideEngine({ workspace: "w", store: mapStore(), autoload: false, by: "human:test" });
  const get = async (u) => (await eng.fetch("http://in-tab" + u)).json();
  const api = async (body) => { const j = await (await eng.fetch("http://in-tab/notebook/api", { method: "POST", body: JSON.stringify(body) })).json(); assert.ok(!j.error, j.error); return j; };
  let s = await get("/notebook/state");
  assert.equal(s.server.runtime, "pyodide"); assert.equal(s.server.env.pyodide, PYODIDE_VERSION); assert.equal(s.conv.type, "notebook"); assert.equal(s.tabs.length, 1);
  const c = s.conv.id;
  const code = (await api({ c, op: "add", type: "code", source: "x = 40" })).selected;
  const mark = (await api({ c, op: "add", type: "markdown", source: "# Notes" })).selected;
  await api({ c, op: "edit", cell: code, source: "x = 41" });
  const csv = Buffer.from("name,value\na,10\nb,20\n").toString("base64");
  await api({ c, op: "upload", name: "sample.csv", base64: csv });
  const ds = await api({ c, op: "dataset" }); assert.match(ds.notice, /sample.csv · 21 characters/);
  s = await get("/notebook/state");
  assert.equal(sourceOf({ entries: s.ledgers.nb }, code), "x = 41"); assert.ok(cellOf({ entries: s.ledgers.nb }, mark));
  const v = verifyState(s); assert.ok(Object.values(v).every((x) => x.ok), JSON.stringify(v));
  const f = await api({ c: s.conv.id, op: "ws-fork", at: "end" });
  const forked = await get("/notebook/state?c=" + f.goto);
  assert.deepEqual(forked.ledgers.nb.map((e) => e.hash), s.ledgers.nb.map((e) => e.hash));
  assert.ok(Object.values(verifyState(forked)).every((x) => x.ok));
  const ipynb = await get("/notebook/ipynb?c=" + s.conv.id);
  assert.equal(ipynb.nbformat, 4); assert.equal(ipynb.metadata.kernelspec.language, "python"); assert.equal(ipynb.cells.length, 2);
  const imp = await api({ c: s.conv.id, op: "import-ipynb", name: "roundtrip.ipynb", notebook: ipynb });
  const imported = await get("/notebook/state?c=" + imp.goto);
  assert.equal(imported.ledgers.nb.filter((e) => e.kind === "cell").length, 2);
  assert.equal(imported.ledgers.nb.filter((e) => e.kind === "exec").length, 0);
  assert.equal(imported.ledgers.nb.filter((e) => e.kind === "import").length, 1);
  assert.equal((await eng.fetch("http://in-tab/notebook/bundle")).ok, false, "the bundle route is the local server's and is refused honestly here");
});
test("the in-tab engine keeps a second workspace apart", async () => {
  const a = createPyodideEngine({ workspace: "a", store: mapStore(), autoload: false, by: "human:test" });
  const b = createPyodideEngine({ workspace: "b", store: mapStore(), autoload: false, by: "human:test" });
  const add = async (eng) => { const s = (await (await eng.fetch("http://x/notebook/state")).json()); return (await (await eng.fetch("http://x/notebook/api", { method: "POST", body: JSON.stringify({ c: s.conv.id, op: "add", type: "code", source: "1" }) })).json()).selected; };
  await add(a); const sb = await (await b.fetch("http://x/notebook/state")).json();
  assert.equal(sb.ledgers.nb.length, 0, "one workspace's notebook is not another's");
});
