"use client";

import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";
import { saveExpense } from "@/app/groups/actions";
import type { Person } from "@/app/groups/data";
import { Avatar } from "@/components/avatar";
import { MoneyInput } from "@/components/money-input";
import { CATEGORIES } from "@/lib/categories";
import {
  computeItemSplits,
  computeSplits,
  DESCRIPTION_MAX,
  ITEM_DESCRIPTION_MAX,
  parsePercent,
  parseShares,
  SPLIT_METHODS,
  splitValueText,
  type Split,
  type SplitMethod,
} from "@/lib/expenses";
import { formatBRL } from "@/lib/money/format";
import { strings } from "@/lib/strings";

export type ExpenseFormItem = {
  description: string;
  amountCents: number | null;
  participantIds: string[];
};

export type ExpenseFormValues = {
  id: string;
  description: string;
  amountCents: number;
  date: string;
  payerId: string;
  category: string | null;
  method: SplitMethod;
  splits: Split[];
  items: ExpenseFormItem[];
};

type ItemRow = ExpenseFormItem & { key: string };

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

function initialItems(expense: ExpenseFormValues | undefined, participantIds: string[]): ItemRow[] {
  if (expense && expense.items.length > 0) {
    return expense.items.map((item, i) => ({ ...item, key: String(i) }));
  }
  return [{ key: "0", description: "", amountCents: null, participantIds }];
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
  const [method, setMethod] = useState<SplitMethod>(expense?.method ?? "equal");
  const [exactCents, setExactCents] = useState<Record<string, number | null>>(() =>
    expense?.method === "exact"
      ? Object.fromEntries(expense.splits.map((split) => [split.userId, split.amountCents]))
      : {},
  );
  const [percentTexts, setPercentTexts] = useState<Record<string, string>>(() => initialTexts(expense, "percent"));
  const [shareTexts, setShareTexts] = useState<Record<string, string>>(() => initialTexts(expense, "shares"));
  const [items, setItems] = useState(() =>
    initialItems(
      expense,
      people.filter((person) => selected.has(person.id)).map((person) => person.id),
    ),
  );
  const nextItemKey = useRef(Math.max(expense?.items.length ?? 0, 1));

  const itemParticipantIds = new Set(items.flatMap((item) => item.participantIds));
  const participants = people.filter((person) =>
    method === "items" ? itemParticipantIds.has(person.id) : selected.has(person.id),
  );
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
  const preview =
    amountCents === null
      ? null
      : method === "items"
        ? computeItemSplits(amountCents, items)
        : computeSplits(method, amountCents, participantIds, values);
  const previewAmounts = new Map(preview?.splits?.map((split) => [split.userId, split.amountCents]));
  const itemsSum = items.reduce((sum, item) => sum + (item.amountCents ?? 0), 0);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  function addItem() {
    const key = String(nextItemKey.current++);
    const ids = people.filter((person) => selected.has(person.id)).map((person) => person.id);
    setItems((current) => [...current, { key, description: "", amountCents: null, participantIds: ids }]);
  }

  function removeItem(key: string) {
    setItems((current) => current.filter((item) => item.key !== key));
  }

  function setItemCents(key: string, cents: number | null) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, amountCents: cents } : item)));
  }

  function toggleItemParticipant(key: string, id: string) {
    setItems((current) =>
      current.map((item) => {
        if (item.key !== key) {
          return item;
        }
        const ids = item.participantIds.includes(id)
          ? item.participantIds.filter((participantId) => participantId !== id)
          : [...item.participantIds, id];
        return { ...item, participantIds: ids };
      }),
    );
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
        <legend className={`${LABEL} mb-1`}>{strings.expenseForm.method}</legend>
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
          {SPLIT_METHODS.map((option) => (
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

      {method !== "items" && (
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
      )}

      {method === "items" && (
        <section className="flex flex-col gap-3">
          <h2 className={LABEL}>{strings.expenseForm.items}</h2>
          {items.map((item) => (
            <div key={item.key} className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-3">
              <input type="hidden" name="itemKeys" value={item.key} />
              <div className="flex gap-2">
                <input
                  name={`item:${item.key}:description`}
                  aria-label={strings.expenseForm.itemDescription}
                  required
                  maxLength={ITEM_DESCRIPTION_MAX}
                  autoComplete="off"
                  defaultValue={item.description}
                  placeholder={strings.expenseForm.itemDescriptionPlaceholder}
                  className={`${FIELD} min-w-0 flex-1`}
                />
                <MoneyInput
                  name={`item:${item.key}:amount`}
                  aria-label={strings.expenseForm.itemAmount}
                  required
                  defaultCents={item.amountCents ?? undefined}
                  onCentsChange={(cents) => setItemCents(item.key, cents)}
                  className="w-32 shrink-0"
                />
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-xs text-neutral-500">{strings.expenseForm.itemParticipants}</legend>
                <div className="flex flex-wrap gap-2">
                  {people.map((person) => (
                    <label key={person.id} className={CHIP}>
                      <input
                        type="checkbox"
                        name={`item:${item.key}:participantIds`}
                        value={person.id}
                        checked={item.participantIds.includes(person.id)}
                        onChange={() => toggleItemParticipant(item.key, person.id)}
                        className="sr-only"
                      />
                      <Avatar name={person.display_name} url={person.avatar_url} />
                      {person.display_name}
                    </label>
                  ))}
                </div>
              </fieldset>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  className="min-h-11 self-start text-sm font-medium text-red-700"
                >
                  {strings.expenseForm.removeItem}
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="min-h-11 rounded-lg border border-neutral-300 px-4 text-sm font-medium"
          >
            {strings.expenseForm.addItem}
          </button>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-neutral-500">{strings.expenseForm.itemsSum}</dt>
            <dd className="text-right tabular-nums">{formatBRL(itemsSum)}</dd>
            {amountCents !== null && (
              <>
                <dt className="text-neutral-500">{strings.expenseForm.itemsExtras}</dt>
                <dd className="text-right tabular-nums">{formatBRL(amountCents - itemsSum)}</dd>
              </>
            )}
          </dl>
        </section>
      )}

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
