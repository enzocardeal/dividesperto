import { categoryLabel } from "./categories.ts";
import { splitMethodLabel } from "./expenses.ts";
import { formatBRL, formatDate } from "./money/format.ts";
import { strings } from "./strings.ts";

export type ActivityEntry = {
  actor_id: string;
  entity_type: string;
  action: string;
  before: unknown;
  after: unknown;
};

export type ActivityView = {
  title: string;
  details: string[];
};

type Snapshot = Record<string, unknown>;
type NameOf = (id: string) => string;

const text = strings.activity;

function snapshot(value: unknown): Snapshot {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Snapshot) : {};
}

function str(record: Snapshot, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function cents(record: Snapshot, key: string): number | null {
  const value = record[key];
  return Number.isSafeInteger(value) ? (value as number) : null;
}

function money(value: number | null | undefined): string {
  return value === null || value === undefined ? text.none : formatBRL(value);
}

function day(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : text.none;
}

function change(label: string, from: string, to: string): string {
  return `${label}: ${from} → ${to}`;
}

function quoted(value: string): string {
  return `“${value}”`;
}

function shares(record: Snapshot): Map<string, number | null> {
  const splits = Array.isArray(record.splits) ? record.splits : [];
  return new Map(
    splits.map((split) => {
      const entry = snapshot(split);
      return [str(entry, "user_id"), cents(entry, "amount_cents")];
    }),
  );
}

function expenseSummary(record: Snapshot, nameOf: NameOf): string[] {
  return [`${money(cents(record, "amount_cents"))} · ${text.paidBy} ${nameOf(str(record, "payer_id"))}`];
}

function expenseChanges(before: Snapshot, after: Snapshot, nameOf: NameOf): string[] {
  const details: string[] = [];
  const differs = (key: string) => JSON.stringify(before[key]) !== JSON.stringify(after[key]);

  if (differs("description")) {
    details.push(change(text.description, str(before, "description"), str(after, "description")));
  }
  if (differs("amount_cents")) {
    details.push(change(text.amount, money(cents(before, "amount_cents")), money(cents(after, "amount_cents"))));
  }
  if (differs("expense_date")) {
    details.push(change(text.date, day(str(before, "expense_date")), day(str(after, "expense_date"))));
  }
  if (differs("payer_id")) {
    details.push(change(text.payer, nameOf(str(before, "payer_id")), nameOf(str(after, "payer_id"))));
  }
  if (differs("category")) {
    const label = (record: Snapshot) => categoryLabel(record.category) ?? strings.expenseForm.noCategory;
    details.push(change(text.category, label(before), label(after)));
  }
  if (differs("split_method")) {
    const label = (record: Snapshot) => splitMethodLabel(record.split_method) ?? text.none;
    details.push(change(text.method, label(before), label(after)));
  }

  const old = shares(before);
  const now = shares(after);
  const people = [...new Set([...old.keys(), ...now.keys()])]
    .map((id) => ({ id, name: nameOf(id) }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  for (const { id, name } of people) {
    if (old.get(id) !== now.get(id)) {
      details.push(change(`${text.shareOf} ${name}`, money(old.get(id)), money(now.get(id))));
    }
  }

  if (differs("items")) {
    details.push(text.itemsChanged);
  }
  return details;
}

function groupUpdate(actor: string, before: Snapshot, after: Snapshot): ActivityView {
  const wasArchived = before.archived_at !== null && before.archived_at !== undefined;
  const isArchived = after.archived_at !== null && after.archived_at !== undefined;
  const renamed = str(before, "name") !== str(after, "name");
  const verb =
    !wasArchived && isArchived ? text.groupArchived : wasArchived && !isArchived ? text.groupUnarchived : text.groupRenamed;
  return {
    title: `${actor} ${verb}`,
    details: renamed ? [change(text.name, str(before, "name"), str(after, "name"))] : [],
  };
}

export function describeActivity(entry: ActivityEntry, nameOf: NameOf): ActivityView {
  const actor = nameOf(entry.actor_id);
  const before = snapshot(entry.before);
  const after = snapshot(entry.after);

  switch (`${entry.entity_type}:${entry.action}`) {
    case "group:create":
      return { title: `${actor} ${text.groupCreated} ${quoted(str(after, "name"))}`, details: [] };
    case "group:update":
      return groupUpdate(actor, before, after);
    case "member:create":
      return {
        title: `${actor} ${text.memberAdded} ${nameOf(str(after, "user_id"))} ${text.memberAddedSuffix}`,
        details: [],
      };
    case "expense:create":
      return {
        title: `${actor} ${text.expenseCreated} ${quoted(str(after, "description"))}`,
        details: expenseSummary(after, nameOf),
      };
    case "expense:update":
      return {
        title: `${actor} ${text.expenseUpdated} ${quoted(str(after, "description"))}`,
        details: expenseChanges(before, after, nameOf),
      };
    case "expense:delete":
      return {
        title: `${actor} ${text.expenseDeleted} ${quoted(str(before, "description"))}`,
        details: expenseSummary(before, nameOf),
      };
    default:
      return { title: `${actor} ${text.other}`, details: [] };
  }
}
