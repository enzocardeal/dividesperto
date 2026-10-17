import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compressSettled,
  copyGraph,
  createGraph,
  edgesOf,
  maxFlowReduce,
  netsOf,
  type DebtGraph,
} from "./graph.ts";
import { expenseGraph, payDebt, replayLedger, type ExpenseDebt, type LedgerPayment } from "./ledger.ts";
import { simplify, type Transfer } from "./simplify.ts";
import { bruteForceMinimum, seeded } from "./test-helpers.ts";
import {
  NODE_LIMIT,
  chainValid,
  fullLines,
  linesFor,
  searchChainMinimum,
  simplifiedLines,
  viewerFirst,
  viewerLines,
} from "./views.ts";

function debt(debtor_id: string, creditor_id: string, amount_cents: number): ExpenseDebt {
  return { debtor_id, creditor_id, amount_cents };
}

function line(from: string, to: string, amountCents: number): Transfer {
  return { from, to, amountCents };
}

function acyclic(g: DebtGraph): boolean {
  const n = g.ids.length;
  const indegree = g.ids.map((_, v) => g.weights.filter((row) => row[v] > 0).length);
  const ready = [...indegree.keys()].filter((v) => indegree[v] === 0);
  let seen = 0;
  while (ready.length > 0) {
    const u = ready.pop()!;
    seen++;
    for (let v = 0; v < n; v++) {
      if (g.weights[u][v] > 0 && --indegree[v] === 0) {
        ready.push(v);
      }
    }
  }
  return seen === n;
}

function linesNets(ids: readonly string[], lines: readonly Transfer[]): Record<string, number> {
  const nets: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const { from, to, amountCents } of lines) {
    nets[to] += amountCents;
    nets[from] -= amountCents;
  }
  return nets;
}

function graphNets(g: DebtGraph): Record<string, number> {
  return Object.fromEntries(netsOf(g).map((n) => [n.userId, n.netCents]));
}

test("fullLines lists every debt and viewerLines keeps the lines of one person", () => {
  const g = expenseGraph(["ana", "bia", "caio"], [debt("ana", "bia", 1000), debt("bia", "caio", 300)], {
    compress: false,
  });
  assert.deepEqual(fullLines(g), [line("ana", "bia", 1000), line("bia", "caio", 300)]);
  assert.deepEqual(viewerLines(fullLines(g), "caio"), [line("bia", "caio", 300)]);
  assert.deepEqual(viewerLines(fullLines(g), "duda"), []);
});

test("a settled group has no simplified lines", () => {
  const g = expenseGraph(["ana", "bia"], []);
  assert.deepEqual(simplifiedLines(g), { transfers: [], followsChains: true });
});

test("the counterexample swaps to a list that follows the chains", () => {
  const debts = [debt("a", "d", 1000), debt("b", "c", 1000)];
  assert.deepEqual(
    simplify([
      { userId: "a", netCents: -1000 },
      { userId: "b", netCents: -1000 },
      { userId: "c", netCents: 1000 },
      { userId: "d", netCents: 1000 },
    ]),
    [line("a", "c", 1000), line("b", "d", 1000)],
  );
  for (const compress of [false, true]) {
    const g = expenseGraph(["a", "b", "c", "d"], debts, { compress });
    assert.deepEqual(simplifiedLines(g, { compress }), {
      transfers: [line("a", "d", 1000), line("b", "c", 1000)],
      followsChains: true,
    });
  }
});

test("a group with no chain-valid minimum keeps 2 transfers that do not follow the chains", () => {
  const debts = [debt("a1", "bia", 500), debt("a1", "caio", 500), debt("a2", "bia", 500), debt("a2", "caio", 500)];
  for (const compress of [false, true]) {
    const g = expenseGraph(["a1", "a2", "bia", "caio"], debts, { compress });
    const result = simplifiedLines(g, { compress });
    assert.equal(result.transfers.length, 2);
    assert.equal(result.followsChains, false);
  }
});

