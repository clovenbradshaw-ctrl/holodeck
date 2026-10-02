// falsify.links.mjs — THE LIVE PULL MUST NEVER GIVE INFO FOR THE WRONG PERSON
// OR THING. Runs the real referent→links pull (holodeck-links.js) over every
// profile in the OHS workspace against the LIVE Wikidata, Wikipedia and
// Wikimedia Commons APIs, and falsifies the binding against a ground-truth
// table:
//
//   bound     — the two referents that ARE on Wikidata must bind, and to the
//               EXACT right QID (Freddie O'Connell Q121177357, MDHA Q115816365),
//               with corroboration named and sources tied through that QID.
//   namesake  — every trap (Park Center hospital, the four Derrick Smiths,
//               the Rodeway Inn CHAIN, the Wayfair COMPANY, Skydio, Metro Arts
//               Theatre Brisbane, the Adam Rosenbergs, the Avenue paintings,
//               the Wellington Kristin Wilson) must be refused: never bound,
//               never presented.
//   honest    — referents with no Wikidata presence are not-found, never
//               fabricated against a partial name.
//
// The identity law is the whole gate: the name only raises a candidate; the
// evidence is whether the candidate's structured claims make the same
// difference the referent's profile parameters do. Wikipedia and Commons are
// reached only through a QID that survived the gate.
//
//   node falsify.links.mjs            # full workspace sweep, live
//   node falsify.links.mjs --ids mdha,park-center   # a subset (network-cheap)
//
// Politeness: a single User-Agent, batched entity/label pulls, and spaced,
// cached searches, so the sweep never hammers the Wikimedia APIs.

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { buildFromTriples, triplesFromObservations } from "./holodeck-profile.js";
import { resolveReferent, norm, searchWikidata, fetchEntity, wikidataTimeToMs } from "./holodeck-links.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UA = "the-fold/0.1 (falsify.links.mjs referent ground falsification; local harness)";

const WIKIDATA = "https://www.wikidata.org/w/api.php";
const LABEL_CACHE = new Map();

// A rate-limit-respecting client: one UA, spaced requests, 429 backoff,
// cached searches and entities.
class PoliteClient {
  constructor({ delay = 700 } = {}) { this.delay = delay; this.last = 0; this.searchCache = new Map(); this.entityCache = new Map(); }
  async get(url, tries = 3) {
    for (let a = 0; a < tries; a++) {
      const wait = Math.max(0, this.last + this.delay - Date.now());
      if (wait) await new Promise((s) => setTimeout(s, wait));
      this.last = Date.now();
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (r.status === 429) { this.gaveUp429 = true; await new Promise((s) => setTimeout(s, 3000 * (a + 1))); continue; }
      if (r.status >= 400) return null;
      return await r.json().catch(() => null);
    }
    return null;
  }
  async search(name) {
    const key = norm(name);
    if (this.searchCache.has(key)) return this.searchCache.get(key);
    const j = await this.get(`${WIKIDATA}?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&uselang=en&format=json&limit=5&origin=*`);
    const out = (j?.search ?? []).map((e) => ({ qid: e.id, label: e.label, description: e.description, aliases: e.aliases ?? [] }));
    this.searchCache.set(key, out);
    return out;
  }
  async entities(ids) {
    const missing = ids.filter((qid) => !this.entityCache.has(qid));
    if (missing.length) {
      const j = await this.get(`${WIKIDATA}?action=wbgetentities&ids=${encodeURIComponent(missing.join("|"))}&props=labels|descriptions|aliases|claims|sitelinks&format=json&languages=en&origin=*`);
      for (const [qid, raw] of Object.entries(j?.entities ?? {})) {
        const timeOf = (c) => c?.mainsnak?.datavalue?.value?.time ?? null;
        const born = timeOf(raw.claims?.P569?.[0]);
        const died = timeOf(raw.claims?.P570?.[0]);
        const positionTerms = (raw.claims?.P39 ?? []).map((c) => {
          const q = c?.qualifiers ?? {};
          const start = timeOf(q.P580?.[0]), end = timeOf(q.P582?.[0]);
          return { id: c?.mainsnak?.datavalue?.value?.id ?? null, start: wikidataTimeToMs(start), end: wikidataTimeToMs(end), startRaw: start ?? null, endRaw: end ?? null };
        }).filter((t) => t.id);
        this.entityCache.set(qid, {
          qid,
          label: raw.labels?.en?.value ?? null,
          description: raw.descriptions?.en?.value ?? null,
          aliases: raw.aliases?.en?.map((a) => a.value) ?? [],
          claims: (() => { const c = {}; for (const p of ["P31", "P131", "P39", "P18", "P373", "P856"]) c[p] = (raw.claims?.[p] ?? []).map((x) => x.mainsnak?.datavalue?.value?.id ?? x.mainsnak?.datavalue?.value ?? null).filter((v) => v != null); return c; })(),
          enwiki: raw.sitelinks?.enwiki?.title ?? null,
          born: born ? wikidataTimeToMs(born) : null,
          died: died ? wikidataTimeToMs(died) : null,
          bornRaw: born ?? null,
          diedRaw: died ?? null,
          positionTerms,
        });
      }
    }
    return ids.map((qid) => this.entityCache.get(qid) ?? null);
  }
}

