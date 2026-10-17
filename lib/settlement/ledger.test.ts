import assert from "node:assert/strict";
import { test } from "node:test";
import { edgesOf, netsOf } from "./graph.ts";
import { COMPRESS_SETTLED, replayLedger, type ExpenseDebt, type LedgerPayment } from "./ledger.ts";
import type { Transfer } from "./simplify.ts";
import { fullLines, simplifiedLines, viewerLines } from "./views.ts";

const members = ["carolina", "enzo", "laura", "ricardo", "yan"];

const shared: ExpenseDebt[] = [
  { debtor_id: "enzo", creditor_id: "laura", amount_cents: 5000 },
  { debtor_id: "laura", creditor_id: "enzo", amount_cents: 1335 },
  { debtor_id: "enzo", creditor_id: "yan", amount_cents: 498 },
  { debtor_id: "carolina", creditor_id: "enzo", amount_cents: 2499 },
  { debtor_id: "enzo", creditor_id: "ricardo", amount_cents: 13252 },
];

const variants: Record<string, ExpenseDebt[]> = {
  chain: [...shared, { debtor_id: "laura", creditor_id: "ricardo", amount_cents: 1664 }],
  "no chain": [...shared, { debtor_id: "carolina", creditor_id: "ricardo", amount_cents: 1664 }],
};

const enzoPaysRicardo: LedgerPayment = {
  id: "p1",
  from_user_id: "enzo",
  to_user_id: "ricardo",
  amount_cents: 14916,
  paid_on: "2026-10-12",
  created_at: "2026-10-12T21:04:05.123456+00:00",
};

function line(from: string, to: string, amountCents: number): Transfer {
  return { from, to, amountCents };
}

function sorted(lines: readonly Transfer[]): Transfer[] {
  return [...lines].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}

function rowNets(debts: readonly ExpenseDebt[], payments: readonly LedgerPayment[]): Record<string, number> {
  const nets: Record<string, number> = Object.fromEntries(members.map((id) => [id, 0]));
  for (const d of debts) {
    nets[d.creditor_id] += d.amount_cents;
    nets[d.debtor_id] -= d.amount_cents;
  }
  for (const p of payments) {
    nets[p.from_user_id] += p.amount_cents;
    nets[p.to_user_id] -= p.amount_cents;
  }
  return nets;
}

test("the fixture uses option B in production", () => {
  assert.equal(COMPRESS_SETTLED, true);
});

for (const [name, debts] of Object.entries(variants)) {
  for (const compress of [false, true]) {
    test(`fixture ${name}, compress ${compress}: Simplificada asks Enzo to pay Ricardo R$ 149,16`, () => {
      const g = replayLedger(members, debts, [], { compress });
      assert.ok(
        simplifiedLines(g, { compress }).transfers.some(
          (t) => t.from === "enzo" && t.to === "ricardo" && t.amountCents === 14916,
        ),
      );
    });

    test(`fixture ${name}, compress ${compress}: nets equal the nets of the rows`, () => {
      for (const payments of [[], [enzoPaysRicardo]]) {
        const g = replayLedger(members, debts, payments, { compress });
        const nets = Object.fromEntries(netsOf(g).map((n) => [n.userId, n.netCents]));
        assert.deepEqual(nets, rowNets(debts, payments));
      }
    });
  }
}

test("fixture chain, option A: the payment follows the chain through Laura and leaves no rest", () => {
  const g = replayLedger(members, variants.chain, [enzoPaysRicardo], { compress: false });
  assert.deepEqual(viewerLines(fullLines(g), "enzo"), [
    line("carolina", "enzo", 2499),
    line("enzo", "laura", 2001),
    line("enzo", "yan", 498),
  ]);
});

test("fixture no chain, option A: the payment leaves a rest that Ricardo owes Enzo", () => {
  const g = replayLedger(members, variants["no chain"], [enzoPaysRicardo], { compress: false });
  assert.deepEqual(viewerLines(fullLines(g), "enzo"), [
    line("carolina", "enzo", 2499),
    line("enzo", "laura", 3665),
    line("enzo", "yan", 498),
    line("ricardo", "enzo", 1664),
  ]);
});

