export type PairBalance = {
  debtor_id: string;
  creditor_id: string;
  amount_cents: number;
};

export type GroupPairBalance = PairBalance & { group_id: string };

export type NetStatus = "receives" | "owes" | "settled";

export type Counterparty = {
  userId: string;
  netCents: number;
};

export type BalanceSummary = {
  owesCents: number;
  receivesCents: number;
  counterparties: Counterparty[];
};

export type GroupNet = {
  groupId: string;
  netCents: number;
};

export function netStatus(netCents: number): NetStatus {
  return netCents > 0 ? "receives" : netCents < 0 ? "owes" : "settled";
}

export function netWith(userId: string, pair: PairBalance): Counterparty | null {
  if (pair.creditor_id === userId) {
    return { userId: pair.debtor_id, netCents: pair.amount_cents };
  }
  if (pair.debtor_id === userId) {
    return { userId: pair.creditor_id, netCents: -pair.amount_cents };
  }
  return null;
}

export function summarizeFor(userId: string, pairs: readonly PairBalance[]): BalanceSummary {
  const nets = new Map<string, number>();
  for (const pair of pairs) {
    const other = netWith(userId, pair);
    if (other) {
      nets.set(other.userId, (nets.get(other.userId) ?? 0) + other.netCents);
    }
  }
  const counterparties = [...nets]
    .filter(([, netCents]) => netCents !== 0)
    .map(([id, netCents]) => ({ userId: id, netCents }))
    .sort((a, b) => Math.abs(b.netCents) - Math.abs(a.netCents) || a.userId.localeCompare(b.userId));
  return {
    owesCents: counterparties.reduce((sum, item) => sum + Math.max(0, -item.netCents), 0),
    receivesCents: counterparties.reduce((sum, item) => sum + Math.max(0, item.netCents), 0),
    counterparties,
  };
}

export function groupNetsFor(userId: string, pairs: readonly GroupPairBalance[]): Map<string, GroupNet[]> {
  const byPerson = new Map<string, GroupNet[]>();
  for (const pair of pairs) {
    const other = netWith(userId, pair);
    if (other && other.netCents !== 0) {
      const list = byPerson.get(other.userId) ?? [];
      list.push({ groupId: pair.group_id, netCents: other.netCents });
      byPerson.set(other.userId, list);
    }
  }
  return byPerson;
}
