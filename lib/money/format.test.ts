import assert from "node:assert/strict";
import { test } from "node:test";
import { formatBRL, formatDate, formatDateTime, todayInSaoPaulo } from "./format.ts";

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

test("formatDateTime renders a timestamp in São Paulo time", () => {
  assert.equal(formatDateTime("2026-10-16T14:32:10.123456+00:00"), "16/10/2026, 11:32");
  assert.equal(formatDateTime("2026-10-17T02:05:00Z"), "16/10/2026, 23:05");
  assert.throws(() => formatDateTime("ontem"), RangeError);
});

test("todayInSaoPaulo returns the calendar date in São Paulo", () => {
  assert.equal(todayInSaoPaulo(new Date("2026-10-17T02:59:00Z")), "2026-10-16");
  assert.equal(todayInSaoPaulo(new Date("2026-10-17T03:00:00Z")), "2026-10-17");
  assert.equal(todayInSaoPaulo(new Date("2026-01-05T12:00:00Z")), "2026-01-05");
});
