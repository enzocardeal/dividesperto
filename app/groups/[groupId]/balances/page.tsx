import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeleton";
import { netStatus, type NetStatus } from "@/lib/balances";
import { formatBRL, formatDate } from "@/lib/money/format";
import { simplify } from "@/lib/settlement/simplify";
import { strings } from "@/lib/strings";
import { getCurrentUserId, getGroup, getGroupPeople, getMemberBalances, getPayments } from "../../data";
import { SettleButton } from "./settle-button";

const STATUS_CLASS: Record<NetStatus, string> = {
  receives: "text-green-700",
  owes: "text-red-700",
  settled: "text-neutral-500",
};

export default function BalancesPage({ params }: PageProps<"/groups/[groupId]/balances">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Balances params={params} />
    </Suspense>
  );
}

function netText(netCents: number): string {
  const status = netStatus(netCents);
  return status === "settled" ? strings.balances.settled : `${strings.balances[status]} ${formatBRL(Math.abs(netCents))}`;
}

async function Balances({ params }: Pick<PageProps<"/groups/[groupId]/balances">, "params">) {
  const group = await getGroup((await params).groupId);
  if (!group) {
    notFound();
  }
  const [balances, payments, { members }, me] = await Promise.all([
    getMemberBalances(group.id),
    getPayments(group.id),
    getGroupPeople(group.id),
    getCurrentUserId(),
  ]);
  const nets = new Map(balances.map((balance) => [balance.user_id, balance.net_cents]));
  const names = new Map(members.map((person) => [person.id, person.display_name]));
  const nameOf = (id: string) => names.get(id) ?? strings.activity.someone;
  const archived = group.archived_at !== null;
  const transfers = simplify(balances.map((balance) => ({ userId: balance.user_id, netCents: balance.net_cents })));

  return (
    <>
      {archived && <p className="text-sm text-neutral-600">{strings.group.archivedNote}</p>}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{strings.balances.title}</h2>
        <ul className="flex flex-col divide-y divide-neutral-100">
          {members.map((person) => {
            const net = nets.get(person.id) ?? 0;
            return (
              <li key={person.id} className="flex min-h-11 items-center gap-3 py-2">
                <Avatar name={person.display_name} url={person.avatar_url} />
                <span className="min-w-0 flex-1 truncate">
                  {person.display_name}{" "}
                  {person.id === me && <span className="text-neutral-500">{strings.members.you}</span>}
                </span>
                <span className={`shrink-0 font-medium tabular-nums ${STATUS_CLASS[netStatus(net)]}`}>
                  {netText(net)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{strings.settlement.title}</h2>
        {transfers.length === 0 ? (
          <EmptyState title={strings.settlement.allSettled} />
        ) : (
          <ul className="flex flex-col gap-2">
            {transfers.map((transfer) => (
              <li
                key={`${transfer.from}:${transfer.to}`}
                className="flex flex-col gap-2 rounded-lg border border-neutral-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  <span className="font-medium">{nameOf(transfer.from)}</span> {strings.settlement.pays}{" "}
                  <span className="font-medium tabular-nums">{formatBRL(transfer.amountCents)}</span>{" "}
                  {strings.settlement.to} <span className="font-medium">{nameOf(transfer.to)}</span>
                </span>
                {!archived && (
                  <SettleButton
                    groupId={group.id}
                    fromId={transfer.from}
                    toId={transfer.to}
                    amountCents={transfer.amountCents}
                    expectedNetCents={nets.get(transfer.from) ?? 0}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{strings.balances.payments}</h2>
        {payments.length === 0 ? (
          <EmptyState
            title={strings.balances.noPayments}
            hint={archived ? undefined : strings.balances.noPaymentsHint}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {payments.map((payment) => (
              <li key={payment.id}>
                <Link
                  href={`/groups/${group.id}/payments/${payment.id}`}
                  className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-neutral-200 px-4 py-3"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">
                      {nameOf(payment.from_user_id)} {strings.balances.paidTo} {nameOf(payment.to_user_id)}
                    </span>
                    <span className="truncate text-sm text-neutral-500">
                      {formatDate(payment.paid_on)}
                      {payment.note && ` · ${payment.note}`}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{formatBRL(payment.amount_cents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {!archived && (
        <Link
          href={`/groups/${group.id}/payments/new`}
          className="sticky bottom-(--above-bottom-nav) mt-auto flex min-h-11 items-center self-end rounded-full bg-neutral-900 px-5 font-medium text-white shadow-lg"
        >
          {strings.balances.newPayment}
        </Link>
      )}
    </>
  );
}
