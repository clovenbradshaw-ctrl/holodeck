// falsify.links-lang.mjs — CROSS-LANGUAGE FALSIFICATION: the referent→links
// pull (holodeck-links.js) must hold in Spanish and Russian, not just English
// ("Confirming it in English is not confirming it, either"). Runs the real
// pull over the staged corpus-es/ and corpus-ru/ Wikipedia manifests (real
// articles, each carrying its Wikidata QID as ground truth) against the LIVE
// es/ru Wikidata APIs, and scores the binding:
//
//   bound + right QID → PASS
//   bound + wrong QID → FAIL (the cardinal sin: another thing's material)
//   unverified/ambiguous/not-found → SAFE (nothing presented), reported
//
// The gate is language-agnostic by construction — canonization is Unicode, the
// folds are token-set, the lexicons carry es/ru words — and the language of
// search, entity fetch and label resolution is threaded through so a candidate
// and its referent fold in the SAME language (an es "escritor" must meet an es
// "escritor", never an en "writer").
//
//   node falsify.links-lang.mjs            # full es+ru sweep, live
//   node falsify.links-lang.mjs --lang ru  # one language
//
// Politeness: one User-Agent, spaced and cached requests, 429 backoff with the
// limit disclosed — a rate-limited referent is reported, never a verdict.

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { resolveReferent } from "./holodeck-links.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UA = "the-fold/0.3 (falsify.links-lang.mjs cross-language referent falsification; local harness)";
const WIKIDATA = "https://www.wikidata.org/w/api.php";

const MANIFESTS = [
  { dir: "corpus-es", lang: "es", file: "Gabriel_García_Márquez", qid: "Q5878" },
  { dir: "corpus-es", lang: "es", file: "Madrid", qid: "Q2807" },
  { dir: "corpus-es", lang: "es", file: "Ciudad_de_México", qid: "Q1489" },
  { dir: "corpus-es", lang: "es", file: "Frida_Kahlo", qid: "Q5588" },
  { dir: "corpus-ru", lang: "ru", file: "Пушкин,_Александр_Сергеевич", qid: "Q7200" },
  { dir: "corpus-ru", lang: "ru", file: "Москва", qid: "Q649" },
  { dir: "corpus-ru", lang: "ru", file: "Путин,_Владимир_Владимирович", qid: "Q7747" },
];

// one rate-limit-respecting client per language (its own caches)
const clients = new Map();
function client(lang) {
  if (!clients.has(lang)) clients.set(lang, { cache: new Map(), labelCache: new Map(), last: 0, delay: 700 });
  return clients.get(lang);
}
async function getJSON(url, lang, tries = 4) {
  const c = client(lang);
  for (let a = 0; a < tries; a++) {
    const wait = Math.max(0, c.last + c.delay - Date.now());
    if (wait) await new Promise((s) => setTimeout(s, wait));
    c.last = Date.now();
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (r.status === 429) { c.gaveUp429 = true; await new Promise((s) => setTimeout(s, 4000 * (a + 1))); continue; }
    if (r.status >= 400) return null;
    return await r.json().catch(() => null);
  }
  return null;
}

const searchImpl = (lang) => async (name, o) => {
  const c = client(lang);
  const key = "s:" + name;
  if (c.cache.has(key)) return c.cache.get(key);
  const j = await getJSON(`${WIKIDATA}?action=wbsearchentities&search=${encodeURIComponent(name)}&language=${lang}&uselang=${lang}&format=json&limit=5&origin=*`, lang);
  const out = (j?.search ?? []).map((e) => ({ qid: e.id, label: e.label, description: e.description, aliases: e.aliases ?? [] }));
  c.cache.set(key, out);
  return out;
};
const entityImpl = (lang) => async (qid, o) => {
  const j = await getJSON(`${WIKIDATA}?action=wbgetentities&ids=${encodeURIComponent(qid)}&props=labels|descriptions|aliases|claims|sitelinks&format=json&languages=${lang}&origin=*`, lang);
  const e = j?.entities?.[qid];
  if (!e) return null;
  return {
    qid,
    label: e.labels?.[lang]?.value ?? null,
    description: e.descriptions?.[lang]?.value ?? null,
    aliases: e.aliases?.[lang]?.map((a) => a.value) ?? [],
    claims: (() => { const c = {}; for (const p of ["P31", "P131", "P39", "P18", "P373", "P856"]) c[p] = (e.claims?.[p] ?? []).map((x) => x.mainsnak?.datavalue?.value?.id ?? x.mainsnak?.datavalue?.value ?? null).filter((v) => v != null); return c; })(),
    enwiki: e.sitelinks?.enwiki?.title ?? null,
    positionTerms: [],
  };
};
const labelsImpl = (lang) => async (ids, { known = {} } = {}) => {
  const c = client(lang);
  const out = { ...known };
  const missing = ids.filter((id) => !out[id] && !c.labelCache.has(id));
  if (missing.length) {
    const j = await getJSON(`${WIKIDATA}?action=wbgetentities&ids=${encodeURIComponent(missing.join("|"))}&props=labels&format=json&languages=${lang}&origin=*`, lang);
    for (const [id, e] of Object.entries(j?.entities ?? {})) if (e?.labels?.[lang]?.value) c.labelCache.set(id, e.labels[lang].value);
  }
  for (const id of ids) if (c.labelCache.has(id)) out[id] = c.labelCache.get(id);
  return out;
};

