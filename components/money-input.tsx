"use client";

import { useLayoutEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type ComponentProps } from "react";
import { centsToBRLInput, editBRLInput, pasteBRLInput } from "@/lib/money/input";
import { parseBRL } from "@/lib/money/parse";
import { strings } from "@/lib/strings";

type MoneyInputProps = Omit<
  ComponentProps<"input">,
  "ref" | "type" | "inputMode" | "value" | "defaultValue" | "onChange" | "onPaste"
> & {
  defaultCents?: number;
  onCentsChange?: (cents: number | null) => void;
};

export function MoneyInput({ defaultCents, onCentsChange, className, ...props }: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState(() => ({
    text: defaultCents === undefined ? "" : centsToBRLInput(defaultCents),
  }));

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input === null || document.activeElement !== input) {
      return;
    }
    input.setSelectionRange(state.text.length, state.text.length);
  }, [state]);

  function update(text: string) {
    setState({ text });
    if (text !== state.text) {
      onCentsChange?.(parseBRL(text));
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const native = event.nativeEvent as InputEvent;
    update(editBRLInput(state.text, { value: event.currentTarget.value, inputType: native.inputType ?? "" }));
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    update(pasteBRLInput(state.text, event.clipboardData.getData("text")));
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
        inputMode="numeric"
        value={state.text}
        onChange={handleChange}
        onPaste={handlePaste}
        className="h-full w-full min-w-0 bg-transparent text-base tabular-nums outline-none"
      />
    </div>
  );
}
