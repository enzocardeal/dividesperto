import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildExpensePayload,
  computeItemSplits,
  computeSplits,
  expenseErrorMessage,
  formatPercent,
  isISODate,
  parseDescription,
  parsePercent,
  parseShares,
  parseSplitValue,
  splitMethodLabel,
  splitValueText,
  type Split,
} from "./expenses.ts";
import { formatBRL } from "./money/format.ts";
import { strings } from "./strings.ts";

const group = "7a1c2e3f-4b5d-4e6f-8a9b-0c1d2e3f4a50";
const expense = "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a";
const ana = "0b6f3a52-4d1e-4c55-9a51-0d8c1e1f0a01";
const bia = "5c2e7f10-8a3b-4f6d-b1c2-3e4f5a6b7c02";
const caio = "e1d2c3b4-a596-4877-8695-a4b3c2d1e003";

function amounts(splits: Split[] | null): Record<string, number> {
  return Object.fromEntries((splits ?? []).map((split) => [split.userId, split.amountCents]));
}

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      data.append(name, item);
    }
  }
  return data;
}

const base = {
  groupId: group,
  description: "  Jantar  ",
  amount: "100,00",
  date: "2026-10-16",
  payerId: ana,
  category: "food",
  method: "equal",
  participantIds: [caio, bia, ana],
};

test("an equal split of R$ 100,00 among three people gives 33,34 / 33,33 / 33,33", () => {
  const result = computeSplits("equal", 10000, [caio, bia, ana], new Map());
  assert.equal(result.error, null);
  assert.deepEqual(amounts(result.splits), { [ana]: 3334, [bia]: 3333, [caio]: 3333 });
  assert.ok(result.splits?.every((split) => split.weight === null));
});

test("an exact split must match the total", () => {
  const values = new Map([
    [ana, 6000],
    [bia, 4000],
  ]);
  assert.deepEqual(amounts(computeSplits("exact", 10000, [ana, bia], values).splits), { [ana]: 6000, [bia]: 4000 });

  const short = computeSplits("exact", 10000, [ana, bia], new Map([[ana, 6000]]));
  assert.equal(short.error, `${strings.expenseForm.exactMissing} ${formatBRL(4000)}.`);

  const over = computeSplits("exact", 10000, [ana, bia], new Map([[ana, 6000], [bia, 4001]]));
  assert.equal(over.error, `${strings.expenseForm.exactOver} ${formatBRL(1)}.`);
});

test("a percent split needs positive weights that sum to 100%", () => {
  const result = computeSplits("percent", 999, [ana, bia, caio], new Map([[ana, 2500], [bia, 2500], [caio, 5000]]));
  assert.deepEqual(amounts(result.splits), { [ana]: 250, [bia]: 250, [caio]: 499 });
  assert.deepEqual(result.splits?.map((split) => split.weight), [2500, 2500, 5000]);

  const missing = computeSplits("percent", 999, [ana, bia], new Map([[ana, 10000]]));
  assert.equal(missing.error, strings.expenseForm.percentPositive);

  const short = computeSplits("percent", 999, [ana, bia], new Map([[ana, 5000], [bia, 3333]]));
  assert.equal(short.error, `${strings.expenseForm.percentSum} 83,33%. ${strings.expenseForm.percentTotal}`);
});

test("a shares split follows the share counts and refuses zero shares", () => {
  const result = computeSplits("shares", 1000, [ana, bia], new Map([[ana, 1], [bia, 2]]));
  assert.deepEqual(amounts(result.splits), { [ana]: 333, [bia]: 667 });
  assert.deepEqual(result.splits?.map((split) => split.weight), [1, 2]);

  const zero = computeSplits("shares", 1000, [ana, bia], new Map([[ana, 1], [bia, 0]]));
  assert.equal(zero.error, strings.expenseForm.sharesPositive);
});

