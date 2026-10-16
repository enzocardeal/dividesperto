import assert from "node:assert/strict";
import { test } from "node:test";
import { describeActivity, type ActivityEntry } from "./activity.ts";
import { formatBRL } from "./money/format.ts";

const names = new Map([
  ["ana", "Ana"],
  ["bruno", "Bruno"],
  ["caio", "Caio"],
]);
const nameOf = (id: string) => names.get(id) ?? "Alguém";

const dinner = {
  description: "Jantar",
  amount_cents: 8000,
  expense_date: "2026-10-15",
  payer_id: "ana",
  split_method: "equal",
  category: null,
  splits: [
    { user_id: "ana", amount_cents: 4000, weight: null },
    { user_id: "bruno", amount_cents: 4000, weight: null },
  ],
  items: [],
};

function entry(fields: Partial<ActivityEntry>): ActivityEntry {
  return { actor_id: "ana", entity_type: "expense", action: "create", before: null, after: null, ...fields };
}

test("an expense creation names the expense, the amount and the payer", () => {
  assert.deepEqual(describeActivity(entry({ after: dinner }), nameOf), {
    title: "Ana adicionou a despesa “Jantar”",
    details: [`${formatBRL(8000)} · pago por Ana`],
  });
});

test("an expense update lists the old and new values", () => {
  const after = {
    ...dinner,
    amount_cents: 9000,
    expense_date: "2026-10-16",
    payer_id: "bruno",
    category: "food",
    split_method: "exact",
    splits: [
      { user_id: "bruno", amount_cents: 6000, weight: null },
      { user_id: "caio", amount_cents: 3000, weight: null },
    ],
  };
  assert.deepEqual(describeActivity(entry({ actor_id: "bruno", action: "update", before: dinner, after }), nameOf), {
    title: "Bruno alterou a despesa “Jantar”",
    details: [
      `Valor: ${formatBRL(8000)} → ${formatBRL(9000)}`,
      "Data: 15/10/2026 → 16/10/2026",
      "Pago por: Ana → Bruno",
      "Categoria: Sem categoria → Alimentação",
      "Divisão: Igual → Valores",
      `Parte de Ana: ${formatBRL(4000)} → —`,
      `Parte de Bruno: ${formatBRL(4000)} → ${formatBRL(6000)}`,
      `Parte de Caio: — → ${formatBRL(3000)}`,
    ],
  });
});

test("a renamed expense shows the old and new description", () => {
  const view = describeActivity(entry({ action: "update", before: dinner, after: { ...dinner, description: "Pizza" } }), nameOf);
  assert.equal(view.title, "Ana alterou a despesa “Pizza”");
  assert.deepEqual(view.details, ["Descrição: Jantar → Pizza"]);
});

test("an expense deletion names the deleted expense", () => {
  assert.deepEqual(describeActivity(entry({ action: "delete", before: dinner }), nameOf), {
    title: "Ana excluiu a despesa “Jantar”",
    details: [`${formatBRL(8000)} · pago por Ana`],
  });
});

test("group and member entries render their own sentences", () => {
  const group = { name: "Praia", archived_at: null };
  const archived = { ...group, archived_at: "2026-10-16T12:00:00+00:00" };
  assert.equal(describeActivity(entry({ entity_type: "group", after: group }), nameOf).title, "Ana criou o grupo “Praia”");
  assert.equal(
    describeActivity(entry({ entity_type: "group", action: "update", before: group, after: archived }), nameOf).title,
    "Ana arquivou o grupo",
  );
  assert.equal(
    describeActivity(entry({ entity_type: "group", action: "update", before: archived, after: group }), nameOf).title,
    "Ana desarquivou o grupo",
  );
  assert.deepEqual(
    describeActivity(entry({ entity_type: "group", action: "update", before: group, after: { ...group, name: "Serra" } }), nameOf),
    { title: "Ana renomeou o grupo", details: ["Nome: Praia → Serra"] },
  );
  assert.equal(
    describeActivity(entry({ entity_type: "member", after: { user_id: "caio" } }), nameOf).title,
    "Ana adicionou Caio ao grupo",
  );
});

test("an unknown entry or a broken snapshot still renders", () => {
  assert.deepEqual(describeActivity(entry({ entity_type: "settlement" }), nameOf), {
    title: "Ana fez uma alteração",
    details: [],
  });
  assert.deepEqual(describeActivity(entry({ actor_id: "zé", after: "oops" }), nameOf), {
    title: "Alguém adicionou a despesa “”",
    details: ["— · pago por Alguém"],
  });
});

const pix = {
  from_user_id: "bruno",
  to_user_id: "ana",
  amount_cents: 5000,
  paid_on: "2026-10-16",
  note: null,
};

test("a payment creation names both people, the amount and the date", () => {
  assert.deepEqual(describeActivity(entry({ actor_id: "bruno", entity_type: "payment", after: pix }), nameOf), {
    title: "Bruno registrou um pagamento de Bruno para Ana",
    details: [`${formatBRL(5000)} · 16/10/2026`],
  });
});

test("a payment update lists the old and new values", () => {
  const after = { ...pix, from_user_id: "caio", amount_cents: 4000, paid_on: "2026-10-17", note: "Pix" };
  assert.deepEqual(describeActivity(entry({ entity_type: "payment", action: "update", before: pix, after }), nameOf), {
    title: "Ana alterou o pagamento de Caio para Ana",
    details: [
      "Quem pagou: Bruno → Caio",
      `Valor: ${formatBRL(5000)} → ${formatBRL(4000)}`,
      "Data: 16/10/2026 → 17/10/2026",
      "Nota: — → Pix",
    ],
  });
});

test("a payment deletion names the deleted payment", () => {
  assert.deepEqual(describeActivity(entry({ entity_type: "payment", action: "delete", before: pix }), nameOf), {
    title: "Ana excluiu o pagamento de Bruno para Ana",
    details: [`${formatBRL(5000)} · 16/10/2026`],
  });
});
