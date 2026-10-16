import { isCategory, type Category } from "./categories.ts";
import { isUuid } from "./groups.ts";
import { allocate, allocateItems, type Item } from "./money/allocate.ts";
import { formatBRL } from "./money/format.ts";
import { centsToBRLInput } from "./money/input.ts";
import { parseBRL } from "./money/parse.ts";
import { strings } from "./strings.ts";

export const DESCRIPTION_MAX = 120;
export const ITEM_DESCRIPTION_MAX = 80;
export const PERCENT_TOTAL = 10000;
export const SPLIT_METHODS = ["equal", "exact", "percent", "shares", "items"] as const;

export type SplitMethod = (typeof SPLIT_METHODS)[number];
export type ParticipantSplitMethod = Exclude<SplitMethod, "items">;

export type Split = {
  userId: string;
  amountCents: number;
  weight: number | null;
};

export type SplitResult = { splits: Split[]; error: null } | { splits: null; error: string };

export type ItemInput = {
  amountCents: number | null;
  participantIds: readonly string[];
};

export type ExpensePayload = {
  id: string | null;
  group_id: string;
  description: string;
  amount_cents: number;
  expense_date: string;
  payer_id: string;
  split_method: SplitMethod;
  category: Category | null;
  splits: { user_id: string; amount_cents: number; weight: number | null }[];
  items: { description: string; amount_cents: number; participant_ids: string[] }[];
};

export type PayloadResult = { payload: ExpensePayload; error: null } | { payload: null; error: string };

type PayloadItem = ExpensePayload["items"][number];
type ItemsResult = { items: PayloadItem[]; error: null } | { items: null; error: string };

const PERCENT_PATTERN = /^(\d{1,3})(?:[,.](\d{1,2}))?$/;
const SHARES_PATTERN = /^\d{1,4}$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ITEM_KEY_PATTERN = /^\d{1,4}$/;

const RPC_ERRORS = new Map<string | undefined, string>([
  ["42501", strings.errors.notMember],
  ["DS002", strings.errors.archived],
  ["DS005", strings.errors.invalidExpense],
  ["DS006", strings.errors.expenseNotFound],
]);

function fail(error: string): SplitResult {
  return { splits: null, error };
}

