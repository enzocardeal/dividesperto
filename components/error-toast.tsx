"use client";

import { useEffect, useState } from "react";
import { strings } from "@/lib/strings";

type ToastState = { error: string | null };

const VISIBLE_MS = 6000;

export function ErrorToast({ state }: { state: ToastState }) {
  const [dismissed, setDismissed] = useState<ToastState | null>(null);

  useEffect(() => {
    if (state.error === null) {
      return;
    }
    const timer = setTimeout(() => setDismissed(state), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [state]);

  if (state.error === null || dismissed === state) {
    return null;
  }

  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-(--above-bottom-nav) z-50 mx-auto flex max-w-md items-center gap-2 rounded-lg bg-red-700 py-1 pr-1 pl-4 text-sm text-white shadow-lg"
    >
      <p className="flex-1 py-2">{state.error}</p>
      <button
        type="button"
        aria-label={strings.toast.close}
        onClick={() => setDismissed(state)}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-lg"
      >
        ✕
      </button>
    </div>
  );
}
