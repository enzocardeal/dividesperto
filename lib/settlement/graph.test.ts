import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDebt,
  cancelCycles,
  compressSettled,
  copyGraph,
  createGraph,
  edgesOf,
  maxFlowReduce,
  netsOf,
  type DebtGraph,
} from "./graph.ts";
import { seeded } from "./test-helpers.ts";

function graphOf(ids: readonly string[], debts: readonly [string, string, number][]): DebtGraph {
  const g = createGraph(ids);
  for (const [from, to, cents] of debts) {
    addDebt(g, from, to, cents);
  }
  return g;
}

function edges(g: DebtGraph): [string, string, number][] {
  return edgesOf(g).map((e) => [e.from, e.to, e.amountCents]);
}

function netMap(g: DebtGraph): Record<string, number> {
  return Object.fromEntries(netsOf(g).map((n) => [n.userId, n.netCents]));
}

test("createGraph sorts and deduplicates the ids", () => {
  assert.deepEqual(createGraph(["c", "a", "b", "a"]).ids, ["a", "b", "c"]);
});

test("addDebt nets opposite debts between the same pair", () => {
  const g = graphOf(["ana", "bia"], [["ana", "bia", 5000]]);
  addDebt(g, "bia", "ana", 1335);
  assert.deepEqual(edges(g), [["ana", "bia", 3665]]);
  addDebt(g, "bia", "ana", 3665);
  assert.deepEqual(edges(g), []);
  addDebt(g, "bia", "ana", 100);
  assert.deepEqual(edges(g), [["bia", "ana", 100]]);
});

test("addDebt refuses unknown ids, self debts and invalid amounts", () => {
  const g = createGraph(["ana", "bia"]);
  assert.throws(() => addDebt(g, "ana", "caio", 100), RangeError);
  assert.throws(() => addDebt(g, "ana", "ana", 100), RangeError);
  assert.throws(() => addDebt(g, "ana", "bia", -1), RangeError);
  assert.throws(() => addDebt(g, "ana", "bia", 0.5), RangeError);
});

test("netsOf gives paid minus owed for every person in id order", () => {
  const g = graphOf(["caio", "bia", "ana"], [
    ["ana", "bia", 1000],
    ["bia", "caio", 300],
  ]);
  assert.deepEqual(netsOf(g), [
    { userId: "ana", netCents: -1000 },
    { userId: "bia", netCents: 700 },
    { userId: "caio", netCents: 300 },
  ]);
});

test("cancelCycles removes the minimum edge of every cycle and keeps the nets", () => {
  const g = graphOf(["ana", "bia", "caio", "duda"], [
    ["ana", "bia", 1000],
    ["bia", "caio", 400],
    ["caio", "ana", 700],
    ["caio", "duda", 200],
  ]);
  const before = netMap(g);
  cancelCycles(g);
  assert.deepEqual(edges(g), [
    ["ana", "bia", 600],
    ["caio", "ana", 300],
    ["caio", "duda", 200],
  ]);
  assert.deepEqual(netMap(g), before);
});

test("maxFlowReduce pays the direct debt first", () => {
  const g = graphOf(["ana", "bia", "caio"], [
    ["ana", "bia", 500],
    ["ana", "caio", 1000],
    ["caio", "bia", 1000],
  ]);
  assert.equal(maxFlowReduce(g, "ana", "bia", 500), 500);
  assert.deepEqual(edges(g), [
    ["ana", "caio", 1000],
    ["caio", "bia", 1000],
  ]);
});

test("maxFlowReduce follows a two-hop chain", () => {
  const g = graphOf(["ana", "bia", "caio"], [
    ["ana", "bia", 1000],
    ["bia", "caio", 600],
  ]);
  assert.equal(maxFlowReduce(g, "ana", "caio", 1000), 600);
  assert.deepEqual(edges(g), [["ana", "bia", 400]]);
});

test("maxFlowReduce reroutes where a path greedy stops at R$ 10,00", () => {
  const g = graphOf(["ana", "bia", "caio", "duda", "eva", "teo"], [
    ["ana", "bia", 1000],
    ["bia", "caio", 1000],
    ["caio", "teo", 1000],
    ["bia", "eva", 1000],
    ["eva", "teo", 1000],
    ["ana", "duda", 1000],
    ["duda", "caio", 1000],
  ]);
  assert.equal(maxFlowReduce(g, "ana", "teo", 2000), 2000);
  assert.deepEqual(edges(g), [["bia", "caio", 1000]]);
  assert.equal(netMap(g).ana, 0);
  assert.equal(netMap(g).teo, 0);
});

