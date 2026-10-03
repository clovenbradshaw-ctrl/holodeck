// experiment-codegen-summary.mjs — THE MECHANICAL SUMMARY OVER A REAL CODE
// CHASE. Fold a recorded code-loop run at the VOID's identity and ask: does the
// summary carry the TURN (the repeated/root-caused fix) better than the raw
// last-failure slice the loop actually feeds the next draw?
//
// The seam this tests (eoreader7 native/the-fold/code-loop.js:880-889): the
// spiral's next fragment carries only `lastTestFailure.slice(0,400)` and
// `lastNote.slice(0,300)` — the RAW last failure, sliced mid-span, identical
// across rounds when the model repeats itself. The full `rounds` record (the
// chase's own bytes: body, exit code, reverted, forecast, test output) is kept
// and never folded. This experiment folds it.
//
// THE GRAIN, DISCLOSED. A code-loop run is a structured record, not prose. Each
// claim below is one DISTINCT body the run tried (identical adds collapsed, the
// repetition kept as a count), its outcome read off the record's own fields
// (testExitCode, reverted, forecast.error) and carried by the English
// evaluative lens (stance.js: "failed" neg, "solved" pos) — the same lens the
// fold and the archons share. Names are the function, the file, and the body's
// own identifiers. Nothing is invented; every token traces to a real field.
//
//   node experiment-codegen-summary.mjs [--record PATH] [--json]
import { readFileSync, readdirSync } from "node:fs";
import { worth, select, resolverEdges, conclusionOf, stanceOf } from "./holodeck-summary.js";

const arg = (f, fb) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : fb; };
const RESULTS = new URL("../eoreader7/native/eval/the-fold/results/", import.meta.url);

function loadRecord(p) {
  const raw = JSON.parse(readFileSync(p, "utf8"));
  return Array.isArray(raw) ? raw : raw.rounds || [];
}

const retOf = (add) => { const m = /return\s+(.+)/.exec(add || ""); return m ? m[1].trim() : String(add || "").split("\n").pop().trim(); };
const funcOf = (rounds) => { for (const r of rounds) { const m = /def\s+([A-Za-z_]\w*)/.exec(r.add || ""); if (m) return m[1]; } return "(the unit)"; };

/** foldRun(rounds) -> { A, id, held, worth, brief, groups, green } — the whole
 *  mechanical read of one chase. Pure; the fold at the void's identity. */
export function foldRun(rounds) {
  const id = "chase";
  const fileOf = rounds.find((r) => r.path)?.path || "solution.py";
  const fn = funcOf(rounds);

  // Collapse identical attempts to one DISTINCT body; the repetition is a count.
  const groups = new Map();
  for (const r of rounds) {
    const key = r.bodyHash || r.add || (r.gap ? "gap:" + r.gap.kind : "raw:" + JSON.stringify(r.raw ?? ""));
    const g = groups.get(key) || { add: r.add, gap: r.gap, n: 0, greens: 0, exits: new Set(), reverted: 0, kelsen: [], ferr: [] };
    g.n += 1;
    if (r.testExitCode === 0) g.greens += 1; else if (r.testExitCode != null) g.exits.add(r.testExitCode);
    if (r.reverted) g.reverted += 1;
    if (r.kelsen != null) g.kelsen.push(r.kelsen);
    if (r.forecast && typeof r.forecast.error === "number") g.ferr.push(r.forecast.error);
    groups.set(key, g);
  }

  let s = 0; const sts = [];
  for (const g of groups.values()) {
    const green = g.greens > 0;
    const ret = g.add ? retOf(g.add) : (g.gap?.reason || "no body was drawn");
    const idents = [...new Set((ret.match(/[A-Za-z_][\w.]*/g) || []))].slice(0, 4);
    const text = green
      ? `${fn} in ${fileOf}: the body ${ret} solved the real test (exit 0) — this change was kept.`
      : `${fn} in ${fileOf}: the body ${ret} failed the real test (exit ${[...g.exits].join("/") || 1}) ${g.n} time${g.n > 1 ? "s" : ""} — the change was reverted each time.`;
    sts.push({
      id: id + ":" + sts.length, doc: id, s, e: s + text.length, text,
      names: [fn, fileOf, ...idents], figs: [{ raw: String(g.n), value: g.n, unit: "attempts" }],
      ref: false, claimy: true, frame: "fact", polarity: green ? "+" : "-", year: 2026,
      _green: green, _n: g.n, _ret: ret, _ferr: g.ferr, _kelsen: g.kelsen,
    });
    s += text.length + 1;
  }
  const A = { docs: [{ id, title: id }], docById: { [id]: { id, title: id } }, sts, byId: Object.fromEntries(sts.map((x) => [x.id, x])), stsByDoc: { [id]: sts } };

  // THE VOID'S IDENTITY: the loop holds that this one unit can be made to pass,
  // on this file. A failing body inverts that held stance — it is the turn.
  const held = { conclusion: { names: [fn, fileOf], measures: [], frames: ["fact"], stance: 1 } };
  const w = worth(A, id, { forWhom: held });
  const brief = select(A, id, { size: 3, forWhom: held });
  const edges = resolverEdges(A, id, { top: 8 });
  const green = sts.some((x) => x._green);
  return { A, id, held, fn, file: fileOf, worth: w, brief, edges, sts, green, groups };
}