const worstCase: [number, number, number][] = [
  [0, 8, 7818], [1, 5, 7602], [2, 0, 2780], [2, 1, 1267], [2, 6, 1866], [2, 7, 3057], [2, 8, 6795],
  [2, 9, 1022], [3, 0, 2780], [3, 2, 4033], [3, 5, 7850], [3, 7, 3057], [3, 8, 3212], [3, 9, 5055],
  [4, 1, 5300], [4, 2, 4033], [4, 5, 7850], [4, 6, 1866], [4, 8, 8195], [4, 9, 5055], [5, 8, 7221],
  [6, 0, 7214], [6, 7, 1191], [6, 8, 12599], [6, 9, 3189], [7, 0, 186], [7, 1, 5300], [7, 8, 8195],
  [7, 9, 1998], [9, 0, 940], [9, 1, 245], [9, 5, 2795], [9, 8, 10756],
];

test("the chain search stops at the node limit in a 10-person worst case", () => {
  const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
  const g = expenseGraph(ids, worstCase.map(([u, v, cents]) => debt(ids[u], ids[v], cents)));
  const minimum = simplify(netsOf(g)).length;
  const unbounded = searchChainMinimum(g, minimum, { nodeLimit: Infinity });
  assert.ok(unbounded.nodes > NODE_LIMIT);
  const bounded = searchChainMinimum(g, minimum);
  assert.deepEqual(bounded, { transfers: null, nodes: NODE_LIMIT, aborted: true });
  const result = simplifiedLines(g);
  assert.equal(result.transfers.length, minimum);
  assert.equal(result.followsChains, false);
});

function chainSearchExists(g: DebtGraph, maxTransfers: number, compress: boolean): boolean {
  const nets = netsOf(g);
  if (nets.every((n) => n.netCents === 0)) {
    return true;
  }
  if (maxTransfers === 0) {
    return false;
  }
  for (const d of nets.filter((n) => n.netCents < 0)) {
    for (const c of nets.filter((n) => n.netCents > 0)) {
      const cents = Math.min(-d.netCents, c.netCents);
      const next = copyGraph(g);
      if (maxFlowReduce(next, d.userId, c.userId, cents) < cents) {
        continue;
      }
      if (compress) {
        compressSettled(next);
      }
      if (chainSearchExists(next, maxTransfers - 1, compress)) {
        return true;
      }
    }
  }
  return false;
}

function randomGraph(int: (max: number) => number, size: number, compress: boolean): DebtGraph {
  const ids = Array.from({ length: size }, (_, i) => `p${i}`);
  const debts: ExpenseDebt[] = [];
  for (let k = 1 + int(2 * size); k > 0; k--) {
    const u = int(size - 1);
    const v = int(size - 1);
    if (u !== v) {
      debts.push(debt(ids[u], ids[v], 100 * (1 + int(6))));
    }
  }
  return expenseGraph(ids, debts, { compress });
}

test("the simplified count equals the brute-force minimum for up to 6 people with a balance", () => {
  const random = seeded(61017);
  const int = (max: number) => Math.floor(random() * (max + 1));
  for (let run = 0; run < 2_000; run++) {
    const compress = run % 2 === 0;
    const g = randomGraph(int, 2 + int(4), compress);
    const transfers = simplifiedLines(g, { compress }).transfers;
    assert.equal(transfers.length, bruteForceMinimum(netsOf(g)), `run ${run}`);
    assert.deepEqual(linesNets(g.ids, transfers), graphNets(g), `run ${run}`);
  }
});

