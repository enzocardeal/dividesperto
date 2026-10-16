import assert from "node:assert/strict";
import { test } from "node:test";
import { centsToBRLInput, editBRLInput, formatBRLInput } from "./input.ts";
import { parseBRL } from "./parse.ts";

test("formatBRLInput groups thousands and keeps two decimals", () => {
  const cases: [string, string][] = [
    ["", ""],
    ["1234567", "1.234.567"],
    ["1234,567", "1.234,56"],
    [",", "0,"],
    [",5", "0,5"],
    ["007", "7"],
    ["00", "0"],
    ["abc", ""],
    ["1,2,3", "1,23"],
    ["R$ 1.234,56", "1.234,56"],
  ];
  for (const [raw, text] of cases) {
    assert.equal(formatBRLInput(raw).text, text, raw);
  }
});

test("formatBRLInput keeps the caret after the same digit", () => {
  assert.deepEqual(formatBRLInput("1.2345", 6), { text: "12.345", caret: 6 });
  assert.deepEqual(formatBRLInput("15.234", 2), { text: "15.234", caret: 2 });
  assert.deepEqual(formatBRLInput(",", 1), { text: "0,", caret: 2 });
  assert.deepEqual(formatBRLInput("05", 2), { text: "5", caret: 1 });
  assert.deepEqual(formatBRLInput("1,234", 5), { text: "1,23", caret: 4 });
});

test("editBRLInput turns a typed dot into the decimal comma", () => {
  const edit = { value: "12.", caret: 3, data: ".", inputType: "insertText" };
  assert.deepEqual(editBRLInput("12", edit), { text: "12,", caret: 3 });
});

test("editBRLInput ignores a typed dot after the comma", () => {
  const edit = { value: "12,5.", caret: 5, data: ".", inputType: "insertText" };
  assert.deepEqual(editBRLInput("12,5", edit), { text: "12,5", caret: 4 });
});

test("editBRLInput deletes the digit before a thousands dot on backspace", () => {
  const edit = { value: "1234", caret: 1, data: null, inputType: "deleteContentBackward" };
  assert.deepEqual(editBRLInput("1.234", edit), { text: "234", caret: 0 });
});

test("editBRLInput deletes a digit on backspace", () => {
  const edit = { value: "1.23", caret: 4, data: null, inputType: "deleteContentBackward" };
  assert.deepEqual(editBRLInput("1.234", edit), { text: "123", caret: 3 });
});

test("centsToBRLInput writes text that parseBRL reads back", () => {
  assert.equal(centsToBRLInput(0), "0,00");
  assert.equal(centsToBRLInput(5), "0,05");
  assert.equal(centsToBRLInput(123456), "1.234,56");
  for (let cents = 0; cents < 2_000_000_000; cents += 999_983) {
    assert.equal(parseBRL(centsToBRLInput(cents)), cents);
  }
  assert.throws(() => centsToBRLInput(-1), RangeError);
});
