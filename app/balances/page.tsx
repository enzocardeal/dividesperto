import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUserId } from "@/app/groups/data";
import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeleton";
import { groupNetsFor, summarizeFor } from "@/lib/balances";
import { formatBRL } from "@/lib/money/format";
import { strings } from "@/lib/strings";
import { getGroupNames, getGroupPairBalances, getOverallBalances, getPeople } from "./data";

export default function OverallBalancesPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <div className="flex items-center gap-1">
        <BackLink href="/" />
        <h1 className="text-xl font-semibold">{strings.overall.title}</h1>
      </div>
      <p className="text-sm text-neutral-600">{strings.overall.intro}</p>
      <Suspense fallback={<ListSkeleton />}>
        <OverallBalances />
      </Suspense>
    </main>
  );
}

function netText(netCents: number): string {
  return netCents < 0
    ? `${strings.overall.youOwe} ${formatBRL(-netCents)}`
    : `${strings.overall.owesYou} ${formatBRL(netCents)}`;
}

function netClass(netCents: number): string {
  return netCents < 0 ? "text-red-700" : "text-green-700";
}

async function OverallBalances() {
  const me = await getCurrentUserId();
  if (!me) {
    return null;
  }
  const [overall, groupPairs, groups, people] = await Promise.all([
    getOverallBalances(me),
    getGroupPairBalances(me),
    getGroupNames(),
    getPeople(),
  ]);
  const { counterparties } = summarizeFor(me, overall);
  if (counterparties.length === 0) {
    return <EmptyState title={strings.overall.allSettled} />;
  }
  const byGroup = groupNetsFor(me, groupPairs);
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const persons = new Map(people.map((person) => [person.id, person]));

  return (
    <ul className="flex flex-col divide-y divide-neutral-100">
      {counterparties.map(({ userId, netCents }) => {
        const person = persons.get(userId);
        const name = person?.display_name ?? strings.activity.someone;
        const lines = (byGroup.get(userId) ?? [])
          .map((line) => ({ ...line, name: groupNames.get(line.groupId) ?? "" }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        return (
          <li key={userId} className="flex gap-3 py-3">
            <Avatar name={name} url={person?.avatar_url ?? null} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-medium">{name}</span>
                <span className={`shrink-0 font-medium tabular-nums ${netClass(netCents)}`}>{netText(netCents)}</span>
              </div>
              <ul className="flex flex-col text-sm text-neutral-600">
                {lines.map((line) => (
                  <li key={line.groupId}>
                    <Link
                      href={`/groups/${line.groupId}/balances`}
                      className="flex min-h-11 items-center justify-between gap-3"
                    >
                      <span className="truncate">{line.name}</span>
                      <span className="shrink-0 tabular-nums">{netText(line.netCents)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
