import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/skeleton";
import { todayInSaoPaulo } from "@/lib/money/format";
import { strings } from "@/lib/strings";
import { getCurrentUserId, getGroup, getGroupPeople } from "../../../data";
import { ExpenseForm } from "../expense-form";

export default function NewExpensePage({ params }: PageProps<"/groups/[groupId]/expenses/new">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <NewExpense params={params} />
    </Suspense>
  );
}

async function NewExpense({ params }: Pick<PageProps<"/groups/[groupId]/expenses/new">, "params">) {
  const group = await getGroup((await params).groupId);
  if (!group) {
    notFound();
  }
  const [{ members }, me] = await Promise.all([getGroupPeople(group.id), getCurrentUserId()]);

  return (
    <>
      <h2 className="text-xl font-semibold">{strings.expenseForm.newTitle}</h2>
      {group.archived_at !== null ? (
        <p className="text-sm text-neutral-600">{strings.group.archivedNote}</p>
      ) : (
        <ExpenseForm groupId={group.id} people={members} currentUserId={me} today={todayInSaoPaulo(new Date())} />
      )}
    </>
  );
}
