const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const calendarDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const localDateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});
const localDay = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

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

export function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`expected an ISO timestamp, got ${timestamp}`);
  }
  return localDateTime.format(date);
}

export function todayInSaoPaulo(now: Date): string {
  const parts = Object.fromEntries(localDay.formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