test("computeSplits refuses an empty participant list and a non-positive amount", () => {
  assert.equal(computeSplits("equal", 1000, [], new Map()).error, strings.expenseForm.chooseParticipants);
  assert.equal(computeSplits("equal", 0, [ana], new Map()).error, strings.expenseForm.invalidAmount);
});

test("every computed split sums to the total", () => {
  const ids = [ana, bia, caio];
  for (let amount = 1; amount <= 2000; amount += 7) {
    for (const [method, values] of [
      ["equal", new Map<string, number>()],
      ["shares", new Map([[ana, 3], [bia, 1], [caio, 2]])],
      ["percent", new Map([[ana, 3333], [bia, 3333], [caio, 3334]])],
    ] as const) {
      const result = computeSplits(method, amount, ids, values);
      const sum = (result.splits ?? []).reduce((total, split) => total + split.amountCents, 0);
      assert.equal(sum, amount, `${method} ${amount}`);
    }
  }
});

test("items 60 (Ana, Bia) and 40 (Bia) with a total of 110 give Ana 33,00 and Bia 77,00", () => {
  const result = computeItemSplits(11000, [
    { amountCents: 6000, participantIds: [ana, bia] },
    { amountCents: 4000, participantIds: [bia] },
  ]);
  assert.equal(result.error, null);
  assert.deepEqual(result.splits, [
    { userId: ana, amountCents: 3300, weight: null },
    { userId: bia, amountCents: 7700, weight: null },
  ]);
});

test("items above the total act as a proportional discount", () => {
  const result = computeItemSplits(9000, [
    { amountCents: 6000, participantIds: [ana, bia] },
    { amountCents: 4000, participantIds: [bia] },
  ]);
  assert.deepEqual(amounts(result.splits), { [ana]: 2700, [bia]: 6300 });
});

test("computeItemSplits refuses a missing item, amount or participant with a pt-BR message", () => {
  const item = { amountCents: 1000, participantIds: [ana] };
  assert.equal(computeItemSplits(1000, []).error, strings.expenseForm.addItemFirst);
  assert.equal(computeItemSplits(0, [item]).error, strings.expenseForm.invalidAmount);
  assert.equal(computeItemSplits(1000, [item, { ...item, amountCents: null }]).error, strings.expenseForm.itemAmountPositive);
  assert.equal(computeItemSplits(1000, [{ ...item, amountCents: 0 }]).error, strings.expenseForm.itemAmountPositive);
  assert.equal(computeItemSplits(1000, [{ ...item, participantIds: [] }]).error, strings.expenseForm.chooseItemParticipants);
});

test("parsePercent reads up to two decimals and caps at 100%", () => {
  assert.equal(parsePercent("50"), 5000);
  assert.equal(parsePercent("33,33"), 3333);
  assert.equal(parsePercent("12,5"), 1250);
  assert.equal(parsePercent("12.5"), 1250);
  assert.equal(parsePercent("100"), 10000);
  assert.equal(parsePercent("0"), 0);
  assert.equal(parsePercent("100,01"), null);
  assert.equal(parsePercent("1,234"), null);
  assert.equal(parsePercent(""), null);
  assert.equal(parsePercent("-5"), null);
});

test("formatPercent writes basis points with a decimal comma", () => {
  assert.equal(formatPercent(5000), "50");
  assert.equal(formatPercent(3333), "33,33");
  assert.equal(formatPercent(1250), "12,50");
  assert.equal(formatPercent(5), "0,05");
});

test("parseShares accepts whole numbers only", () => {
  assert.equal(parseShares("2"), 2);
  assert.equal(parseShares(" 10 "), 10);
  assert.equal(parseShares("0"), 0);
  assert.equal(parseShares("1,5"), null);
  assert.equal(parseShares(""), null);
  assert.equal(parseShares("abc"), null);
});

