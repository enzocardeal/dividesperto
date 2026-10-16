import assert from "node:assert/strict";
import { test } from "node:test";
import { backDelta } from "./back.ts";

const home = "https://dividesperto.vercel.app/";
const group = "https://dividesperto.vercel.app/groups/1";
const overall = "https://dividesperto.vercel.app/balances";

test("backDelta goes one entry back to the previous page", () => {
  assert.equal(backDelta([home, group, overall], 2), -1);
  assert.equal(backDelta([home, group, overall], 1), -1);
});

test("backDelta has no target on the first entry", () => {
  assert.equal(backDelta([overall], 0), null);
  assert.equal(backDelta([overall, group], 0), null);
});

test("backDelta skips entries of the same page", () => {
  assert.equal(backDelta([home, group, group], 2), -2);
  assert.equal(backDelta([home, group, `${group}#top`], 2), -2);
  assert.equal(backDelta([group, group], 1), null);
});

test("backDelta keeps a different query as a different page", () => {
  assert.equal(backDelta([`${home}?a=1`, home], 1), -1);
});

test("backDelta goes to an entry with a hidden URL", () => {
  assert.equal(backDelta([home, null, group], 2), -1);
  assert.equal(backDelta([home, group, null], 2), -1);
});
