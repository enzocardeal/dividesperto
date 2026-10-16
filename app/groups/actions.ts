"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { buildExpensePayload, expenseErrorMessage } from "@/lib/expenses";
import { groupErrorMessage, isUuid, parseGroupName } from "@/lib/groups";
import { buildPaymentPayload, paymentErrorMessage } from "@/lib/payments";
import { buildSettleArgs, settleErrorMessage } from "@/lib/settlement/settle";
import { strings } from "@/lib/strings";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

export async function createGroup(_state: ActionState, formData: FormData): Promise<ActionState> {
  const name = parseGroupName(formData.get("name"));
  if (name === null) {
    return { error: strings.newGroup.invalidName };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", { p_name: name });
  if (error) {
    return { error: groupErrorMessage(error.code) };
  }
  redirect(`/groups/${data}`);
}

export async function setGroupArchived(_state: ActionState, formData: FormData): Promise<ActionState> {
  const groupId = formData.get("groupId");
  if (!isUuid(groupId)) {
    return { error: strings.errors.generic };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_group", {
    p_group_id: groupId,
    p_name: null,
    p_archived: formData.get("archived") === "true",
  });
  if (error) {
    return { error: groupErrorMessage(error.code) };
  }
  refresh();
  return { error: null };
}

export async function addGroupMember(_state: ActionState, formData: FormData): Promise<ActionState> {
  const groupId = formData.get("groupId");
  const userId = formData.get("userId");
  if (!isUuid(groupId) || !isUuid(userId)) {
    return { error: strings.errors.generic };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_group_member", { p_group_id: groupId, p_user_id: userId });
  if (error) {
    return { error: groupErrorMessage(error.code) };
  }
  refresh();
  return { error: null };
}

export async function saveExpense(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { payload, error } = buildExpensePayload(formData);
  if (payload === null) {
    return { error };
  }
  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("save_expense", { p_expense: payload });
  if (rpcError) {
    return { error: expenseErrorMessage(rpcError.code) };
  }
  redirect(payload.id === null ? `/groups/${payload.group_id}` : `/groups/${payload.group_id}/expenses/${payload.id}`);
}

export async function deleteExpense(_state: ActionState, formData: FormData): Promise<ActionState> {
  const groupId = formData.get("groupId");
  const expenseId = formData.get("expenseId");
  if (!isUuid(groupId) || !isUuid(expenseId)) {
    return { error: strings.errors.generic };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_expense", { p_expense_id: expenseId });
  if (error) {
    return { error: expenseErrorMessage(error.code) };
  }
  redirect(`/groups/${groupId}`);
}

export async function savePayment(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { payload, error } = buildPaymentPayload(formData);
  if (payload === null) {
    return { error };
  }
  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("save_payment", { p_payment: payload });
  if (rpcError) {
    return { error: paymentErrorMessage(rpcError.code) };
  }
  redirect(
    payload.id === null
      ? `/groups/${payload.group_id}/balances`
      : `/groups/${payload.group_id}/payments/${payload.id}`,
  );
}

export async function deletePayment(_state: ActionState, formData: FormData): Promise<ActionState> {
  const groupId = formData.get("groupId");
  const paymentId = formData.get("paymentId");
  if (!isUuid(groupId) || !isUuid(paymentId)) {
    return { error: strings.errors.generic };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_payment", { p_payment_id: paymentId });
  if (error) {
    return { error: paymentErrorMessage(error.code) };
  }
  redirect(`/groups/${groupId}/balances`);
}

export async function settleTransfer(_state: ActionState, formData: FormData): Promise<ActionState> {
  const args = buildSettleArgs(formData);
  if (args === null) {
    return { error: strings.errors.generic };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("settle_transfer", args);
  if (error) {
    return { error: settleErrorMessage(error.code) };
  }
  refresh();
  return { error: null };
}
