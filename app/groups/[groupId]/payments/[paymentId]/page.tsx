import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/skeleton";
import { formatBRL, formatDate } from "@/lib/money/format";
import { strings } from "@/lib/strings";
import { getGroup, getGroupPeople, getPayment } from "../../../data";
import { DeletePaymentButton } from "./delete-payment-button";

type PaymentParams = Pick<PageProps<"/groups/[groupId]/payments/[paymentId]">, "params">;

export default function PaymentPage({ params }: PaymentParams) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Payment params={params} />
    </Suspense>
  );
}

async function Payment({ params }: PaymentParams) {
  const { groupId, paymentId } = await params;
  const group = await getGroup(groupId);
  if (!group) {
    notFound();
  }
  const [payment, { members }] = await Promise.all([getPayment(group.id, paymentId), getGroupPeople(group.id)]);
  if (!payment) {
    notFound();
  }
  const names = new Map(members.map((person) => [person.id, person.display_name]));
  const nameOf = (id: string) => names.get(id) ?? strings.activity.someone;
  const facts = [
    [strings.payment.from, nameOf(payment.from_user_id)],
    [strings.payment.to, nameOf(payment.to_user_id)],
    [strings.payment.date, formatDate(payment.paid_on)],
    ...(payment.note ? [[strings.payment.note, payment.note]] : []),
  ];

  return (
    <>
      <section className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{strings.payment.title}</h2>
        <p className="text-3xl font-semibold tabular-nums">{formatBRL(payment.amount_cents)}</p>
      </section>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-neutral-500">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
      {group.archived_at !== null ? (
        <p className="text-sm text-neutral-600">{strings.group.archivedNote}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <Link
            href={`/groups/${group.id}/payments/${payment.id}/edit`}
            className="flex min-h-11 items-center justify-center rounded-lg bg-neutral-900 px-4 font-medium text-white"
          >
            {strings.payment.edit}
          </Link>
          <DeletePaymentButton groupId={group.id} paymentId={payment.id} />
        </div>
      )}
    </>
  );
}
