import { cache } from "react";
import type { Person } from "@/app/groups/data";
import type { GroupPairBalance, PairBalance } from "@/lib/balances";
import { createClient } from "@/lib/supabase/server";

export type GroupName = {
  id: string;
  name: string;
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
