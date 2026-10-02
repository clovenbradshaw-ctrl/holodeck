// holodeck-links.test.mjs — THE GATE MUST NEVER GIVE INFO FOR THE WRONG
// PERSON OR THING. Falsifies the referent→links pull against captured real
// Wikidata payloads (fixtures/wikidata-probes.json), with fetch injected so
// nothing here touches the network.
//
// The identity law (SEED-SPEAKER.md; native/kernel/identity.js): two figures
// are the same iff they make the same difference to the ground — never by
// appearance. The name only raises a candidate; the evidence is whether the
// candidate's structured claims make the same difference the referent's
// profile parameters do. A namesake makes a different difference and is
// refused (identity_reading_refused); its Wikipedia/Commons material is never
// presented, because those sources are reached only through a bound QID.
//
//   node --test holodeck-links.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { buildFromTriples, triplesFromObservations } from "./holodeck-profile.js";
import { resolveReferent, profileGround, gate, nameRaise, norm } from "./holodeck-links.js";

const REFERENTS = fs.readFileSync(new URL("./fixtures/ohs-referents.eot.jsonl", import.meta.url), "utf8")
  .trim().split("\n").map((l) => JSON.parse(l));
const PROBES = JSON.parse(fs.readFileSync(new URL("./fixtures/wikidata-probes.json", import.meta.url), "utf8"));

const triples = triplesFromObservations(REFERENTS);
const beings = [...new Set(triples.map((t) => t.subject))];
const built = buildFromTriples(triples, { beings, exposureFloor: 2, draws: 99, alpha: 0.05, seed: 5 });

// captured search, keyed by the machine's own canonization
const searchMap = new Map();
for (const [k, v] of Object.entries(PROBES.search)) {
  if (v.status !== 200 || !v.results.length) continue;
  const q = k.split("::").slice(1).join("::");
  if (!searchMap.has(norm(q))) searchMap.set(norm(q), v.results);
}
const fakeSearch = async (name) => (searchMap.get(norm(name)) ?? [])
  .map((r) => ({ qid: r.id, label: r.label, description: r.description, aliases: r.aliases }));
const fakeEntity = async (qid) => PROBES.entities[qid] ?? null;
const fakeLabels = async (ids, { known }) => known;

const stubLinks = {
  wikipedia: async (title, o) => ({ title, extract: "stub" }),
  commonsImage: async (file, o) => ({ file }),
  commonsCategory: async (cat, o) => ({ category: cat }),
};

function resolve(id, { linkImpl = stubLinks } = {}) {
  return resolveReferent(built.byId.get(id), built, {
    searchImpl: fakeSearch, entityImpl: fakeEntity, labelsImpl: fakeLabels,
    knownLabels: PROBES.labels, linkImpl,
  });
}

// The two referents that ARE on Wikidata, and the exact QIDs the reading must bind to.
const BOUND_GROUND = {
  "freddie-oconnell": { qid: "Q121177357", support: ["council", "member", "mayor"] },
  "mdha": { qid: "Q115816365", support: ["housing", "agency"] },
};

// Every namesake trap that a naive name pull would get wrong, and the WRONG
// entity it must refuse to present.
const NAMESAKE_TRAPS = {
  "park-center": "Q87932555", // hospital in Fort Wayne IN — not the Nashville nonprofit
  "derrick-smith": "Q100924078", // college basketball player — not the OHS attorney
  "adam-rosenberg": "Q58319209", // researcher — not the Wallace Studios developer
  "the-avenue": "Q64590179", // painting — not the Nashville placement
  "rodeway-inn-ria-llc": "Q7356709", // the hotel CHAIN — not the specific RIA LLC property
  "rodeway-per-welsch-letter": "Q7356709", // the hotel CHAIN — not the 97 Wallace Rd property
  "kristin-wilson": "Q141207880", // Wellington researcher — not the Mayor's Office director
  "txn-wayfair-furniture-2024": "Q3540193", // the COMPANY — the referent is a purchase
  "txn-mnpd-skydio-drone-trial": "Q97321374", // the COMPANY — the referent is a trial
  "txn-metro-arts-withheld-funding": "Q6824486", // Brisbane theatre — the referent is withheld funding
};

