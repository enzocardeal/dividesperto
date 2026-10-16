import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { categoryLabel } from "@/lib/categories";
import { formatPercent, splitMethodLabel } from "@/lib/expenses";
import { formatBRL, formatDate } from "@/lib/money/format";
import { strings } from "@/lib/strings";
import { getExpense, getGroup, getGroupPeople, type ExpenseDetail } from "../../../data";
import { DeleteExpenseButton } from "./delete-expense-button";

type ExpenseParams = Pick<PageProps<"/groups/[groupId]/expenses/[expenseId]">, "params">;

export default function ExpensePage({ params }: ExpenseParams) {
  return (
    <Suspense>
      <Expense params={params} />
    </Suspense>
  );
}

function weightLabel(method: ExpenseDetail["split_method"], weight: number | null): string | null {
  if (weight === null) {
    return null;
  }
  if (method === "percent") {
    return `${formatPercent(weight)}%`;
  }
  return method === "shares" ? `${weight} ${weight === 1 ? strings.expense.share : strings.expense.sharesUnit}` : null;
}

async function Expense({ params }: ExpenseParams) {
  const { groupId, expenseId } = await params;
  const group = await getGroup(groupId);
  if (!group) {
    notFound();
  }
  const [expense, { members }] = await Promise.all([getExpense(group.id, expenseId), getGroupPeople(group.id)]);
  if (!expense) {
    notFound();
  }
  const people = new Map(members.map((person) => [person.id, person]));
  const nameOf = (id: string) => people.get(id)?.display_name ?? strings.activity.someone;
  const splits = [...expense.expense_splits].sort((a, b) => nameOf(a.user_id).localeCompare(nameOf(b.user_id), "pt-BR"));
  const facts = [
    [strings.expense.paidBy, nameOf(expense.payer_id)],
    [strings.expense.date, formatDate(expense.expense_date)],
    [strings.expense.category, categoryLabel(expense.category) ?? strings.expenseForm.noCategory],
    [strings.expense.method, splitMethodLabel(expense.split_method) ?? ""],
  ];

  return (
    <>
      <section className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold break-words">{expense.description}</h2>
        <p className="text-3xl font-semibold tabular-nums">{formatBRL(expense.amount_cents)}</p>
      </section>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-neutral-500">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">{strings.expense.shares}</h3>
        <ul className="flex flex-col divide-y divide-neutral-100">
          {splits.map((split) => {
            const person = people.get(split.user_id);
            const weight = weightLabel(expense.split_method, split.weight);
            return (
              <li key={split.user_id} className="flex min-h-11 items-center gap-3 py-2">
                <Avatar name={nameOf(split.user_id)} url={person?.avatar_url ?? null} />
                <span className="min-w-0 flex-1 truncate">{nameOf(split.user_id)}</span>
                {weight && <span className="text-sm text-neutral-500">{weight}</span>}
                <span className="shrink-0 tabular-nums">{formatBRL(split.amount_cents)}</span>
              </li>
            );
          })}
        </ul>
      </section>
      {group.archived_at !== null ? (
        <p className="text-sm text-neutral-600">{strings.group.archivedNote}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <Link
            href={`/groups/${group.id}/expenses/${expense.id}/edit`}
            className="flex min-h-11 items-center justify-center rounded-lg bg-neutral-900 px-4 font-medium text-white"
          >
            {strings.expense.edit}
          </Link>
          <DeleteExpenseButton groupId={group.id} expenseId={expense.id} />
        </div>
      )}
    </>
  );
}
