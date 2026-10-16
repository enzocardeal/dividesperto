import { strings } from "./strings.ts";

export const GROUP_NAME_MAX = 80;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RPC_ERRORS = new Map<string | undefined, string>([
  ["42501", strings.errors.notMember],
  ["DS002", strings.errors.archived],
  ["DS003", strings.newGroup.invalidName],
  ["DS004", strings.errors.personNotFound],
]);

export function parseGroupName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const name = value.trim();
  const length = [...name].length;
  return length >= 1 && length <= GROUP_NAME_MAX ? name : null;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function groupErrorMessage(code: string | undefined): string {
  return RPC_ERRORS.get(code) ?? strings.errors.generic;
}

export function memberCountLabel(count: number): string {
  return `${count} ${count === 1 ? strings.group.person : strings.group.people}`;
}
