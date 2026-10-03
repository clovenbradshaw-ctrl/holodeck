// falsify.identity-lang.mjs — THE IDENTITY RULE ON A DIFFERENT WORLD.
//
// The merge rule must hold on corpora that share nothing with the English
// biography it was built on: real Spanish and Russian Wikipedia articles (with
// their own naming conventions), a cased-script reader, scripts without case at
// all, and source code. Two properties are checked, and they are not the same
// property:
//
//   SAFETY (hard FAIL)  no two DISTINCT referents are ever folded into one
//                       identity — the cardinal sin, in any language or in code.
//   SCOPE  (reported)   what the ASCII→Unicode reader can and cannot reach;
//                       an unread script or a missed variant is a disclosed gap,
//                       never a silent guess, so it is printed, not failed.
//
//   node falsify.identity-lang.mjs     # needs `npm run serve` running on :8813
//
// Corpus paths are the repo's own corpus-es/ and corpus-ru/ (real articles).

import fs from "node:fs";
import { openSurface } from "./drive-holodeck.mjs";

const htmlDoc = (id, title, path) => ({ id, title, format: "html", html: fs.readFileSync(path, "utf8") });
const txtDoc = (id, title, text) => ({ id, title, format: "text", text });

const ES_REAL = htmlDoc("es0", "Gabriel García Márquez", "corpus-es/Gabriel_García_Márquez.html");
const RU_REAL = htmlDoc("ru0", "Пушкин, Александр Сергеевич", "corpus-ru/Пушкин,_Александр_Сергеевич.html");
const ES_SYNTH = txtDoc("d0", "Gabriel García Márquez",
  "Gabriel García Márquez escribió novelas. García Márquez escribió Cien años de soledad. La obra de García Márquez es famosa. Gabriel García Márquez ganó un premio.");
const ZH = txtDoc("zh", "孙中山", "孙中山（1866年11月12日—1925年3月12日），名文，字载之，号逸仙，是中国近代民主革命家。孙中山出生于广东省香山县。孙文后来被尊称为国父。");
const AR = txtDoc("ar", "نجيب محفوظ", "نجيب محفوظ كاتب مصري. وُلد نجيب محفوظ في القاهرة. حصل محفوظ على جائزة نوبل.");
const ZH_LINKED = { id: "zh2", title: "孙中山", format: "html",
  html: `<p><a href="https://zh.wikipedia.org/wiki/孙中山">孙中山</a>是中国近代民主革命家。<a href="https://zh.wikipedia.org/wiki/孙文">孙文</a>后来被尊称为国父。</p>` };
const CODE = [
  txtDoc("c0", "user-service.js", `import { createServer } from "node:http";
const Smith = { name: "John Smith", city: "New York" };
export class UserService { constructor(db) { this.db = db; } async find(id) { const born = await this.db.get(id); return born; } }
`),
  txtDoc("c1", "a.py", `# John Smith and Jane Smith both appear here; born() is unrelated.
class Parser:
    def __init__(self, Smith):
        self.Smith = Smith
`),
];

const membersOf = (names, label) => {
  const e = names.find((n) => n.name === label || (n.aliases || []).includes(label));
  return e ? { entry: e, set: new Set([e.name, ...(e.aliases || [])]) } : null;
};
const hasCyrillic = (s) => /[\u0400-\u04ff]/.test(s);

async function analyze(surf, docs) {
  const raw = await surf.page.evaluate((docs) => docs.map((d) => {
    try {
      const A = window.__holodeck.analyze({ docs: [d] });
      return { id: d.id, title: d.title, sts: A.sts.length, error: null,
        names: Object.values(A.names).map((n) => ({ name: n.name, type: n.type, aliases: n.aliases || [], sts: n.sts.length })) };
    } catch (e) { return { id: d.id, title: d.title, error: String((e && e.message) || e), names: [] }; }
  }), docs);
  raw.forEach((r) => r.names.sort((a, b) => b.sts - a.sts || a.name.localeCompare(b.name)));
  return raw;
}

