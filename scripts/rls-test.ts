import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ExpensePayload } from "../lib/expenses.ts";
import { loginErrorFor } from "../lib/login-error.ts";
import { todayInSaoPaulo } from "../lib/money/format.ts";
import type { PaymentPayload } from "../lib/payments.ts";

type Stack = { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
type User = { id: string; email: string; client: SupabaseClient };
type Result<T> = { data: T; error: null } | { data: unknown; error: { code?: string; message: string } };
type Read = { name: string; run: (client: SupabaseClient) => PromiseLike<Result<unknown[]>> };
type Target = { table: string; row: () => Record<string, unknown>; match: () => Record<string, string> };
type Call = { name: string; fn: string; args: () => Record<string, unknown> };

const DENIED = /permission denied/;
const NOT_MEMBER = /not a member/;

const stack: Stack = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }),
);
const run = randomUUID().slice(0, 8);
const password = randomUUID();
const today = todayInSaoPaulo(new Date());

const admin = newClient(stack.SERVICE_ROLE_KEY);
const anon = newClient(stack.ANON_KEY);

let owner: User;
let member: User;
let outsider: User;
let groupId = "";
let outsiderGroupId = "";
let expenseId = "";
let paymentId = "";
let itemId = "";

function newClient(key: string): SupabaseClient {
  return createClient(stack.API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function emailFor(name: string): string {
  return `${name}-${run}@rls.test`;
}

function ok<T>(result: Result<T>, what: string): T {
  if (result.error) {
    assert.fail(`${what}: ${result.error.code} ${result.error.message}`);
  }
  return result.data;
}

function refused(result: Result<unknown>, code: string, reason: RegExp, what: string): void {
  const got = result.error ? `${result.error.code} ${result.error.message}` : "success";
  assert.equal(result.error?.code, code, `${what} returned ${got}, expected ${code}`);
  assert.match(result.error?.message ?? "", reason, `${what} returned ${got}`);
}

async function signUp(name: string): Promise<User> {
  const email = emailFor(name);
  const client = newClient(stack.ANON_KEY);
  const { data, error } = await client.auth.signUp({ email, password });
  if (error || !data.user || !data.session) {
    assert.fail(`sign-up of ${email}: ${error?.message ?? "no session"}`);
  }
  return { id: data.user.id, email, client };
}

function expensePayload(changes: Partial<ExpensePayload> = {}): ExpensePayload {
  return {
    id: null,
    group_id: groupId,
    description: "Pizza",
    amount_cents: 11000,
    expense_date: today,
    payer_id: owner.id,
    split_method: "items",
    category: "food",
    splits: [
      { user_id: owner.id, amount_cents: 3300, weight: null },
      { user_id: member.id, amount_cents: 7700, weight: null },
    ],
    items: [
      { description: "Pizza grande", amount_cents: 6000, participant_ids: [owner.id, member.id] },
      { description: "Vinho", amount_cents: 4000, participant_ids: [member.id] },
    ],
    ...changes,
  };
}

function paymentPayload(changes: Partial<PaymentPayload> = {}): PaymentPayload {
  return {
    id: null,
    group_id: groupId,
    from_user_id: member.id,
    to_user_id: owner.id,
    amount_cents: 2000,
    paid_on: today,
    note: "Pix",
    ...changes,
  };
}

const READS: Read[] = [
  { name: "groups", run: (c) => c.from("groups").select("*").eq("id", groupId) },
  { name: "group_members", run: (c) => c.from("group_members").select("*").eq("group_id", groupId).order("user_id") },
  { name: "expenses", run: (c) => c.from("expenses").select("*").eq("group_id", groupId) },
  {
    name: "expense_splits",
    run: (c) => c.from("expense_splits").select("*").eq("expense_id", expenseId).order("user_id"),
  },
  {
    name: "expense_items",
    run: (c) => c.from("expense_items").select("*").eq("expense_id", expenseId).order("position"),
  },
  {
    name: "expense_item_participants",
    run: (c) => c.from("expense_item_participants").select("*").eq("item_id", itemId).order("user_id"),
  },
  { name: "payments", run: (c) => c.from("payments").select("*").eq("group_id", groupId) },
  { name: "activity_log", run: (c) => c.from("activity_log").select("*").eq("group_id", groupId).order("id") },
  { name: "group_member_balances", run: (c) => c.from("group_member_balances").select("*").eq("group_id", groupId) },
  { name: "group_pair_balances", run: (c) => c.from("group_pair_balances").select("*").eq("group_id", groupId) },
  { name: "overall_pair_balances", run: (c) => c.from("overall_pair_balances").select("*") },
];

const TARGETS: Target[] = [
  { table: "invited_emails", row: () => ({ email: emailFor("direct") }), match: () => ({ email: member.email }) },
  {
    table: "profiles",
    row: () => ({ id: member.id, email: member.email, display_name: "Direct" }),
    match: () => ({ id: member.id }),
  },
  { table: "groups", row: () => ({ name: "Direct", created_by: member.id }), match: () => ({ id: groupId }) },
  {
    table: "group_members",
    row: () => ({ group_id: groupId, user_id: outsider.id, added_by: member.id }),
    match: () => ({ group_id: groupId }),
  },
  {
    table: "expenses",
    row: () => ({
      group_id: groupId,
      description: "Direct",
      amount_cents: 1,
      expense_date: today,
      payer_id: member.id,
      split_method: "equal",
      created_by: member.id,
    }),
    match: () => ({ id: expenseId }),
  },
  {
    table: "expense_splits",
    row: () => ({ expense_id: expenseId, user_id: outsider.id, amount_cents: 1 }),
    match: () => ({ expense_id: expenseId }),
  },
  {
    table: "expense_items",
    row: () => ({ expense_id: expenseId, position: 99, description: "Direct", amount_cents: 1 }),
    match: () => ({ expense_id: expenseId }),
  },
  {
    table: "expense_item_participants",
    row: () => ({ item_id: itemId, user_id: outsider.id }),
    match: () => ({ item_id: itemId }),
  },
  {
    table: "payments",
    row: () => ({
      group_id: groupId,
      from_user_id: owner.id,
      to_user_id: member.id,
      amount_cents: 1,
      paid_on: today,
      created_by: member.id,
    }),
    match: () => ({ id: paymentId }),
  },
  {
    table: "activity_log",
    row: () => ({ group_id: groupId, actor_id: member.id, entity_type: "group", entity_id: groupId, action: "create" }),
    match: () => ({ group_id: groupId }),
  },
];

const GROUP_RPCS: Call[] = [
  {
    name: "update_group",
    fn: "update_group",
    args: () => ({ p_group_id: groupId, p_name: "Taken", p_archived: null }),
  },
  { name: "add_group_member", fn: "add_group_member", args: () => ({ p_group_id: groupId, p_user_id: outsider.id }) },
  { name: "save_expense (new)", fn: "save_expense", args: () => ({ p_expense: expensePayload() }) },
  { name: "save_expense (edit)", fn: "save_expense", args: () => ({ p_expense: expensePayload({ id: expenseId }) }) },
  { name: "delete_expense", fn: "delete_expense", args: () => ({ p_expense_id: expenseId }) },
  { name: "save_payment (new)", fn: "save_payment", args: () => ({ p_payment: paymentPayload() }) },
  { name: "save_payment (edit)", fn: "save_payment", args: () => ({ p_payment: paymentPayload({ id: paymentId }) }) },
  { name: "delete_payment", fn: "delete_payment", args: () => ({ p_payment_id: paymentId }) },
  {
    name: "settle_transfer",
    fn: "settle_transfer",
    args: () => ({
      p_group_id: groupId,
      p_from: member.id,
      p_to: owner.id,
      p_amount_cents: 5700,
      p_expected_from_net_cents: -5700,
    }),
  },
];

const AUTHENTICATED_RPCS: Call[] = [
  { name: "create_group", fn: "create_group", args: () => ({ p_name: "Anon" }) },
  { name: "is_group_member", fn: "is_group_member", args: () => ({ p_group_id: groupId }) },
];

const INTERNAL_RPCS: Call[] = [
  {
    name: "before_user_created_hook",
    fn: "before_user_created_hook",
    args: () => ({ event: { user: { email: emailFor("hook") } } }),
  },
  { name: "expense_snapshot", fn: "expense_snapshot", args: () => ({ p_expense_id: expenseId }) },
];

async function snapshot(): Promise<unknown[]> {
  const rows = [];
  for (const read of READS) {
    rows.push(ok(await read.run(member.client), read.name));
  }
  rows.push(ok(await member.client.from("profiles").select("*").order("id"), "profiles"));
  const invites = admin.from("invited_emails").select("email").like("email", `%-${run}@rls.test`).order("email");
  rows.push(ok(await invites, "invited_emails"));
  return rows;
}

async function memberNet(): Promise<number> {
  const query = member.client
    .from("group_member_balances")
    .select("net_cents")
    .eq("group_id", groupId)
    .eq("user_id", member.id);
  return Number(ok(await query, "group_member_balances")[0]?.net_cents);
}

before(async () => {
  const invites = ["owner", "member", "outsider"].map((name) => ({ email: emailFor(name) }));
  ok(await admin.from("invited_emails").insert(invites), "invite");
  owner = await signUp("owner");
  member = await signUp("member");
  outsider = await signUp("outsider");

  groupId = ok(await owner.client.rpc("create_group", { p_name: `RLS ${run}` }), "create_group");
  ok(await owner.client.rpc("add_group_member", { p_group_id: groupId, p_user_id: member.id }), "add_group_member");
  expenseId = ok(await owner.client.rpc("save_expense", { p_expense: expensePayload() }), "save_expense");
  paymentId = ok(await member.client.rpc("save_payment", { p_payment: paymentPayload() }), "save_payment");
  outsiderGroupId = ok(await outsider.client.rpc("create_group", { p_name: `Outsider ${run}` }), "create_group");
  const items = owner.client.from("expense_items").select("id").eq("expense_id", expenseId).order("position");
  itemId = ok(await items, "expense_items")[0].id;
});

after(async () => {
  const groups = [groupId, outsiderGroupId].filter((id) => id !== "");
  ok(await admin.from("groups").delete().in("id", groups), "delete groups");
  const { users } = ok(await admin.auth.admin.listUsers({ perPage: 1000 }), "list users");
  for (const user of users.filter((u) => u.email?.endsWith(`-${run}@rls.test`))) {
    ok(await admin.auth.admin.deleteUser(user.id), "delete user");
  }
  ok(await admin.from("invited_emails").delete().like("email", `%-${run}@rls.test`), "delete invites");
});

test("the hook refuses a sign-up from an email without an invite", async () => {
  const email = emailFor("stranger");
  const { data, error } = await newClient(stack.ANON_KEY).auth.signUp({ email, password });
  assert.equal(data.user, null);
  assert.equal(loginErrorFor(error?.message ?? null), "invite", `sign-up error: ${error?.message}`);

  const { users } = ok(await admin.auth.admin.listUsers({ perPage: 1000 }), "list users");
  const emails = new Set(users.map((user) => user.email));
  assert.equal(emails.has(email), false, "the refused sign-up left a row in auth.users");
  assert.ok(emails.has(owner.email), "an invited sign-up is missing from auth.users");
});

test("invited sign-ups get a profile", async () => {
  const ids = [owner.id, member.id, outsider.id];
  assert.equal(ok(await member.client.from("profiles").select("id").in("id", ids), "profiles").length, 3);
});

test("a member reads every table and view of the group", async () => {
  for (const read of READS) {
    const rows = ok(await read.run(member.client), read.name);
    assert.ok(rows.length > 0, `${read.name} returned no rows to a member`);
  }
});

test("an outsider reads no row of another group", async () => {
  const own = ok(await outsider.client.from("groups").select("id").eq("id", outsiderGroupId), "own group");
  assert.equal(own.length, 1, "the outsider cannot read their own group");
  for (const read of READS) {
    const rows = ok(await read.run(outsider.client), read.name);
    assert.equal(rows.length, 0, `${read.name} returned ${rows.length} rows to an outsider`);
  }
});

test("only authenticated users read app tables, and nobody reads invited_emails", async () => {
  const invites = member.client.from("invited_emails").select("email");
  refused(await invites, "42501", DENIED, "authenticated select invited_emails");
  refused(await anon.from("invited_emails").select("email"), "42501", DENIED, "anon select invited_emails");
  refused(await anon.from("profiles").select("id"), "42501", DENIED, "anon select profiles");
  for (const read of READS) {
    refused(await read.run(anon), "42501", DENIED, `anon select ${read.name}`);
  }
});

test("every direct insert, update and delete is refused for anon and for a member", async () => {
  const before = await snapshot();
  for (const [role, client] of [["anon", anon], ["member", member.client]] as const) {
    for (const target of TARGETS) {
      const table = () => client.from(target.table);
      const what = `${role} on ${target.table}`;
      refused(await table().insert(target.row()), "42501", DENIED, `${what}: insert`);
      refused(await table().update(target.row()).match(target.match()), "42501", DENIED, `${what}: update`);
      refused(await table().delete().match(target.match()), "42501", DENIED, `${what}: delete`);
    }
  }
  assert.deepEqual(await snapshot(), before, "a refused write changed the data");
});

test("every group RPC refuses a non-member", async () => {
  const before = await snapshot();
  for (const call of GROUP_RPCS) {
    refused(await outsider.client.rpc(call.fn, call.args()), "42501", NOT_MEMBER, `outsider ${call.name}`);
  }
  assert.deepEqual(await snapshot(), before, "a refused RPC changed the data");
});

test("anon cannot execute any RPC", async () => {
  for (const call of [...GROUP_RPCS, ...AUTHENTICATED_RPCS, ...INTERNAL_RPCS]) {
    refused(await anon.rpc(call.fn, call.args()), "42501", DENIED, `anon ${call.name}`);
  }
});

test("authenticated cannot execute the hook or the snapshot helper", async () => {
  for (const call of INTERNAL_RPCS) {
    refused(await member.client.rpc(call.fn, call.args()), "42501", DENIED, `member ${call.name}`);
  }
});

test("save_expense refuses splits that do not sum to the amount", async () => {
  const splits = [
    { user_id: owner.id, amount_cents: 3300, weight: null },
    { user_id: member.id, amount_cents: 7699, weight: null },
  ];
  const result = await member.client.rpc("save_expense", { p_expense: expensePayload({ id: expenseId, splits }) });
  refused(result, "DS005", /splits sum to/, "save_expense with a 1-cent gap");
});

test("settle_transfer refuses a stale expected net and accepts the current one", async () => {
  const net = await memberNet();
  assert.equal(net, -5700);
  const args = { p_group_id: groupId, p_from: member.id, p_to: owner.id, p_amount_cents: 5700 };
  const stale = await member.client.rpc("settle_transfer", { ...args, p_expected_from_net_cents: net + 1 });
  refused(stale, "DS009", /balances changed/, "settle_transfer with a stale net");
  ok(await member.client.rpc("settle_transfer", { ...args, p_expected_from_net_cents: net }), "settle_transfer");
  assert.equal(await memberNet(), 0);
});

test("an archived group refuses every write RPC", async () => {
  ok(await owner.client.rpc("update_group", { p_group_id: groupId, p_name: null, p_archived: true }), "archive");
  for (const call of GROUP_RPCS) {
    const result = await member.client.rpc(call.fn, call.args());
    refused(result, "DS002", /archived/, `member ${call.name} on an archived group`);
  }
  ok(await owner.client.rpc("update_group", { p_group_id: groupId, p_name: null, p_archived: false }), "unarchive");
});