test("compressSettled joins the debts through a settled person", () => {
  const g = graphOf(["carolina", "enzo", "laura", "ricardo", "yan"], [
    ["carolina", "enzo", 2499],
    ["ricardo", "enzo", 1664],
    ["enzo", "laura", 3665],
    ["enzo", "yan", 498],
  ]);
  const before = netMap(g);
  compressSettled(g);
  assert.deepEqual(edges(g), [
    ["carolina", "laura", 2499],
    ["ricardo", "laura", 1166],
    ["ricardo", "yan", 498],
  ]);
  assert.deepEqual(netMap(g), before);
});

test("compressSettled leaves people with a balance unchanged", () => {
  const g = graphOf(["ana", "bia", "caio"], [
    ["ana", "bia", 1000],
    ["bia", "caio", 400],
  ]);
  compressSettled(g);
  assert.deepEqual(edges(g), [
    ["ana", "bia", 1000],
    ["bia", "caio", 400],
  ]);
});

test("copyGraph gives an independent copy", () => {
  const g = graphOf(["ana", "bia"], [["ana", "bia", 1000]]);
  const h = copyGraph(g);
  addDebt(h, "ana", "bia", 500);
  assert.deepEqual(edges(g), [["ana", "bia", 1000]]);
  assert.deepEqual(edges(h), [["ana", "bia", 1500]]);
});

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

test("an acyclic graph where every net is zero is empty", () => {
  const random = seeded(17102026);
  const int = (max: number) => Math.floor(random() * (max + 1));
  for (let run = 0; run < 2_000; run++) {
    const ids = Array.from({ length: 2 + int(6) }, (_, i) => `p${i}`);
    const g = createGraph(ids);
    for (let k = int(4); k > 0; k--) {
      const cycle = [...new Set(Array.from({ length: 2 + int(ids.length - 2) }, () => ids[int(ids.length - 1)]))];
      const cents = 100 * (1 + int(9));
      cycle.forEach((from, i) => {
        if (cycle.length > 1) {
          addDebt(g, from, cycle[(i + 1) % cycle.length], cents);
        }
      });
    }
    assert.ok(netsOf(g).every((n) => n.netCents === 0), `run ${run}`);
    cancelCycles(g);
    assert.ok(acyclic(g), `run ${run}`);
    assert.deepEqual(edgesOf(g), [], `run ${run}`);
  }
});

test("maxFlowReduce absorbs the minimum of the amount and the minimum cut for up to 7 people", () => {
  const random = seeded(20261017);
  const int = (max: number) => Math.floor(random() * (max + 1));
  for (let run = 0; run < 2_000; run++) {
    const ids = Array.from({ length: 2 + int(5) }, (_, i) => `p${i}`);
    const n = ids.length;
    const g = createGraph(ids);
    for (let k = int(3 * n); k > 0; k--) {
      const u = int(n - 1);
      const v = int(n - 1);
      if (u !== v) {
        addDebt(g, ids[u], ids[v], 100 * (1 + int(9)));
      }
    }
    cancelCycles(g);
    const a = int(n - 1);
    const b = (a + 1 + int(n - 2)) % n;
    let minCut = Infinity;
    for (let mask = 0; mask < 1 << n; mask++) {
      if (!(mask & (1 << a)) || mask & (1 << b)) {
        continue;
      }
      let cut = 0;
      for (let u = 0; u < n; u++) {
        for (let v = 0; v < n; v++) {
          if (mask & (1 << u) && !(mask & (1 << v))) {
            cut += g.weights[u][v];
          }
        }
      }
      minCut = Math.min(minCut, cut);
    }
    const amount = 100 * int(30);
    const before = netMap(g);
    const absorbed = maxFlowReduce(g, ids[a], ids[b], amount);
    assert.equal(absorbed, Math.min(amount, minCut), `run ${run}`);
    assert.ok(acyclic(g), `run ${run}`);
    const after = netMap(g);
    for (const id of ids) {
      const change = id === ids[a] ? absorbed : id === ids[b] ? -absorbed : 0;
      assert.equal(after[id], before[id] + change, `run ${run}: ${id}`);
    }
  }
});
