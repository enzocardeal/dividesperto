import assert from "node:assert/strict";
import { test } from "node:test";
import { EXACT_LIMIT, simplify, type MemberNet, type Transfer } from "./simplify.ts";

function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nets(values: Record<string, number>): MemberNet[] {
  return Object.entries(values).map(([userId, netCents]) => ({ userId, netCents }));
}

function bruteForceMinimum(input: readonly MemberNet[]): number {
  const debts = input.map((n) => n.netCents).filter((cents) => cents !== 0);
  const search = (start: number): number => {
    while (start < debts.length && debts[start] === 0) {
      start++;
    }
    if (start === debts.length) {
      return 0;
    }
    let best = Infinity;
    for (let j = start + 1; j < debts.length; j++) {
      if (debts[j] * debts[start] < 0) {
        debts[j] += debts[start];
        best = Math.min(best, 1 + search(start + 1));
        debts[j] -= debts[start];
      }
    }
    return best;
  };
  return search(0);
}

function assertSettles(input: readonly MemberNet[], transfers: readonly Transfer[], label: string): void {
  const remaining = new Map(input.map((n) => [n.userId, n.netCents]));
  for (const { from, to, amountCents } of transfers) {
    assert.ok(Number.isSafeInteger(amountCents) && amountCents > 0, `${label}: amount ${amountCents}`);
    assert.ok(remaining.get(from)! < 0, `${label}: ${from} pays but does not owe`);
    assert.ok(remaining.get(to)! > 0, `${label}: ${to} receives but is not owed`);
    remaining.set(from, remaining.get(from)! + amountCents);
    remaining.set(to, remaining.get(to)! - amountCents);
  }
  for (const [userId, cents] of remaining) {
    assert.equal(cents, 0, `${label}: ${userId} keeps ${cents}`);
  }
}

test("no transfers when every net is zero", () => {
  assert.deepEqual(simplify([]), []);
  assert.deepEqual(simplify(nets({ a: 0, b: 0, c: 0 })), []);
});

test("two separate debts of R$ 50,00 give exactly two transfers", () => {
  assert.deepEqual(simplify(nets({ d: 5000, c: -5000, b: 5000, a: -5000 })), [
    { from: "a", to: "b", amountCents: 5000 },
    { from: "c", to: "d", amountCents: 5000 },
  ]);
});

test("one debtor pays every creditor and settled members stay out", () => {
  assert.deepEqual(simplify(nets({ ana: -9000, bia: 3000, caio: 6000, duda: 0 })), [
    { from: "ana", to: "caio", amountCents: 6000 },
    { from: "ana", to: "bia", amountCents: 3000 },
  ]);
});

test("zero-sum subsets beat the plain greedy", () => {
  const input = nets({ a: -600, b: -400, c: 300, d: 300, e: 400 });
  const transfers = simplify(input);
  assert.deepEqual(transfers, [
    { from: "a", to: "c", amountCents: 300 },
    { from: "a", to: "d", amountCents: 300 },
    { from: "b", to: "e", amountCents: 400 },
  ]);
  assertSettles(input, transfers, "subsets");
});

test("the result does not depend on the input order", () => {
  const input = nets({ e: 400, a: -600, d: 300, b: -400, c: 300, f: 0 });
  assert.deepEqual(simplify(input), simplify([...input].reverse()));
});

test("more people than the exact limit still settle every net", () => {
  const input = Array.from({ length: EXACT_LIMIT + 1 }, (_, i) => ({
    userId: `p${String(i).padStart(2, "0")}`,
    netCents: i === 0 ? -100 * EXACT_LIMIT : 100,
  }));
  const transfers = simplify(input);
  assert.equal(transfers.length, EXACT_LIMIT);
  assertSettles(input, transfers, "fallback");
});

test("simplify refuses invalid nets", () => {
  assert.throws(() => simplify(nets({ a: -100, b: 99 })), RangeError);
  assert.throws(() => simplify(nets({ a: -0.5, b: 0.5 })), RangeError);
  assert.throws(
    () =>
      simplify([
        { userId: "a", netCents: -1 },
        { userId: "a", netCents: 1 },
      ]),
    RangeError,
  );
});

test("the transfer count equals the brute-force minimum for up to 6 people", () => {
  const random = seeded(20261016);
  const int = (max: number) => Math.floor(random() * (max + 1));
  for (let run = 0; run < 3_000; run++) {
    const k = 2 + int(4);
    const values = Array.from({ length: k - 1 }, () => (int(10) - 5) * 100);
    values.push(0 - values.reduce((a, b) => a + b, 0));
    const input = values.map((netCents, i) => ({ userId: String.fromCharCode(97 + i), netCents }));

    const transfers = simplify(input);
    assertSettles(input, transfers, `run ${run}`);
    assert.equal(transfers.length, bruteForceMinimum(input), `run ${run}: ${JSON.stringify(values)}`);
  }
});

test("10,000 random groups settle with positive, deterministic transfers", () => {
  const random = seeded(16102026);
  const int = (max: number) => Math.floor(random() * (max + 1));
  for (let run = 0; run < 10_000; run++) {
    const ids = [...new Set(Array.from({ length: 1 + int(9) }, () => int(0xffffffff).toString(16)))];
    const spread = random() < 0.5 ? 5 : 100_000;
    const values = ids.map(() => int(2 * spread) - spread);
    values[int(ids.length - 1)] -= values.reduce((a, b) => a + b, 0);
    const input = ids.map((userId, i) => ({ userId, netCents: values[i] }));

    const transfers = simplify(input);
    assertSettles(input, transfers, `run ${run}`);
    const nonZero = values.filter((cents) => cents !== 0).length;
    assert.ok(transfers.length <= Math.max(0, nonZero - 1), `run ${run}`);
    assert.deepEqual(simplify([...input].reverse()), transfers, `run ${run}`);
  }
});
