import { notFound } from "next/navigation";
import { Suspense } from "react";
import { todayInSaoPaulo } from "@/lib/money/format";
import { strings } from "@/lib/strings";
import { getCurrentUserId, getGroup, getGroupPeople } from "../../../data";
import { PaymentForm } from "../payment-form";

export default function NewPaymentPage({ params }: PageProps<"/groups/[groupId]/payments/new">) {
  return (
    <Suspense>
      <NewPayment params={params} />
    </Suspense>
  );
}

async function NewPayment({ params }: Pick<PageProps<"/groups/[groupId]/payments/new">, "params">) {
  const group = await getGroup((await params).groupId);
  if (!group) {
    notFound();
  }
  const [{ members }, me] = await Promise.all([getGroupPeople(group.id), getCurrentUserId()]);

  return (
    <>
      <h2 className="text-xl font-semibold">{strings.paymentForm.newTitle}</h2>
      {group.archived_at !== null ? (
        <p className="text-sm text-neutral-600">{strings.group.archivedNote}</p>
      ) : (
        <PaymentForm groupId={group.id} people={members} currentUserId={me} today={todayInSaoPaulo(new Date())} />
      )}
    </>
  );
}