const NOT_FOUND = [
  "wellsky", "people-loving-nashville", "nashville-launchpad", "ohs", "wallace-studios",
  "nathan-scarlett", "desawn-reed", "david-langgle-martin", "april-calvin", "monty-tavern",
  "hg-stovall", "jenneen-reed", "davie-tucker", "dahron-johnson", "jazzi-laster",
  "mistye-taylor", "kirsney-cunningham", "chuck-levesque", "stacy-horn-koch",
];

test("the two referents that ARE on Wikidata bind to the exact right QID", async () => {
  for (const [id, { qid, support }] of Object.entries(BOUND_GROUND)) {
    const r = await resolve(id);
    assert.equal(r.verdict, "bound", `${id}: expected bound`);
    assert.equal(r.identity.candidate, qid, `${id}: bound to the wrong entity`);
    for (const s of support) assert.ok(r.identity.supportRefs.includes(s), `${id}: missing corroboration ${s}`);
    assert.ok(r.links, `${id}: a bound referent must carry its sources`);
    assert.equal(r.links.qid, qid, `${id}: links not tied to the bound QID`);
  }
});

test("every namesake trap refuses its wrong entity and presents nothing", async () => {
  for (const [id, wrongQid] of Object.entries(NAMESAKE_TRAPS)) {
    const r = await resolve(id);
    assert.notEqual(r.verdict, "bound", `${id}: must not bind`);
    assert.equal(r.links, null, `${id}: namesake material was presented`);
    const wrong = r.candidates.find((c) => c.qid === wrongQid);
    assert.ok(wrong, `${id}: the wrong entity was not even considered`);
    assert.ok(wrong.attacks.length, `${id}: the wrong entity must be attacked, not merely unraised`);
    assert.equal(wrong.support.length, 0, `${id}: a namesake carries no corroboration`);
  }
});

test("referents with no Wikidata presence are honestly not-found, never fabricated", async () => {
  for (const id of NOT_FOUND) {
    const r = await resolve(id);
    assert.equal(r.verdict, "not-found", `${id}: expected not-found`);
    assert.equal(r.links, null, `${id}: nothing to present`);
    assert.equal(r.candidates.length, 0, `${id}: no candidate was raised`);
  }
});

test("THE INVARIANT — no referent in the workspace gets another thing's material", async () => {
  let checked = 0;
  for (const p of built.byId.values()) {
    const r = await resolve(p.id);
    if (r.verdict === "bound") {
      // even a bound reading is only a live hypothesis, never a settled fact
      assert.equal(r.identity.standing, "live_hypothesis");
      assert.ok(r.identity.supportRefs.length, `${p.id}: bound without corroboration`);
      assert.equal(r.identity.attackRefs.length, 0, `${p.id}: bound despite an attack`);
    } else {
      assert.equal(r.links, null, `${p.id}: non-bound verdict must present nothing`);
    }
    checked += 1;
  }
  assert.ok(checked >= 40, `workspace covered (${checked} referents)`);
});

