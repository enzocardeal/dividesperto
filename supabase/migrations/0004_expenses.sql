create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  description text not null check (char_length(btrim(description)) between 1 and 120),
  amount_cents bigint not null check (amount_cents > 0),
  expense_date date not null,
  payer_id uuid not null references public.profiles (id),
  split_method text not null check (split_method in ('equal', 'exact', 'percent', 'shares', 'items')),
  category text check (category in ('food', 'transport', 'lodging', 'groceries', 'entertainment', 'shopping', 'utilities', 'other')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index expenses_group_id_expense_date_idx on public.expenses (group_id, expense_date desc)
  where deleted_at is null;

create table public.expense_splits (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  amount_cents bigint not null check (amount_cents >= 0),
  weight bigint check (weight > 0),
  primary key (expense_id, user_id)
);

create index expense_splits_user_id_idx on public.expense_splits (user_id);

create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  position int not null,
  description text not null check (char_length(btrim(description)) between 1 and 80),
  amount_cents bigint not null check (amount_cents > 0),
  unique (expense_id, position)
);

create table public.expense_item_participants (
  item_id uuid not null references public.expense_items (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  primary key (item_id, user_id)
);

alter table public.expenses enable row level security;
alter table public.expenses force row level security;
alter table public.expense_splits enable row level security;
alter table public.expense_splits force row level security;
alter table public.expense_items enable row level security;
alter table public.expense_items force row level security;
alter table public.expense_item_participants enable row level security;
alter table public.expense_item_participants force row level security;

revoke all on table public.expenses, public.expense_splits, public.expense_items, public.expense_item_participants
  from anon, authenticated;
grant select on table public.expenses, public.expense_splits, public.expense_items, public.expense_item_participants
  to authenticated;

create policy expenses_select on public.expenses
  for select to authenticated using (public.is_group_member(group_id));

create policy splits_select on public.expense_splits
  for select to authenticated using (exists (
    select 1 from public.expenses e
    where e.id = expense_id and public.is_group_member(e.group_id)));

create policy items_select on public.expense_items
  for select to authenticated using (exists (
    select 1 from public.expenses e
    where e.id = expense_id and public.is_group_member(e.group_id)));

create policy ip_select on public.expense_item_participants
  for select to authenticated using (exists (
    select 1 from public.expense_items i
    join public.expenses e on e.id = i.expense_id
    where i.id = item_id and public.is_group_member(e.group_id)));

create function public.expense_snapshot(p_expense_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select to_jsonb(e) || jsonb_build_object(
    'splits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', s.user_id, 'amount_cents', s.amount_cents, 'weight', s.weight) order by s.user_id)
      from public.expense_splits s
      where s.expense_id = e.id), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', i.position, 'description', i.description, 'amount_cents', i.amount_cents,
        'participant_ids', (
          select coalesce(jsonb_agg(p.user_id order by p.user_id), '[]'::jsonb)
          from public.expense_item_participants p
          where p.item_id = i.id)) order by i.position)
      from public.expense_items i
      where i.expense_id = e.id), '[]'::jsonb))
  from public.expenses e
  where e.id = p_expense_id;
$$;

revoke execute on function public.expense_snapshot(uuid) from public, anon, authenticated;

