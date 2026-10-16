"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { saveExpense } from "@/app/groups/actions";
import type { Person } from "@/app/groups/data";
import { Avatar } from "@/components/avatar";
import { MoneyInput } from "@/components/money-input";
import { CATEGORIES } from "@/lib/categories";
import {
  computeSplits,
  DESCRIPTION_MAX,
  FORM_SPLIT_METHODS,
  parsePercent,
  parseShares,
  splitValueText,
  type FormSplitMethod,
  type Split,
} from "@/lib/expenses";
import { formatBRL } from "@/lib/money/format";
import { strings } from "@/lib/strings";

export type ExpenseFormValues = {
  id: string;
  description: string;
  amountCents: number;
  date: string;
  payerId: string;
  category: string | null;
  method: FormSplitMethod;
  splits: Split[];
};

type ExpenseFormProps = {
  groupId: string;
  people: Person[];
  currentUserId: string | null;
  today: string;
  expense?: ExpenseFormValues;
};

const LABEL = "text-sm font-medium";
const FIELD = "min-h-11 rounded-lg border border-neutral-300 bg-white px-3";
const CHIP =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-neutral-300 py-1 pl-1 pr-3 text-sm has-checked:border-neutral-900 has-checked:bg-neutral-900 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-neutral-400";
const SEGMENT =
  "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-md text-sm font-medium text-neutral-600 has-checked:bg-white has-checked:text-neutral-900 has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-neutral-400";

function initialTexts(expense: ExpenseFormValues | undefined, method: "percent" | "shares") {
  if (expense?.method !== method) {
    return {};
  }
  return Object.fromEntries(expense.splits.map((split) => [split.userId, splitValueText(method, split)]));
}

