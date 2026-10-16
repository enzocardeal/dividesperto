"use client";

import { useActionState } from "react";
import { settleTransfer } from "@/app/groups/actions";
import { strings } from "@/lib/strings";

type SettleButtonProps = {
  groupId: string;
  fromId: string;
  toId: string;
  amountCents: number;
  expectedNetCents: number;
};

export function SettleButton({ groupId, fromId, toId, amountCents, expectedNetCents }: SettleButtonProps) {
  const [state, action, pending] = useActionState(settleTransfer, { error: null });

  return (
    <form action={action} className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="fromId" value={fromId} />
      <input type="hidden" name="toId" value={toId} />
      <input type="hidden" name="amountCents" value={amountCents} />
      <input type="hidden" name="expectedNetCents" value={expectedNetCents} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg border border-neutral-300 px-4 text-sm font-medium disabled:opacity-60"
      >
        {pending ? strings.settlement.marking : strings.settlement.markPaid}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
