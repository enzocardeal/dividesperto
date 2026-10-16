create function public.settle_transfer(
  p_group_id uuid,
  p_from uuid,
  p_to uuid,
  p_amount_cents bigint,
  p_expected_from_net_cents bigint
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_archived_at timestamptz;
  v_from_net bigint;
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

  select net_cents into v_from_net from public.group_member_balances
  where group_id = p_group_id and user_id = p_from;
  if v_from_net is distinct from p_expected_from_net_cents then
    raise exception 'balances changed: expected %, found %', p_expected_from_net_cents, v_from_net
      using errcode = 'DS009';
  end if;

  insert into public.payments (group_id, from_user_id, to_user_id, amount_cents, paid_on, created_by)
  values (p_group_id, p_from, p_to, p_amount_cents, (now() at time zone 'America/Sao_Paulo')::date, v_actor)
  returning * into v_after;

  insert into public.activity_log (group_id, actor_id, entity_type, entity_id, action, after)
  values (p_group_id, v_actor, 'payment', v_after.id, 'create', to_jsonb(v_after));
  return v_after.id;
end $$;

revoke execute on function public.settle_transfer(uuid, uuid, uuid, bigint, bigint) from public, anon;
grant execute on function public.settle_transfer(uuid, uuid, uuid, bigint, bigint) to authenticated;