test("Wikipedia and Commons are reached ONLY through a bound QID", async () => {
  const calls = [];
  const linkImpl = {
    wikipedia: async (title, o) => { calls.push(["wp", title]); return { title, extract: "x" }; },
    commonsImage: async (file, o) => { calls.push(["img", file]); return { file }; },
    commonsCategory: async (cat, o) => { calls.push(["cat", cat]); return { category: cat }; },
  };
  // a refused namesake must never reach the sources, even when it has a
  // Wikipedia article (Park Center hospital, Rodeway chain, Wayfair company)
  for (const id of Object.keys(NAMESAKE_TRAPS)) await resolve(id, { linkImpl });
  assert.equal(calls.length, 0, `sources were reached for a refused referent: ${JSON.stringify(calls)}`);

  const ok = await resolve("freddie-oconnell", { linkImpl });
  assert.ok(calls.length >= 3, "the bound referent reaches Wikipedia + Commons");
  for (const [, arg] of calls) {
    // the source is reached with the BOUND entity's own sitelink / P18 / P373
    assert.ok(arg === "Freddie O'Connell" || arg === "Freddie O'Connell (cropped).png" || arg === "Freddie O'Connell",
      `source reached with a foreign title: ${arg}`);
  }
  assert.equal(ok.links.wikipedia.tiedTo.qid, "Q121177357");
  assert.equal(ok.links.commonsImage.tiedTo.qid, "Q121177357");
  assert.equal(ok.links.commonsCategory.tiedTo.qid, "Q121177357");
});

test("the name alone never binds — a sole name-raised candidate with a different ground is refused", async () => {
  // Park Center: the only candidates share the name; every one makes a
  // different difference to the ground (hospital, CDP, school).
  const g = profileGround(built.byId.get("park-center"));
  for (const qid of ["Q87932555", "Q104880128", "Q7137663"]) {
    const e = PROBES.entities[qid];
    if (!e) continue;
    const cand = { ...e, kinds: [], positions: [], places: [] };
    const res = gate(g, cand);
    assert.ok(res.raised, `${qid} must be name-raised`);
    assert.ok(res.attacks.length, `${qid} must be attacked by its ground`);
    assert.equal(res.support.length, 0, `${qid} must carry no corroboration`);
  }
});

test("a use-surface names its pointer, not the entity", async () => {
  const g = profileGround(built.byId.get("txn-wayfair-furniture-2024"));
  assert.ok(g.hasDescriptor, "the purchase surface must raise the descriptor flag");
  // the company, raised through the stripped pointer, is refused
  const cand = { ...PROBES.entities["Q3540193"], kinds: [], positions: [], places: [] };
  const res = gate(g, cand);
  assert.ok(res.raised, "the company must be name-raised by the pointer");
  assert.ok(res.attacks.length, "the company must be refused as a use of the name");
  assert.equal(res.support.length, 0);
});

test("a missing label is absent evidence, never an attack", async () => {
  // If the P39 position labels ("council member", "mayor of Nashville") fail
  // to resolve, the corroboration is lost — but "American politician" CONTAINS
  // mayor/council, so the gate must go unverified, never namesake: a namesake
  // is a constitutive contradiction, and absent labels assert nothing.
  const g = profileGround(built.byId.get("freddie-oconnell"));
  const e = PROBES.entities["Q121177357"];
  const cand = { ...e, kinds: [], positions: [], places: [] };
  const res = gate(g, cand);
  assert.ok(res.raised);
  assert.equal(res.attacks.length, 0, "generic 'politician' must not attack");
  assert.equal(res.support.length, 0, "without the positions there is no corroboration");
});

test("THE ARROW OF TIME — a twin with the same life, one difference, a hundred years apart, is refused", () => {
  const g = profileGround(built.byId.get("freddie-oconnell"));
  assert.ok(g.witnessed, "the reading must carry when the referent was witnessed");
  assert.ok(g.rolePeriods.length >= 2, "the reading's role rels must carry tenure years");

  // the same life — same name, same offices, same labels — but born 1875,
  // died 1935, a hundred years before the reading witnessed the referent
  const twin = {
    ...PROBES.entities["Q121177357"],
    kinds: [{ id: "Q5", label: "human" }],
    positions: [{ id: "Q708492", label: "council member" }, { id: "Q98810690", label: "mayor of Nashville" }],
    places: [],
    born: Date.UTC(1875, 0, 1), died: Date.UTC(1935, 0, 1),
    positionTerms: [
      { id: "Q708492", label: "council member", start: Date.UTC(1915, 0, 1), end: Date.UTC(1923, 0, 1) },
      { id: "Q98810690", label: "mayor of Nashville", start: Date.UTC(1923, 0, 1), end: Date.UTC(1930, 0, 1) },
    ],
  };
  const res = gate(g, twin);
  assert.ok(res.raised, "the twin shares the name");
  assert.ok(res.attacks.length, "the twin must be refused — it is not the referent");
  const why = res.attacks.map((a) => a.why).join(" ");
  assert.match(why, /died in 1935/, "the refusal must name the arrow of time, not a kind mismatch");
  assert.match(why, /validity-window check first/, "Kelsen's step 1 must be the refusing step, never a silent pick");
  assert.equal(res.support.length, 0, "a refused candidate carries no corroboration");
});