test("the chain search finds a chain-valid minimum exactly when an unbounded search does, up to 5 people", () => {
  const random = seeded(51017);
  const int = (max: number) => Math.floor(random() * (max + 1));
  let found = 0;
  let missing = 0;
  for (let run = 0; run < 2_000; run++) {
    const compress = run % 2 === 0;
    const g = randomGraph(int, 2 + int(3), compress);
    const minimum = simplify(netsOf(g)).length;
    const result = searchChainMinimum(g, minimum, { compress });
    assert.equal(result.aborted, false, `run ${run}`);
    assert.equal(result.transfers !== null, chainSearchExists(g, minimum, compress), `run ${run}`);
    if (result.transfers) {
      found++;
      assert.equal(result.transfers.length, minimum, `run ${run}`);
      assert.ok(chainValid(g, result.transfers, compress), `run ${run}`);
    } else {
      missing++;
    }
  }
  assert.ok(found > 0 && missing > 0);
});

type Generated = { ids: string[]; debts: ExpenseDebt[] };

function tripLike(random: () => number, int: (max: number) => number): Generated {
  const ids = Array.from({ length: 2 + int(8) }, () => int(0xffffffff).toString(16).padStart(8, "0"));
  const unique = [...new Set(ids)];
  const sums = new Map<string, number>();
  for (let k = 1 + int(12); k > 0; k--) {
    const payer = unique[int(unique.length - 1)];
    const people = unique.filter(() => random() < 0.7);
    const total = 100 + int(60_000);
    people.forEach((person, i) => {
      const share = Math.floor(total / people.length) + (i < total % people.length ? 1 : 0);
      if (person !== payer && share > 0) {
        sums.set(`${person} ${payer}`, (sums.get(`${person} ${payer}`) ?? 0) + share);
      }
    });
  }
  const debts = [...sums].map(([pair, cents]) => {
    const [debtor, creditor] = pair.split(" ");
    return debt(debtor, creditor, cents);
  });
  return { ids: unique, debts };
}

function sparse(int: (max: number) => number): Generated {
  const ids = Array.from({ length: 2 + int(8) }, (_, i) => `m${i}`);
  const debts: ExpenseDebt[] = [];
  for (let k = int(ids.length); k > 0; k--) {
    const u = int(ids.length - 1);
    const v = int(ids.length - 1);
    if (u !== v) {
      debts.push(debt(ids[u], ids[v], 1 + int(20_000)));
    }
  }
  return { ids, debts };
}

