import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeleton";
import { categoryLabel } from "@/lib/categories";
import { formatBRL, formatDate } from "@/lib/money/format";
import { strings } from "@/lib/strings";
import { getExpenses, getGroup, getGroupPeople } from "../data";

export default function ExpensesPage({ params }: PageProps<"/groups/[groupId]">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Expenses params={params} />
    </Suspense>
  );
}

async function Expenses({ params }: Pick<PageProps<"/groups/[groupId]">, "params">) {
  const group = await getGroup((await params).groupId);
  if (!group) {
    notFound();
  }
  const [expenses, { members }] = await Promise.all([getExpenses(group.id), getGroupPeople(group.id)]);
  const names = new Map(members.map((person) => [person.id, person.display_name]));
  const archived = group.archived_at !== null;

  return (
    <>
      {archived && <p className="text-sm text-neutral-600">{strings.group.archivedNote}</p>}
      {expenses.length === 0 ? (
        <EmptyState title={strings.expenses.empty} hint={archived ? undefined : strings.expenses.emptyHint} />
      ) : (
        <ul className="flex flex-col gap-2">
          {expenses.map((expense) => {
            const category = categoryLabel(expense.category);
            return (
              <li key={expense.id}>
                <Link
                  href={`/groups/${group.id}/expenses/${expense.id}`}
                  className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-neutral-200 px-4 py-3"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{expense.description}</span>
                    <span className="truncate text-sm text-neutral-500">
                      {formatDate(expense.expense_date)} · {names.get(expense.payer_id) ?? strings.activity.someone}{" "}
                      {strings.expenses.paid}
                      {category && ` · ${category}`}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{formatBRL(expense.amount_cents)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {!archived && (
        <Link
          href={`/groups/${group.id}/expenses/new`}
          className="sticky bottom-(--above-bottom-nav) mt-auto flex min-h-11 items-center self-end rounded-full bg-neutral-900 px-5 font-medium text-white shadow-lg"
        >
          {strings.expenses.new}
        </Link>
      )}
    </>
  );
}
