create table public.payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_user_id uuid not null references public.profiles (id),
  to_user_id uuid not null references public.profiles (id),
  amount_cents bigint not null check (amount_cents > 0),
  paid_on date not null,
  note text check (char_length(note) <= 120),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (from_user_id <> to_user_id)
);

create index payments_group_id_idx on public.payments (group_id) where deleted_at is null;

alter table public.payments enable row level security;
alter table public.payments force row level security;

revoke all on table public.payments from anon, authenticated;
grant select on table public.payments to authenticated;

create policy payments_select on public.payments
  for select to authenticated using (public.is_group_member(group_id));

create view public.group_member_balances with (security_invoker = true) as
with flows as (
  select e.group_id, e.payer_id as user_id, e.amount_cents as cents
  from public.expenses e
  where e.deleted_at is null
  union all
  select e.group_id, s.user_id, -s.amount_cents
  from public.expense_splits s
  join public.expenses e on e.id = s.expense_id
  where e.deleted_at is null
  union all
  select p.group_id, p.from_user_id, p.amount_cents
  from public.payments p
  where p.deleted_at is null
  union all
  select p.group_id, p.to_user_id, -p.amount_cents
  from public.payments p
  where p.deleted_at is null
)
select m.group_id, m.user_id, coalesce(sum(f.cents), 0)::bigint as net_cents
from public.group_members m
left join flows f on f.group_id = m.group_id and f.user_id = m.user_id
group by m.group_id, m.user_id;

create view public.group_pair_balances with (security_invoker = true) as
with debts as (
  select e.group_id, s.user_id as debtor_id, e.payer_id as creditor_id, s.amount_cents
  from public.expense_splits s
  join public.expenses e on e.id = s.expense_id
  where e.deleted_at is null and s.user_id <> e.payer_id
  union all
  select p.group_id, p.to_user_id, p.from_user_id, p.amount_cents
  from public.payments p
  where p.deleted_at is null
),
pairs as (
  select group_id,
         least(debtor_id, creditor_id) as low_id,
         greatest(debtor_id, creditor_id) as high_id,
         sum(case when debtor_id < creditor_id then amount_cents else -amount_cents end) as low_owes
  from debts
  group by group_id, least(debtor_id, creditor_id), greatest(debtor_id, creditor_id)
)
select group_id,
       case when low_owes > 0 then low_id else high_id end as debtor_id,
       case when low_owes > 0 then high_id else low_id end as creditor_id,
       abs(low_owes)::bigint as amount_cents
from pairs
where low_owes <> 0;

create view public.overall_pair_balances with (security_invoker = true) as
with pairs as (
  select least(debtor_id, creditor_id) as low_id,
         greatest(debtor_id, creditor_id) as high_id,
         sum(case when debtor_id < creditor_id then amount_cents else -amount_cents end) as low_owes
  from public.group_pair_balances
  group by least(debtor_id, creditor_id), greatest(debtor_id, creditor_id)
)
select case when low_owes > 0 then low_id else high_id end as debtor_id,
       case when low_owes > 0 then high_id else low_id end as creditor_id,
       abs(low_owes)::bigint as amount_cents
from pairs
where low_owes <> 0;

revoke all on table public.group_member_balances, public.group_pair_balances, public.overall_pair_balances
  from anon, authenticated;
grant select on table public.group_member_balances, public.group_pair_balances, public.overall_pair_balances
  to authenticated;

create function public.save_payment(p_payment jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_id uuid := (p_payment->>'id')::uuid;
  v_group_id uuid := (p_payment->>'group_id')::uuid;
  v_from uuid := (p_payment->>'from_user_id')::uuid;
  v_to uuid := (p_payment->>'to_user_id')::uuid;
  v_amount bigint := (p_payment->>'amount_cents')::bigint;
  v_paid_on date := (p_payment->>'paid_on')::date;
  v_note text := nullif(btrim(p_payment->>'note'), '');
  v_archived_at timestamptz;
  v_before public.payments;
  v_after public.payments;
begin
  if not public.is_group_member(v_group_id) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  select archived_at into v_archived_at from public.groups where id = v_group_id for update;
  if v_archived_at is not null then
    raise exception 'group is archived' using errcode = 'DS002';
  end if;

  if v_id is not null then
    select * into v_before from public.payments where id = v_id for update;
    if not found or v_before.group_id <> v_group_id or v_before.deleted_at is not null then
      raise exception 'payment not found' using errcode = 'DS008';
    end if;
  end if;

  if v_amount is null or v_amount <= 0 then
    raise exception 'amount must be a positive number of cents' using errcode = 'DS007';
  end if;
  if v_paid_on is null then
    raise exception 'payment date is required' using errcode = 'DS007';
  end if;
  if char_length(v_note) > 120 then
    raise exception 'note must have at most 120 characters' using errcode = 'DS007';
  end if;
  if v_from is null or v_to is null or v_from = v_to then
    raise exception 'a payment needs two different people' using errcode = 'DS007';
  end if;
  if (select count(*) from public.group_members
      where group_id = v_group_id and user_id in (v_from, v_to)) <> 2 then
    raise exception 'both people must be group members' using errcode = 'DS007';
  end if;

  if v_id is null then
    insert into public.payments (group_id, from_user_id, to_user_id, amount_cents, paid_on, note, created_by)
    values (v_group_id, v_from, v_to, v_amount, v_paid_on, v_note, v_actor)
    returning * into v_after;

    insert into public.activity_log (group_id, actor_id, entity_type, entity_id, action, after)
    values (v_group_id, v_actor, 'payment', v_after.id, 'create', to_jsonb(v_after));
    return v_after.id;
  end if;

  if (v_before.from_user_id, v_before.to_user_id, v_before.amount_cents, v_before.paid_on, v_before.note)
     is not distinct from (v_from, v_to, v_amount, v_paid_on, v_note) then
    return v_id;
  end if;

  update public.payments
  set from_user_id = v_from, to_user_id = v_to, amount_cents = v_amount, paid_on = v_paid_on,
      note = v_note, updated_at = now()
  where id = v_id
  returning * into v_after;

  insert into public.activity_log (group_id, actor_id, entity_type, entity_id, action, before, after)
  values (v_group_id, v_actor, 'payment', v_id, 'update', to_jsonb(v_before), to_jsonb(v_after));
  return v_id;
end $$;

create function public.delete_payment(p_payment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_group_id uuid := (select group_id from public.payments where id = p_payment_id);
  v_archived_at timestamptz;
  v_before public.payments;
begin
  if not public.is_group_member(v_group_id) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  select archived_at into v_archived_at from public.groups where id = v_group_id for update;
  if v_archived_at is not null then
    raise exception 'group is archived' using errcode = 'DS002';
  end if;
  select * into v_before from public.payments where id = p_payment_id and deleted_at is null for update;
  if not found then
    raise exception 'payment not found' using errcode = 'DS008';
  end if;

  update public.payments set deleted_at = now() where id = p_payment_id;

  insert into public.activity_log (group_id, actor_id, entity_type, entity_id, action, before)
  values (v_group_id, (select auth.uid()), 'payment', p_payment_id, 'delete', to_jsonb(v_before));
end $$;

revoke execute on function public.save_payment(jsonb) from public, anon;
revoke execute on function public.delete_payment(uuid) from public, anon;
grant execute on function public.save_payment(jsonb) to authenticated;
grant execute on function public.delete_payment(uuid) to authenticated;
