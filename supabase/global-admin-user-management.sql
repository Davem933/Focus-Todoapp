create or replace function public.list_app_users()
returns table (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, private
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.is_global_admin() then
    raise exception 'Only global admins can view users.' using errcode = '42501';
  end if;

  return query
  select
    users.id as user_id,
    users.email::text as email,
    coalesce(profiles.role, 'user') as role,
    users.created_at
  from auth.users as users
  left join public.profiles as profiles
    on profiles.id = users.id
  order by users.created_at desc, users.email asc;
end;
$$;

create or replace function public.update_global_user_role(target_user_id uuid, new_role text)
returns table (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, private
as $$
declare
  v_current_role text;
  v_admin_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not private.is_global_admin() then
    raise exception 'Only global admins can change global roles.' using errcode = '42501';
  end if;

  if new_role not in ('user', 'admin') then
    raise exception 'Unsupported global role.' using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;

  select profiles.role into v_current_role
  from public.profiles as profiles
  where profiles.id = target_user_id;

  v_current_role := coalesce(v_current_role, 'user');

  if v_current_role = 'admin' and new_role = 'user' then
    select count(*) into v_admin_count
    from public.profiles as profiles
    where profiles.role = 'admin';

    if v_admin_count <= 1 then
      raise exception 'Application must have at least one global admin.' using errcode = '23514';
    end if;
  end if;

  insert into public.profiles (id, role)
  values (target_user_id, new_role)
  on conflict (id)
  do update set role = excluded.role;

  return query
  select
    users.id as user_id,
    users.email::text as email,
    profiles.role,
    users.created_at
  from auth.users as users
  join public.profiles as profiles
    on profiles.id = users.id
  where users.id = target_user_id;
end;
$$;

revoke execute on function public.list_app_users() from public, anon;
grant execute on function public.list_app_users() to authenticated;

revoke execute on function public.update_global_user_role(uuid, text) from public, anon;
grant execute on function public.update_global_user_role(uuid, text) to authenticated;
