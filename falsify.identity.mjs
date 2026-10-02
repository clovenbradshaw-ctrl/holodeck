// falsify.identity.mjs — REFERENT IDENTITY: the source's own evidence must fold a
// referent's surface variants into ONE identity, canonicalised to its most
// descriptive and singular spelling; and a shared token must NEVER fold two
// genuinely different referents together.
//
// Feeds the live analysis pipeline (window.__holodeck.analyze) corpora whose
// ground truth is known, and checks the cast it yields:
//
//   MERGE   a biography whose subject is named by a full form, a birth name
//           (stated appositively and linked), and a bare surname must be ONE
//           entry, canonicalised to the most descriptive surface, with the rest
//           carried as aliases; the type is read once for the whole identity.
//   CONTROL same-surname people whose own hyperlinks point at different
//           referents must stay two entries (no over-merge); a bare surname a
//           document's own title gives to one bearer folds to that bearer; a
//           bare surname with two possible bearers and no deciding evidence is
//           left alone, not guessed.
//
//   node falsify.identity.mjs          # needs `npm run serve` running on :8813
//
// The corpora are data, not assertions: edit CASES to test other content.

import { openSurface } from "./drive-holodeck.mjs";

const W = (u, t) => `<a href="https://en.wikipedia.org/wiki/${u}">${t}</a>`;
const doc = (id, title, html, url) => ({ id, title, format: "html", html, url: url || ("https://en.wikipedia.org/wiki/" + title.replace(/ /g, "_")) });

// one referent named three ways + a same-surname relative who is a different person
const SARANDON = [doc("d0", "Susan Sarandon", `<p>${W("Susan_Sarandon", "Susan Sarandon")} (born ${W("Susan_Sarandon", "Susan Abigail Tomalin")}; October 4, 1946) is an American actress.</p>
<p>Later, Sarandon won an Academy Award for her performance in Dead Man Walking. In 1946, Sarandon was born in New York City.</p>
<p>Her brother is actor ${W("Chris_Sarandon", "Chris Sarandon")}. In The Princess Bride, Chris Sarandon played a prince.</p>
<p>By then, Susan Sarandon had moved to New York City. Later, Sarandon said the role changed her career.</p>`)];
// the birth name stated only appositively, never linked (the link must not be the crutch)
const BORN_UNLINKED = [doc("d0", "Susan Sarandon", `<p>Susan Sarandon (born Susan Abigail Tomalin; October 4, 1946) is an American actress.</p>
<p>Later, Sarandon won an Academy Award. In 1995, Sarandon said the role changed her career.</p>`)];
// two people who share a surname; each linked to its OWN referent; the bare surname links to John
const TWO_SMITHS_LINKED = [doc("d0", "John Smith", `<p>${W("John_Smith", "John Smith")} was an engineer. ${W("Jane_Smith", "Jane Smith")} was a doctor.</p>
<p>Later, ${W("John_Smith", "Smith")} founded a company, while Jane Smith remained at the hospital.</p>`)];
// two same-surname subjects as their own documents: the bare surname is NOT singular, so it must not fold either
const TWO_SMITHS_DOCS = [
  doc("d0", "John Smith", `<p>John Smith was an engineer. Later, Smith founded a company.</p>`),
  doc("d1", "Jane Smith", `<p>Jane Smith was a doctor. Later, Smith ran a hospital.</p>`),
];
// ambiguity with no deciding evidence at all: two bearers, no links, no full-name title
const TWO_SMITHS_AMBIGUOUS = [doc("d0", "Report", `<p>John Smith met Jane Smith at the meeting. The report also names Smith as a witness.</p>`)];

const CASES = [
  { id: "merge-three-way", label: "one referent, three surfaces", docs: SARANDON,
    expect: { oneOf: ["Susan Sarandon", "Susan Abigail Tomalin", "Sarandon"], members: ["Susan Sarandon", "Susan Abigail Tomalin", "Sarandon"], canonical: "Susan Abigail Tomalin", type: "person", separate: ["Chris Sarandon"] } },
  { id: "merge-born-unlinked", label: "born-name stated appositively (no link)", docs: BORN_UNLINKED,
    expect: { oneOf: ["Susan Sarandon"], members: ["Susan Sarandon", "Susan Abigail Tomalin", "Sarandon"], canonical: "Susan Abigail Tomalin", type: "person" } },
  { id: "linked-namesakes-stay-apart", label: "same surname, different link targets", docs: TWO_SMITHS_LINKED,
    expect: { oneOf: ["John Smith"], members: ["John Smith", "Smith"], separate: ["Jane Smith"] } },
  { id: "two-subject-docs-stay-apart", label: "same surname, two documented subjects", docs: TWO_SMITHS_DOCS,
    expect: { separate: ["John Smith", "Jane Smith"] } },
  { id: "ambiguous-bare-refused", label: "two bearers, no evidence — not guessed", docs: TWO_SMITHS_AMBIGUOUS,
    expect: { bareAlone: "Smith", separate: ["John Smith", "Jane Smith"] } },
  { id: "appositive-anchors-nearest", label: "alias binds the name nearest it, not the sentence's lead",
    docs: [doc("d0", "Report", `<p>Susan Sarandon met Louis Malle, known as Malle, in Paris.</p><p>Louis Malle directed the film.</p>`)],
    expect: { oneOf: ["Louis Malle"], members: ["Louis Malle", "Malle"], separate: ["Susan Sarandon"] } },
];

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const toks = (s) => norm(s).split(" ").filter(Boolean).length;

