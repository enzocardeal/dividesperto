import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { strings } from "../strings.ts";
import { buildSettleArgs, buildSettleLineArgs, settleErrorMessage } from "./settle.ts";

const group = "7a1c2e3f-4b5d-4e6f-8a9b-0c1d2e3f4a50";
const ana = "0b6f3a52-4d1e-4c55-9a51-0d8c1e1f0a01";
const bia = "5c2e7f10-8a3b-4f6d-b1c2-3e4f5a6b7c02";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    data.append(name, value);
  }
  return data;
}

const base = {
  groupId: group,
  fromId: bia,
  toId: ana,
  amountCents: "5000",
  expectedNetCents: "-7550",
};

test("buildSettleArgs builds the RPC arguments from the form", () => {
  assert.deepEqual(buildSettleArgs(form(base)), {
    p_group_id: group,
    p_from: bia,
    p_to: ana,
    p_amount_cents: 5000,
    p_expected_from_net_cents: -7550,
  });
  assert.equal(buildSettleArgs(form({ ...base, expectedNetCents: "0" }))?.p_expected_from_net_cents, 0);
});

test("buildSettleArgs refuses tampered fields", () => {
  const cases: Record<string, string>[] = [
    { ...base, groupId: "x" },
    { ...base, fromId: "" },
    { ...base, toId: bia },
    { ...base, amountCents: "0" },
    { ...base, amountCents: "-5" },
    { ...base, amountCents: "50,00" },
    { ...base, amountCents: "1e3" },
    { ...base, amountCents: "99999999999999999999" },
    { ...base, expectedNetCents: "" },
    { ...base, expectedNetCents: "-1.5" },
  ];
  for (const fields of cases) {
    assert.equal(buildSettleArgs(form(fields)), null, JSON.stringify(fields));
  }
});

const line = {
  groupId: group,
  fromId: bia,
  toId: ana,
  amountCents: "5000",
  expectedVersion: "42",
  view: "full",
};

test("buildSettleLineArgs builds the settle_line arguments from the form", () => {
  assert.deepEqual(buildSettleLineArgs(form(line)), {
    p_group_id: group,
    p_from: bia,
    p_to: ana,
    p_amount_cents: 5000,
    p_expected_version: 42,
    p_view: "full",
  });
  assert.equal(buildSettleLineArgs(form({ ...line, expectedVersion: "0" }))?.p_expected_version, 0);
  assert.equal(buildSettleLineArgs(form({ ...line, view: "simplified" }))?.p_view, "simplified");
});

test("buildSettleLineArgs refuses tampered fields", () => {
  const cases: Record<string, string>[] = [
    { ...line, groupId: "x" },
    { ...line, fromId: "" },
    { ...line, toId: bia },
    { ...line, amountCents: "0" },
    { ...line, amountCents: "-5" },
    { ...line, amountCents: "50,00" },
    { ...line, amountCents: "99999999999999999999" },
    { ...line, expectedVersion: "" },
    { ...line, expectedVersion: "-1" },
    { ...line, expectedVersion: "4.2" },
    { ...line, view: "" },
    { ...line, view: "other" },
    { ...line, view: "Full" },
  ];
  for (const fields of cases) {
    assert.equal(buildSettleLineArgs(form(fields)), null, JSON.stringify(fields));
  }
  const withoutView = form(line);
  withoutView.delete("view");
  assert.equal(buildSettleLineArgs(withoutView), null);
});

test("settleErrorMessage maps known SQLSTATEs and falls back to the generic text", () => {
  assert.equal(settleErrorMessage("42501"), strings.errors.notMember);
  assert.equal(settleErrorMessage("DS002"), strings.errors.archived);
  assert.equal(settleErrorMessage("DS007"), strings.errors.invalidPayment);
  assert.equal(settleErrorMessage("DS009"), "Os saldos mudaram. Atualize a página.");
  assert.equal(settleErrorMessage("22P02"), strings.errors.generic);
  assert.equal(settleErrorMessage(undefined), strings.errors.generic);
});

for (const migration of ["0006_settle_transfer.sql", "0007_balance_views.sql"]) {
  test(`${migration} raises every SQLSTATE that settleErrorMessage maps`, () => {
    const sql = readFileSync(new URL(`../../supabase/migrations/${migration}`, import.meta.url), "utf8");
    const raised = new Set([...sql.matchAll(/errcode = '([0-9A-Z]{5})'/g)].map((match) => match[1]));
    assert.deepEqual([...raised].sort(), ["42501", "DS002", "DS007", "DS009"]);
    for (const code of raised) {
      assert.notEqual(settleErrorMessage(code), strings.errors.generic);
    }
  });
}
