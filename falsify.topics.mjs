// falsify.topics.mjs — topic detection must hold against a workspace with genuinely disparate content.
//
// Feeds the live analysis pipeline (window.__holodeck.analyze) a corpus spanning several real topics —
// each topic as its own documents, plus the three traps that break pure name-recurrence:
//   1. ECHO TOPIC: two documents about the SAME story that use different proper names (only the claim and
//      its figures recur). Name recurrence leaves them both stray; the holograph's echo must hold them.
//   2. CROSS-TOPIC RECURRING NAME: one name genuinely used across topics (a funder, a reporter) inside the
//      hub floor, so a naive "shares a name" edge would drag unrelated documents together.
//   3. CROSS-TOPIC PAIR: two unrelated documents that share TWO proper names (both inside the hub floor),
//      the exact shape the old shared-name floor was built to refuse.
// Then runs paradigms(A) and scores every detected group against ground truth: no over-merge (a group must
// be single-topic), and recall (each topic's documents must actually come together).
//
//   node falsify.topics.mjs          # needs `npm run serve` running on :8813
//
// The corpus is data, not assertions: edit TOPICS to test other content. A topic's docs must share a
// ground-truth label here; detection never sees it.

import { openSurface } from "./drive-holodeck.mjs";

const TOPICS = [
  {
    label: "library",
    docs: [
      "The Bellevue branch of the Metro Public Library is set to reopen in May after an $18 million renovation. Director Paul Ashworth told the library board the project came in under its $20 million estimate, and the new 24,000 square foot reading room will open to the public first. The renovation added meeting space and moved the children's collection to the ground floor.",
      "Paul Ashworth, the library director, confirmed the Bellevue renovation is on track to reopen in May. The $18 million project stayed under the $20 million estimate, he told the board, and the 24,000 square foot reading room is the centerpiece. The children's collection moves to the ground floor when the branch reopens.",
    ],
  },
  {
    label: "quantum",
    docs: [
      "Northwind Quantum raised $90 million for its annealing chip line. Founder Elena Marsh says the Phoenix-class chip solved a scheduling workload in 42 microseconds, and the round was led by Meridian Capital. The new funding will double the company's fab capacity by next year.",
      "Elena Marsh's Northwind Quantum closed a $90 million round led by Meridian Capital. The Phoenix-class annealing chip completed a scheduling workload in 42 microseconds, Marsh said, and the company plans to double its fab capacity by next year.",
    ],
  },
  {
    label: "budget",
    docs: [
      "The Metro Council budget committee reviewed the FY2027 operating budget on Tuesday. Chair Dana Whitfield said the public safety allocation rose to $412 million, a cut from the $430 million the mayor proposed, and the full council will vote next week.",
      "Council Chair Dana Whitfield told reporters the FY2027 operating budget falls short of the mayor's request. The public safety allocation was set at $412 million after the committee vote, and the full council votes on it next week.",
    ],
  },
  {
    label: "audit", // ECHO TOPIC: the same story told with different proper names — only the claim and figures recur
    docs: [
      "An audit of the startup's flagship processor failed its own reliability claim. The chip could not sustain a 42-hour burn test, the audit said, and the projected launch now slips to 2027. Engineers blamed a cooling defect in the production unit.",
      "The company's newest processor could not pass a 42-hour burn test, outside reviewers found. The projected launch now slips to 2027, undercutting the startup's reliability claim, and engineers are investigating a cooling defect.",
    ],
  },
];

// cross-topic recurring name: a funder genuinely involved in two different stories, inside the hub floor
// cross-topic pair: two unrelated stories sharing the same funder AND the same architect (the exact shape
// the old shared-name floor was built to refuse — the holograph must refuse it too)
const CROSS = [
  {
    label: "funder-story-a", // shares the funder + architect with funder-story-b (the trap)
    docs: [
      "The Carter Family Foundation gave $12 million to the Bellevue library renovation this spring. Architect Maya Lindqvist designed the new reading room, which opens in May. Foundation trustees called the grant the largest in the branch's history.",
      "The Carter Family Foundation's $12 million grant to the Bellevue library was announced this week. Maya Lindqvist's design for the reading room opens in May, and the trustees called it the largest grant in the branch's history.",
    ],
  },
  {
    label: "funder-story-b", // an UNRELATED story that happens to name the same funder and architect
    docs: [
      "Maya Lindqvist joined the Carter Family Foundation's board to advise on a quantum computing campus. The foundation is exploring a $12 million commitment, and a first grant could come this quarter.",
      "The Carter Family Foundation tapped architect Maya Lindqvist for its quantum campus advisory board, eyeing a $12 million commitment. A first grant could come this quarter.",
    ],
  },
];

