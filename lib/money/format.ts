const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const calendarDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

export function formatBRL(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`cents must be a safe integer, got ${cents}`);
  }
  return currency.format(cents / 100);
}

export function formatDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    throw new RangeError(`expected YYYY-MM-DD, got ${isoDate}`);
  }
  return calendarDate.format(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}
