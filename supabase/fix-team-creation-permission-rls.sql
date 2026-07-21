-- Fix: any authenticated user could create a new team (teams_insert_own only
-- required owner_id = auth.uid()), including plain team members with no admin
-- role anywhere. Per product decision, team creation is restricted to global
-- admins and users who are already a team admin of at least one team.
--
-- Note this closes self-service team creation for brand-new users with no
-- admin role anywhere - only a global admin can create the first team for
-- someone, who can then promote other members to admin so they can create
-- further teams themselves.

drop policy if exists "teams_insert_own" on public.teams;
create policy "teams_insert_own"
on public.teams for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and (
    private.is_global_admin()
    or exists (
      select 1
      from public.team_members as member
      where member.user_id = (select auth.uid())
        and member.role = 'admin'
    )
  )
);