test("parseSplitValue and splitValueText round-trip each method", () => {
  const split = (weight: number | null): Split => ({ userId: ana, amountCents: 123456, weight });
  assert.equal(parseSplitValue("exact", splitValueText("exact", split(null))), 123456);
  assert.equal(parseSplitValue("percent", splitValueText("percent", split(3333))), 3333);
  assert.equal(parseSplitValue("shares", splitValueText("shares", split(3))), 3);
  assert.equal(parseSplitValue("equal", "5"), null);
  assert.equal(splitValueText("equal", split(null)), "");
});

test("parseDescription trims and accepts 1 to 120 characters", () => {
  assert.equal(parseDescription("  Jantar "), "Jantar");
  assert.equal(parseDescription("x".repeat(120)), "x".repeat(120));
  assert.equal(parseDescription("x".repeat(121)), null);
  assert.equal(parseDescription("x".repeat(80), 80), "x".repeat(80));
  assert.equal(parseDescription("x".repeat(81), 80), null);
  assert.equal(parseDescription("  "), null);
  assert.equal(parseDescription(null), null);
});

test("isISODate accepts real calendar dates only", () => {
  assert.equal(isISODate("2026-10-16"), true);
  assert.equal(isISODate("2028-02-29"), true);
  assert.equal(isISODate("2026-02-30"), false);
  assert.equal(isISODate("16/10/2026"), false);
  assert.equal(isISODate(undefined), false);
});

test("buildExpensePayload builds the RPC payload from the form", () => {
  const result = buildExpensePayload(form(base));
  assert.equal(result.error, null);
  assert.deepEqual(result.payload, {
    id: null,
    group_id: group,
    description: "Jantar",
    amount_cents: 10000,
    expense_date: "2026-10-16",
    payer_id: ana,
    split_method: "equal",
    category: "food",
    splits: [
      { user_id: caio, amount_cents: 3333, weight: null },
      { user_id: bia, amount_cents: 3333, weight: null },
      { user_id: ana, amount_cents: 3334, weight: null },
    ],
    items: [],
  });
});

test("buildExpensePayload reads per-person values for the chosen method", () => {
  const result = buildExpensePayload(
    form({
      ...base,
      expenseId: expense,
      category: "",
      method: "percent",
      participantIds: [ana, bia],
      [`value:${ana}`]: "60",
      [`value:${bia}`]: "40",
    }),
  );
  assert.equal(result.payload?.id, expense);
  assert.equal(result.payload?.category, null);
  assert.deepEqual(result.payload?.splits, [
    { user_id: ana, amount_cents: 6000, weight: 6000 },
    { user_id: bia, amount_cents: 4000, weight: 4000 },
  ]);
});

test("buildExpensePayload refuses invalid fields with a pt-BR message", () => {
  const cases: [Record<string, string | string[]>, string][] = [
    [{ ...base, description: " " }, strings.expenseForm.invalidDescription],
    [{ ...base, amount: "0" }, strings.expenseForm.invalidAmount],
    [{ ...base, amount: "abc" }, strings.expenseForm.invalidAmount],
    [{ ...base, date: "2026-02-30" }, strings.expenseForm.invalidDate],
    [{ ...base, payerId: "" }, strings.expenseForm.choosePayer],
    [{ ...base, participantIds: [] }, strings.expenseForm.chooseParticipants],
    [{ ...base, method: "items" }, strings.expenseForm.addItemFirst],
    [{ ...base, method: "split" }, strings.errors.generic],
    [{ ...base, category: "travel" }, strings.errors.generic],
    [{ ...base, groupId: "x" }, strings.errors.generic],
    [{ ...base, participantIds: [ana, ana] }, strings.errors.generic],
    [{ ...base, method: "exact", [`value:${ana}`]: "50,00" }, `${strings.expenseForm.exactMissing} ${formatBRL(5000)}.`],
  ];
  for (const [fields, error] of cases) {
    assert.deepEqual(buildExpensePayload(form(fields)), { payload: null, error });
  }
});

const itemized = {
  ...base,
  amount: "110,00",
  method: "items",
  itemKeys: ["0", "3"],
  "item:0:description": "Pizza",
  "item:0:amount": "60,00",
  "item:0:participantIds": [ana, bia],
  "item:3:description": "  Vinho ",
  "item:3:amount": "40,00",
  "item:3:participantIds": [bia],
};

