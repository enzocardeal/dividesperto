import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { memberCountLabel } from "@/lib/groups";
import { strings } from "@/lib/strings";
import { getGroup, getGroupPeople } from "../data";
import { GroupMenu } from "./group-menu";
import { GroupTabs } from "./group-tabs";

export default function GroupLayout({ children, params }: LayoutProps<"/groups/[groupId]">) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <Suspense>
        <GroupHeader params={params} />
      </Suspense>
      <main className="flex flex-1 flex-col gap-6 px-4 py-6">{children}</main>
    </div>
  );
}

async function GroupHeader({ params }: Pick<LayoutProps<"/groups/[groupId]">, "params">) {
  const group = await getGroup((await params).groupId);
  if (!group) {
    notFound();
  }
  const { members } = await getGroupPeople(group.id);
  const archived = group.archived_at !== null;

  return (
    <header className="flex flex-col gap-3 border-b border-neutral-200 px-4 pt-3">
      <div className="flex items-center gap-1">
        <Link
          href="/"
          aria-label={strings.group.back}
          className="-ml-3 flex size-11 shrink-0 items-center justify-center text-xl"
        >
          ←
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-xl font-semibold">{group.name}</h1>
          {archived && (
            <span className="text-xs font-medium uppercase tracking-wide text-amber-700">
              {strings.group.archivedBadge}
            </span>
          )}
        </div>
        <GroupMenu groupId={group.id} archived={archived} />
      </div>
      <Link href={`/groups/${group.id}/members`} className="flex min-h-11 items-center gap-3">
        <span className="flex -space-x-2">
          {members.map((person) => (
            <Avatar key={person.id} name={person.display_name} url={person.avatar_url} />
          ))}
        </span>
        <span className="text-sm text-neutral-600">{memberCountLabel(members.length)}</span>
      </Link>
      <GroupTabs groupId={group.id} />
    </header>
  );
}
