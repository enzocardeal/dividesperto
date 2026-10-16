import { isISODate } from "./expenses.ts";
import { isUuid } from "./groups.ts";
import { parseBRL } from "./money/parse.ts";
import { strings } from "./strings.ts";

export const NOTE_MAX = 120;

export type PaymentPayload = {
  id: string | null;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount_cents: number;
  paid_on: string;
  note: string | null;
};

export type PaymentPayloadResult = { payload: PaymentPayload; error: null } | { payload: null; error: string };

const RPC_ERRORS = new Map<string | undefined, string>([
  ["42501", strings.errors.notMember],
  ["DS002", strings.errors.archived],
  ["DS007", strings.errors.invalidPayment],
  ["DS008", strings.errors.paymentNotFound],
]);

export function buildPaymentPayload(form: FormData): PaymentPayloadResult {
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const reject = (error: string): PaymentPayloadResult => ({ payload: null, error });

  const groupId = text("groupId");
  const paymentId = text("paymentId");
  if (!isUuid(groupId) || (paymentId !== "" && !isUuid(paymentId))) {
    return reject(strings.errors.generic);
  }

  const fromId = text("fromId");
  if (!isUuid(fromId)) {
    return reject(strings.paymentForm.chooseFrom);
  }
  const toId = text("toId");
  if (!isUuid(toId)) {
    return reject(strings.paymentForm.chooseTo);
  }
  if (fromId === toId) {
    return reject(strings.paymentForm.samePerson);
  }
  const amountCents = parseBRL(text("amount"));
  if (amountCents === null || amountCents <= 0) {
    return reject(strings.paymentForm.invalidAmount);
  }
  const date = text("date");
  if (!isISODate(date)) {
    return reject(strings.paymentForm.invalidDate);
  }
  const note = text("note").trim();
  if ([...note].length > NOTE_MAX) {
    return reject(strings.paymentForm.invalidNote);
  }

  return {
    payload: {
      id: paymentId === "" ? null : paymentId,
      group_id: groupId,
      from_user_id: fromId,
      to_user_id: toId,
      amount_cents: amountCents,
      paid_on: date,
      note: note === "" ? null : note,
    },
    error: null,
  };
}

export function paymentErrorMessage(code: string | undefined): string {
  return RPC_ERRORS.get(code) ?? strings.errors.generic;
}
