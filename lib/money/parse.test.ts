import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBRL } from "./parse.ts";

test("parseBRL reads comma decimals and dot thousands", () => {
  const cases: [string, number][] = [
    ["12", 1200],
    ["12,5", 1250],
    ["12,50", 1250],
    ["1234,56", 123456],
    ["1.234,56", 123456],
    ["1.234", 123400],
    ["1.234.567,89", 123456789],
    ["0,01", 1],
    ["0", 0],
    [" 12,50 ", 1250],
  ];
  for (const [input, cents] of cases) {
    assert.equal(parseBRL(input), cents, input);
  }
});

test("parseBRL rejects malformed, negative and oversized input", () => {
  const cases = [
    "",
    "12,345",
    "abc",
    "12a",
    "R$ 12",
    "-12",
    "-12,50",
    "+12",
    "12.5",
    "12.50",
    "12,",
    ",50",
    "1.23,45",
    "1,234.56",
    "1e3",
    "12 50",
    "99999999999999999",
  ];
  for (const input of cases) {
    assert.equal(parseBRL(input), null, input);
  }
});
