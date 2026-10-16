export type BRLInputState = {
  text: string;
  caret: number;
};

export type BRLInputEdit = {
  value: string;
  caret: number;
  data: string | null;
  inputType: string;
};

export function formatBRLInput(raw: string, caret = raw.length): BRLInputState {
  let kept = "";
  let at = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if ((ch >= "0" && ch <= "9") || (ch === "," && !kept.includes(","))) {
      kept += ch;
      if (i < caret) {
        at++;
      }
    }
  }

  const comma = kept.indexOf(",");
  let integer = comma === -1 ? kept : kept.slice(0, comma);
  let decimals = comma === -1 ? null : kept.slice(comma + 1);

  const zeros = integer.length - integer.replace(/^0+(?=\d)/, "").length;
  integer = integer.slice(zeros);
  at -= Math.min(zeros, at);
  if (decimals !== null && integer === "") {
    integer = "0";
    at++;
  }
  if (decimals !== null && decimals.length > 2) {
    decimals = decimals.slice(0, 2);
    at = Math.min(at, integer.length + 3);
  }

  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const text = decimals === null ? grouped : `${grouped},${decimals}`;

  let position = 0;
  for (let seen = 0; seen < at && position < text.length; position++) {
    if (text[position] !== ".") {
      seen++;
    }
  }
  return { text, caret: position };
}

export function editBRLInput(previous: string, edit: BRLInputEdit): BRLInputState {
  let { value, caret } = edit;
  if (edit.data === "." && value[caret - 1] === ".") {
    value = `${value.slice(0, caret - 1)},${value.slice(caret)}`;
  } else if (
    edit.inputType === "deleteContentBackward" &&
    caret > 0 &&
    formatBRLInput(value).text === previous
  ) {
    value = value.slice(0, caret - 1) + value.slice(caret);
    caret--;
  }
  return formatBRLInput(value, caret);
}

export function centsToBRLInput(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError(`cents must be a non-negative safe integer, got ${cents}`);
  }
  const reais = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, "0");
  return formatBRLInput(`${reais},${rest}`).text;
}
