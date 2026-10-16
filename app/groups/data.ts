import { cache } from "react";
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
