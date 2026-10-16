import { strings } from "./strings.ts";

export const CATEGORIES = [
  "food",
  "transport",
  "lodging",
  "groceries",
  "entertainment",
  "shopping",
  "utilities",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return CATEGORIES.includes(value as Category);
}

export function categoryLabel(value: unknown): string | null {
  return isCategory(value) ? strings.categories[value] : null;
}
