import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CATEGORIES, categoryLabel, isCategory } from "./categories.ts";
import { strings } from "./strings.ts";

test("every category has a pt-BR label", () => {
  assert.deepEqual(Object.keys(strings.categories), [...CATEGORIES]);
  assert.equal(categoryLabel("food"), "Alimentação");
  assert.equal(categoryLabel("toString"), null);
  assert.equal(categoryLabel(null), null);
});

test("isCategory accepts only the fixed list", () => {
  assert.equal(isCategory("lodging"), true);
  assert.equal(isCategory("Lodging"), false);
  assert.equal(isCategory(""), false);
});

test("the expenses migration allows the same category list", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0004_expenses.sql", import.meta.url), "utf8");
  const lists = [...sql.matchAll(/category (?:not )?in \(([^)]*)\)/g)].map((match) =>
    match[1].split(",").map((item) => item.trim().replaceAll("'", "")),
  );
  assert.equal(lists.length, 2);
  for (const list of lists) {
    assert.deepEqual(list, [...CATEGORIES]);
  }
});
