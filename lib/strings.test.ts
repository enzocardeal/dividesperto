import assert from "node:assert/strict";
import { test } from "node:test";
import { strings } from "./strings.ts";

function leaves(value: unknown): unknown[] {
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(leaves);
  }
  return [value];
}

test("every string is non-empty text", () => {
  for (const leaf of leaves(strings)) {
    assert.equal(typeof leaf, "string");
    assert.notEqual((leaf as string).trim(), "");
  }
});
