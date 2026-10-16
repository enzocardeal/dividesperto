"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { setGroupArchived } from "@/app/groups/actions";
import { strings } from "@/lib/strings";

type GroupMenuProps = {
  groupId: string;
  archived: boolean;
};

const ITEM = "flex min-h-11 w-full items-center px-4 text-left disabled:opacity-60";

export function GroupMenu({ groupId, archived }: GroupMenuProps) {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => menu.current?.removeAttribute("open");
  const [state, action, pending] = useActionState(setGroupArchived, { error: null });

  useEffect(() => {
    if (state.error === null) {
      menu.current?.removeAttribute("open");
    }
  }, [state]);

  return (
    <details ref={menu} className="relative">
      <summary
        aria-label={strings.group.menu}
        className="flex size-11 cursor-pointer list-none items-center justify-center rounded-lg text-2xl [&::-webkit-details-marker]:hidden"
      >
        ⋯
      </summary>
      <div className="absolute right-0 z-10 mt-1 flex w-56 flex-col rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
        <Link href={`/groups/${groupId}/members`} onClick={close} className={ITEM}>
          {strings.group.members}
        </Link>
        <form action={action}>
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="archived" value={String(!archived)} />
          <button type="submit" disabled={pending} className={ITEM}>
            {archived ? strings.group.unarchive : strings.group.archive}
          </button>
        </form>
        {state.error && (
          <p role="alert" className="px-4 pb-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
      </div>
    </details>
  );
}
