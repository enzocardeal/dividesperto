import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUserId } from "@/app/groups/data";
import { BackLink } from "@/components/back-link";
import { BalanceViewToggle } from "@/components/balance-view-toggle";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeleton";
import { ViewerLine } from "@/components/viewer-line";
import { viewerGroupLines, viewerTotals } from "@/lib/balances";
import { formatBRL } from "@/lib/money/format";
import { strings } from "@/lib/strings";
import { getBalanceView, getPeople, getViewerLedgers } from "./data";

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

async function OverallBalances() {
  const me = await getCurrentUserId();
  if (!me) {
    return null;
  }
  const [ledgers, people, view] = await Promise.all([getViewerLedgers(), getPeople(), getBalanceView()]);
  const groups = viewerGroupLines(me, ledgers, view);
  const { owesCents, receivesCents } = viewerTotals(me, groups);
  const names = new Map(people.map((person) => [person.id, person.display_name]));
  const nameOf = (id: string) => names.get(id) ?? strings.activity.someone;

  return (
    <>
      <BalanceViewToggle view={view} />
      {groups.length === 0 ? (
        <EmptyState title={strings.overall.allSettled} />
      ) : (
        <>
          <p className="font-medium tabular-nums">
            <span className={owesCents > 0 ? "text-red-700" : ""}>
              {strings.overall.youOwe} {formatBRL(owesCents)}
            </span>
            {" · "}
            <span className={receivesCents > 0 ? "text-green-700" : ""}>
              {strings.overall.youReceive} {formatBRL(receivesCents)}
            </span>
          </p>
          {groups.map(({ lines, ...group }) => (
            <section key={group.groupId} className="flex flex-col gap-2">
              <Link
                href={`/groups/${group.groupId}/balances`}
                className="flex min-h-11 min-w-0 flex-col justify-center"
              >
                <h2 className="truncate text-lg font-semibold">{group.name}</h2>
                {group.archived && (
                  <span className="text-xs font-medium uppercase tracking-wide text-amber-700">
                    {strings.group.archivedBadge}
                  </span>
                )}
              </Link>
              <ul className="flex flex-col gap-2">
                {lines.map((line) => (
                  <ViewerLine
                    key={`${line.from}:${line.to}`}
                    line={{ ...group, ...line }}
                    me={me}
                    otherName={nameOf(line.from === me ? line.to : line.from)}
                    view={view}
                  />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </>
  );
}
