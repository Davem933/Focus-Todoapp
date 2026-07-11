-- Fix: team members with a global admin flag (profiles.role = 'admin') could
-- see and manage every team in the app, not just teams they belong to.
--
-- Root cause: private.is_team_member() / private.is_team_admin() unconditionally
-- OR-ed in private.is_global_admin(), conflating the app-wide admin flag (used
-- to gate user management, see global-admin-user-management.sql) with
-- team-scoped membership/admin status. This let any global admin bypass the
-- teams_select_access / team_members_select_access / teams_update_by_admin /
-- teams_delete_by_admin / team_members_manage_by_admin RLS policies for teams
-- they never joined.
--
-- Global admin user management (list_app_users / update_global_user_role) does
-- not rely on team RLS bypass - those are security definer functions - so
-- removing the bypass here does not affect that feature.

create or replace function private.is_team_member(check_team_id uuid)
returns boolean
language sql
stable
set search_path to ''
as $$
  select exists (
      select 1
      from public.team_members as member
      where member.team_id = check_team_id
        and member.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.teams as team
      where team.id = check_team_id
        and team.owner_id = (select auth.uid())
        and not exists (
          select 1
          from public.team_members as member
          where member.team_id = check_team_id
            and member.user_id = (select auth.uid())
        )
    );
$$;

create or replace function private.is_team_admin(check_team_id uuid)
returns boolean
language sql
stable
set search_path to ''
as $$
  select exists (
      select 1
      from public.team_members as member
      where member.team_id = check_team_id
        and member.user_id = (select auth.uid())
        and member.role = 'admin'
    )
    or exists (
      select 1
      from public.teams as team
      where team.id = check_team_id
        and team.owner_id = (select auth.uid())
        and not exists (
          select 1
          from public.team_members as member
          where member.team_id = check_team_id
            and member.user_id = (select auth.uid())
        )
    );
$$;
