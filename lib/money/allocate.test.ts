import assert from "node:assert/strict";
import { test } from "node:test";
import { allocate, allocateItems, type Item } from "./allocate.ts";

function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function plain(shares: Map<string, number>): Record<string, number> {
  return Object.fromEntries(shares);
}

function sum(shares: Map<string, number>): number {
  return [...shares.values()].reduce((total, cents) => total + cents, 0);
}

const ana = "0b6f3a52-4d1e-4c55-9a51-0d8c1e1f0a01";
const bia = "5c2e7f10-8a3b-4f6d-b1c2-3e4f5a6b7c02";
const caio = "e1d2c3b4-a596-4877-8695-a4b3c2d1e003";

test("equal split gives leftover cents to the lowest ids", () => {
  assert.deepEqual(plain(allocate(10, [1, 1, 1], ["c", "a", "b"])), { a: 4, b: 3, c: 3 });
  assert.deepEqual(plain(allocate(10000, [1, 1, 1], [caio, bia, ana])), {
    [ana]: 3334,
    [bia]: 3333,
    [caio]: 3333,
  });
});

test("percent split uses basis points and the largest remainder", () => {
  assert.deepEqual(plain(allocate(10000, [3333, 3333, 3334], ["a", "b", "c"])), {
    a: 3333,
    b: 3333,
    c: 3334,
  });
  assert.deepEqual(plain(allocate(999, [2500, 2500, 5000], ["a", "b", "c"])), {
    a: 250,
    b: 250,
    c: 499,
  });
  assert.deepEqual(plain(allocate(1001, [5000, 5000], ["b", "a"])), { a: 501, b: 500 });
});

test("shares split follows the share counts", () => {
  assert.deepEqual(plain(allocate(1000, [1, 2], ["a", "b"])), { a: 333, b: 667 });
  assert.deepEqual(plain(allocate(700, [3, 2, 2], ["a", "b", "c"])), { a: 300, b: 200, c: 200 });
});

test("a zero weight receives nothing", () => {
  assert.deepEqual(plain(allocate(5, [0, 1, 1], ["a", "b", "c"])), { a: 0, b: 3, c: 2 });
});

test("a negative total mirrors the positive allocation", () => {
  assert.deepEqual(plain(allocate(-10, [1, 1, 1], ["c", "a", "b"])), { a: -4, b: -3, c: -3 });
});

test("the result does not depend on the input order", () => {
  const forward = allocate(1003, [7, 3, 3, 1], ["d", "b", "c", "a"]);
  const backward = allocate(1003, [1, 3, 3, 7], ["a", "c", "b", "d"]);
  assert.deepEqual(plain(forward), plain(backward));
});

test("allocate refuses invalid input", () => {
  assert.throws(() => allocate(10, [], []), RangeError);
  assert.throws(() => allocate(10, [1], ["a", "b"]), RangeError);
  assert.throws(() => allocate(10, [1, 1], ["a", "a"]), RangeError);
  assert.throws(() => allocate(10, [0, 0], ["a", "b"]), RangeError);
  assert.throws(() => allocate(10, [1, -1], ["a", "b"]), RangeError);
  assert.throws(() => allocate(10, [1.5, 1], ["a", "b"]), RangeError);
  assert.throws(() => allocate(10.5, [1, 1], ["a", "b"]), RangeError);
});

test("items split equally and extras follow the item subtotals", () => {
  const items: Item[] = [
    { amountCents: 6000, participantIds: ["a", "b"] },
    { amountCents: 4000, participantIds: ["b"] },
  ];
  assert.deepEqual(plain(allocateItems(11000, items)), { a: 3300, b: 7700 });
  assert.deepEqual(plain(allocateItems(10000, items)), { a: 3000, b: 7000 });
});

test("negative extras act as a proportional discount", () => {
  const items: Item[] = [
    { amountCents: 6000, participantIds: ["a", "b"] },
    { amountCents: 4000, participantIds: ["b"] },
  ];
  assert.deepEqual(plain(allocateItems(9000, items)), { a: 2700, b: 6300 });
});

test("items round deterministically inside each item and in the extras", () => {
  const items: Item[] = [{ amountCents: 1000, participantIds: ["c", "b", "a"] }];
  assert.deepEqual(plain(allocateItems(1100, items)), { a: 368, b: 366, c: 366 });
});

test("a participant with a zero subtotal receives no extras", () => {
  const items: Item[] = [{ amountCents: 1, participantIds: ["a", "b", "c"] }];
  assert.deepEqual(plain(allocateItems(4, items)), { a: 4, b: 0, c: 0 });
});

test("allocateItems refuses invalid input", () => {
  assert.throws(() => allocateItems(100, []), RangeError);
  assert.throws(() => allocateItems(100, [{ amountCents: 100, participantIds: [] }]), RangeError);
  assert.throws(() => allocateItems(100, [{ amountCents: 0, participantIds: ["a"] }]), RangeError);
  assert.throws(() => allocateItems(0, [{ amountCents: 100, participantIds: ["a"] }]), RangeError);
});

test("10,000 random allocations sum to the total and stay within one cent", () => {
  const random = seeded(20261016);
  const int = (max: number) => Math.floor(random() * (max + 1));
  for (let run = 0; run < 10_000; run++) {
    const ids = [...new Set(Array.from({ length: 1 + int(9) }, () => int(0xffffffff).toString(16)))];
    const weights = ids.map(() => int(10_000));
    weights[int(ids.length - 1)] += 1;
    const total = int(2_000_000_000) - 1_000_000_000;

    const shares = allocate(total, weights, ids);
    assert.equal(sum(shares), total, `run ${run}`);

    const weightSum = BigInt(weights.reduce((a, b) => a + b, 0));
    ids.forEach((id, i) => {
      const gap = BigInt(shares.get(id)!) * weightSum - BigInt(total) * BigInt(weights[i]);
      assert.ok(gap < weightSum && -gap < weightSum, `run ${run} id ${id}`);
    });

    const order = ids.map((_, i) => i).reverse();
    const reordered = allocate(
      total,
      order.map((i) => weights[i]),
      order.map((i) => ids[i]),
    );
    assert.deepEqual(plain(reordered), plain(shares), `run ${run}`);
  }
});

test("random itemized expenses sum to the total and never go negative", () => {
  const random = seeded(16102026);
  const int = (max: number) => Math.floor(random() * (max + 1));
  const people = ["a", "b", "c", "d", "e", "f"];
  for (let run = 0; run < 2_000; run++) {
    const items: Item[] = Array.from({ length: 1 + int(5) }, () => ({
      amountCents: 1 + int(50_000),
      participantIds: people.filter(() => random() < 0.5).concat(people[int(5)]),
    })).map((item) => ({ ...item, participantIds: [...new Set(item.participantIds)] }));
    const itemsSum = items.reduce((a, item) => a + item.amountCents, 0);
    const total = 1 + int(2 * itemsSum - 1);

    const shares = allocateItems(total, items);
    assert.equal(sum(shares), total, `run ${run}`);
    for (const cents of shares.values()) {
      assert.ok(cents >= 0, `run ${run}`);
    }
  }
});
