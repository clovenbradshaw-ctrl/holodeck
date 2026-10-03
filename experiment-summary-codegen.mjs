// experiment-summary-codegen.mjs — fold the chase record at the DRAWER's
// identity (forWhom), take the summary, and generate code from it. Judge by
// the generic RSS-validity test; count machine repairs. Compare to the record.
import { writeFileSync } from 'node:fs';
import { select, worth } from './holodeck-summary.js';

// the chase record, in the grain the engine reads: name-BONDS (two names per
// statement) and the giver's OWN evaluative lexicon (failed/broken neg,
// solved/worked pos). The same facts as the LOG, written to the claim shape.
const report = [
  "FirstDraw and Machine collided on the import gap.",
  "FirstDraw failed the first attempt.",
  "The redraw was broken and drifted again.",
  "Machine and FirstDraw shared the correct structure.",
  "Machine repaired the import and solved the datetime error.",
  "Machine and Test completed the truncated return.",
  "The generic Test worked and judged the feed valid.",
  "The Hunt and Wall matched nothing by name.",
  "The Wall collapsed when Repairs landed.",
].join("\n");

let s = 0; const sts = [];
for (const line of report.split("\n")) {
  const e = s + line.length;
  sts.push({
    id: "chase:" + s + "-" + e, doc: "chase", s, e,
    text: line, names: (line.match(/\b(FirstDraw|Machine|Test|Wall|Hunt|Repairs)\b/g) || []).filter((v, i, a) => a.indexOf(v) === i),
    figs: [], ref: false, claimy: true, frame: "fact", polarity: "+",
  });
  s = e + 1;
}
const A = { docs: [{ id: "chase" }], docById: { chase: { id: "chase" } }, sts, byId: Object.fromEntries(sts.map((x) => [x.id, x])), stsByDoc: { chase: sts } };

// THE IDENTITY: the drawer after its failed draws — negative stance, holds
// its own failure, the hunt's failure, the wall. The summary must be what
// DIFFERS from it: the stance-inversions (the turns), then content-departure.
const drawer = { conclusion: { names: ["FirstDraw", "Hunt", "Wall"], frames: ["uncertain"], measures: [], stance: -1, n: 3 } };

const w = worth(A, "chase", { forWhom: drawer });
const one = select(A, "chase", { size: 5, forWhom: drawer });
console.log("=== the summary of the record, folded at the drawer ===");
for (const p of one.proves) {
  const sc = w.score.get(p.id);
  console.log(`- [score ${sc.s.toFixed(2)} | flip ${sc.flip} | dep ${sc.dep} | excess ${sc.ex}] ${p.span.text}`);
}

const lines = one.lines.join("\n");
writeFileSync("/tmp/summary-brief.txt", lines);
console.log("\n=== SUMMARY BRIEF (the anchor for code generation) ===");
console.log(lines);
console.log("\n=== the drawer's held conclusion (what is NOT news to it) ===");
console.log(JSON.stringify(drawer.conclusion));