test("DEPENDENCY ORDER — a candidate alive across the witness window but who held the offices in a different era is refused", () => {
  const g = profileGround(built.byId.get("freddie-oconnell"));
  // alive and contemporary — but council 1990-1995, never mayor: the offices
  // were held outside the referent's tenure years
  const wrongOrder = {
    ...PROBES.entities["Q121177357"],
    kinds: [{ id: "Q5", label: "human" }],
    positions: [{ id: "Q708492", label: "council member" }],
    places: [],
    born: Date.UTC(1965, 0, 1), died: null,
    positionTerms: [{ id: "Q708492", label: "council member", start: Date.UTC(1990, 0, 1), end: Date.UTC(1995, 0, 1) }],
  };
  const res = gate(g, wrongOrder);
  assert.ok(res.raised);
  assert.ok(res.attacks.length, "same era but different tenure must be refused");
  assert.match(res.attacks[0].why, /different era, different person/, "the refusal must name the dependency order");
});

test("a candidate born after the reading last witnessed the referent is refused", () => {
  const g = profileGround(built.byId.get("freddie-oconnell"));
  const unborn = {
    ...PROBES.entities["Q121177357"],
    kinds: [{ id: "Q5", label: "human" }],
    positions: [], places: [],
    born: Date.UTC(2030, 0, 1), died: null, positionTerms: [],
  };
  const res = gate(g, unborn);
  assert.ok(res.raised);
  assert.ok(res.attacks.length, "born after the witness is refused");
  assert.match(res.attacks[0].why, /arrow of time/, "the refusal must name the arrow of time");
});

test("the bound pair's own temporal claims are consistent with the witness", () => {
  // Freddie O'Connell: born 1970, council 2015-2023, mayor 2023→, witnessed
  // 2026 — every window overlaps; nothing temporal attacks. Same for MDHA
  // (no temporal claims at all — open windows never attack).
  for (const id of Object.keys(BOUND_GROUND)) {
    const g = profileGround(built.byId.get(id));
    const e = PROBES.entities[BOUND_GROUND[id].qid];
    const cand = { ...e, kinds: [], positions: [], places: [] };
    const res = gate(g, cand);
    const why = res.attacks.map((a) => a.why).join(" ");
    assert.ok(!/died in|born in|different era|arrow of time|validity-window/.test(why), `${id}: a temporal attack fired on the real entity: ${why}`);
  }
});

test("an OBJECT about the referent is refused even when its prose borrows the referent's kind", () => {
  // The "Anexo:Bibliografía de Gabriel García Márquez" list describes itself as
  // "listado con la bibliografía del escritor colombiano" — its prose carries
  // the writer's own kind, so bag-of-words binds the LIST to the writer. The
  // structure (P31 = anexo/bibliography) must refuse it.
  const profile = {
    id: "es:Gabriel García Márquez",
    parameters: [
      { rel: "also written", values: [{ value: "Gabriel García Márquez", count: 1 }], informationWeight: 0.77 },
      { rel: "type", values: [{ value: "escritor y periodista colombiano", count: 1 }], informationWeight: 4.0 },
    ],
  };
  const g = profileGround(profile);
  const bibliography = {
    qid: "Q6344145", label: "Anexo:Bibliografía de Gabriel García Márquez",
    description: "listado con la bibliografía del escritor colombiano",
    aliases: [], kinds: [{ id: "Q13406463", label: "anexo" }], positions: [], places: [],
    born: null, died: null, positionTerms: [],
  };
  const res = gate(g, bibliography);
  assert.ok(res.raised, "the bibliography shares the name");
  assert.ok(res.attacks.length, "the bibliography must be refused — it is not the writer");
  assert.match(res.attacks[0].why, /object about the referent/, "the refusal must name the structure, not the prose");
  assert.equal(res.support.length, 0, "borrowed kind words are not corroboration");
});

