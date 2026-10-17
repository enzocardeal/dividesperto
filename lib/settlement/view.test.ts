import assert from "node:assert/strict";
import { test } from "node:test";
import { BALANCE_VIEW_COOKIE, parseBalanceView } from "./view.ts";

test("the view cookie has a fixed name", () => {
  assert.equal(BALANCE_VIEW_COOKIE, "ds_balance_view");
});

test("parseBalanceView reads both views", () => {
  assert.equal(parseBalanceView("simplified"), "simplified");
  assert.equal(parseBalanceView("full"), "full");
});

test("parseBalanceView falls back to the simplified view", () => {
  for (const value of [undefined, null, "", "FULL", "completa", " full", 1]) {
    assert.equal(parseBalanceView(value), "simplified");
  }
});