create function public.save_expense(p_expense jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_id uuid := (p_expense->>'id')::uuid;
  v_group_id uuid := (p_expense->>'group_id')::uuid;
  v_description text := btrim(p_expense->>'description');
  v_amount bigint := (p_expense->>'amount_cents')::bigint;
  v_date date := (p_expense->>'expense_date')::date;
  v_payer uuid := (p_expense->>'payer_id')::uuid;
  v_method text := p_expense->>'split_method';
  v_category text := p_expense->>'category';
  v_splits jsonb := coalesce(p_expense->'splits', '[]'::jsonb);
  v_items jsonb := coalesce(p_expense->'items', '[]'::jsonb);
  v_archived_at timestamptz;
  v_existing public.expenses;
  v_count int;
  v_distinct int;
  v_members int;
  v_amounts int;
  v_sum numeric;
  v_min bigint;
  v_max bigint;
  v_weights int;
  v_weight_sum numeric;
  v_weight_min bigint;
  v_before jsonb;
  v_after jsonb;
begin
  if not public.is_group_member(v_group_id) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  select archived_at into v_archived_at from public.groups where id = v_group_id for update;
  if v_archived_at is not null then
    raise exception 'group is archived' using errcode = 'DS002';
  end if;

  if v_id is not null then
    select * into v_existing from public.expenses where id = v_id for update;
    if not found or v_existing.group_id <> v_group_id or v_existing.deleted_at is not null then
      raise exception 'expense not found' using errcode = 'DS006';
    end if;
    v_before := public.expense_snapshot(v_id);
  end if;

  if v_description is null or char_length(v_description) not between 1 and 120 then
    raise exception 'description must have 1 to 120 characters' using errcode = 'DS005';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'amount must be a positive number of cents' using errcode = 'DS005';
  end if;
  if v_date is null then
    raise exception 'expense date is required' using errcode = 'DS005';
  end if;
  if v_method is null or v_method not in ('equal', 'exact', 'percent', 'shares', 'items') then
    raise exception 'unknown split method' using errcode = 'DS005';
  end if;
  if v_category is not null
     and v_category not in ('food', 'transport', 'lodging', 'groceries', 'entertainment', 'shopping', 'utilities', 'other') then
    raise exception 'unknown category' using errcode = 'DS005';
  end if;
  if not exists (select 1 from public.group_members where group_id = v_group_id and user_id = v_payer) then
    raise exception 'payer is not a group member' using errcode = 'DS005';
  end if;
  if jsonb_typeof(v_splits) <> 'array' or jsonb_typeof(v_items) <> 'array' then
    raise exception 'splits and items must be arrays' using errcode = 'DS005';
  end if;

  select count(*), count(distinct s.user_id), count(m.user_id), count(s.amount_cents),
         coalesce(sum(s.amount_cents), 0), min(s.amount_cents), max(s.amount_cents),
         count(s.weight), coalesce(sum(s.weight), 0), min(s.weight)
  into v_count, v_distinct, v_members, v_amounts, v_sum, v_min, v_max, v_weights, v_weight_sum, v_weight_min
  from jsonb_to_recordset(v_splits) as s(user_id uuid, amount_cents bigint, weight bigint)
  left join public.group_members m on m.group_id = v_group_id and m.user_id = s.user_id;

  if v_count = 0 or v_distinct <> v_count or v_members <> v_count then
    raise exception 'participants must be distinct group members' using errcode = 'DS005';
  end if;
  if v_amounts <> v_count or v_min < 0 then
    raise exception 'every split needs a non-negative amount' using errcode = 'DS005';
  end if;
  if v_sum <> v_amount then
    raise exception 'splits sum to % but the amount is %', v_sum, v_amount using errcode = 'DS005';
  end if;
  if v_method in ('percent', 'shares') then
    if v_weights <> v_count or v_weight_min <= 0 then
      raise exception 'every participant needs a positive weight' using errcode = 'DS005';
    end if;
    if v_method = 'percent' and v_weight_sum <> 10000 then
      raise exception 'percent weights sum to % basis points, not 10000', v_weight_sum using errcode = 'DS005';
    end if;
  elsif v_weights > 0 then
    raise exception 'only percent and shares splits carry weights' using errcode = 'DS005';
  end if;
  if v_method = 'equal' and v_max - v_min > 1 then
    raise exception 'equal splits differ by more than one cent' using errcode = 'DS005';
  end if;

  if v_method <> 'items' and jsonb_array_length(v_items) > 0 then
    raise exception 'only items splits carry items' using errcode = 'DS005';
  end if;
  if v_method = 'items' then
    if jsonb_array_length(v_items) = 0 then
      raise exception 'an items split needs at least one item' using errcode = 'DS005';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_items) as i(item)
      where char_length(btrim(coalesce(i.item->>'description', ''))) not between 1 and 80
         or coalesce((i.item->>'amount_cents')::bigint, 0) <= 0
         or jsonb_typeof(i.item->'participant_ids') is distinct from 'array'
    ) then
      raise exception 'every item needs a description, a positive amount and participants' using errcode = 'DS005';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_items) with ordinality as i(item, n)
      left join lateral jsonb_array_elements_text(i.item->'participant_ids') as p(user_id) on true
      group by i.n
      having count(p.user_id) = 0 or count(distinct p.user_id) <> count(p.user_id)
    ) then
      raise exception 'every item needs distinct participants' using errcode = 'DS005';
    end if;
    if exists (
      select p.user_id::uuid
      from jsonb_array_elements(v_items) as i(item)
      cross join jsonb_array_elements_text(i.item->'participant_ids') as p(user_id)
      except
      select s.user_id from jsonb_to_recordset(v_splits) as s(user_id uuid)
    ) or exists (
      select s.user_id from jsonb_to_recordset(v_splits) as s(user_id uuid)
      except
      select p.user_id::uuid
      from jsonb_array_elements(v_items) as i(item)
      cross join jsonb_array_elements_text(i.item->'participant_ids') as p(user_id)
    ) then
      raise exception 'split participants must equal the item participants' using errcode = 'DS005';
    end if;
  end if;

  if v_id is null then
    insert into public.expenses
      (group_id, description, amount_cents, expense_date, payer_id, split_method, category, created_by)
    values (v_group_id, v_description, v_amount, v_date, v_payer, v_method, v_category, v_actor)
    returning id into v_id;
  else
    update public.expenses
    set description = v_description, amount_cents = v_amount, expense_date = v_date,
        payer_id = v_payer, split_method = v_method, category = v_category
    where id = v_id;
    delete from public.expense_splits where expense_id = v_id;
    delete from public.expense_items where expense_id = v_id;
  end if;

  insert into public.expense_splits (expense_id, user_id, amount_cents, weight)
  select v_id, s.user_id, s.amount_cents, s.weight
  from jsonb_to_recordset(v_splits) as s(user_id uuid, amount_cents bigint, weight bigint);

  with inserted as (
    insert into public.expense_items (expense_id, position, description, amount_cents)
    select v_id, i.n, btrim(i.item->>'description'), (i.item->>'amount_cents')::bigint
    from jsonb_array_elements(v_items) with ordinality as i(item, n)
    returning id, position
  )
  insert into public.expense_item_participants (item_id, user_id)
  select inserted.id, p.user_id::uuid
  from inserted
  join jsonb_array_elements(v_items) with ordinality as i(item, n) on i.n = inserted.position
  cross join jsonb_array_elements_text(i.item->'participant_ids') as p(user_id);

  v_after := public.expense_snapshot(v_id);
  if v_before is null then
    insert into public.activity_log (group_id, actor_id, entity_type, entity_id, action, after)
    values (v_group_id, v_actor, 'expense', v_id, 'create', v_after);
  elsif v_after is distinct from v_before then
    update public.expenses set updated_at = now() where id = v_id;
    v_after := public.expense_snapshot(v_id);
    insert into public.activity_log (group_id, actor_id, entity_type, entity_id, action, before, after)
    values (v_group_id, v_actor, 'expense', v_id, 'update', v_before, v_after);
  end if;

  return v_id;
end $$;

create function public.delete_expense(p_expense_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_group_id uuid := (select group_id from public.expenses where id = p_expense_id);
  v_archived_at timestamptz;
  v_before jsonb;
begin
  if not public.is_group_member(v_group_id) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  select archived_at into v_archived_at from public.groups where id = v_group_id for update;
  if v_archived_at is not null then
    raise exception 'group is archived' using errcode = 'DS002';
  end if;
  perform 1 from public.expenses where id = p_expense_id and deleted_at is null for update;
  if not found then
    raise exception 'expense not found' using errcode = 'DS006';
  end if;

  v_before := public.expense_snapshot(p_expense_id);
  update public.expenses set deleted_at = now() where id = p_expense_id;

  insert into public.activity_log (group_id, actor_id, entity_type, entity_id, action, before)
  values (v_group_id, (select auth.uid()), 'expense', p_expense_id, 'delete', v_before);
end $$;

revoke execute on function public.save_expense(jsonb) from public, anon;
revoke execute on function public.delete_expense(uuid) from public, anon;
grant execute on function public.save_expense(jsonb) to authenticated;
grant execute on function public.delete_expense(uuid) to authenticated;
