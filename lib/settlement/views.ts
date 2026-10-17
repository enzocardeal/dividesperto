import { compareIds, compressSettled, copyGraph, edgesOf, maxFlowReduce, netsOf, type DebtGraph } from "./graph.ts";
import { COMPRESS_SETTLED } from "./ledger.ts";
import { EXACT_LIMIT, simplify, type Transfer } from "./simplify.ts";

export const NODE_LIMIT = 5000;

export type SimplifiedLines = {
  transfers: Transfer[];
  followsChains: boolean;
};

export type ChainSearchOptions = {
  compress?: boolean;
  nodeLimit?: number;
};

export type ChainSearchResult = {
  transfers: Transfer[] | null;
  nodes: number;
  aborted: boolean;
};

export function fullLines(g: DebtGraph): Transfer[] {
  return edgesOf(g);
}

export function viewerLines(lines: readonly Transfer[], viewerId: string): Transfer[] {
  return lines.filter((line) => line.from === viewerId || line.to === viewerId);
}

export function chainValid(
  g: DebtGraph,
  transfers: readonly Transfer[],
  compress: boolean = COMPRESS_SETTLED,
): boolean {
  const h = copyGraph(g);
  for (const { from, to, amountCents } of transfers) {
    if (maxFlowReduce(h, from, to, amountCents) < amountCents) {
      return false;
    }
    if (compress) {
      compressSettled(h);
    }
  }
  return true;
}

type Candidate = Transfer & { zeroesBoth: boolean };

function candidates(g: DebtGraph): Candidate[] {
  const nets = netsOf(g);
  const debtors = nets.filter((n) => n.netCents < 0);
  const creditors = nets.filter((n) => n.netCents > 0);
  return debtors
    .flatMap((d) =>
      creditors.map((c) => ({
        from: d.userId,
        to: c.userId,
        amountCents: Math.min(-d.netCents, c.netCents),
        zeroesBoth: -d.netCents === c.netCents,
      })),
    )
    .sort(
      (x, y) =>
        Number(y.zeroesBoth) - Number(x.zeroesBoth) ||
        y.amountCents - x.amountCents ||
        compareIds(x.from, y.from) ||
        compareIds(x.to, y.to),
    );
}

export function searchChainMinimum(
  g: DebtGraph,
  maxTransfers: number,
  { compress = COMPRESS_SETTLED, nodeLimit = NODE_LIMIT }: ChainSearchOptions = {},
): ChainSearchResult {
  let nodes = 0;
  let aborted = false;
  const failed = new Set<string>();
  const dfs = (h: DebtGraph, used: number): Transfer[] | null => {
    const left = simplify(netsOf(h)).length;
    if (left === 0) {
      return [];
    }
    const key = h.weights.join(";");
    if (used + left > maxTransfers || failed.has(key)) {
      return null;
    }
    if (nodes === nodeLimit) {
      aborted = true;
      return null;
    }
    nodes++;
    for (const { from, to, amountCents } of candidates(h)) {
      const next = copyGraph(h);
      if (maxFlowReduce(next, from, to, amountCents) < amountCents) {
        continue;
      }
      if (compress) {
        compressSettled(next);
      }
      const rest = dfs(next, used + 1);
      if (rest) {
        return [{ from, to, amountCents }, ...rest];
      }
      if (aborted) {
        return null;
      }
    }
    failed.add(key);
    return null;
  };
  const transfers = dfs(g, 0);
  return { transfers: aborted ? null : transfers, nodes, aborted };
}

export function simplifiedLines(g: DebtGraph, options: ChainSearchOptions = {}): SimplifiedLines {
  const compress = options.compress ?? COMPRESS_SETTLED;
  const nets = netsOf(g);
  const best = simplify(nets);
  if (best.length === 0) {
    return { transfers: best, followsChains: true };
  }
  const valid = chainValid(g, best, compress);
  if (valid || nets.filter((n) => n.netCents !== 0).length > EXACT_LIMIT) {
    return { transfers: best, followsChains: valid };
  }
  const found = searchChainMinimum(g, best.length, options).transfers;
  return found ? { transfers: found, followsChains: true } : { transfers: best, followsChains: false };
}