function check(names, expect) {
  const fails = [];
  const byName = new Map(names.map((n) => [n.name, n]));
  const entryFor = (label) => names.find((n) => n.name === label || (n.aliases || []).some((a) => a === label));
  const membersOf = (e) => new Set([e.name, ...(e.aliases || [])]);

  if (expect.members) {
    const e = entryFor(expect.oneOf[0]);
    if (!e) { fails.push("no entry carries " + JSON.stringify(expect.oneOf)); return fails; }
    const ms = membersOf(e);
    for (const m of expect.members) if (!ms.has(m)) fails.push("identity is missing surface " + JSON.stringify(m) + " (has " + [...ms].join(", ") + ")");
    if (expect.canonical && e.name !== expect.canonical) fails.push("canonical is " + JSON.stringify(e.name) + ", expected the most descriptive " + JSON.stringify(expect.canonical));
    if (expect.canonical && toks(e.name) < Math.max(...expect.members.map(toks))) fails.push("canonical " + JSON.stringify(e.name) + " is not the most descriptive of its surfaces");
    if (expect.type && e.type !== expect.type) fails.push("type is " + JSON.stringify(e.type) + ", expected " + JSON.stringify(expect.type));
    for (const lab of (expect.separate || [])) {
      if (ms.has(lab)) fails.push("over-merged: " + JSON.stringify(lab) + " is a different referent but folded in");
      if (!byName.has(lab)) fails.push("missing the separate referent " + JSON.stringify(lab));
    }
  }
  for (const lab of (expect.separate || [])) {
    const e = byName.get(lab);
    if (e && expect.oneOf && e.name === expect.oneOf[0]) fails.push("over-merged: " + JSON.stringify(lab) + " took the canonical of another referent");
  }
  if (expect.bareAlone) {
    const e = byName.get(expect.bareAlone);
    if (!e) fails.push("the ambiguous bare " + JSON.stringify(expect.bareAlone) + " vanished instead of standing alone");
    else if ((e.aliases || []).length || names.some((n) => n.name !== e.name && (n.aliases || []).includes(expect.bareAlone))) fails.push("the ambiguous bare " + JSON.stringify(expect.bareAlone) + " was folded to a bearer on no evidence");
  }
  return fails;
}

async function main() {
  const surf = await openSurface({ headless: true });
  try {
    await surf.page.waitForFunction(() => window.__holodeck && typeof window.__holodeck.analyze === "function", null, { timeout: 20000 });
    let failed = 0;
    for (const c of CASES) {
      const names = await surf.page.evaluate((docs) => Object.values(window.__holodeck.analyze({ docs }).names).map((n) => ({ name: n.name, type: n.type, aliases: n.aliases || [] })), c.docs);
      names.sort((a, b) => a.name.localeCompare(b.name));
      const fails = check(names, c.expect);
      console.log((fails.length ? "FAIL " : "PASS ") + c.id.padEnd(28) + c.label);
      console.log("      cast: " + names.map((n) => n.name + (n.aliases.length ? " [" + n.aliases.join(", ") + "]" : "")).join(" · "));
      for (const f of fails) console.log("      - " + f);
      failed += fails.length ? 1 : 0;
    }
    // ── TYPING: a referent's kind is read from the statement's own words — a
    // human role before/after a name marks a person, a structural org head beats a
    // place that ends the name, and a merged identity carries one stable type. ──
    const TYPE_DOCS = [
      ...SARANDON,
      doc("d9", "Louis Malle", `<p>Louis Malle was a French filmmaker. Louis Malle directed Au Revoir les Enfants.</p>
<p>The Catholic University of America is in Washington. New York City hosted the premiere.</p>`),
    ];
    const typeNames = await surf.page.evaluate((docs) => Object.values(window.__holodeck.analyze({ docs }).names).map((n) => ({ name: n.name, type: n.type, aliases: n.aliases || [] })), TYPE_DOCS);
    const typeOf = (label) => { const e = typeNames.find((n) => n.name === label || (n.aliases || []).includes(label)); return e ? e.type : null; };
    const WANT = [["Susan Abigail Tomalin", "person"], ["Chris Sarandon", "person"], ["Louis Malle", "person"], ["New York City", "place"], ["Catholic University of America", "organisation"]];
    for (const [nm, want] of WANT) {
      const got = typeOf(nm);
      const ok = got === want;
      if (!ok) failed += 1;
      console.log((ok ? "PASS " : "FAIL ") + "type".padEnd(28) + nm + " → " + (got || "?").padEnd(14) + " (want " + want + ")");
    }

    console.log("");
    console.log(failed ? "VERDICT: FAIL (" + failed + " failures)" : "VERDICT: PASS (identity " + CASES.length + "/" + CASES.length + ", typing 5/5)");
    if (surf.consoleErrors.length) console.log("console errors:", JSON.stringify(surf.consoleErrors.slice(0, 6)));
    if (failed) process.exitCode = 1;
  } finally {
    await surf.close();
  }
}

main();