function profileFrom(m) {
  return {
    id: m.title,
    parameters: [
      { rel: "also written", values: [{ value: m.title, count: 1 }], informationWeight: 0.77 },
      { rel: "type", values: [{ value: m.description ?? "", count: 1 }], informationWeight: 4.0 },
    ],
  };
}

async function main() {
  const langFilter = process.argv.includes("--lang") ? process.argv[process.argv.indexOf("--lang") + 1] : null;
  const rows = [];
  let boundWrong = 0, boundRight = 0, safe = 0;
  for (const m of MANIFESTS) {
    if (langFilter && m.lang !== langFilter) continue;
    const manifest = JSON.parse(fs.readFileSync(path.join(HERE, m.dir, m.file + ".json"), "utf8"));
    client(m.lang).gaveUp429 = false;
    const r = await resolveReferent(profileFrom(manifest), null, {
      language: m.lang, ua: UA,
      labelsImpl: labelsImpl(m.lang),
      linkImpl: { wikipedia: async () => null, commonsImage: async () => null, commonsCategory: async () => null },
      searchImpl: searchImpl(m.lang),
      entityImpl: entityImpl(m.lang),
    });
    const got = r.identity?.candidate ?? null;
    let mark, note;
    if (r.verdict === "bound" && got === m.qid) { mark = "PASS"; boundRight++; }
    else if (r.verdict === "bound") { mark = "FAIL"; boundWrong++; note = `BOUND THE WRONG ENTITY (${got}) — another thing's material would be presented`; }
    else { mark = "SAFE"; safe++; note = r.verdict + (r.identity?.candidate ? ` — live candidate ${r.identity.candidate}` : ""); }
    if (client(m.lang).gaveUp429 && r.verdict === "not-found") { mark = "429"; note = "rate-limited by Wikimedia — not a verdict; rerun when the limit clears"; }
    rows.push({ mark, lang: m.lang, title: m.title, got, truth: m.qid, support: (r.identity?.supportRefs ?? []).join(","), note });
  }

  console.log("mark".padEnd(6) + "lang".padEnd(5) + "referent".padEnd(30) + "got".padEnd(12) + "truth".padEnd(8) + "corroboration");
  console.log("-".repeat(100));
  for (const row of rows) {
    console.log(row.mark.padEnd(6) + row.lang.padEnd(5) + row.title.padEnd(30).slice(0, 30) + (row.got ?? "-").padEnd(12) + row.truth.padEnd(8) + row.support.padEnd(26) + (row.note ? "· " + row.note : ""));
  }
  console.log("\n" + "=".repeat(100));
  console.log(`bound-right=${boundRight}  bound-wrong=${boundWrong}  safe/none-presented=${safe}`);
  console.log(`the no-wrong-entity invariant across es/ru — ${boundWrong === 0 ? "HOLDS" : "VIOLATED"}`);
  const ok = boundWrong === 0;
  console.log(ok ? "PASS" : `FAIL — ${boundWrong} referent(s) would present another thing's material`);
  if (!ok) process.exitCode = 1;
}

main().catch((e) => { console.error(`fatal: ${e.message}`); process.exitCode = 1; });