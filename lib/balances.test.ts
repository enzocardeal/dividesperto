import assert from "node:assert/strict";
import { test } from "node:test";
import { firstLines, netStatus, viewerGroupLines, viewerTotals, type GroupLedgerRows } from "./balances.ts";

test("netStatus reads the sign of a net", () => {
  assert.equal(netStatus(1), "receives");
  assert.equal(netStatus(-1), "owes");
  assert.equal(netStatus(0), "settled");
});

function ledger(id: string, fields: Partial<GroupLedgerRows> = {}): GroupLedgerRows {
  return { id, name: id, archived: false, version: 1, memberIds: [], debts: [], payments: [], ...fields };
}

function debt(debtor_id: string, creditor_id: string, amount_cents: number) {
  return { debtor_id, creditor_id, amount_cents };
}

const people = ["ana", "bia", "caio"];
const chain = [debt("ana", "bia", 1000), debt("bia", "caio", 500)];

test("viewerGroupLines keeps the lines of the viewer in each view", () => {
  const groups = [ledger("praia", { memberIds: people, debts: chain })];
  assert.deepEqual(viewerGroupLines("caio", groups, "full")[0].lines, [{ from: "bia", to: "caio", amountCents: 500 }]);
  assert.deepEqual(viewerGroupLines("caio", groups, "simplified")[0].lines, [
    { from: "ana", to: "caio", amountCents: 500 },
  ]);
});

test("viewerGroupLines lists active groups by name, then archived groups, and drops groups without a line", () => {
  const groups = [
    ledger("g1", { name: "Serra", memberIds: people, debts: [debt("ana", "bia", 100)] }),
    ledger("g2", { name: "Arraial", archived: true, memberIds: people, debts: [debt("bia", "ana", 200)] }),
    ledger("g3", { name: "Praia", memberIds: people, debts: [debt("caio", "ana", 300)] }),
    ledger("g4", { name: "Bar", memberIds: people, debts: [debt("bia", "caio", 400)] }),
  ];
  const lines = viewerGroupLines("ana", groups, "full");
  assert.deepEqual(
    lines.map((group) => [group.name, group.archived]),
    [
      ["Praia", false],
      ["Serra", false],
      ["Arraial", true],
    ],
  );
  assert.deepEqual(lines[2], {
    groupId: "g2",
    name: "Arraial",
    archived: true,
    version: 1,
    lines: [{ from: "bia", to: "ana", amountCents: 200 }],
  });
});

test("viewerGroupLines replays the payments of each group", () => {
  const groups = [
    ledger("praia", {
      memberIds: people,
      debts: chain,
      payments: [
        {
          id: "p1",
          from_user_id: "bia",
          to_user_id: "caio",
          amount_cents: 500,
          paid_on: "2026-10-17",
          created_at: "2026-10-17T12:00:00Z",
        },
      ],
    }),
  ];
  assert.deepEqual(viewerGroupLines("caio", groups, "full"), []);
  assert.deepEqual(viewerGroupLines("ana", groups, "full")[0].lines, [{ from: "ana", to: "bia", amountCents: 1000 }]);
});

test("a debt in one group and a credit in another group never net out", () => {
  const groups = [
    ledger("praia", { memberIds: ["ana", "bia"], debts: [debt("ana", "bia", 1000)] }),
    ledger("serra", { memberIds: ["ana", "bia"], debts: [debt("bia", "ana", 1000)] }),
  ];
  for (const view of ["full", "simplified"] as const) {
    const lines = viewerGroupLines("ana", groups, view);
    assert.deepEqual(
      lines.map((group) => [group.groupId, group.lines]),
      [
        ["praia", [{ from: "ana", to: "bia", amountCents: 1000 }]],
        ["serra", [{ from: "bia", to: "ana", amountCents: 1000 }]],
      ],
    );
    assert.deepEqual(viewerTotals("ana", lines), { owesCents: 1000, receivesCents: 1000 });
  }
});

test("viewerTotals equals the sum of the lines of the viewer", () => {
  const groups = [
    ledger("praia", { memberIds: people, debts: chain }),
    ledger("serra", { memberIds: people, debts: [debt("caio", "bia", 700), debt("ana", "caio", 300)] }),
  ];
  for (const view of ["full", "simplified"] as const) {
    const lines = viewerGroupLines("caio", groups, view);
    const all = lines.flatMap((group) => group.lines);
    const totals = viewerTotals("caio", lines);
    const sum = (filter: (line: (typeof all)[number]) => boolean) =>
      all.filter(filter).reduce((total, line) => total + line.amountCents, 0);
    assert.equal(totals.owesCents, sum((line) => line.from === "caio"));
    assert.equal(totals.receivesCents, sum((line) => line.to === "caio"));
    assert.ok(totals.owesCents > 0 && totals.receivesCents > 0);
  }
  assert.deepEqual(viewerTotals("caio", []), { owesCents: 0, receivesCents: 0 });
});

test("firstLines takes the first lines in group order with their group", () => {
  const groups = [
    {
      groupId: "g1",
      name: "Praia",
      archived: false,
      version: 4,
      lines: [
        { from: "ana", to: "bia", amountCents: 100 },
        { from: "caio", to: "ana", amountCents: 200 },
      ],
    },
    { groupId: "g2", name: "Serra", archived: true, version: 9, lines: [{ from: "ana", to: "caio", amountCents: 300 }] },
  ];
  assert.deepEqual(firstLines(groups, 2), [
    { groupId: "g1", name: "Praia", archived: false, version: 4, from: "ana", to: "bia", amountCents: 100 },
    { groupId: "g1", name: "Praia", archived: false, version: 4, from: "caio", to: "ana", amountCents: 200 },
  ]);
  assert.deepEqual(firstLines(groups, 5).at(-1), {
    groupId: "g2",
    name: "Serra",
    archived: true,
    version: 9,
    from: "ana",
    to: "caio",
    amountCents: 300,
  });
  assert.deepEqual(firstLines([], 5), []);
});
