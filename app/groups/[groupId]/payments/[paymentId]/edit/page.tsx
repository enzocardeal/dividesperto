import { notFound } from "next/navigation";
import { Suspense } from "react";
import { todayInSaoPaulo } from "@/lib/money/format";
import { strings } from "@/lib/strings";
import { getCurrentUserId, getGroup, getGroupPeople, getPayment } from "../../../../data";
import { PaymentForm } from "../../payment-form";

type EditParams = Pick<PageProps<"/groups/[groupId]/payments/[paymentId]/edit">, "params">;

export default function EditPaymentPage({ params }: EditParams) {
  return (
    <Suspense>
      <EditPayment params={params} />
    </Suspense>
  );
}

async function EditPayment({ params }: EditParams) {
  const { groupId, paymentId } = await params;
  const group = await getGroup(groupId);
  if (!group) {
    notFound();
  }
  const [payment, { members }, me] = await Promise.all([
    getPayment(group.id, paymentId),
    getGroupPeople(group.id),
    getCurrentUserId(),
  ]);
  if (!payment) {
    notFound();
  }

  return (
    <>
      <h2 className="text-xl font-semibold">{strings.paymentForm.editTitle}</h2>
      {group.archived_at !== null ? (
        <p className="text-sm text-neutral-600">{strings.group.archivedNote}</p>
      ) : (
        <PaymentForm
          groupId={group.id}
          people={members}
          currentUserId={me}
          today={todayInSaoPaulo(new Date())}
          payment={{
            id: payment.id,
            fromId: payment.from_user_id,
            toId: payment.to_user_id,
            amountCents: payment.amount_cents,
            date: payment.paid_on,
            note: payment.note,
          }}
        />
      )}
    </>
  );
}