function total(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

function formText(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export function isSplitMethod(value: unknown): value is SplitMethod {
  return SPLIT_METHODS.includes(value as SplitMethod);
}

export function splitMethodLabel(value: unknown): string | null {
  return typeof value === "string" && Object.hasOwn(strings.splitMethods, value)
    ? strings.splitMethods[value as SplitMethod]
    : null;
}

export function parseDescription(value: unknown, max = DESCRIPTION_MAX): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const description = value.trim();
  const length = [...description].length;
  return length >= 1 && length <= max ? description : null;
}

export function isISODate(value: unknown): value is string {
  const match = typeof value === "string" ? DATE_PATTERN.exec(value) : null;
  if (!match) {
    return false;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

export function parsePercent(text: string): number | null {
  const match = PERCENT_PATTERN.exec(text.trim());
  if (!match) {
    return null;
  }
  const basisPoints = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return basisPoints <= PERCENT_TOTAL ? basisPoints : null;
}

export function formatPercent(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const rest = basisPoints % 100;
  return rest === 0 ? String(whole) : `${whole},${String(rest).padStart(2, "0")}`;
}

export function parseShares(text: string): number | null {
  const trimmed = text.trim();
  return SHARES_PATTERN.test(trimmed) ? Number(trimmed) : null;
}

export function parseSplitValue(method: ParticipantSplitMethod, text: string): number | null {
  switch (method) {
    case "exact":
      return parseBRL(text);
    case "percent":
      return parsePercent(text);
    case "shares":
      return parseShares(text);
    case "equal":
      return null;
  }
}

export function splitValueText(method: ParticipantSplitMethod, split: Split): string {
  switch (method) {
    case "exact":
      return centsToBRLInput(split.amountCents);
    case "percent":
      return split.weight === null ? "" : formatPercent(split.weight);
    case "shares":
      return split.weight === null ? "" : String(split.weight);
    case "equal":
      return "";
  }
}

export function computeSplits(
  method: ParticipantSplitMethod,
  amountCents: number,
  participantIds: readonly string[],
  values: ReadonlyMap<string, number | null>,
): SplitResult {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    return fail(strings.expenseForm.invalidAmount);
  }
  if (participantIds.length === 0) {
    return fail(strings.expenseForm.chooseParticipants);
  }

  if (method === "exact") {
    const amounts = participantIds.map((id) => values.get(id) ?? 0);
    const missing = amountCents - total(amounts);
    if (missing > 0) {
      return fail(`${strings.expenseForm.exactMissing} ${formatBRL(missing)}.`);
    }
    if (missing < 0) {
      return fail(`${strings.expenseForm.exactOver} ${formatBRL(-missing)}.`);
    }
    return {
      splits: participantIds.map((id, i) => ({ userId: id, amountCents: amounts[i], weight: null })),
      error: null,
    };
  }

  let weights = participantIds.map(() => 1);
  if (method !== "equal") {
    const entered = participantIds.map((id) => values.get(id) ?? 0);
    if (!entered.every((weight) => weight > 0)) {
      return fail(method === "percent" ? strings.expenseForm.percentPositive : strings.expenseForm.sharesPositive);
    }
    const sum = total(entered);
    if (method === "percent" && sum !== PERCENT_TOTAL) {
      return fail(`${strings.expenseForm.percentSum} ${formatPercent(sum)}%. ${strings.expenseForm.percentTotal}`);
    }
    weights = entered;
  }

  const shares = allocate(amountCents, weights, participantIds);
  return {
    splits: participantIds.map((id, i) => ({
      userId: id,
      amountCents: shares.get(id) ?? 0,
      weight: method === "equal" ? null : weights[i],
    })),
    error: null,
  };
}

export function computeItemSplits(amountCents: number, items: readonly ItemInput[]): SplitResult {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    return fail(strings.expenseForm.invalidAmount);
  }
  if (items.length === 0) {
    return fail(strings.expenseForm.addItemFirst);
  }
  const valid: Item[] = [];
  for (const { amountCents: itemCents, participantIds } of items) {
    if (itemCents === null || !Number.isSafeInteger(itemCents) || itemCents <= 0) {
      return fail(strings.expenseForm.itemAmountPositive);
    }
    if (participantIds.length === 0) {
      return fail(strings.expenseForm.chooseItemParticipants);
    }
    valid.push({ amountCents: itemCents, participantIds });
  }

  const shares = allocateItems(amountCents, valid);
  return {
    splits: [...shares].map(([userId, cents]) => ({ userId, amountCents: cents, weight: null })),
    error: null,
  };
}

function readItems(form: FormData): ItemsResult {
  const keys = form.getAll("itemKeys");
  if (
    !keys.every((key): key is string => typeof key === "string" && ITEM_KEY_PATTERN.test(key)) ||
    new Set(keys).size !== keys.length
  ) {
    return { items: null, error: strings.errors.generic };
  }

  const items: PayloadItem[] = [];
  for (const key of keys) {
    const participantIds = form.getAll(`item:${key}:participantIds`);
    if (!participantIds.every(isUuid) || new Set(participantIds).size !== participantIds.length) {
      return { items: null, error: strings.errors.generic };
    }
    const description = parseDescription(formText(form, `item:${key}:description`), ITEM_DESCRIPTION_MAX);
    if (description === null) {
      return { items: null, error: strings.expenseForm.invalidItemDescription };
    }
    const amountCents = parseBRL(formText(form, `item:${key}:amount`));
    if (amountCents === null || amountCents <= 0) {
      return { items: null, error: strings.expenseForm.itemAmountPositive };
    }
    items.push({ description, amount_cents: amountCents, participant_ids: participantIds });
  }
  return { items, error: null };
}

export function buildExpensePayload(form: FormData): PayloadResult {
  const text = (name: string) => formText(form, name);
  const reject = (error: string): PayloadResult => ({ payload: null, error });

  const groupId = text("groupId");
  const expenseId = text("expenseId");
  const method = text("method");
  const category = text("category");
  const participantIds = form.getAll("participantIds");
  if (
    !isUuid(groupId) ||
    (expenseId !== "" && !isUuid(expenseId)) ||
    !isSplitMethod(method) ||
    (category !== "" && !isCategory(category)) ||
    !participantIds.every(isUuid) ||
    new Set(participantIds).size !== participantIds.length
  ) {
    return reject(strings.errors.generic);
  }

  const description = parseDescription(text("description"));
  if (description === null) {
    return reject(strings.expenseForm.invalidDescription);
  }
  const amountCents = parseBRL(text("amount"));
  if (amountCents === null || amountCents <= 0) {
    return reject(strings.expenseForm.invalidAmount);
  }
  const date = text("date");
  if (!isISODate(date)) {
    return reject(strings.expenseForm.invalidDate);
  }
  const payerId = text("payerId");
  if (!isUuid(payerId)) {
    return reject(strings.expenseForm.choosePayer);
  }

  let items: PayloadItem[] = [];
  let result: SplitResult;
  if (method === "items") {
    const read = readItems(form);
    if (read.items === null) {
      return reject(read.error);
    }
    items = read.items;
    result = computeItemSplits(
      amountCents,
      items.map((item) => ({ amountCents: item.amount_cents, participantIds: item.participant_ids })),
    );
  } else {
    const values = new Map(participantIds.map((id) => [id, parseSplitValue(method, text(`value:${id}`))]));
    result = computeSplits(method, amountCents, participantIds, values);
  }
  if (result.splits === null) {
    return reject(result.error);
  }

  return {
    payload: {
      id: expenseId === "" ? null : expenseId,
      group_id: groupId,
      description,
      amount_cents: amountCents,
      expense_date: date,
      payer_id: payerId,
      split_method: method,
      category: category === "" ? null : category,
      splits: result.splits.map((split) => ({
        user_id: split.userId,
        amount_cents: split.amountCents,
        weight: split.weight,
      })),
      items,
    },
    error: null,
  };
}

export function expenseErrorMessage(code: string | undefined): string {
  return RPC_ERRORS.get(code) ?? strings.errors.generic;
}
