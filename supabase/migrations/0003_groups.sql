create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid not null references public.profiles (id),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  added_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_id_idx on public.group_members (user_id);

create table public.activity_log (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  actor_id uuid not null references public.profiles (id),
  entity_type text not null check (entity_type in ('group', 'member', 'expense', 'payment')),
  entity_id uuid not null,
  action text not null check (action in ('create', 'update', 'delete')),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_group_id_created_at_idx on public.activity_log (group_id, created_at desc);

create function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.group_members (group_id, user_id, added_by)
  values (new.id, new.created_by, new.created_by);
  return new;
end $$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

revoke execute on function public.handle_new_group() from public, anon, authenticated;

create function public.is_group_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = (select auth.uid()));
$$;

revoke execute on function public.is_group_member(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;

alter table public.groups enable row level security;
alter table public.groups force row level security;
alter table public.group_members enable row level security;
alter table public.group_members force row level security;
alter table public.activity_log enable row level security;
alter table public.activity_log force row level security;

revoke all on table public.groups, public.group_members, public.activity_log from anon, authenticated;
revoke all on sequence public.activity_log_id_seq from anon, authenticated;
grant select on table public.groups, public.group_members, public.activity_log to authenticated;

create policy groups_select on public.groups
  for select to authenticated using (public.is_group_member(id));

create policy gm_select on public.group_members
  for select to authenticated using (public.is_group_member(group_id));

create policy activity_select on public.activity_log
  for select to authenticated using (public.is_group_member(group_id));

create function public.create_group(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_name text := btrim(p_name);
  v_group public.groups;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) not between 1 and 80 then
    raise exception 'group name must have 1 to 80 characters' using errcode = 'DS003';
  end if;

  insert into public.groups (name, created_by)
  values (v_name, v_actor)
  returning * into v_group;

  insert into public.activity_log (group_id, actor_id, entity_type, entity_id, action, after)
  values (v_group.id, v_actor, 'group', v_group.id, 'create', to_jsonb(v_group));

  return v_group.id;
end $$;

create function public.update_group(p_group_id uuid, p_name text, p_archived boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_before public.groups;
  v_after public.groups;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'not a member' using errcode = '42501';
  end if;

  select * into v_before from public.groups where id = p_group_id for update;
  v_after := v_before;
  v_after.name := coalesce(btrim(p_name), v_before.name);
  v_after.archived_at := case
    when p_archived is null then v_before.archived_at
    when p_archived then coalesce(v_before.archived_at, now())
  end;

  if v_after is not distinct from v_before then
    return;
  end if;
  if v_before.archived_at is not null and v_after.archived_at is not null then
    raise exception 'group is archived' using errcode = 'DS002';
  end if;
  if char_length(v_after.name) not between 1 and 80 then
    raise exception 'group name must have 1 to 80 characters' using errcode = 'DS003';
  end if;

  update public.groups
  set name = v_after.name, archived_at = v_after.archived_at
  where id = p_group_id;

  insert into public.activity_log (group_id, actor_id, entity_type, entity_id, action, before, after)
  values (p_group_id, (select auth.uid()), 'group', p_group_id, 'update',
          to_jsonb(v_before), to_jsonb(v_after));
end $$;

create function public.add_group_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_archived_at timestamptz;
  v_member public.group_members;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  select archived_at into v_archived_at from public.groups where id = p_group_id for update;
  if v_archived_at is not null then
    raise exception 'group is archived' using errcode = 'DS002';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'profile not found' using errcode = 'DS004';
  end if;

  insert into public.group_members (group_id, user_id, added_by)
  values (p_group_id, p_user_id, v_actor)
  on conflict do nothing
  returning * into v_member;

  if v_member.group_id is null then
    return;
  end if;

  insert into public.activity_log (group_id, actor_id, entity_type, entity_id, action, after)
  values (p_group_id, v_actor, 'member', p_user_id, 'create', to_jsonb(v_member));
end $$;

revoke execute on function public.create_group(text) from public, anon;
revoke execute on function public.update_group(uuid, text, boolean) from public, anon;
revoke execute on function public.add_group_member(uuid, uuid) from public, anon;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.update_group(uuid, text, boolean) to authenticated;
grant execute on function public.add_group_member(uuid, uuid) to authenticated;
