"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { savePayment } from "@/app/groups/actions";
import type { Person } from "@/app/groups/data";
import { Avatar } from "@/components/avatar";
import { ErrorToast } from "@/components/error-toast";
import { MoneyInput } from "@/components/money-input";
import { NOTE_MAX } from "@/lib/payments";
import { strings } from "@/lib/strings";

export type PaymentFormValues = {
  id: string;
  fromId: string;
  toId: string;
  amountCents: number;
  date: string;
  note: string | null;
};

type PaymentFormProps = {
  groupId: string;
  people: Person[];
  currentUserId: string | null;
  today: string;
  payment?: PaymentFormValues;
};

type PersonChipsProps = {
  legend: string;
  name: string;
  people: Person[];
  selected: string;
  onSelect: (id: string) => void;
};

const LABEL = "text-sm font-medium";
const FIELD = "min-h-11 rounded-lg border border-neutral-300 bg-white px-3";
const CHIP =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-neutral-300 py-1 pl-1 pr-3 text-sm has-checked:border-neutral-900 has-checked:bg-neutral-900 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-neutral-400";

function PersonChips({ legend, name, people, selected, onSelect }: PersonChipsProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={`${LABEL} mb-1`}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {people.map((person) => (
          <label key={person.id} className={CHIP}>
            <input
              type="radio"
              name={name}
              value={person.id}
              checked={selected === person.id}
              onChange={() => onSelect(person.id)}
              className="sr-only"
            />
            <Avatar name={person.display_name} url={person.avatar_url} />
            {person.display_name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PaymentForm({ groupId, people, currentUserId, today, payment }: PaymentFormProps) {
  const [state, action, pending] = useActionState(savePayment, { error: null });
  const [fromId, setFromId] = useState(
    payment?.fromId ?? people.find((person) => person.id === currentUserId)?.id ?? "",
  );
  const [toId, setToId] = useState(payment?.toId ?? "");

  function selectFrom(id: string) {
    setFromId(id);
    if (id === toId) {
      setToId("");
    }
  }

  function selectTo(id: string) {
    setToId(id);
    if (id === fromId) {
      setFromId("");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="groupId" value={groupId} />
      {payment && <input type="hidden" name="paymentId" value={payment.id} />}

      <PersonChips legend={strings.paymentForm.from} name="fromId" people={people} selected={fromId} onSelect={selectFrom} />
      <PersonChips legend={strings.paymentForm.to} name="toId" people={people} selected={toId} onSelect={selectTo} />

      <div className="flex gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={LABEL}>{strings.paymentForm.amount}</span>
          <MoneyInput name="amount" required defaultCents={payment?.amountCents} />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className={LABEL}>{strings.paymentForm.date}</span>
          <input
            type="date"
            name="date"
            required
            defaultValue={payment?.date ?? today}
            className={`${FIELD} h-11 w-full min-w-0`}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className={LABEL}>{strings.paymentForm.note}</span>
        <input
          name="note"
          maxLength={NOTE_MAX}
          autoComplete="off"
          defaultValue={payment?.note ?? ""}
          placeholder={strings.paymentForm.notePlaceholder}
          className={FIELD}
        />
      </label>

      <ErrorToast state={state} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg bg-neutral-900 px-4 font-medium text-white disabled:opacity-60"
      >
        {pending ? strings.paymentForm.saving : strings.paymentForm.save}
      </button>
    </form>
  );
}
