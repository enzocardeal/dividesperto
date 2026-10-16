import { notFound } from "next/navigation";
import { Suspense } from "react";
import { todayInSaoPaulo } from "@/lib/money/format";
import { strings } from "@/lib/strings";
import { getCurrentUserId, getExpense, getGroup, getGroupPeople } from "../../../../data";
import { ExpenseForm } from "../../expense-form";

type EditParams = Pick<PageProps<"/groups/[groupId]/expenses/[expenseId]/edit">, "params">;

export default function EditExpensePage({ params }: EditParams) {
  return (
    <Suspense>
      <EditExpense params={params} />
    </Suspense>
  );
}

async function EditExpense({ params }: EditParams) {
  const { groupId, expenseId } = await params;
  const group = await getGroup(groupId);
  if (!group) {
    notFound();
  }
  const [expense, { members }, me] = await Promise.all([
    getExpense(group.id, expenseId),
    getGroupPeople(group.id),
    getCurrentUserId(),
  ]);
  if (!expense) {
    notFound();
  }

  return (
    <>
      <h2 className="text-xl font-semibold">{strings.expenseForm.editTitle}</h2>
      {group.archived_at !== null ? (
        <p className="text-sm text-neutral-600">{strings.group.archivedNote}</p>
      ) : (
        <ExpenseForm
          groupId={group.id}
          people={members}
          currentUserId={me}
          today={todayInSaoPaulo(new Date())}
          expense={{
            id: expense.id,
            description: expense.description,
            amountCents: expense.amount_cents,
            date: expense.expense_date,
            payerId: expense.payer_id,
            category: expense.category,
            method: expense.split_method,
            splits: expense.expense_splits.map((split) => ({
              userId: split.user_id,
              amountCents: split.amount_cents,
              weight: split.weight,
            })),
            items: expense.expense_items.map((item) => ({
              description: item.description,
              amountCents: item.amount_cents,
              participantIds: item.expense_item_participants.map((participant) => participant.user_id),
            })),
          }}
        />
      )}
    </>
  );
}
