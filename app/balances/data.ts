import { cookies } from "next/headers";
import { cache } from "react";
import type { Payment, Person } from "@/app/groups/data";
import type { GroupLedgerRows, GroupPairBalance, PairBalance } from "@/lib/balances";
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

type GroupRow = {
  id: string;
  name: string;
  archived_at: string | null;
};

type InGroup<T> = T & { group_id: string };

const PAGE_SIZE = 1000;

async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) {
      return rows;
    }
  }
}

function byGroup<T extends { group_id: string }>(rows: readonly T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const list = groups.get(row.group_id) ?? [];
    list.push(row);
    groups.set(row.group_id, list);
  }
  return groups;
}

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

export const getViewerLedgers = cache(async (): Promise<GroupLedgerRows[]> => {
  const supabase = await createClient();
  const versions = await supabase
    .from("group_ledger_versions")
    .select("group_id, version")
    .overrideTypes<InGroup<{ version: number }>[], { merge: false }>();
  if (versions.error) {
    throw versions.error;
  }
  const [groups, members, debts, payments] = await Promise.all([
    supabase.from("groups").select("id, name, archived_at").overrideTypes<GroupRow[], { merge: false }>(),
    readAll((from, to) =>
      supabase
        .from("group_members")
        .select("group_id, user_id")
        .order("group_id")
        .order("user_id")
        .range(from, to)
        .overrideTypes<InGroup<{ user_id: string }>[], { merge: false }>(),
    ),
    readAll((from, to) =>
      supabase
        .from("group_expense_debts")
        .select("group_id, debtor_id, creditor_id, amount_cents")
        .order("group_id")
        .order("debtor_id")
        .order("creditor_id")
        .range(from, to)
        .overrideTypes<InGroup<ExpenseDebt>[], { merge: false }>(),
    ),
    readAll((from, to) =>
      supabase
        .from("payments")
        .select("group_id, id, from_user_id, to_user_id, amount_cents, paid_on, created_at")
        .is("deleted_at", null)
        .order("id")
        .range(from, to)
        .overrideTypes<InGroup<LedgerPayment>[], { merge: false }>(),
    ),
  ]);
  if (groups.error) {
    throw groups.error;
  }
  const version = new Map(versions.data.map((row) => [row.group_id, row.version]));
  const membersOf = byGroup(members);
  const debtsOf = byGroup(debts);
  const paymentsOf = byGroup(payments);
  return groups.data.map((group) => ({
    id: group.id,
    name: group.name,
    archived: group.archived_at !== null,
    version: version.get(group.id) ?? 0,
    memberIds: (membersOf.get(group.id) ?? []).map((member) => member.user_id),
    debts: debtsOf.get(group.id) ?? [],
    payments: paymentsOf.get(group.id) ?? [],
  }));
});
