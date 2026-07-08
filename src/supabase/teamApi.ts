import { supabase } from './supabaseClient';
import type { Team, TeamInvite, TeamMember } from '../teams/teamTypes';

type TeamRow = {
  color: string | null;
  description: string | null;
  id: string;
  name: string;
  owner_id: string;
};

type MembershipRow = {
  team_id: string;
};

type TeamMemberRow = {
  created_at: string;
  email: string;
  role: "admin" | "member";
  user_id: string;
};

type TeamInviteRow = {
  created_at: string;
  email: string;
  id: string;
  role: "member";
  status: "pending" | "accepted" | "cancelled";
};

type TeamInviteResultRow = {
  created_at: string;
  email: string;
  invite_id: string | null;
  kind: "member" | "invite";
  role: "admin" | "member";
  status: "pending" | "accepted" | "cancelled";
  user_id: string | null;
};

export type TeamInviteResult =
  | { kind: "member"; member: TeamMember }
  | { kind: "invite"; invite: TeamInvite };

export async function loadUserTeams(userId: string, includeAll = false): Promise<Team[]> {
  if (!supabase) {
    return [];
  }

  const membershipResult = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId);

  if (membershipResult.error) {
    throw membershipResult.error;
  }

  const memberTeamIds = Array.from(
    new Set(
      (membershipResult.data ?? []).map((row) =>
        (row as MembershipRow).team_id,
      ),
    ),
  );

  let teamsQuery = supabase.from('teams').select('id,name,color,description,owner_id');

  if (!includeAll) {
    if (memberTeamIds.length > 0) {
      teamsQuery = teamsQuery.or(
        `owner_id.eq.${userId},id.in.(${memberTeamIds.join(',')})`,
      );
    } else {
      teamsQuery = teamsQuery.eq('owner_id', userId);
    }
  }

  const teamsResult = await teamsQuery.order('created_at', { ascending: true });

  if (teamsResult.error) {
    throw teamsResult.error;
  }

  return uniqueTeams(
    ((teamsResult.data ?? []) as TeamRow[]).map((team) => ({
      id: team.id,
      name: team.name,
      color: team.color,
      description: team.description,
      ownerId: team.owner_id,
    })),
  );
}

export async function createTeamInSupabase({
  color,
  name,
  description = null,
  ownerId,
}: {
  color: string | null;
  description?: string | null;
  name: string;
  ownerId: string;
}): Promise<Team> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error('Nazev tymu nesmi byt prazdny.');
  }

  const { data: teamRow, error: teamError } = await supabase
    .from('teams')
    .insert({
      color,
      description: description?.trim() || null,
      name: trimmedName,
      owner_id: ownerId,
    })
    .select('id,name,color,description,owner_id')
    .single();

  if (teamError) {
    throw teamError;
  }

  const { error: membershipError } = await supabase.from('team_members').insert({
    role: 'admin',
    team_id: teamRow.id,
    user_id: ownerId,
  });

  if (membershipError) {
    throw membershipError;
  }

  return {
    id: teamRow.id,
    name: teamRow.name,
    color: teamRow.color,
    description: teamRow.description,
    ownerId: teamRow.owner_id,
  };
}

export async function updateTeamInSupabase({
  description,
  name,
  teamId,
}: {
  description?: string | null;
  name: string;
  teamId: string;
}): Promise<Team> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error('Nazev tymu nesmi byt prazdny.');
  }

  const { data: teamRow, error } = await supabase
    .from('teams')
    .update({
      description: description?.trim() || null,
      name: trimmedName,
    })
    .eq('id', teamId)
    .select('id,name,color,description,owner_id')
    .single();

  if (error) {
    throw error;
  }

  return {
    id: teamRow.id,
    name: teamRow.name,
    color: teamRow.color,
    description: teamRow.description,
    ownerId: teamRow.owner_id,
  };
}

export async function loadTeamMembers(teamId: string): Promise<TeamMember[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc('get_team_members', {
    check_team_id: teamId,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as TeamMemberRow[]).map(mapTeamMemberRow);
}

export async function inviteTeamMemberByEmail({
  email,
  teamId,
}: {
  email: string;
  teamId: string;
}): Promise<TeamInviteResult> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    throw new Error('Email nesmi byt prazdny.');
  }

  const { data, error } = await supabase.rpc('invite_team_member_by_email', {
    check_team_id: teamId,
    member_email: trimmedEmail,
  });

  if (error) {
    throw error;
  }

  const [result] = (data ?? []) as TeamInviteResultRow[];

  if (!result) {
    throw new Error('Pozvanku se nepodarilo vytvorit.');
  }

  if (result.kind === 'member') {
    return {
      kind: 'member',
      member: mapTeamMemberRow({
        created_at: result.created_at,
        email: result.email,
        role: result.role,
        user_id: result.user_id ?? '',
      }),
    };
  }

  return {
    kind: 'invite',
    invite: mapTeamInviteRow({
      created_at: result.created_at,
      email: result.email,
      id: result.invite_id ?? '',
      role: 'member',
      status: result.status,
    }),
  };
}

export async function loadTeamInvites(teamId: string): Promise<TeamInvite[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc('get_team_invites', {
    check_team_id: teamId,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as TeamInviteRow[]).map(mapTeamInviteRow);
}

export async function acceptPendingTeamInvites(): Promise<number> {
  if (!supabase) {
    return 0;
  }

  const { data, error } = await supabase.rpc('accept_pending_team_invites');

  if (error) {
    throw error;
  }

  return typeof data === 'number' ? data : 0;
}

export async function updateTeamMemberRole({
  role,
  teamId,
  userId,
}: {
  role: 'admin' | 'member';
  teamId: string;
  userId: string;
}): Promise<TeamMember> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const { data, error } = await supabase.rpc('update_team_member_role', {
    check_team_id: teamId,
    new_role: role,
    target_user_id: userId,
  });

  if (error) {
    throw error;
  }

  const [member] = (data ?? []) as TeamMemberRow[];

  if (!member) {
    throw new Error('Roli clena se nepodarilo zmenit.');
  }

  return mapTeamMemberRow(member);
}

export async function removeTeamMember({
  teamId,
  userId,
}: {
  teamId: string;
  userId: string;
}): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const { error } = await supabase.rpc('remove_team_member_from_team', {
    check_team_id: teamId,
    target_user_id: userId,
  });

  if (error) {
    throw error;
  }
}

export async function deleteTeamInSupabase(teamId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  // All FK constraints from related tables to teams have ON DELETE CASCADE,
  // so deleting the team row cascades to task_lists, tasks, subtasks,
  // task_labels, team_members, team_invites, projects, project_columns.
  // The team must be deleted first — before team_members — because the RLS
  // DELETE policy (teams_delete_by_admin) checks team_members for admin role.
  const { error } = await supabase
    .from('teams')
    .delete()
    .eq('id', teamId);

  if (error) {
    throw error;
  }
}
function mapTeamMemberRow(row: TeamMemberRow): TeamMember {
  return {
    createdAt: row.created_at,
    email: row.email,
    role: row.role === 'admin' ? 'admin' : 'member',
    userId: row.user_id,
  };
}

function mapTeamInviteRow(row: TeamInviteRow): TeamInvite {
  return {
    createdAt: row.created_at,
    email: row.email,
    id: row.id,
    role: row.role,
    status: row.status,
  };
}

function uniqueTeams(teams: Team[]) {
  const seen = new Set<string>();

  return teams.filter((team) => {
    if (seen.has(team.id)) {
      return false;
    }

    seen.add(team.id);
    return true;
  });
}

