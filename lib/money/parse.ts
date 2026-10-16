const BRL_PATTERN = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

export function parseBRL(input: string): number | null {
  const match = BRL_PATTERN.exec(input.trim());
  if (!match) {
    return null;
  }
  const reais = Number(match[1].replaceAll(".", ""));
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  const total = reais * 100 + cents;
  return Number.isSafeInteger(total) ? total : null;
}
