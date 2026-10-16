"use client";

import { useActionState } from "react";
import { deleteExpense } from "@/app/groups/actions";
import { strings } from "@/lib/strings";

type DeleteExpenseButtonProps = {
  groupId: string;
  expenseId: string;
};

export function DeleteExpenseButton({ groupId, expenseId }: DeleteExpenseButtonProps) {
  const [state, action, pending] = useActionState(deleteExpense, { error: null });

  return (
    <details className="flex flex-col">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-lg border border-red-200 px-4 font-medium text-red-700 [&::-webkit-details-marker]:hidden">
        {strings.expense.delete}
      </summary>
      <form action={action} className="mt-2 flex flex-col gap-3 rounded-lg border border-red-200 p-4">
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="expenseId" value={expenseId} />
        <p className="text-sm">{strings.expense.deleteConfirm}</p>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg bg-red-700 px-4 font-medium text-white disabled:opacity-60"
        >
          {pending ? strings.expense.deleting : strings.expense.deleteYes}
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