async function labelsImpl(ids, { known = {} } = {}) {
  const out = { ...known };
  const missing = ids.filter((id) => !out[id] && !LABEL_CACHE.has(id));
  if (missing.length) {
    const j = await client.get(`${WIKIDATA}?action=wbgetentities&ids=${encodeURIComponent(missing.join("|"))}&props=labels&format=json&languages=en&origin=*`);
    for (const [id, e] of Object.entries(j?.entities ?? {})) if (e?.labels?.en?.value) LABEL_CACHE.set(id, e.labels.en.value);
  }
  for (const id of ids) if (LABEL_CACHE.has(id)) out[id] = LABEL_CACHE.get(id);
  return out;
}

const client = new PoliteClient();

// ── ground truth — what the reading MUST and MUST NOT do ────────────────────
const BOUND = {
  "freddie-oconnell": { qid: "Q121177357" },
  "mdha": { qid: "Q115816365" },
};
// the wrong entity a naive name pull would hand back; it must be refused
const NAMESAKE = {
  "park-center": ["Q87932555", "Q104880128", "Q7137663"],
  "derrick-smith": ["Q100924078", "Q5263102", "Q5263095", "Q5263097"],
  "adam-rosenberg": ["Q58319209", "Q29514454"],
  "the-avenue": ["Q896965", "Q64590179", "Q59340950"],
  "rodeway-inn-ria-llc": ["Q7356709", "Q111843506", "Q112025479", "Q111887482"],
  "rodeway-per-welsch-letter": ["Q7356709", "Q111843506", "Q112025479"],
  "kristin-wilson": ["Q141207880"],
  "txn-wayfair-furniture-2024": ["Q3540193", "Q26373557"],
  "txn-mnpd-skydio-drone-trial": ["Q97321374", "Q134696555", "Q135440787"],
  "txn-metro-arts-withheld-funding": ["Q6824486", "Q6824484"],
};
// referents the live probes have confirmed are absent from Wikidata; honesty
// is a verdict
const CONFIRMED_ABSENT = [
  "wellsky", "people-loving-nashville", "nashville-launchpad", "ohs",
  "wallace-studios", "nathan-scarlett", "desawn-reed", "david-langgle-martin",
  "april-calvin", "monty-tavern", "hg-stovall", "jenneen-reed", "davie-tucker",
];

function loadBuilt() {
  const lines = fs.readFileSync(path.join(HERE, "fixtures", "ohs-referents.eot.jsonl"), "utf8")
    .trim().split("\n").map((l) => JSON.parse(l));
  const triples = triplesFromObservations(lines);
  const beings = [...new Set(triples.map((t) => t.subject))];
  return buildFromTriples(triples, { beings, exposureFloor: 2, draws: 99, alpha: 0.05, seed: 5 });
}

function parseIds(argv) {
  const i = argv.indexOf("--ids");
  if (i < 0) return null;
  return argv[i + 1].split(",").map((s) => s.trim()).filter(Boolean);
}

