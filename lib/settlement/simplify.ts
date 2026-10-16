export type MemberNet = {
  userId: string;
  netCents: number;
};

export type Transfer = {
  from: string;
  to: string;
  amountCents: number;
};

export const EXACT_LIMIT = 12;

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function settleGroup(people: readonly MemberNet[]): Transfer[] {
  const byAmount = (a: MemberNet, b: MemberNet) =>
    Math.abs(b.netCents) - Math.abs(a.netCents) || compareIds(a.userId, b.userId);
  const debtors = people.filter((p) => p.netCents < 0).map((p) => ({ ...p })).sort(byAmount);
  const creditors = people.filter((p) => p.netCents > 0).map((p) => ({ ...p })).sort(byAmount);

  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amountCents = Math.min(-debtors[d].netCents, creditors[c].netCents);
    transfers.push({ from: debtors[d].userId, to: creditors[c].userId, amountCents });
    debtors[d].netCents += amountCents;
    creditors[c].netCents -= amountCents;
    if (debtors[d].netCents === 0) {
      d++;
    }
    if (creditors[c].netCents === 0) {
      c++;
    }
  }
  return transfers;
}

function zeroSumGroups(people: readonly MemberNet[]): MemberNet[][] {
  const k = people.length;
  const full = (1 << k) - 1;
  const sums = new Array<number>(full + 1).fill(0);
  const best = new Array<number>(full + 1).fill(0);
  const choice = new Array<number>(full + 1).fill(0);

  for (let mask = 1; mask <= full; mask++) {
    const lowest = 31 - Math.clz32(mask & -mask);
    sums[mask] = sums[mask ^ (1 << lowest)] + people[lowest].netCents;
    let top = -1;
    for (let i = 0; i < k; i++) {
      if (mask & (1 << i) && best[mask ^ (1 << i)] > top) {
        top = best[mask ^ (1 << i)];
        choice[mask] = i;
      }
    }
    best[mask] = top + (sums[mask] === 0 ? 1 : 0);
  }

  const groups: MemberNet[][] = [];
  let current: MemberNet[] = [];
  let mask = full;
  while (mask !== 0) {
    const i = choice[mask];
    mask ^= 1 << i;
    current.push(people[i]);
    if (sums[mask] === 0) {
      groups.push(current);
      current = [];
    }
  }
  return groups;
}

export function simplify(nets: readonly MemberNet[]): Transfer[] {
  for (const { netCents } of nets) {
    if (!Number.isSafeInteger(netCents)) {
      throw new RangeError(`netCents must be a safe integer, got ${netCents}`);
    }
  }
  if (new Set(nets.map((n) => n.userId)).size !== nets.length) {
    throw new RangeError("user ids must be unique");
  }
  if (nets.reduce((sum, n) => sum + n.netCents, 0) !== 0) {
    throw new RangeError("nets must sum to zero");
  }

  const people = nets.filter((n) => n.netCents !== 0).sort((a, b) => compareIds(a.userId, b.userId));
  if (people.length === 0) {
    return [];
  }
  if (people.length > EXACT_LIMIT) {
    return settleGroup(people);
  }
  return zeroSumGroups(people).flatMap(settleGroup);
}