async function main() {
  const surf = await openSurface({ headless: true });
  const fails = [];
  const scope = [];
  try {
    await surf.page.waitForFunction(() => window.__holodeck && window.__holodeck.analyze, null, { timeout: 20000 });
    await surf.page.waitForFunction(() => window.__holodeck.hdDeclReady && window.__holodeck.hdDeclReady(), null, { timeout: 20000 });
    await surf.page.waitForFunction(() => window.__holodeck.hdEngineReady && window.__holodeck.hdEngineReady(), null, { timeout: 20000 });

    // ── SAFETY: Spanish, real article — a shared surname must not chain people ──
    {
      const [es] = await analyze(surf, [ES_REAL]);
      if (es.error) fails.push("es0 threw: " + es.error);
      const garcia = membersOf(es.names, "Gabriel García Márquez") || membersOf(es.names, "García Márquez");
      const forbidden = ["Fidel Castro", "Colombia", "Macondo", "FARC", "Barranquilla"];
      const leaked = forbidden.filter((f) => garcia && garcia.set.has(f));
      console.log("es0 real: sts=" + es.sts + " names=" + es.names.length + "  biggest=[" + es.names.slice(0, 3).map((n) => n.name + ":" + n.sts).join(", ") + "]");
      console.log("    identity carrying García Márquez = " + (garcia ? garcia.entry.name + " [" + garcia.entry.aliases.join(", ") + "]" : "(none)"));
      if (leaked.length) fails.push("es0 OVER-MERGED distinct referents into García Márquez: " + leaked.join(", "));
      scope.push("es0: " + es.names.filter((n) => n.sts >= 2).length + " recurring surfaces read");
    }

    // ── SAFETY + SULLIVAN: Russian, real article — Пушкина (genitive) IS Пушкин;
    //    Дантес is a different person and must NOT be folded in ──
    {
      const [ru] = await analyze(surf, [RU_REAL]);
      if (ru.error) fails.push("ru0 threw: " + ru.error);
      const cyr = ru.names.filter((n) => hasCyrillic(n.name));
      const pushkin = membersOf(ru.names, "Пушкин");
      const pushkina = membersOf(ru.names, "Пушкина");
      const dantes = membersOf(ru.names, "Дантес");
      console.log("ru0 real: sts=" + ru.sts + " names=" + ru.names.length + " (Cyrillic " + cyr.length + ")  biggest=[" + ru.names.slice(0, 3).map((n) => n.name + ":" + n.sts).join(", ") + "]");
      if (!cyr.length) fails.push("ru0 read NO Cyrillic names — the Unicode reader is not reaching the script");
      if (!pushkin || !pushkina) fails.push("ru0: Пушкин or Пушкина is missing entirely");
      else if (pushkin.entry.name !== pushkina.entry.name) fails.push("ru0 did not fold Пушкина (genitive) into Пушкин — Sullivan's case fold did not fire");
      else if (pushkin.entry.name !== "Пушкин") fails.push("ru0 canonical is " + JSON.stringify(pushkin.entry.name) + ", not the base/nominative Пушкин");
      if (pushkin && dantes && pushkin.set.has("Дантес")) fails.push("ru0 OVER-MERGED Дантес (a different person) into Пушкин");
      scope.push("ru0: " + cyr.length + " Cyrillic surfaces read; Пушкина folded into Пушкин by the UniMorph declension rules (giver in the prior's provenance)");
    }

    // ── SAFETY: synthetic Spanish positive — the surname form folds to the full name ──
    {
      const [es] = await analyze(surf, [ES_SYNTH]);
      const g = membersOf(es.names, "Gabriel García Márquez");
      console.log("es synth: " + JSON.stringify(es.names.map((n) => n.name + (n.aliases.length ? "[" + n.aliases.join(",") + "]" : ""))));
      if (!g || !g.set.has("García Márquez")) fails.push("es synth did not fold «García Márquez» into «Gabriel García Márquez»");
      if (g && g.entry.name !== "Gabriel García Márquez") fails.push("es synth canonical is " + JSON.stringify(g.entry.name) + ", not the most descriptive");
    }

    // ── CHOMSKY: a caseless script names by its own marking — the source's links ──
    {
      const [zh] = await analyze(surf, [ZH_LINKED]);
      if (zh.error) fails.push("zh2 threw: " + zh.error);
      const names = zh.names.map((n) => n.name);
      console.log("zh linked: sts=" + zh.sts + " names=" + JSON.stringify(names.slice(0, 6)));
      if (!names.length) fails.push("zh2: a caseless script that MARKS its own names (links) read none — Chomsky's universal arrangement (a name is what the material marks) is not wired");
    }

    // ── SCOPE: scripts without case — reported, never guessed ──
    for (const d of [ZH, AR]) {
      const [r] = await analyze(surf, [d]);
      if (r.error) fails.push(d.id + " threw: " + r.error);
      const names = r.names.map((n) => n.name);
      console.log(d.id + " (cased reader): sts=" + r.sts + " names=" + names.length + (names.length ? "  " + JSON.stringify(names.slice(0, 5)) : "  — no case to open a name on; not read, disclosed"));
      scope.push(d.id + ": " + names.length + " names read (script has no case — the disclosed gap)");
    }

    // ── SAFETY: code — distinct identifiers must never merge, and one file's cast must
    //    never leak into another's (the engine's form-containment may fold a bare
    //    identifier into a quoted full name in the same file — disclosed, not a fail) ──
    {
      const cs = await analyze(surf, CODE);
      const perFile = new Map();
      for (const r of cs) {
        if (r.error) fails.push(r.id + " threw: " + r.error);
        perFile.set(r.id, r.names.map((n) => n.name));
        console.log(r.id + " code: sts=" + r.sts + " names=" + JSON.stringify(r.names.map((n) => n.name)));
      }
      const [c0, c1] = cs;
      const joined = (n) => new Set([n.name, ...(n.aliases || [])]);
      const anyAliases = (names) => names.filter((n) => n.aliases.length).map((n) => n.name + " -> " + n.aliases.join(", "));
      // 1. one file's identities must not appear in the other's cast
      const c1Names = new Set(c1.names.map((n) => n.name));
      for (const n of c0.names) if (c1Names.has(n.name)) fails.push("code OVER-MERGED across files: " + n.name);
      // 2. two DISTINCT code identifiers (both bare, CamelCase tokens) must not merge —
      //    a quoted full name ("John Smith") absorbing a bare identifier is the
      //    engine's disclosed containment, not two identifiers.
      const idLike = (s) => /^[A-Z][A-Za-z]+$/.test(s) && !s.includes(' ');
      for (const r of cs) for (const n of r.names) {
        if (!idLike(n.name)) continue;
        const al = (n.aliases || []).filter((a) => idLike(a) && a !== n.name);
        if (al.length) fails.push(r.id + " merged two distinct code identifiers: " + n.name + " absorbed " + al.join(", "));
      }
      scope.push("code: within-file form merges (identifier into a quoted full name) are the engine's containment, disclosed: " + (anyAliases(c0.names).join("; ") || "none") + (anyAliases(c1.names).join("; ") ? " · " + anyAliases(c1.names).join("; ") : ""));
    }

    console.log("");
    for (const s of scope) console.log("scope: " + s);
    console.log("");
    console.log(fails.length ? "VERDICT: FAIL\n  - " + fails.join("\n  - ") : "VERDICT: PASS (no distinct referents merged in any language or in code)");
    if (surf.consoleErrors.length) console.log("console errors:", JSON.stringify(surf.consoleErrors.slice(0, 4)));
    if (fails.length) process.exitCode = 1;
  } finally { await surf.close(); }
}

main();
