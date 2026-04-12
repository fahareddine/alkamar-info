// api/_lib/auth.js
const { createClient } = require('@supabase/supabase-js');

/**
 * Vérifie le JWT dans Authorization header et contrôle le rôle.
 * @param {object} req - requête Vercel
 * @param {...string} allowedRoles - ex: 'admin', 'editor'
 * @returns {{ user, role } | { error, status }}
 */
async function requireRole(req, ...allowedRoles) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!token) return { error: 'Unauthorized', status: 401 };

  const anonClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user) return { error: 'Unauthorized', status: 401 };

  const { supabase } = require('./supabase');
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) return { error: 'Forbidden', status: 403 };
  if (!allowedRoles.includes(profile.role)) return { error: 'Forbidden', status: 403 };

  return { user, role: profile.role };
}

module.exports = { requireRole };
