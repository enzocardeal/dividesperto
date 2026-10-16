import assert from "node:assert/strict";
import { test } from "node:test";
import { centsToBRLInput, editBRLInput, parsePastedBRL, pasteBRLInput } from "./input.ts";
import { parseBRL } from "./parse.ts";

function type(text: string, key: string): string {
  return editBRLInput(text, { value: `${text}${key}`, inputType: "insertText" });
}

function backspace(text: string): string {
  return editBRLInput(text, { value: text.slice(0, -1), inputType: "deleteContentBackward" });
}

test("editBRLInput fills the digits from the cents", () => {
  const shown: string[] = [];
  let text = "";
  for (const key of "123456") {
    text = type(text, key);
    shown.push(text);
  }
  assert.deepEqual(shown, ["0,01", "0,12", "1,23", "12,34", "123,45", "1.234,56"]);
});

test("editBRLInput removes the last digit on backspace until the field is empty", () => {
  const shown: string[] = [];
  let text = "1.234,56";
  while (text !== "") {
    text = backspace(text);
    shown.push(text);
  }
  assert.deepEqual(shown, ["123,45", "12,34", "1,23", "0,12", "0,01", ""]);
});

test("editBRLInput removes the last digit when backspace hits a separator", () => {
  const edit = { value: "1234,56", inputType: "deleteContentBackward" };
  assert.equal(editBRLInput("1.234,56", edit), "123,45");
});

test("editBRLInput empties a prefilled zero on backspace", () => {
  assert.equal(backspace("0,00"), "");
});

test("editBRLInput ignores leading zeros and keys that are not digits", () => {
  assert.equal(type("", "0"), "");
  assert.equal(type("0,01", "0"), "0,10");
  for (const key of [",", ".", "a", " "]) {
    assert.equal(type("12,34", key), "12,34", key);
  }
});

test("editBRLInput reads the whole value after a selection is replaced", () => {
  assert.equal(editBRLInput("1.234,56", { value: "5", inputType: "insertText" }), "0,05");
  assert.equal(editBRLInput("1.234,56", { value: "", inputType: "deleteContentBackward" }), "");
});

test("editBRLInput refuses a digit above the maximum", () => {
  const max = centsToBRLInput(Number.MAX_SAFE_INTEGER);
  assert.equal(type(max, "1"), max);
  let text = "";
  for (const key of String(Number.MAX_SAFE_INTEGER + 1)) {
    text = type(text, key);
  }
  assert.equal(parseBRL(text), Math.floor((Number.MAX_SAFE_INTEGER + 1) / 10));
});

test("parsePastedBRL reads comma, dot and currency formats", () => {
  const cases: [string, number | null][] = [
    ["12,34", 1234],
    ["12.34", 1234],
    ["R$ 1.234,56", 123456],
    ["R$ 1.234,56", 123456],
    ["1,234.56", 123456],
    ["1.234", 123400],
    ["50", 5000],
    ["12,5", 1250],
    [" 7 ", 700],
    ["0", 0],
    ["", null],
    ["abc", null],
    [",", null],
    ["99999999999999999", null],
  ];
  for (const [text, cents] of cases) {
    assert.equal(parsePastedBRL(text), cents, text);
  }
});

test("pasteBRLInput replaces the field and keeps it when the text is not an amount", () => {
  assert.equal(pasteBRLInput("9,99", "R$ 1.234,56"), "1.234,56");
  assert.equal(pasteBRLInput("", "12.34"), "12,34");
  assert.equal(pasteBRLInput("9,99", "abc"), "9,99");
  assert.equal(pasteBRLInput("9,99", "0"), "");
});

test("centsToBRLInput writes text that parseBRL reads back", () => {
  assert.equal(centsToBRLInput(0), "0,00");
  assert.equal(centsToBRLInput(5), "0,05");
  assert.equal(centsToBRLInput(123456), "1.234,56");
  assert.equal(centsToBRLInput(Number.MAX_SAFE_INTEGER), "90.071.992.547.409,91");
  for (let cents = 0; cents < 2_000_000_000; cents += 999_983) {
    assert.equal(parseBRL(centsToBRLInput(cents)), cents);
  }
  assert.throws(() => centsToBRLInput(-1), RangeError);
});
