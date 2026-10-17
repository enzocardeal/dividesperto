"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { setBalanceView } from "@/app/balances/actions";
import { ErrorToast } from "@/components/error-toast";
import { parseBalanceView, type BalanceView } from "@/lib/settlement/view";
import { strings } from "@/lib/strings";

const VIEWS: BalanceView[] = ["simplified", "full"];

function ViewButtons({ view }: { view: BalanceView }) {
  const { pending, data } = useFormStatus();
  const shown = pending ? parseBalanceView(data?.get("view")) : view;

  return (
    <>
      <div className="flex items-center gap-3">
        <span id="balance-view-label" className="text-sm font-medium text-neutral-600">
          {strings.balanceView.label}
        </span>
        <div
          role="group"
          aria-labelledby="balance-view-label"
          className="flex flex-1 rounded-lg border border-neutral-300 p-1"
        >
          {VIEWS.map((option) => (
            <button
              key={option}
              type="submit"
              name="view"
              value={option}
              aria-pressed={option === shown}
              disabled={pending}
              className={`min-h-11 flex-1 rounded-md text-sm font-medium disabled:opacity-60 ${
                option === shown ? "bg-neutral-900 text-white" : "text-neutral-700"
              }`}
            >
              {strings.balanceView[option]}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-neutral-500">{strings.balanceView.hints[shown]}</p>
    </>
  );
}

export function BalanceViewToggle({ view }: { view: BalanceView }) {
  const [state, action] = useActionState(setBalanceView, { error: null });

  return (
    <form action={action} className="flex flex-col gap-2">
      <ViewButtons view={view} />
      <ErrorToast state={state} />
    </form>
  );
}
