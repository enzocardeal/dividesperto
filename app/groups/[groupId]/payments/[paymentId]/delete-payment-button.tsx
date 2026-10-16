"use client";

import { useActionState } from "react";
import { deletePayment } from "@/app/groups/actions";
import { strings } from "@/lib/strings";

type DeletePaymentButtonProps = {
  groupId: string;
  paymentId: string;
};

export function DeletePaymentButton({ groupId, paymentId }: DeletePaymentButtonProps) {
  const [state, action, pending] = useActionState(deletePayment, { error: null });

  return (
    <details className="flex flex-col">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-lg border border-red-200 px-4 font-medium text-red-700 [&::-webkit-details-marker]:hidden">
        {strings.payment.delete}
      </summary>
      <form action={action} className="mt-2 flex flex-col gap-3 rounded-lg border border-red-200 p-4">
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="paymentId" value={paymentId} />
        <p className="text-sm">{strings.payment.deleteConfirm}</p>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg bg-red-700 px-4 font-medium text-white disabled:opacity-60"
        >
          {pending ? strings.payment.deleting : strings.payment.deleteYes}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-red-700">
            {state.error}
          </p>
        )}
      </form>
    </details>
  );
}
