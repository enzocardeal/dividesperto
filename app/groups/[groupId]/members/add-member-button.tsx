"use client";

import { useActionState } from "react";
import { addGroupMember } from "@/app/groups/actions";
import { strings } from "@/lib/strings";

type AddMemberButtonProps = {
  groupId: string;
  userId: string;
};

export function AddMemberButton({ groupId, userId }: AddMemberButtonProps) {
  const [state, action, pending] = useActionState(addGroupMember, { error: null });

  return (
    <form action={action} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg border border-neutral-300 px-4 text-sm font-medium disabled:opacity-60"
      >
        {pending ? strings.members.adding : strings.members.addButton}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
