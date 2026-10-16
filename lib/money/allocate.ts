const ZERO = BigInt(0);
const ONE = BigInt(1);

export type Item = {
  amountCents: number;
  participantIds: readonly string[];
};

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function allocate(
  totalCents: number,
  weights: readonly number[],
  ids: readonly string[],
): Map<string, number> {
  if (!Number.isSafeInteger(totalCents)) {
    throw new RangeError(`totalCents must be a safe integer, got ${totalCents}`);
  }
  if (ids.length === 0 || weights.length !== ids.length) {
    throw new RangeError("weights and ids must be non-empty and of the same length");
  }
  if (new Set(ids).size !== ids.length) {
    throw new RangeError("ids must be unique");
  }
  if (!weights.every((w) => Number.isSafeInteger(w) && w >= 0)) {
    throw new RangeError("weights must be non-negative safe integers");
  }

  const sign = totalCents < 0 ? -ONE : ONE;
  const total = BigInt(Math.abs(totalCents));
  const big = weights.map((w) => BigInt(w));
  const weightSum = big.reduce((sum, w) => sum + w, ZERO);
  if (weightSum === ZERO) {
    throw new RangeError("weights must sum to more than zero");
  }

  const amounts = big.map((w) => (total * w) / weightSum);
  const remainders = big.map((w) => (total * w) % weightSum);
  const leftover = Number(total - amounts.reduce((sum, a) => sum + a, ZERO));

  const order = ids
    .map((_, i) => i)
    .sort((a, b) => {
      if (remainders[a] !== remainders[b]) {
        return remainders[a] > remainders[b] ? -1 : 1;
      }
      return compareIds(ids[a], ids[b]);
    });
  for (const i of order.slice(0, leftover)) {
    amounts[i] += ONE;
  }

  return new Map(ids.map((id, i) => [id, Number(sign * amounts[i])]));
}

export function allocateItems(totalCents: number, items: readonly Item[]): Map<string, number> {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new RangeError(`totalCents must be a positive safe integer, got ${totalCents}`);
  }
  if (items.length === 0) {
    throw new RangeError("an itemized expense needs at least one item");
  }

  const subtotals = new Map<string, number>();
  for (const item of items) {
    if (!Number.isSafeInteger(item.amountCents) || item.amountCents <= 0) {
      throw new RangeError(`item amount must be a positive safe integer, got ${item.amountCents}`);
    }
    if (item.participantIds.length === 0) {
      throw new RangeError("every item needs at least one participant");
    }
    const shares = allocate(item.amountCents, item.participantIds.map(() => 1), item.participantIds);
    for (const [id, cents] of shares) {
      subtotals.set(id, (subtotals.get(id) ?? 0) + cents);
    }
  }

  const itemsSum = items.reduce((sum, item) => sum + item.amountCents, 0);
  const extras = totalCents - itemsSum;
  if (extras === 0) {
    return subtotals;
  }

  const weighted = [...subtotals].filter(([, cents]) => cents > 0);
  const extraShares = allocate(
    extras,
    weighted.map(([, cents]) => cents),
    weighted.map(([id]) => id),
  );
  return new Map(
    [...subtotals].map(([id, cents]) => [id, cents + (extraShares.get(id) ?? 0)]),
  );
}