test("corroboration must be discriminating — one shared generic word never binds", () => {
  const g = profileGround(built.byId.get("park-center"));
  // a Kansas org sharing ONLY the word "services" with the Nashville nonprofit
  const kansas = {
    qid: "Q99999999", label: "Park Center Community Services",
    description: "community services organization in Kansas",
    aliases: [], kinds: [{ id: "Q43229", label: "organization" }], positions: [],
    places: [{ id: "Q1558", label: "Kansas" }], born: null, died: null, positionTerms: [],
  };
  const res = gate(g, kansas);
  assert.ok(res.raised);
  assert.equal(res.attacks.length, 0, "no constitutive contradiction");
  assert.equal(res.support.length, 0, "a single weak shared word is vocabulary, not evidence");
});

test("nameRaise scores the LABEL, never diluted by a rich alias list", () => {
  // Ciudad de México has ten aliases (Cd Méx, DF, D. F., …); a bare-label
  // disambiguation page has none. The real city is a perfect label match and
  // must rank at 1.0, never below the disambiguation page.
  const g = profileGround({
    id: "Ciudad de México",
    parameters: [{ rel: "also written", values: [{ value: "Ciudad de México", count: 1 }], informationWeight: 0.77 }],
  });
  const city = { qid: "Q1489", label: "Ciudad de México", aliases: ["Cd Méx", "DF", "D. F.", "México DF", "Ciudad de Méjico"] };
  const disambig = { qid: "Q53539010", label: "Ciudad de México", aliases: [] };
  const a = nameRaise(g, city);
  const b = nameRaise(g, disambig);
  assert.equal(a.jaccard, 1, "the rich-alias city must not be diluted");
  assert.equal(b.jaccard, 1);
  assert.ok(a.jaccard === b.jaccard, "equal label matches rank equal regardless of aliases");
});

test("a label match outranks an alias-only match", () => {
  // the real MDHA ground carries BOTH the "MDHA" pointer and the full name as
  // a pointer; a candidate is raised by whichever surface it shares — and a
  // candidate whose label IS the full name is a canonical match, not a weak
  // alias-only reach
  const g = profileGround({
    id: "mdha",
    parameters: [
      { rel: "also written", values: [{ value: "MDHA", count: 1 }], informationWeight: 0.77 },
      { rel: "full_name", values: [{ value: "Metropolitan Development and Housing Agency", count: 1 }], informationWeight: 4.0 },
    ],
  });
  assert.ok(g.pointers.includes("Metropolitan Development and Housing Agency"), "the full name is a pointer");
  const byLabel = { qid: "Q115816365", label: "Metropolitan Development and Housing Agency", aliases: [] };
  const res = nameRaise(g, byLabel);
  assert.ok(res && res.jaccard === 1, "the full-name candidate is a canonical label match");
});

test("canonization is the machine's own (identity.js:15)", () => {
  // the search is punctuation- and case-blind, so a surface and a label that
  // fold the same are the same pointer
  assert.equal(norm("Freddie O'Connell"), norm("Freddie O’Connell"));
  assert.equal(norm("MDHA"), norm("mdha"));
  assert.equal(norm("H.G. Stovall"), "h g stovall");
  assert.equal(norm("H.G. Stovall"), norm("h.g. stovall"));
});