export const BALANCE_VIEW_COOKIE = "ds_balance_view";

export type BalanceView = "simplified" | "full";

export function parseBalanceView(value: unknown): BalanceView {
  return value === "full" ? "full" : "simplified";
}
