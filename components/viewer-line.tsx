import { SettleButton } from "@/components/settle-button";
import type { GroupLine } from "@/lib/balances";
import { formatBRL } from "@/lib/money/format";
import type { BalanceView } from "@/lib/settlement/view";
import { strings } from "@/lib/strings";

type ViewerLineProps = {
  line: GroupLine;
  me: string;
  otherName: string;
  view: BalanceView;
  showGroup?: boolean;
};

export function ViewerLine({ line, me, otherName, view, showGroup = false }: ViewerLineProps) {
  const amount = <span className="font-medium tabular-nums">{formatBRL(line.amountCents)}</span>;
  const other = <span className="font-medium">{otherName}</span>;

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-neutral-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex min-w-0 flex-col">
        {line.from === me ? (
          <span className="text-red-700">
            {strings.overall.you} {strings.overall.owes} {amount} {strings.overall.to} {other}
          </span>
        ) : (
          <span className="text-green-700">
            {other} {strings.overall.owes} {amount} {strings.overall.toYou}
          </span>
        )}
        {showGroup && <span className="truncate text-sm text-neutral-500">{line.name}</span>}
      </span>
      {!line.archived && (
        <SettleButton
          groupId={line.groupId}
          fromId={line.from}
          toId={line.to}
          amountCents={line.amountCents}
          expectedVersion={line.version}
          view={view}
        />
      )}
    </li>
  );
}
