import { cookies } from "next/headers";
import { cache } from "react";
import type { Payment, Person } from "@/app/groups/data";
import type { GroupPairBalance, PairBalance } from "@/lib/balances";
import type { ExpenseDebt, LedgerPayment } from "@/lib/settlement/ledger";
import { BALANCE_VIEW_COOKIE, parseBalanceView, type BalanceView } from "@/lib/settlement/view";
import { createClient } from "@/lib/supabase/server";

export type GroupName = {
  id: string;
  name: string;
};

export type LedgerPaymentRow = Payment & LedgerPayment & { source: BalanceView | null };

export type GroupLedger = {
  version: number;
  debts: ExpenseDebt[];
  payments: LedgerPaymentRow[];
};

function involving(userId: string): string {
  return `debtor_id.eq.${userId},creditor_id.eq.${userId}`;
}

export const getOverallBalances = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("overall_pair_balances")
    .select("debtor_id, creditor_id, amount_cents")
    .or(involving(userId))
    .overrideTypes<PairBalance[], { merge: false }>();
  if (error) {
    throw error;
  }
  return data;
});

export const getGroupPairBalances = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_pair_balances")
    .select("group_id, debtor_id, creditor_id, amount_cents")
    .or(involving(userId))
    .overrideTypes<GroupPairBalance[], { merge: false }>();
  if (error) {
    throw error;
  }
  return data;
});

export const getGroupNames = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name")
    .overrideTypes<GroupName[], { merge: false }>();
  if (error) {
    throw error;
  }
  return data;
});

export const getPeople = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url")
    .overrideTypes<Person[], { merge: false }>();
  if (error) {
    throw error;
  }
  return data;
});

export const getBalanceView = cache(async (): Promise<BalanceView> => {
  return parseBalanceView((await cookies()).get(BALANCE_VIEW_COOKIE)?.value);
});

export const getGroupLedger = cache(async (groupId: string): Promise<GroupLedger> => {
  const supabase = await createClient();
  const version = await supabase
    .from("group_ledger_versions")
    .select("version")
    .eq("group_id", groupId)
    .maybeSingle()
    .overrideTypes<{ version: number }, { merge: false }>();
  if (version.error) {
    throw version.error;
  }
  const [debts, payments] = await Promise.all([
    supabase
      .from("group_expense_debts")
      .select("debtor_id, creditor_id, amount_cents")
      .eq("group_id", groupId)
      .overrideTypes<ExpenseDebt[], { merge: false }>(),
    supabase
      .from("payments")
      .select("id, from_user_id, to_user_id, amount_cents, paid_on, note, created_at, source")
      .eq("group_id", groupId)
      .is("deleted_at", null)
      .order("paid_on", { ascending: false })
      .order("created_at", { ascending: false })
      .overrideTypes<LedgerPaymentRow[], { merge: false }>(),
  ]);
  if (debts.error) {
    throw debts.error;
  }
  if (payments.error) {
    throw payments.error;
  }
  return { version: version.data?.version ?? 0, debts: debts.data, payments: payments.data };
});