export function ExpenseForm({ groupId, people, currentUserId, today, expense }: ExpenseFormProps) {
  const [state, action, pending] = useActionState(saveExpense, { error: null });
  const [amountCents, setAmountCents] = useState<number | null>(expense?.amountCents ?? null);
  const [payerId, setPayerId] = useState(
    expense?.payerId ?? people.find((person) => person.id === currentUserId)?.id ?? people[0]?.id ?? "",
  );
  const [selected, setSelected] = useState(
    () => new Set(expense ? expense.splits.map((split) => split.userId) : people.map((person) => person.id)),
  );
  const [method, setMethod] = useState<FormSplitMethod>(expense?.method ?? "equal");
  const [exactCents, setExactCents] = useState<Record<string, number | null>>(() =>
    expense?.method === "exact"
      ? Object.fromEntries(expense.splits.map((split) => [split.userId, split.amountCents]))
      : {},
  );
  const [percentTexts, setPercentTexts] = useState<Record<string, string>>(() => initialTexts(expense, "percent"));
  const [shareTexts, setShareTexts] = useState<Record<string, string>>(() => initialTexts(expense, "shares"));

  const participants = people.filter((person) => selected.has(person.id));
  const participantIds = participants.map((person) => person.id);
  const shareText = (id: string) => shareTexts[id] ?? "1";
  const values = new Map(
    participantIds.map((id) => [
      id,
      method === "exact"
        ? (exactCents[id] ?? null)
        : method === "percent"
          ? parsePercent(percentTexts[id] ?? "")
          : method === "shares"
            ? parseShares(shareText(id))
            : null,
    ]),
  );
  const preview = amountCents === null ? null : computeSplits(method, amountCents, participantIds, values);
  const previewAmounts = new Map(preview?.splits?.map((split) => [split.userId, split.amountCents]));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="groupId" value={groupId} />
      {expense && <input type="hidden" name="expenseId" value={expense.id} />}

      <label className="flex flex-col gap-1">
        <span className={LABEL}>{strings.expenseForm.description}</span>
        <input
          name="description"
          required
          maxLength={DESCRIPTION_MAX}
          autoComplete="off"
          defaultValue={expense?.description}
          placeholder={strings.expenseForm.descriptionPlaceholder}
          className={FIELD}
        />
      </label>

      <div className="flex gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={LABEL}>{strings.expenseForm.amount}</span>
          <MoneyInput name="amount" required defaultCents={expense?.amountCents} onCentsChange={setAmountCents} />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className={LABEL}>{strings.expenseForm.date}</span>
          <input
            type="date"
            name="date"
            required
            defaultValue={expense?.date ?? today}
            className={`${FIELD} h-11 w-full min-w-0`}
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${LABEL} mb-1`}>{strings.expenseForm.payer}</legend>
        <div className="flex flex-wrap gap-2">
          {people.map((person) => (
            <label key={person.id} className={CHIP}>
              <input
                type="radio"
                name="payerId"
                value={person.id}
                checked={payerId === person.id}
                onChange={() => setPayerId(person.id)}
                className="sr-only"
              />
              <Avatar name={person.display_name} url={person.avatar_url} />
              {person.display_name}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>{strings.expenseForm.category}</span>
        <select name="category" defaultValue={expense?.category ?? ""} className={FIELD}>
          <option value="">{strings.expenseForm.noCategory}</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {strings.categories[category]}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${LABEL} mb-1`}>{strings.expenseForm.participants}</legend>
        <div className="flex flex-wrap gap-2">
          {people.map((person) => (
            <label key={person.id} className={CHIP}>
              <input
                type="checkbox"
                name="participantIds"
                value={person.id}
                checked={selected.has(person.id)}
                onChange={() => toggle(person.id)}
                className="sr-only"
              />
              <Avatar name={person.display_name} url={person.avatar_url} />
              {person.display_name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${LABEL} mb-1`}>{strings.expenseForm.method}</legend>
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
          {FORM_SPLIT_METHODS.map((option) => (
            <label key={option} className={SEGMENT}>
              <input
                type="radio"
                name="method"
                value={option}
                checked={method === option}
                onChange={() => setMethod(option)}
                className="sr-only"
              />
              {strings.splitMethods[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <section className="flex flex-col gap-2">
        <h2 className={LABEL}>{strings.expenseForm.preview}</h2>
        <ul className="flex flex-col divide-y divide-neutral-100">
          {participants.map((person) => (
            <li key={person.id} className="flex min-h-11 items-center gap-3 py-2">
              <Avatar name={person.display_name} url={person.avatar_url} />
              <span className="min-w-0 flex-1 truncate">{person.display_name}</span>
              {method === "exact" && (
                <MoneyInput
                  name={`value:${person.id}`}
                  aria-label={person.display_name}
                  defaultCents={exactCents[person.id] ?? undefined}
                  onCentsChange={(cents) => setExactCents((current) => ({ ...current, [person.id]: cents }))}
                  className="w-36"
                />
              )}
              {method === "percent" && (
                <label className="flex h-11 w-24 items-center gap-1 rounded-lg border border-neutral-300 px-3 focus-within:border-neutral-900">
                  <input
                    name={`value:${person.id}`}
                    aria-label={person.display_name}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={percentTexts[person.id] ?? ""}
                    onChange={(event) => {
                      const text = event.currentTarget.value;
                      setPercentTexts((current) => ({ ...current, [person.id]: text }));
                    }}
                    className="h-full w-full min-w-0 bg-transparent text-right tabular-nums outline-none"
                  />
                  <span aria-hidden="true" className="text-neutral-500">
                    %
                  </span>
                </label>
              )}
              {method === "shares" && (
                <input
                  name={`value:${person.id}`}
                  aria-label={person.display_name}
                  inputMode="numeric"
                  autoComplete="off"
                  value={shareText(person.id)}
                  onChange={(event) => {
                    const text = event.currentTarget.value;
                    setShareTexts((current) => ({ ...current, [person.id]: text }));
                  }}
                  className="h-11 w-16 rounded-lg border border-neutral-300 px-3 text-right tabular-nums"
                />
              )}
              {method !== "exact" && (
                <span className="w-24 shrink-0 text-right tabular-nums">
                  {previewAmounts.has(person.id) ? formatBRL(previewAmounts.get(person.id) ?? 0) : "—"}
                </span>
              )}
            </li>
          ))}
        </ul>
        {preview === null ? (
          <p className="text-sm text-neutral-500">{strings.expenseForm.previewHint}</p>
        ) : (
          preview.error && <p className="text-sm text-amber-700">{preview.error}</p>
        )}
      </section>

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
        {pending ? strings.expenseForm.saving : strings.expenseForm.save}
      </button>
    </form>
  );
}
