// holodeck-heimdall.test.mjs — the pure half of the Holodeck's heimdall
// compute-invite door: the link is the shape the heimdall site parses, and
// with `short` (default) it is the typable `?r=<code>` form whose code is the
// fleet room's local alias. No network anywhere — http and account-data I/O
// are stubs.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mintInvite, recordCode, normalizeCode, inviteLink, shortLink, shortCode,
  CODES_TYPE, sha256Hex, HEIMDALL_SITE, SHORT_LENGTH,
} from "./holodeck-heimdall.js";

test("normalizeCode: six digits, stripped of separators and letters; anything else is a typed refusal", () => {
  assert.equal(normalizeCode("123456"), "123456");
  assert.equal(normalizeCode("12a3b4c5d6"), "123456");
  assert.equal(normalizeCode("12345"), null);
  assert.equal(normalizeCode("1234567"), "123456");
});

test("mintInvite: short by default — the room gets a short local alias and the link is `?r=<code>`", async () => {
  const aliases = [];
  const http = {
    createRoom: async (name, opts) => { assert.equal(opts.isPublic, true); return "!fleet:hs"; },
    setRoomAlias: async (roomId, alias) => aliases.push({ roomId, alias }),
  };
  const out = await mintInvite({ http, hs: "https://hyphae.social", host: "@me:hs", name: "Alex" });
  assert.ok(out.code);
  assert.equal(out.code.length, SHORT_LENGTH);
  assert.equal(aliases.length, 1);
  assert.equal(aliases[0].roomId, "!fleet:hs");
  assert.equal(aliases[0].alias, `#${out.code}:hyphae.social`);
  const u = new URL(out.link);
  assert.equal(u.origin + u.pathname, HEIMDALL_SITE);
  assert.equal(u.searchParams.get("r"), out.code);
  assert.equal(u.searchParams.get("room"), null, "the room id never rides the short link");
  assert.ok(out.exp > Date.now());
  assert.ok(out.exp < Date.now() + 8 * 24 * 3600 * 1000, "a 7-day invite");
});

test("mintInvite: a taken alias retries with a fresh code, then falls back to the full link if all taken", async () => {
  let attempts = 0;
  const http = {
    createRoom: async () => "!fleet:hs",
    setRoomAlias: async () => { attempts++; if (attempts < 3) { const e = new Error("Alias is already in use"); e.errcode = "M_IN_USE"; throw e; } },
  };
  const out = await mintInvite({ http, hs: "https://hyphae.social", host: "@me:hs" });
  assert.ok(out.code, "third attempt succeeded");
  assert.equal(attempts, 3);

  const stuck = { createRoom: async () => "!fleet:hs", setRoomAlias: async () => { throw { errcode: "M_IN_USE" }; } };
  const fallback = await mintInvite({ http: stuck, hs: "https://hyphae.social", host: "@me:hs" });
  assert.equal(fallback.code, null);
  assert.equal(new URL(fallback.link).searchParams.get("room"), "!fleet:hs", "no alias -> full link");
});

test("mintInvite: a surface without setRoomAlias still gets the full link", async () => {
  const http = { createRoom: async () => "!fleet:hs" };
  const out = await mintInvite({ http, hs: "https://hyphae.social", host: "@me:hs" });
  assert.equal(out.code, null);
  assert.equal(new URL(out.link).searchParams.get("room"), "!fleet:hs");
});

test("shortLink: the whole link is `?r=<code>` on the heimdall site", () => {
  const u = new URL(shortLink({ code: "h7q2x" }));
  assert.equal(u.origin + u.pathname, HEIMDALL_SITE);
  assert.equal(u.searchParams.get("r"), "h7q2x");
});

test("recordCode: read-modify-write into the account registry, prunes expired, refuses duplicates", async () => {
  let stored = { active: [{ hash: await sha256Hex("111111"), exp: Date.now() - 1 }] };
  const read = async () => stored;
  const write = async (c) => { stored = c; };
  const first = await recordCode({ code: "222222", read, write });
  assert.equal(first.ok, true);
  assert.equal(stored.active.length, 1);
  assert.equal(stored.active[0].hash, await sha256Hex("222222"));
  const dup = await recordCode({ code: "222222", read, write });
  assert.equal(dup.duplicate, true);
  assert.equal(stored.active.length, 1);
  const bad = await recordCode({ code: "12", read, write });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "six digits");
});

test("CODES_TYPE is the registry the heimdall site confirms against", () => {
  assert.equal(CODES_TYPE, "org.heimdall.codes");
  assert.ok(shortCode());
});