test("buildExpensePayload builds items and their splits and ignores the top-level participants", () => {
  const result = buildExpensePayload(form(itemized));
  assert.equal(result.error, null);
  assert.equal(result.payload?.split_method, "items");
  assert.equal(result.payload?.amount_cents, 11000);
  assert.deepEqual(result.payload?.splits, [
    { user_id: ana, amount_cents: 3300, weight: null },
    { user_id: bia, amount_cents: 7700, weight: null },
  ]);
  assert.deepEqual(result.payload?.items, [
    { description: "Pizza", amount_cents: 6000, participant_ids: [ana, bia] },
    { description: "Vinho", amount_cents: 4000, participant_ids: [bia] },
  ]);
});

test("buildExpensePayload sends no items for the other methods", () => {
  const result = buildExpensePayload(form({ ...itemized, method: "equal", participantIds: [ana, bia] }));
  assert.deepEqual(result.payload?.items, []);
  assert.deepEqual(result.payload?.splits, [
    { user_id: ana, amount_cents: 5500, weight: null },
    { user_id: bia, amount_cents: 5500, weight: null },
  ]);
});

test("buildExpensePayload refuses invalid items", () => {
  const cases: [Record<string, string | string[]>, string][] = [
    [{ ...itemized, itemKeys: [] }, strings.expenseForm.addItemFirst],
    [{ ...itemized, itemKeys: ["0", "x"] }, strings.errors.generic],
    [{ ...itemized, itemKeys: ["0", "0"] }, strings.errors.generic],
    [{ ...itemized, "item:3:participantIds": [bia, bia] }, strings.errors.generic],
    [{ ...itemized, "item:3:participantIds": ["x"] }, strings.errors.generic],
    [{ ...itemized, "item:3:description": " " }, strings.expenseForm.invalidItemDescription],
    [{ ...itemized, "item:3:description": "x".repeat(81) }, strings.expenseForm.invalidItemDescription],
    [{ ...itemized, "item:3:amount": "0" }, strings.expenseForm.itemAmountPositive],
    [{ ...itemized, "item:3:amount": "" }, strings.expenseForm.itemAmountPositive],
    [{ ...itemized, "item:3:participantIds": [] }, strings.expenseForm.chooseItemParticipants],
  ];
  for (const [fields, error] of cases) {
    assert.deepEqual(buildExpensePayload(form(fields)), { payload: null, error }, JSON.stringify(fields));
  }
});

test("splitMethodLabel names every method and nothing else", () => {
  assert.equal(splitMethodLabel("equal"), strings.splitMethods.equal);
  assert.equal(splitMethodLabel("items"), strings.splitMethods.items);
  assert.equal(splitMethodLabel("toString"), null);
  assert.equal(splitMethodLabel(null), null);
});

test("expenseErrorMessage maps known SQLSTATEs and falls back to the generic text", () => {
  assert.equal(expenseErrorMessage("42501"), strings.errors.notMember);
  assert.equal(expenseErrorMessage("DS002"), strings.errors.archived);
  assert.equal(expenseErrorMessage("DS005"), strings.errors.invalidExpense);
  assert.equal(expenseErrorMessage("DS006"), strings.errors.expenseNotFound);
  assert.equal(expenseErrorMessage("22P02"), strings.errors.generic);
  assert.equal(expenseErrorMessage(undefined), strings.errors.generic);
});

test("the expenses migration raises every SQLSTATE that expenseErrorMessage maps", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0004_expenses.sql", import.meta.url), "utf8");
  const raised = new Set([...sql.matchAll(/errcode = '([0-9A-Z]{5})'/g)].map((match) => match[1]));
  assert.deepEqual([...raised].sort(), ["42501", "DS002", "DS005", "DS006"]);
  for (const code of raised) {
    assert.notEqual(expenseErrorMessage(code), strings.errors.generic);
  }
});
