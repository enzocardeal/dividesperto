import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { groupErrorMessage, isUuid, memberCountLabel, parseGroupName } from "./groups.ts";
import { strings } from "./strings.ts";

test("parseGroupName trims and accepts 1 to 80 characters", () => {
  assert.equal(parseGroupName("  Viagem  "), "Viagem");
  assert.equal(parseGroupName("x".repeat(80)), "x".repeat(80));
  assert.equal(parseGroupName("🏖".repeat(80)), "🏖".repeat(80));
});

test("parseGroupName refuses blank, long and non-text values", () => {
  assert.equal(parseGroupName(""), null);
  assert.equal(parseGroupName("   "), null);
  assert.equal(parseGroupName("x".repeat(81)), null);
  assert.equal(parseGroupName(null), null);
  assert.equal(parseGroupName(42), null);
});

test("isUuid accepts only canonical uuids", () => {
  assert.equal(isUuid("0b7c7a52-3f1e-4b8e-9d4a-2f6c1e8a9b10"), true);
  assert.equal(isUuid("0B7C7A52-3F1E-4B8E-9D4A-2F6C1E8A9B10"), true);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid("0b7c7a52-3f1e-4b8e-9d4a-2f6c1e8a9b10x"), false);
  assert.equal(isUuid(undefined), false);
});

test("groupErrorMessage maps known SQLSTATEs and falls back to the generic text", () => {
  assert.equal(groupErrorMessage("42501"), strings.errors.notMember);
  assert.equal(groupErrorMessage("DS002"), strings.errors.archived);
  assert.equal(groupErrorMessage("DS003"), strings.newGroup.invalidName);
  assert.equal(groupErrorMessage("DS004"), strings.errors.personNotFound);
  assert.equal(groupErrorMessage("23505"), strings.errors.generic);
  assert.equal(groupErrorMessage("toString"), strings.errors.generic);
  assert.equal(groupErrorMessage(undefined), strings.errors.generic);
});

test("the groups migration raises every SQLSTATE that groupErrorMessage maps", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0003_groups.sql", import.meta.url), "utf8");
  const raised = new Set([...sql.matchAll(/errcode = '([0-9A-Z]{5})'/g)].map((match) => match[1]));
  assert.deepEqual([...raised].sort(), ["42501", "DS002", "DS003", "DS004"]);
  for (const code of raised) {
    assert.notEqual(groupErrorMessage(code), strings.errors.generic);
  }
});

test("memberCountLabel uses the singular only for one", () => {
  assert.equal(memberCountLabel(1), "1 pessoa");
  assert.equal(memberCountLabel(2), "2 pessoas");
  assert.equal(memberCountLabel(0), "0 pessoas");
});