function corpus() {
  const docs = [];
  const truth = new Map(); // doc id -> topic label
  let i = 0;
  for (const t of [...TOPICS, ...CROSS]) {
    t.docs.forEach((text, k) => {
      const id = "d" + i++;
      docs.push({ id, title: t.label + "-" + (k + 1), text });
      truth.set(id, t.label);
    });
  }
  return { docs, truth };
}

// score a paradigm run: every detected group must be single-topic (no over-merge), and each topic's
// documents must be grouped with at least one partner (recall). Returns { groups, overMerge, strays,
// recall, perGroup, perTopic }.
function score(A, P, truth) {
  const docTopic = (id) => truth.get(id);
  const perGroup = P.groups.map((g) => {
    const ids = g.docs.map((d) => d.id);
    const counts = {};
    ids.forEach((id) => { const t = docTopic(id); counts[t] = (counts[t] || 0) + 1; });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const majority = entries[0];
    return { label: g.label, ids, n: ids.length, counts, majority: majority[0], purity: majority[1] / ids.length, overMerged: entries.length > 1 };
  });
  const overMerge = perGroup.filter((g) => g.overMerged);
  const groupedIds = new Set(P.groups.flatMap((g) => g.docs.map((d) => d.id)));
  const topics = {};
  [...truth.entries()].forEach(([id, t]) => { (topics[t] = topics[t] || []).push(id); });
  const perTopic = Object.entries(topics).map(([t, ids]) => {
    const inGroup = ids.filter((id) => groupedIds.has(id));
    const partners = ids.filter((id) => groupedIds.has(id) && P.groups.some((g) => g.docs.length >= 2 && g.docs.some((d) => d.id === id) && g.docs.some((d) => d.id !== id)));
    return { topic: t, n: ids.length, grouped: inGroup.length, recall: partners.length / ids.length };
  });
  const grouped = [...groupedIds];
  const recall = perTopic.reduce((s, t) => s + t.recall * t.n, 0) / truth.size;
  const strays = A.docs.length - grouped.length;
  return { perGroup, overMerge, perTopic, recall, strays, groupedN: grouped.length, totalN: A.docs.length };
}

async function main() {
  const surf = await openSurface({ headless: true, url: process.env.FOLD_URL || "http://127.0.0.1:8813/index.html" });
  try {
    await surf.page.waitForFunction(() => window.__holodeck && typeof window.__holodeck.paradigms === "function", null, { timeout: 20000 });
    const { docs, truth } = corpus();
    // analyze and detect entirely in the page (Sets don't survive the evaluate round-trip); return
    // only the serializable verdict.
    const det = await surf.page.evaluate((docs) => {
      const A = window.__holodeck.analyze({ docs });
      const P = window.__holodeck.paradigms(A);
      return { totalN: A.docs.length, groups: P.groups.map((g) => ({ label: g.label, ids: g.docs.map((d) => d.id) })) };
    }, docs);
    const P = { groups: det.groups.map((g) => ({ label: g.label, docs: g.ids.map((id) => ({ id })) })) };
    const r = score({ docs }, P, truth);

    console.log("corpus: " + docs.length + " docs, " + new Set(truth.values()).size + " ground-truth topics");
    console.log("");
    console.log("detected groups:");
    for (const g of r.perGroup) {
      const mark = g.overMerged ? "  <-- OVER-MERGED (" + Object.entries(g.counts).map(([t, n]) => t + ":" + n).join(", ") + ")" : "";
      console.log("  " + g.label.padEnd(28) + " n=" + g.n + "  purity=" + g.purity.toFixed(2) + mark);
    }
    console.log("");
    console.log("per topic:");
    for (const t of r.perTopic) console.log("  " + t.topic.padEnd(22) + " grouped " + t.grouped + "/" + t.n + "  recall=" + t.recall.toFixed(2));
    console.log("");
    console.log("VERDICT: over-merge=" + r.overMerge.length + ", strays=" + r.strays + ", recall=" + r.recall.toFixed(2));

    const ok = r.overMerge.length === 0 && r.recall >= 0.75;
    console.log(ok ? "PASS" : "FAIL");
    if (surf.consoleErrors.length) {
      console.log("console errors:", JSON.stringify(surf.consoleErrors));
      process.exitCode = 2;
    }
    if (!ok) process.exitCode = 1;
  } finally {
    await surf.close();
  }
}

main();