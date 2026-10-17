import {
  addDebt,
  cancelCycles,
  compareIds,
  compressSettled,
  createGraph,
  maxFlowReduce,
  type DebtGraph,
} from "./graph.ts";

export const COMPRESS_SETTLED = true;

export type ExpenseDebt = {
  debtor_id: string;
  creditor_id: string;
  amount_cents: number;
};

export type LedgerPayment = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  amount_cents: number;
  paid_on: string;
  created_at: string;
};

export type LedgerOptions = {
  compress?: boolean;
};

function paymentOrder(a: LedgerPayment, b: LedgerPayment): number {
  return (
    compareIds(a.paid_on, b.paid_on) ||
    Date.parse(a.created_at) - Date.parse(b.created_at) ||
    compareIds(a.id, b.id)
  );
}

export function payDebt(
  g: DebtGraph,
  fromId: string,
  toId: string,
  amountCents: number,
  compress: boolean = COMPRESS_SETTLED,
): number {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new RangeError(`payment must be a positive safe integer, got ${amountCents}`);
  }
  const absorbed = maxFlowReduce(g, fromId, toId, amountCents);
  if (absorbed < amountCents) {
    addDebt(g, toId, fromId, amountCents - absorbed);
  }
  if (compress) {
    compressSettled(g);
  }
  return absorbed;
}

export function expenseGraph(
  memberIds: Iterable<string>,
  debts: readonly ExpenseDebt[],
  { compress = COMPRESS_SETTLED }: LedgerOptions = {},
): DebtGraph {
  const g = createGraph([...memberIds, ...debts.flatMap((d) => [d.debtor_id, d.creditor_id])]);
  for (const debt of debts) {
    if (!Number.isSafeInteger(debt.amount_cents) || debt.amount_cents <= 0) {
      throw new RangeError(`debt must be a positive safe integer, got ${debt.amount_cents}`);
    }
    addDebt(g, debt.debtor_id, debt.creditor_id, debt.amount_cents);
  }
  cancelCycles(g);
  if (compress) {
    compressSettled(g);
  }
  return g;
}

export function replayLedger(
  memberIds: Iterable<string>,
  debts: readonly ExpenseDebt[],
  payments: readonly LedgerPayment[],
  { compress = COMPRESS_SETTLED }: LedgerOptions = {},
): DebtGraph {
  const people = [...memberIds, ...payments.flatMap((p) => [p.from_user_id, p.to_user_id])];
  const g = expenseGraph(people, debts, { compress });
  for (const payment of [...payments].sort(paymentOrder)) {
    payDebt(g, payment.from_user_id, payment.to_user_id, payment.amount_cents, compress);
  }
  return g;
}
