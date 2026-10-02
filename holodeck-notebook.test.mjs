// node --test holodeck-notebook.test.mjs
// The Data notebook pane's own guarantees, and the vendored ledger code it re-verifies with — run against the VENDORED copies (the
// same files the page loads), so a drift between vendor/ and upstream shows up here and in `node vendor-sync.mjs --check`.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import { createHash } from "node:crypto";
import { sha256 } from "./vendor/eoreader7/native/kernel/sha256.js";
import { seal, verifyChain, emptyBench, addCard, addRun, promote, statusOf, phrase } from "./vendor/eoreader7/native/the-fold/surface/bench.mjs";
import { emptyNotebook, addCell, editCell, recordExec, sourceOf, stale, verify } from "./vendor/eoreader7/native/the-fold/surface/notebook.mjs";
import { serverBase, mdToHtml, verifyState, turnsOf, DEFAULT_SERVER } from "./holodeck-notebook.js";

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
test("notebook modules introduce no external hosts", () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === ".git" ? [] : walk(`${d}/${e.name}`)) : [`${d}/${e.name}`]));
  const hostsIn = (txt) => [...txt.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)].map((m) => m[1].toLowerCase()).filter((h) => !/^(localhost|127\.0\.0\.1)$/.test(h));
  for (const f of ["holodeck-notebook.js", "vendor-sync.mjs", "tools/cdp.mjs", "tools/notebook-falsify.mjs", ...walk("vendor/eoreader7/native/the-fold"), "vendor/eoreader7/native/kernel/sha256.js"]) assert.deepEqual(hostsIn(fs.readFileSync(f, "utf8")), [], f);

});
