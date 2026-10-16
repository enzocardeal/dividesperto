import assert from "node:assert/strict";
import { test } from "node:test";
import { formatBRL, formatDate } from "./format.ts";

test("formatBRL renders cents as pt-BR reais", () => {
  const cases: [number, string][] = [
    [0, "R$ 0,00"],
    [5, "R$ 0,05"],
    [1250, "R$ 12,50"],
    [123456, "R$ 1.234,56"],
    [99999999999, "R$ 999.999.999,99"],
    [-123456, "-R$ 1.234,56"],
  ];
  for (const [cents, text] of cases) {
    assert.equal(formatBRL(cents), text);
  }
});

test("formatBRL refuses non-integer cents", () => {
  assert.throws(() => formatBRL(1.5), RangeError);
  assert.throws(() => formatBRL(Number.NaN), RangeError);
});

test("formatDate renders a calendar date without a timezone shift", () => {
  assert.equal(formatDate("2026-10-16"), "16/10/2026");
  assert.equal(formatDate("2026-01-01"), "01/01/2026");
  assert.throws(() => formatDate("16/10/2026"), RangeError);
});
