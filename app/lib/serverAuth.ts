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
    return { user: null, error: 'Sesija nije važeća' };
  }

  return { user, error: null };
}
