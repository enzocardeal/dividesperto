import assert from "node:assert/strict";
import { test } from "node:test";
import { groupNetsFor, netStatus, netWith, summarizeFor, type GroupPairBalance } from "./balances.ts";

const pairs: GroupPairBalance[] = [
  { group_id: "praia", debtor_id: "bruno", creditor_id: "ana", amount_cents: 1000 },
  { group_id: "praia", debtor_id: "caio", creditor_id: "ana", amount_cents: 3000 },
  { group_id: "serra", debtor_id: "ana", creditor_id: "bruno", amount_cents: 2500 },
  { group_id: "serra", debtor_id: "caio", creditor_id: "bruno", amount_cents: 700 },
];

test("netStatus reads the sign of a net", () => {
  assert.equal(netStatus(1), "receives");
  assert.equal(netStatus(-1), "owes");
  assert.equal(netStatus(0), "settled");
});

test("netWith is positive when the other person owes the user", () => {
  assert.deepEqual(netWith("ana", pairs[0]), { userId: "bruno", netCents: 1000 });
  assert.deepEqual(netWith("ana", pairs[2]), { userId: "bruno", netCents: -2500 });
  assert.equal(netWith("ana", pairs[3]), null);
});

test("summarizeFor nets the pairs of two groups per person", () => {
  assert.deepEqual(summarizeFor("ana", pairs), {
    owesCents: 1500,
    receivesCents: 3000,
    counterparties: [
      { userId: "caio", netCents: 3000 },
      { userId: "bruno", netCents: -1500 },
    ],
  });
});

test("summarizeFor drops a person whose pairs cancel out", () => {
  const even = [
    { debtor_id: "bruno", creditor_id: "ana", amount_cents: 2500 },
    { debtor_id: "ana", creditor_id: "bruno", amount_cents: 2500 },
  ];
  assert.deepEqual(summarizeFor("ana", even), { owesCents: 0, receivesCents: 0, counterparties: [] });
  assert.deepEqual(summarizeFor("ana", []), { owesCents: 0, receivesCents: 0, counterparties: [] });
});

test("groupNetsFor lists the per-group nets that add up to the overall net", () => {
  const byPerson = groupNetsFor("ana", pairs);
  assert.deepEqual(byPerson.get("bruno"), [
    { groupId: "praia", netCents: 1000 },
    { groupId: "serra", netCents: -2500 },
  ]);
  assert.deepEqual(byPerson.get("caio"), [{ groupId: "praia", netCents: 3000 }]);
  for (const { userId, netCents } of summarizeFor("ana", pairs).counterparties) {
    const total = (byPerson.get(userId) ?? []).reduce((sum, item) => sum + item.netCents, 0);
    assert.equal(total, netCents);
  }
});
