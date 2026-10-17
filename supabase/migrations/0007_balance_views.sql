create view public.group_expense_debts with (security_invoker = true) as
select e.group_id, s.user_id as debtor_id, e.payer_id as creditor_id,
       sum(s.amount_cents)::bigint as amount_cents
from public.expense_splits s
join public.expenses e on e.id = s.expense_id
where e.deleted_at is null and s.user_id <> e.payer_id and s.amount_cents > 0
group by e.group_id, s.user_id, e.payer_id;

create view public.group_ledger_versions with (security_invoker = true) as
select group_id, max(id)::bigint as version
from public.activity_log
group by group_id;

revoke all on table public.group_expense_debts, public.group_ledger_versions from anon, authenticated;
grant select on table public.group_expense_debts, public.group_ledger_versions to authenticated;

alter table public.payments add column source text check (source in ('simplified', 'full'));

create function public.settle_line(
  p_group_id uuid,
  p_from uuid,
  p_to uuid,
  p_amount_cents bigint,
  p_expected_version bigint,
  p_view text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_archived_at timestamptz;
  v_version bigint;
  v_after public.payments;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  select archived_at into v_archived_at from public.groups where id = p_group_id for update;
  if v_archived_at is not null then
    raise exception 'group is archived' using errcode = 'DS002';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'amount must be a positive number of cents' using errcode = 'DS007';
  end if;
  if p_from is null or p_to is null or p_from = p_to then
    raise exception 'a payment needs two different people' using errcode = 'DS007';
  end if;
  if (select count(*) from public.group_members
      where group_id = p_group_id and user_id in (p_from, p_to)) <> 2 then
    raise exception 'both people must be group members' using errcode = 'DS007';
  end if;
  if p_view is null or p_view not in ('simplified', 'full') then
    raise exception 'unknown balance view' using errcode = 'DS007';
  end if;

  select coalesce(max(id), 0) into v_version from public.activity_log where group_id = p_group_id;
  if p_expected_version is distinct from v_version then
    raise exception 'balances changed: expected version %, found %', p_expected_version, v_version
      using errcode = 'DS009';
  end if;

  insert into public.payments (group_id, from_user_id, to_user_id, amount_cents, paid_on, source, created_by)
  values (p_group_id, p_from, p_to, p_amount_cents, (now() at time zone 'America/Sao_Paulo')::date, p_view, v_actor)
  returning * into v_after;

  insert into public.activity_log (group_id, actor_id, entity_type, entity_id, action, after)
  values (p_group_id, v_actor, 'payment', v_after.id, 'create', to_jsonb(v_after));
  return v_after.id;
end $$;

revoke execute on function public.settle_line(uuid, uuid, uuid, bigint, bigint, text) from public, anon;
grant execute on function public.settle_line(uuid, uuid, uuid, bigint, bigint, text) to authenticated;