async function main() {
  const subset = parseIds(process.argv.slice(2));
  const built = loadBuilt();
  const ids = subset ?? [...built.byId.keys()].sort();
  if (subset) console.log(`subset: ${ids.join(", ")}`);
  console.log(`resolving ${ids.length} referents against live Wikidata/Wikipedia/Commons…\n`);

  const rows = [];
  const failures = [];
  for (const id of ids) {
    const profile = built.byId.get(id);
    if (!profile) { console.log(`(unknown referent ${id})`); continue; }
    process.stderr.write(`  . ${id}\n`);
    client.gaveUp429 = false;
    let r;
    try {
      r = await resolveReferent(profile, built, {
        searchImpl: (s) => client.search(s),
        entityBatchImpl: (qs) => client.entities(qs),
        labelsImpl,
        ua: UA,
      });
    } catch (e) { console.log(`  ${id}: resolveReferent threw: ${e.message}`); failures.push(`${id}: threw`); continue; }

    const bound = BOUND[id];
    const trap = NAMESAKE[id];
    let ok = true; const notes = [];

    if (bound) {
      if (r.verdict !== "bound" || r.identity?.candidate !== bound.qid) { ok = false; notes.push(`expected bound ${bound.qid}`); }
      else {
        if (!r.identity.supportRefs.length) { ok = false; notes.push("bound without corroboration"); }
        if (!r.links) { ok = false; notes.push("bound with no links"); }
        else if (r.links.qid !== bound.qid) { ok = false; notes.push("links tied to a different QID"); }
      }
    } else if (trap) {
      if (r.verdict === "bound") { ok = false; notes.push(`BOUND (${r.identity.candidate}) — wrong info would be presented`); }
      if (r.links) { ok = false; notes.push("namesake material presented"); }
      const wrongAttacked = r.candidates.some((c) => trap.includes(c.qid) && c.attacks.length);
      if (!wrongAttacked) { ok = false; notes.push(`none of the known wrong entities was refused (${trap.join(",")})`); }
    } else if (CONFIRMED_ABSENT.includes(id)) {
      if (r.verdict === "bound") { ok = false; notes.push(`bound (${r.identity?.candidate}) despite confirmed absence`); }
      if (r.links) { ok = false; notes.push("material presented for an absent referent"); }
      if (r.verdict === "not-found") notes.push("honest");
      else notes.push(`verdict ${r.verdict} (no wrong info, acceptable)`);
    } else {
      // unasserted referent: the invariant still holds
      if (r.verdict === "bound") notes.push(`bound ${r.identity.candidate} — a genuine discovery, verified above`);
      if (r.verdict !== "bound" && r.links) { ok = false; notes.push("non-bound verdict presented material"); }
    }

    rows.push({ id, verdict: r.verdict, qid: r.identity?.candidate ?? (r.identity?.candidates ?? []).join("/") ?? "-", label: r.identity?.label ?? "", support: (r.identity?.supportRefs ?? []).join(","), links: r.links, ok, notes });
    if (client.gaveUp429 && r.verdict === "not-found") {
      ok = false; rows[rows.length - 1].ok = false;
      rows[rows.length - 1].notes.push("rate-limited by Wikimedia (HTTP 429) — not a verdict; rerun when the limit clears");
    }
    if (!ok) failures.push(id);
  }

  console.log("verdict".padEnd(10) + "referent".padEnd(34) + "qid/label".padEnd(44) + "corroboration".padEnd(26) + "ok");
  console.log("-".repeat(120));
  for (const row of rows) {
    console.log(row.verdict.padEnd(10) + row.id.padEnd(34) + (row.qid + " " + row.label).padEnd(44).slice(0, 44) + row.support.padEnd(26) + (row.ok ? "PASS" : "FAIL"));
    for (const n of row.notes) console.log("  · " + n);
  }

  console.log("\n" + "=".repeat(120));
  const boundCount = rows.filter((r) => r.verdict === "bound").length;
  const refusedCount = rows.filter((r) => r.verdict === "namesake").length;
  const notFound = rows.filter((r) => r.verdict === "not-found").length;
  const presented = rows.filter((r) => r.links).length;
  console.log(`bound=${boundCount}  namesake-refused=${refusedCount}  not-found=${notFound}  material-presented=${presented}`);
  console.log(`the no-wrong-entity invariant: every presented link is tied to a bound QID — ${presented === boundCount ? "HOLDS" : "VIOLATED"}`);

  const ok = failures.length === 0 && rows.every((r) => r.ok);
  console.log(ok ? "PASS" : `FAIL — ${failures.length} referent(s) made a mistake: ${failures.join(", ")}`);
  if (!ok) process.exitCode = 1;
}

main().catch((e) => { console.error(`fatal: ${e.message}`); process.exitCode = 1; });