import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { memberCountLabel } from "@/lib/groups";
import { strings } from "@/lib/strings";
import { createClient } from "@/lib/supabase/server";

type GroupSummary = {
  id: string;
  name: string;
  archived_at: string | null;
  group_members: { count: number }[];
};

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-6">
      <h1 className="text-3xl font-semibold">{strings.app.name}</h1>
      <Suspense>
        <Account />
      </Suspense>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{strings.home.groups}</h2>
          <Link
            href="/groups/new"
            className="flex min-h-11 items-center rounded-lg bg-neutral-900 px-4 font-medium text-white"
          >
            {strings.home.newGroup}
          </Link>
        </div>
        <Suspense>
          <Groups />
        </Suspense>
      </section>
    </main>
  );
}

async function Account() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) {
    return null;
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  return (
    <form action={signOut} className="flex items-center justify-between gap-4">
      <p className="text-neutral-700">
        {strings.home.greeting} {profile?.display_name ?? data?.claims.email}
      </p>
      <button
        type="submit"
        className="min-h-11 rounded-lg border border-neutral-300 px-4 font-medium"
      >
        {strings.home.logout}
      </button>
    </form>
  );
}

async function Groups() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, archived_at, group_members(count)")
    .order("created_at", { ascending: false })
    .overrideTypes<GroupSummary[], { merge: false }>();
  if (error) {
    throw error;
  }
  const active = data.filter((group) => group.archived_at === null);
  const archived = data.filter((group) => group.archived_at !== null);

  return (
    <>
      {data.length === 0 && <p className="text-neutral-500">{strings.home.empty}</p>}
      {active.length > 0 && <GroupList groups={active} />}
      {archived.length > 0 && (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-neutral-600">
            {strings.home.archived} ({archived.length})
          </summary>
          <GroupList groups={archived} />
        </details>
      )}
    </>
  );
}

function GroupList({ groups }: { groups: GroupSummary[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {groups.map((group) => (
        <li key={group.id}>
          <Link
            href={`/groups/${group.id}`}
            className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-neutral-200 px-4 py-3"
          >
            <span className="truncate font-medium">{group.name}</span>
            <span className="shrink-0 text-sm text-neutral-500">
              {memberCountLabel(group.group_members[0]?.count ?? 0)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
