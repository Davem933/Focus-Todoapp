import { supabase } from './supabaseClient';

export type AppUserSummary = {
  createdAt: string;
  email: string;
  role: 'user' | 'admin';
  userId: string;
};

type AppUserRow = {
  created_at: string;
  email: string | null;
  role: string;
  user_id: string;
};

export async function loadAppUsers(): Promise<AppUserSummary[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc('list_app_users');

  if (error) {
    throw error;
  }

  return ((data ?? []) as AppUserRow[]).map(mapAppUserRow);
}

export async function updateGlobalUserRole({
  role,
  userId,
}: {
  role: 'user' | 'admin';
  userId: string;
}): Promise<AppUserSummary> {
  if (!supabase) {
    throw new Error('Supabase neni nakonfigurovany.');
  }

  const { data, error } = await supabase.rpc('update_global_user_role', {
    new_role: role,
    target_user_id: userId,
  });

  if (error) {
    throw error;
  }

  const [user] = (data ?? []) as AppUserRow[];

  if (!user) {
    throw new Error('Globalni roli se nepodarilo zmenit.');
  }

  return mapAppUserRow(user);
}

function mapAppUserRow(row: AppUserRow): AppUserSummary {
  return {
    createdAt: row.created_at,
    email: row.email ?? 'Bez emailu',
    role: row.role === 'admin' ? 'admin' : 'user',
    userId: row.user_id,
  };
}
