import { compareIds } from "./settlement/graph.ts";
import { replayLedger, type ExpenseDebt, type LedgerPayment } from "./settlement/ledger.ts";
import type { Transfer } from "./settlement/simplify.ts";
import type { BalanceView } from "./settlement/view.ts";
import { linesFor, viewerLines } from "./settlement/views.ts";

export type NetStatus = "receives" | "owes" | "settled";

export function netStatus(netCents: number): NetStatus {
  return netCents > 0 ? "receives" : netCents < 0 ? "owes" : "settled";
}

export type GroupLedgerRows = {
  id: string;
  name: string;
  archived: boolean;
  version: number;
  memberIds: string[];
  debts: ExpenseDebt[];
  payments: LedgerPayment[];
};

export type GroupLines = {
  groupId: string;
  name: string;
  archived: boolean;
  version: number;
  lines: Transfer[];
};

export type GroupLine = Transfer & Omit<GroupLines, "lines">;

export type ViewerTotals = {
  owesCents: number;
  receivesCents: number;
};

export function viewerGroupLines(viewerId: string, groups: readonly GroupLedgerRows[], view: BalanceView): GroupLines[] {
  return groups
    .map((group) => ({
      groupId: group.id,
      name: group.name,
      archived: group.archived,
      version: group.version,
      lines: viewerLines(linesFor(replayLedger(group.memberIds, group.debts, group.payments), view), viewerId),
    }))
    .filter((group) => group.lines.length > 0)
    .sort(
      (a, b) =>
        Number(a.archived) - Number(b.archived) ||
        a.name.localeCompare(b.name, "pt-BR") ||
        compareIds(a.groupId, b.groupId),
    );
}

export function viewerTotals(viewerId: string, groups: readonly GroupLines[]): ViewerTotals {
  const totals = { owesCents: 0, receivesCents: 0 };
  for (const line of groups.flatMap((group) => group.lines)) {
    if (line.from === viewerId) {
      totals.owesCents += line.amountCents;
    } else if (line.to === viewerId) {
      totals.receivesCents += line.amountCents;
    }
  }
  return totals;
}

export function firstLines(groups: readonly GroupLines[], limit: number): GroupLine[] {
  return groups
    .flatMap(({ lines, ...group }) => lines.map((line) => ({ ...group, ...line })))
    .slice(0, limit);
}
