import type { MemberNet } from "./simplify.ts";

export function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function bruteForceMinimum(input: readonly MemberNet[]): number {
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
