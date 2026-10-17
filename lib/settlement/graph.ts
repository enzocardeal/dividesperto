import type { MemberNet, Transfer } from "./simplify.ts";

export type DebtGraph = {
  ids: string[];
  index: Map<string, number>;
  weights: number[][];
};

export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function createGraph(memberIds: Iterable<string>): DebtGraph {
  const ids = [...new Set(memberIds)].sort(compareIds);
  return {
    ids,
    index: new Map(ids.map((id, i) => [id, i])),
    weights: ids.map(() => new Array<number>(ids.length).fill(0)),
  };
}

export function copyGraph(g: DebtGraph): DebtGraph {
  return { ids: g.ids, index: g.index, weights: g.weights.map((row) => [...row]) };
}

function indexOf(g: DebtGraph, id: string): number {
  const i = g.index.get(id);
  if (i === undefined) {
    throw new RangeError(`unknown user id ${id}`);
  }
  return i;
}

function checkCents(cents: number): void {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError(`cents must be a non-negative safe integer, got ${cents}`);
  }
}

function addWeight(w: number[][], u: number, v: number, cents: number): void {
  const back = w[v][u];
  if (back >= cents) {
    w[v][u] = back - cents;
  } else {
    w[v][u] = 0;
    w[u][v] += cents - back;
  }
}

export function addDebt(g: DebtGraph, debtorId: string, creditorId: string, cents: number): void {
  checkCents(cents);
  const u = indexOf(g, debtorId);
  const v = indexOf(g, creditorId);
  if (u === v) {
    throw new RangeError("a person cannot owe themselves");
  }
  addWeight(g.weights, u, v, cents);
}

function netAt(w: number[][], v: number): number {
  let net = 0;
  for (let u = 0; u < w.length; u++) {
    net += w[u][v] - w[v][u];
  }
  return net;
}

export function netsOf(g: DebtGraph): MemberNet[] {
  return g.ids.map((userId, v) => ({ userId, netCents: netAt(g.weights, v) }));
}

function firstCycle(w: number[][]): number[] | null {
  const n = w.length;
  const state = new Array<number>(n).fill(0);
  const path: number[] = [];
  const visit = (u: number): number[] | null => {
    state[u] = 1;
    path.push(u);
    for (let v = 0; v < n; v++) {
      if (w[u][v] === 0) {
        continue;
      }
      if (state[v] === 1) {
        return path.slice(path.indexOf(v));
      }
      if (state[v] === 0) {
        const cycle = visit(v);
        if (cycle) {
          return cycle;
        }
      }
    }
    path.pop();
    state[u] = 2;
    return null;
  };
  for (let u = 0; u < n; u++) {
    if (state[u] === 0) {
      const cycle = visit(u);
      if (cycle) {
        return cycle;
      }
    }
  }
  return null;
}

export function cancelCycles(g: DebtGraph): void {
  const w = g.weights;
  for (let cycle = firstCycle(w); cycle; cycle = firstCycle(w)) {
    const edges = cycle.map((u, i) => [u, cycle[(i + 1) % cycle.length]] as const);
    const least = Math.min(...edges.map(([u, v]) => w[u][v]));
    for (const [u, v] of edges) {
      w[u][v] -= least;
    }
  }
}

export function maxFlowReduce(g: DebtGraph, fromId: string, toId: string, limit: number): number {
  checkCents(limit);
  const a = indexOf(g, fromId);
  const b = indexOf(g, toId);
  const w = g.weights;
  const n = w.length;
  const flow = w.map(() => new Array<number>(n).fill(0));
  const residual = (u: number, v: number) => w[u][v] - flow[u][v] + flow[v][u];

  let pushed = 0;
  while (pushed < limit) {
    const parent = new Array<number>(n).fill(-1);
    parent[a] = a;
    const queue = [a];
    for (let head = 0; head < queue.length && parent[b] === -1; head++) {
      const u = queue[head];
      for (let v = 0; v < n; v++) {
        if (parent[v] === -1 && residual(u, v) > 0) {
          parent[v] = u;
          queue.push(v);
        }
      }
    }
    if (parent[b] === -1) {
      break;
    }
    let step = limit - pushed;
    for (let v = b; v !== a; v = parent[v]) {
      step = Math.min(step, residual(parent[v], v));
    }
    for (let v = b; v !== a; v = parent[v]) {
      const u = parent[v];
      const cancelled = Math.min(step, flow[v][u]);
      flow[v][u] -= cancelled;
      flow[u][v] += step - cancelled;
    }
    pushed += step;
  }

  for (let u = 0; u < n; u++) {
    for (let v = 0; v < n; v++) {
      w[u][v] -= flow[u][v];
    }
  }
  return pushed;
}

export function compressSettled(g: DebtGraph): void {
  const w = g.weights;
  const n = w.length;
  const settled = g.ids.map((_, v) => v).filter((v) => netAt(w, v) === 0);
  for (const v of settled) {
    const ins = [...Array(n).keys()].filter((u) => w[u][v] > 0);
    const outs = [...Array(n).keys()].filter((x) => w[v][x] > 0);
    let i = 0;
    let o = 0;
    while (i < ins.length && o < outs.length) {
      const u = ins[i];
      const x = outs[o];
      const cents = Math.min(w[u][v], w[v][x]);
      w[u][v] -= cents;
      w[v][x] -= cents;
      addWeight(w, u, x, cents);
      if (w[u][v] === 0) {
        i++;
      }
      if (w[v][x] === 0) {
        o++;
      }
    }
  }
}

export function edgesOf(g: DebtGraph): Transfer[] {
  const edges: Transfer[] = [];
  g.weights.forEach((row, u) =>
    row.forEach((amountCents, v) => {
      if (amountCents > 0) {
        edges.push({ from: g.ids[u], to: g.ids[v], amountCents });
      }
    }),
  );
  return edges;
}
