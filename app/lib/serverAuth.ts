import 'server-only';

import { createSupabaseAdmin } from './supabaseAdmin';

export async function authenticateRequest(request: Request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Niste prijavljeni' };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return { user: null, error: 'Niste prijavljeni' };
  }

  const supabaseAdmin = createSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: 'The session is not valid' };
  }

  return { user, error: null };
}

export async function authenticateActiveUser(request: Request) {
  const authentication = await authenticateRequest(request);
  if (!authentication.user) {
    return {
      ...authentication,
      profile: null,
      supabaseAdmin: null,
    };
  }

  const supabaseAdmin = createSupabaseAdmin();
  const { data: profile, error } = await supabaseAdmin
    .from('drivers')
    .select('id, email, full_name, role, active')
    .eq('id', authentication.user.id)
    .maybeSingle();

  if (error || !profile || profile.active === false) {
    return {
      user: null,
      error: 'Your account is not active',
      profile: null,
      supabaseAdmin: null,
    };
  }

  return {
    user: authentication.user,
    error: null,
    profile,
    supabaseAdmin,
  };
}

export async function authenticateAdmin(request: Request) {
  const authentication = await authenticateActiveUser(request);
  if (!authentication.user || !authentication.profile || !authentication.supabaseAdmin) {
    return authentication;
  }

  if (authentication.profile.role !== 'admin') {
    return {
      user: null,
      error: 'Only an administrator can perform this action',
      profile: null,
      supabaseAdmin: null,
    };
  }

  return authentication;
}
