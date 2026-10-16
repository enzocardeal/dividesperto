"use client";

import { useLayoutEffect, useRef, useState, type ChangeEvent, type ComponentProps } from "react";
import { centsToBRLInput, editBRLInput } from "@/lib/money/input";
import { parseBRL } from "@/lib/money/parse";
import { strings } from "@/lib/strings";

type MoneyInputProps = Omit<
  ComponentProps<"input">,
  "ref" | "type" | "inputMode" | "value" | "defaultValue" | "onChange"
> & {
  defaultCents?: number;
  onCentsChange?: (cents: number | null) => void;
};

export function MoneyInput({ defaultCents, onCentsChange, className, ...props }: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState(() => ({
    text: defaultCents === undefined ? "" : centsToBRLInput(defaultCents),
    caret: null as number | null,
  }));

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (state.caret === null || input === null || document.activeElement !== input) {
      return;
    }
    input.setSelectionRange(state.caret, state.caret);
  }, [state]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const native = event.nativeEvent as InputEvent;
    const next = editBRLInput(state.text, {
      value: input.value,
      caret: input.selectionStart ?? input.value.length,
      data: native.data ?? null,
      inputType: native.inputType ?? "",
    });
    setState(next);
    if (next.text !== state.text) {
      onCentsChange?.(parseBRL(next.text));
    }
  }

  return (
    <div
      className={`flex h-11 items-center gap-2 rounded-lg border border-neutral-300 px-3 focus-within:border-neutral-900 ${className ?? ""}`}
    >
      <span aria-hidden="true" className="text-neutral-500">
        {strings.money.symbol}
      </span>
      <input
        placeholder={strings.money.placeholder}
        autoComplete="off"
        {...props}
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={state.text}
        onChange={handleChange}
        className="h-full w-full min-w-0 bg-transparent text-base tabular-nums outline-none"
      />
    </div>
  );
}
