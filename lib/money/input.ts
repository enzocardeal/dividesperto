export type BRLInputEdit = {
  value: string;
  inputType: string;
};

const MAX_DIGITS = String(Number.MAX_SAFE_INTEGER).length;

function digitsOf(text: string): string {
  return text.replace(/\D/g, "").replace(/^0+/, "");
}

function digitsToCents(digits: string): number | null {
  if (digits.length > MAX_DIGITS) {
    return null;
  }
  const cents = Number(digits);
  return Number.isSafeInteger(cents) ? cents : null;
}

function inputText(cents: number): string {
  return cents === 0 ? "" : centsToBRLInput(cents);
}

export function centsToBRLInput(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError(`cents must be a non-negative safe integer, got ${cents}`);
  }
  const rest = cents % 100;
  const reais = String((cents - rest) / 100).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${reais},${String(rest).padStart(2, "0")}`;
}

export function editBRLInput(previous: string, edit: BRLInputEdit): string {
  const before = digitsOf(previous);
  let digits = digitsOf(edit.value);
  if (digits === before) {
    if (!edit.inputType.startsWith("delete")) {
      return previous;
    }
    digits = before.slice(0, -1);
  }
  const cents = digitsToCents(digits);
  return cents === null ? previous : inputText(cents);
}

export function parsePastedBRL(text: string): number | null {
  const kept = text.replace(/[^\d.,]/g, "");
  const separator = Math.max(kept.lastIndexOf(","), kept.lastIndexOf("."));
  const decimals = separator === -1 ? "" : kept.slice(separator + 1);
  const hasDecimals = decimals.length === 1 || decimals.length === 2;
  const reais = (hasDecimals ? kept.slice(0, separator) : kept).replace(/\D/g, "");
  if (reais === "" && !hasDecimals) {
    return null;
  }
  return digitsToCents(digitsOf(`${reais}${hasDecimals ? decimals.padEnd(2, "0") : "00"}`));
}

export function pasteBRLInput(previous: string, pasted: string): string {
  const cents = parsePastedBRL(pasted);
  return cents === null ? previous : inputText(cents);
}