function rowNets(ids: readonly string[], debts: readonly ExpenseDebt[], payments: readonly LedgerPayment[]) {
  const nets: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
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

function payAll(g: DebtGraph, transfers: readonly Transfer[], compress: boolean): boolean {
  let noRest = true;
  for (const { from, to, amountCents } of transfers) {
    const before = edgesOf(g).reduce((sum, e) => sum + e.amountCents, 0);
    if (payDebt(g, from, to, amountCents, compress) < amountCents) {
      noRest = false;
    } else {
      assert.ok(edgesOf(g).reduce((sum, e) => sum + e.amountCents, 0) < before);
    }
  }
  return noRest;
}

const outcomes = { swapped: 0, fallback: 0 };

function checkInvariants(
  ids: string[],
  debts: ExpenseDebt[],
  payments: LedgerPayment[],
  compress: boolean,
  label: string,
) {
  const g = replayLedger(ids, debts, payments, { compress });
  const nets = graphNets(g);
  const full = fullLines(g);
  const simplified = simplifiedLines(g, { compress });

  assert.ok(acyclic(g), `${label}: L0`);
  assert.deepEqual(nets, rowNets(ids, debts, payments), `${label}: I1 graph`);
  assert.deepEqual(linesNets(g.ids, full), nets, `${label}: I1 Completa`);
  assert.deepEqual(linesNets(g.ids, simplified.transfers), nets, `${label}: I1 Simplificada`);
  assert.equal(simplified.transfers.length, simplify(netsOf(g)).length, `${label}: count`);

  const paid = copyGraph(g);
  const noRest = payAll(paid, simplified.transfers, compress);
  assert.deepEqual(edgesOf(paid), [], `${label}: I2`);
  if (simplified.followsChains) {
    assert.ok(noRest, `${label}: I3`);
    if (!chainValid(g, simplify(netsOf(g)), compress)) {
      outcomes.swapped++;
    }
  } else {
    outcomes.fallback++;
  }

  if (compress) {
    const settled = new Set(netsOf(g).filter((n) => n.netCents === 0).map((n) => n.userId));
    for (const l of [...full, ...simplified.transfers]) {
      assert.ok(!settled.has(l.from) && !settled.has(l.to), `${label}: I5`);
    }
  } else if (full.length > 0) {
    const tapped = full[ids.length % full.length];
    const h = copyGraph(g);
    payDebt(h, tapped.from, tapped.to, tapped.amountCents, false);
    assert.deepEqual(edgesOf(h), full.filter((l) => l !== tapped), `${label}: I4`);
  }

  if (payments.length === 4) {
    const shuffled = replayLedger([...ids].reverse(), [...debts].reverse(), [...payments].reverse(), { compress });
    assert.deepEqual(edgesOf(shuffled), edgesOf(g), `${label}: D`);
    assert.deepEqual(simplifiedLines(shuffled, { compress }), simplified, `${label}: D`);
  }
  return { full, simplified };
}

test("5,000 random groups keep every ledger invariant under options A and B", () => {
  const random = seeded(171026);
  const int = (max: number) => Math.floor(random() * (max + 1));
  for (let run = 0; run < 5_000; run++) {
    const { ids, debts } = run % 2 === 0 ? tripLike(random, int) : sparse(int);
    for (const compress of [false, true]) {
      const payments: LedgerPayment[] = [];
      for (let step = 0; step < 4; step++) {
        const label = `run ${run}, compress ${compress}, step ${step}`;
        const { full, simplified } = checkInvariants(ids, debts, payments, compress, label);
        const kind = int(2);
        let next: Transfer | null = null;
        if (kind === 0 && simplified.transfers.length > 0) {
          next = simplified.transfers[int(simplified.transfers.length - 1)];
        } else if (kind === 1 && full.length > 0) {
          const l = full[int(full.length - 1)];
          next = line(l.from, l.to, l.amountCents + int(1) * (1 + int(5_000)));
        } else {
          const u = int(ids.length - 1);
          const v = (u + 1 + int(ids.length - 2)) % ids.length;
          next = line(ids[u], ids[v], 1 + int(20_000));
        }
        payments.push({
          id: `pay${step}`,
          from_user_id: next.from,
          to_user_id: next.to,
          amount_cents: next.amountCents,
          paid_on: "2026-10-17",
          created_at: `2026-10-17T12:00:0${step}Z`,
        });
      }
      checkInvariants(ids, debts, payments, compress, `run ${run}, compress ${compress}, end`);
    }
  }
  assert.ok(outcomes.swapped > 0 && outcomes.fallback > 0, JSON.stringify(outcomes));
});

test("an empty graph with members has no lines in either view", () => {
  const g = createGraph(["ana", "bia"]);
  assert.deepEqual(fullLines(g), []);
  assert.deepEqual(simplifiedLines(g).transfers, []);
});

test("viewerFirst moves the lines of the viewer to the top and keeps the order", () => {
  const lines = [
    line("ana", "bia", 100),
    line("caio", "duda", 200),
    line("bia", "caio", 300),
    line("duda", "ana", 400),
  ];
  assert.deepEqual(viewerFirst(lines, "caio"), [lines[1], lines[2], lines[0], lines[3]]);
  assert.deepEqual(viewerFirst(lines, "eva"), lines);
  assert.deepEqual(viewerFirst(lines, null), lines);
});

test("linesFor gives the full lines or the simplified transfers", () => {
  const g = expenseGraph(["ana", "bia", "caio"], [debt("ana", "bia", 1000), debt("bia", "caio", 1000)], {
    compress: false,
  });
  assert.deepEqual(linesFor(g, "full"), fullLines(g));
  assert.deepEqual(linesFor(g, "simplified"), simplifiedLines(g).transfers);
  assert.notDeepEqual(linesFor(g, "full"), linesFor(g, "simplified"));
});
