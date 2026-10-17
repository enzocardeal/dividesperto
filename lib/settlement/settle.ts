import { isUuid } from "../groups.ts";
import { strings } from "../strings.ts";
import type { BalanceView } from "./view.ts";

export type SettleLineArgs = {
  p_group_id: string;
  p_from: string;
  p_to: string;
  p_amount_cents: number;
  p_expected_version: number;
  p_view: BalanceView;
};

const INTEGER_PATTERN = /^-?\d+$/;

const RPC_ERRORS = new Map<string | undefined, string>([
  ["42501", strings.errors.notMember],
  ["DS002", strings.errors.archived],
  ["DS007", strings.errors.invalidPayment],
  ["DS009", strings.errors.balancesChanged],
]);

function parseInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !INTEGER_PATTERN.test(value)) {
    return null;
  }
  const cents = Number(value);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function buildSettleLineArgs(form: FormData): SettleLineArgs | null {
  const groupId = form.get("groupId");
  const fromId = form.get("fromId");
  const toId = form.get("toId");
  const amountCents = parseInteger(form.get("amountCents"));
  const expectedVersion = parseInteger(form.get("expectedVersion"));
  const view = form.get("view");
  if (!isUuid(groupId) || !isUuid(fromId) || !isUuid(toId) || fromId === toId) {
    return null;
  }
  if (amountCents === null || amountCents <= 0 || expectedVersion === null || expectedVersion < 0) {
    return null;
  }
  if (view !== "simplified" && view !== "full") {
    return null;
  }
  return {
    p_group_id: groupId,
    p_from: fromId,
    p_to: toId,
    p_amount_cents: amountCents,
    p_expected_version: expectedVersion,
    p_view: view,
  };
}

export function settleErrorMessage(code: string | undefined): string {
  return RPC_ERRORS.get(code) ?? strings.errors.generic;
}
