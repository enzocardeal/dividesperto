import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeleton";
import { strings } from "@/lib/strings";
import { getCurrentUserId, getGroup, getGroupPeople, type Person } from "../../data";
import { AddMemberButton } from "./add-member-button";

export default function MembersPage({ params }: PageProps<"/groups/[groupId]/members">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Members params={params} />
    </Suspense>
  );
}

async function Members({ params }: Pick<PageProps<"/groups/[groupId]/members">, "params">) {
  const group = await getGroup((await params).groupId);
  if (!group) {
    notFound();
  }
  const [{ members, others }, me] = await Promise.all([getGroupPeople(group.id), getCurrentUserId()]);

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{strings.members.current}</h2>
        <ul className="flex flex-col divide-y divide-neutral-100">
          {members.map((person) => (
            <PersonRow key={person.id} person={person} isMe={person.id === me} />
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{strings.members.add}</h2>
        {group.archived_at !== null ? (
          <p className="text-sm text-neutral-600">{strings.group.archivedNote}</p>
        ) : others.length === 0 ? (
          <EmptyState title={strings.members.nobodyLeft} hint={strings.members.nobodyLeftHint} />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {others.map((person) => (
              <PersonRow key={person.id} person={person}>
                <AddMemberButton groupId={group.id} userId={person.id} />
              </PersonRow>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function PersonRow({ person, isMe, children }: { person: Person; isMe?: boolean; children?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <Avatar name={person.display_name} url={person.avatar_url} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">
          {person.display_name} {isMe && <span className="text-neutral-500">{strings.members.you}</span>}
        </span>
        <span className="truncate text-sm text-neutral-500">{person.email}</span>
      </div>
      {children}
    </li>
  );
}
