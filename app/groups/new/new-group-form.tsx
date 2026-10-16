"use client";

import { useActionState } from "react";
import { createGroup } from "@/app/groups/actions";
import { GROUP_NAME_MAX } from "@/lib/groups";
import { strings } from "@/lib/strings";

export function NewGroupForm() {
  const [state, action, pending] = useActionState(createGroup, { error: null });

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{strings.newGroup.name}</span>
        <input
          name="name"
          required
          maxLength={GROUP_NAME_MAX}
          autoComplete="off"
          placeholder={strings.newGroup.placeholder}
          className="min-h-11 rounded-lg border border-neutral-300 px-3"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-neutral-900 px-4 font-medium text-white disabled:opacity-60"
      >
        {pending ? strings.newGroup.creating : strings.newGroup.submit}
      </button>
    </form>
  );
}
