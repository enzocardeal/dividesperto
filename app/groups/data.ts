import { cache } from "react";
import type { SplitMethod } from "@/lib/expenses";
import { isUuid } from "@/lib/groups";
import { createClient } from "@/lib/supabase/server";

export type Group = {
  id: string;
  name: string;
  archived_at: string | null;
};

export type Person = {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
};

export type ExpenseSummary = {
  id: string;
  description: string;
  amount_cents: number;
  expense_date: string;
  payer_id: string;
  category: string | null;
};

export type ExpenseItem = {
  position: number;
  description: string;
  amount_cents: number;
  expense_item_participants: { user_id: string }[];
};

export type ExpenseDetail = ExpenseSummary & {
  split_method: SplitMethod;
  expense_splits: { user_id: string; amount_cents: number; weight: number | null }[];
  expense_items: ExpenseItem[];
};

export type MemberBalance = {
  user_id: string;
  net_cents: number;
};

export type Payment = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  amount_cents: number;
  paid_on: string;
  note: string | null;
};

export type ActivityRow = {
  id: number;
  actor_id: string;
  entity_type: string;
  action: string;
  before: unknown;
  after: unknown;
  created_at: string;
};

const ACTIVITY_LIMIT = 200;

export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
});

export const getGroup = cache(async (groupId: string): Promise<Group | null> => {
  if (!isUuid(groupId)) {
    return null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, archived_at")
    .eq("id", groupId)
    .maybeSingle()
    .overrideTypes<Group, { merge: false }>();
  if (error) {
    throw error;
  }
  return data;
});

export const getGroupPeople = cache(async (groupId: string) => {
  const supabase = await createClient();
  const [members, profiles] = await Promise.all([
    supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId)
      .order("created_at")
      .overrideTypes<{ user_id: string }[], { merge: false }>(),
    supabase
      .from("profiles")
      .select("id, display_name, email, avatar_url")
      .order("display_name")
      .overrideTypes<Person[], { merge: false }>(),
  ]);
  if (members.error) {
    throw members.error;
  }
  if (profiles.error) {
    throw profiles.error;
  }
  const byId = new Map(profiles.data.map((person) => [person.id, person]));
  const memberIds = new Set(members.data.map((member) => member.user_id));
  return {
    members: members.data.flatMap((member) => byId.get(member.user_id) ?? []),
    others: profiles.data.filter((person) => !memberIds.has(person.id)),
  };
});

export const getExpenses = cache(async (groupId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("id, description, amount_cents, expense_date, payer_id, category")
    .eq("group_id", groupId)
    .is("deleted_at", null)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .overrideTypes<ExpenseSummary[], { merge: false }>();
  if (error) {
    throw error;
  }
  return data;
});

export const getExpense = cache(async (groupId: string, expenseId: string): Promise<ExpenseDetail | null> => {
  if (!isUuid(expenseId)) {
    return null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select(
      "id, description, amount_cents, expense_date, payer_id, category, split_method, expense_splits(user_id, amount_cents, weight), expense_items(position, description, amount_cents, expense_item_participants(user_id))",
    )
    .eq("id", expenseId)
    .eq("group_id", groupId)
    .is("deleted_at", null)
    .order("position", { referencedTable: "expense_items" })
    .maybeSingle()
    .overrideTypes<ExpenseDetail, { merge: false }>();
  if (error) {
    throw error;
  }
  return data;
});

export const getMemberBalances = cache(async (groupId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_member_balances")
    .select("user_id, net_cents")
    .eq("group_id", groupId)
    .overrideTypes<MemberBalance[], { merge: false }>();
  if (error) {
    throw error;
  }
  return data;
});

export const getPayments = cache(async (groupId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, from_user_id, to_user_id, amount_cents, paid_on, note")
    .eq("group_id", groupId)
    .is("deleted_at", null)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false })
    .overrideTypes<Payment[], { merge: false }>();
  if (error) {
    throw error;
  }
  return data;
});

export const getPayment = cache(async (groupId: string, paymentId: string): Promise<Payment | null> => {
  if (!isUuid(paymentId)) {
    return null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, from_user_id, to_user_id, amount_cents, paid_on, note")
    .eq("id", paymentId)
    .eq("group_id", groupId)
    .is("deleted_at", null)
    .maybeSingle()
    .overrideTypes<Payment, { merge: false }>();
  if (error) {
    throw error;
  }
  return data;
});

export const getActivity = cache(async (groupId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, actor_id, entity_type, action, before, after, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(ACTIVITY_LIMIT)
    .overrideTypes<ActivityRow[], { merge: false }>();
  if (error) {
    throw error;
  }
  return data;
});
