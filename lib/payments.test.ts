import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildPaymentPayload, paymentErrorMessage } from "./payments.ts";
import { strings } from "./strings.ts";

const group = "7a1c2e3f-4b5d-4e6f-8a9b-0c1d2e3f4a50";
const payment = "3d4e5f60-7a8b-4c9d-8e0f-1a2b3c4d5e6f";
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
  amount: "1.250,50",
  date: "2026-10-16",
  note: "  Pix  ",
};

test("buildPaymentPayload builds the RPC payload from the form", () => {
  assert.deepEqual(buildPaymentPayload(form(base)), {
    payload: {
      id: null,
      group_id: group,
      from_user_id: bia,
      to_user_id: ana,
      amount_cents: 125050,
      paid_on: "2026-10-16",
      note: "Pix",
    },
    error: null,
  });
});

test("buildPaymentPayload keeps the payment id and turns a blank note into null", () => {
  const result = buildPaymentPayload(form({ ...base, paymentId: payment, note: "   " }));
  assert.equal(result.payload?.id, payment);
  assert.equal(result.payload?.note, null);
});

test("buildPaymentPayload refuses invalid fields with a pt-BR message", () => {
  const cases: [Record<string, string>, string][] = [
    [{ ...base, groupId: "x" }, strings.errors.generic],
    [{ ...base, paymentId: "x" }, strings.errors.generic],
    [{ ...base, fromId: "" }, strings.paymentForm.chooseFrom],
    [{ ...base, toId: "" }, strings.paymentForm.chooseTo],
    [{ ...base, toId: bia }, strings.paymentForm.samePerson],
    [{ ...base, amount: "0" }, strings.paymentForm.invalidAmount],
    [{ ...base, amount: "-5" }, strings.paymentForm.invalidAmount],
    [{ ...base, date: "2026-02-30" }, strings.paymentForm.invalidDate],
    [{ ...base, note: "x".repeat(121) }, strings.paymentForm.invalidNote],
  ];
  for (const [fields, error] of cases) {
    assert.deepEqual(buildPaymentPayload(form(fields)), { payload: null, error });
  }
  assert.equal(buildPaymentPayload(form({ ...base, note: "😀".repeat(120) })).error, null);
});

test("paymentErrorMessage maps known SQLSTATEs and falls back to the generic text", () => {
  assert.equal(paymentErrorMessage("42501"), strings.errors.notMember);
  assert.equal(paymentErrorMessage("DS002"), strings.errors.archived);
  assert.equal(paymentErrorMessage("DS007"), strings.errors.invalidPayment);
  assert.equal(paymentErrorMessage("DS008"), strings.errors.paymentNotFound);
  assert.equal(paymentErrorMessage("22P02"), strings.errors.generic);
  assert.equal(paymentErrorMessage(undefined), strings.errors.generic);
});

test("the payments migration raises every SQLSTATE that paymentErrorMessage maps", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0005_payments_balances.sql", import.meta.url), "utf8");
  const raised = new Set([...sql.matchAll(/errcode = '([0-9A-Z]{5})'/g)].map((match) => match[1]));
  assert.deepEqual([...raised].sort(), ["42501", "DS002", "DS007", "DS008"]);
  for (const code of raised) {
    assert.notEqual(paymentErrorMessage(code), strings.errors.generic);
  }
});