// ── CLI ────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const single = arg("--record", null);
  const records = single
    ? [single]
    : (() => {
        const files = readdirSync(RESULTS).filter((f) => f.startsWith("harness-rounds-") && f.endsWith(".json"));
        const green = files.find((f) => f.includes("16-47-24-004Z-Basic-09")); // 5 rounds, repeated body, then solved
        const wall = files.find((f) => f.includes("04-49-33-065Z-Basic-09")); // 3 rounds, same body, never solved
        return [green, wall].filter(Boolean).map((f) => new URL(f, RESULTS));
      })();

  const out = [];
  for (const rec of records) {
    const rounds = loadRecord(rec);
    if (!rounds.length) { console.log(`(no rounds in ${rec})`); continue; }
    const R = foldRun(rounds);
    const name = String(rec).split("/").pop().replace(".json", "");

    // what code-loop.js:880-889 ACTUALLY feeds the next draw
    const lastFailure = [...rounds].reverse().find((r) => r.testExitCode && r.testExitCode !== 0)?.testOutput || "";
    const current = lastFailure.slice(0, 400);
    const briefText = R.brief.lines.join("\n");

    console.log(`\n═══ ${name} — ${rounds.length} attempts, ${R.sts.length} distinct bodies, ${R.green ? "SOLVED" : "WALL (no green)"} ═══`);
    console.log(`\nper-claim worth (folded at the void: ${R.fn} in ${R.file}, held stance +):`);
    for (const st of R.sts) {
      const sc = R.worth.score.get(st.id);
      console.log(`  [score ${sc.s.toFixed(2)} | flip ${sc.flip} | dep ${sc.dep} | excess ${sc.ex.toFixed(2)}] ${st._green ? "KEPT " : "FAIL "}×${st._n}  ${st.text}`);
    }
    console.log(`\ncurrent feedback the loop sends (last failure .slice(0,400)) — ${current.length} chars:`);
    console.log("  " + JSON.stringify(current.slice(0, 100)) + (current.length > 100 ? " …" : ""));
    console.log(`\nfolded brief — ${briefText.length} chars, every line a real record reading:`);
    for (const l of R.brief.lines) console.log("  → " + l);
    console.log(`\nresolvers (S(a|B∪{b}) < S(a|B)): ${R.edges.length ? R.edges.map((e) => `${e.resolver.id}→${e.turn.id} (drop ${e.drop.toFixed(2)})`).join(", ") : "none — no claim explains another at this grain"}`);

    if (!R.green) {
      console.log(`\nVOID: no body in this run solved the unit — the fold asserts the wall as a fact:`);
      console.log(`  "${R.brief.lines[0] || "(nothing formed)"}"`);
    } else {
      const repeat = R.sts.find((x) => !x._green && x._n > 1);
      const keeper = R.sts.find((x) => x._green);
      console.log(`\nTURN the fold carries: ${repeat ? `the same body failed ${repeat._n}× — repetition is the signal` : "a single failing body"}; resolver: ${keeper ? keeper._ret : "(none)"}`);
    }
    out.push({ name, chars: { current: current.length, brief: briefText.length }, green: R.green, brief: R.brief.lines });
  }
  if (process.argv.includes("--json")) console.log(JSON.stringify(out, null, 2));
}