test("fixture, option B: Enzo has no line and Completa equals Simplificada", () => {
  const expected: Record<string, Transfer[]> = {
    chain: [line("carolina", "laura", 2001), line("carolina", "yan", 498)],
    "no chain": [line("carolina", "laura", 3665), line("carolina", "yan", 498)],
  };
  for (const [name, debts] of Object.entries(variants)) {
    const g = replayLedger(members, debts, [enzoPaysRicardo], { compress: true });
    const full = fullLines(g);
    const simplified = simplifiedLines(g, { compress: true });
    assert.deepEqual(full, expected[name], name);
    assert.deepEqual(sorted(simplified.transfers), expected[name], name);
    assert.equal(simplified.followsChains, true, name);
    assert.deepEqual(viewerLines(full, "enzo"), [], name);
    assert.deepEqual(viewerLines(simplified.transfers, "enzo"), [], name);
  }
});

test("payments replay by date, then creation time, then id", () => {
  const debts: ExpenseDebt[] = [
    { debtor_id: "ana", creditor_id: "bia", amount_cents: 1000 },
    { debtor_id: "bia", creditor_id: "caio", amount_cents: 1000 },
  ];
  const toCaio = (paid_on: string, created_at: string, id: string): LedgerPayment => ({
    id,
    from_user_id: "ana",
    to_user_id: "caio",
    amount_cents: 1000,
    paid_on,
    created_at,
  });
  const toBia = (paid_on: string, created_at: string, id: string): LedgerPayment => ({
    id,
    from_user_id: "ana",
    to_user_id: "bia",
    amount_cents: 500,
    paid_on,
    created_at,
  });
  const caioFirst = [line("bia", "ana", 500)];
  const biaFirst = [line("bia", "caio", 500), line("caio", "ana", 500)];
  const replay = (payments: LedgerPayment[]) =>
    edgesOf(replayLedger(["ana", "bia", "caio"], debts, payments, { compress: false }));

  const t = "2026-10-01T10:00:00Z";
  const later = "2026-10-01T10:00:01Z";
  assert.deepEqual(replay([toBia("2026-10-02", t, "a"), toCaio("2026-10-01", later, "b")]), caioFirst);
  assert.deepEqual(replay([toCaio("2026-10-02", t, "a"), toBia("2026-10-01", later, "b")]), biaFirst);
  assert.deepEqual(replay([toBia("2026-10-01", later, "a"), toCaio("2026-10-01", t, "b")]), caioFirst);
  assert.deepEqual(replay([toBia("2026-10-01", t, "b"), toCaio("2026-10-01", t, "a")]), caioFirst);
});

test("the replay does not depend on the order of the input rows", () => {
  const payments: LedgerPayment[] = [
    enzoPaysRicardo,
    { ...enzoPaysRicardo, id: "p2", from_user_id: "carolina", to_user_id: "laura", amount_cents: 1000 },
    { ...enzoPaysRicardo, id: "p0", from_user_id: "yan", to_user_id: "enzo", amount_cents: 300 },
  ];
  for (const compress of [false, true]) {
    const g = replayLedger(members, variants.chain, payments, { compress });
    const h = replayLedger([...members].reverse(), [...variants.chain].reverse(), [...payments].reverse(), {
      compress,
    });
    assert.deepEqual(edgesOf(h), edgesOf(g));
    assert.deepEqual(simplifiedLines(h, { compress }), simplifiedLines(g, { compress }));
  }
});

test("replayLedger refuses amounts that are not positive integers", () => {
  const debt = (amount_cents: number) => [{ debtor_id: "ana", creditor_id: "bia", amount_cents }];
  assert.throws(() => replayLedger(["ana", "bia"], debt(0), []), RangeError);
  assert.throws(() => replayLedger(["ana", "bia"], debt(1.5), []), RangeError);
  const refund = { ...enzoPaysRicardo, from_user_id: "ana", to_user_id: "bia", amount_cents: -1 };
  assert.throws(() => replayLedger(["ana", "bia"], [], [refund]), RangeError);
});
