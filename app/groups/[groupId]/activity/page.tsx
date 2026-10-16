import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { describeActivity } from "@/lib/activity";
import { formatDateTime } from "@/lib/money/format";
import { strings } from "@/lib/strings";
import { getActivity, getGroup, getGroupPeople } from "../../data";

export default function ActivityPage({ params }: PageProps<"/groups/[groupId]/activity">) {
  return (
    <Suspense>
      <Activity params={params} />
    </Suspense>
  );
}

async function Activity({ params }: Pick<PageProps<"/groups/[groupId]/activity">, "params">) {
  const group = await getGroup((await params).groupId);
  if (!group) {
    notFound();
  }
  const [entries, { members, others }] = await Promise.all([getActivity(group.id), getGroupPeople(group.id)]);
  const people = new Map([...members, ...others].map((person) => [person.id, person]));
  const nameOf = (id: string) => people.get(id)?.display_name ?? strings.activity.someone;

  if (entries.length === 0) {
    return <p className="text-neutral-500">{strings.activity.empty}</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-neutral-100">
      {entries.map((entry) => {
        const view = describeActivity(entry, nameOf);
        return (
          <li key={entry.id} className="flex gap-3 py-3">
            <Avatar name={nameOf(entry.actor_id)} url={people.get(entry.actor_id)?.avatar_url ?? null} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="break-words">{view.title}</p>
              {view.details.length > 0 && (
                <ul className="flex flex-col text-sm text-neutral-600">
                  {view.details.map((detail, index) => (
                    <li key={index} className="break-words">
                      {detail}
                    </li>
                  ))}
                </ul>
              )}
              <time dateTime={entry.created_at} className="text-xs text-neutral-500">
                {formatDateTime(entry.created_at)}
              </time>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
