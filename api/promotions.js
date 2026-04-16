// api/promotions.js
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — promotions actives (public) ou toutes (admin)
  if (req.method === 'GET') {
    const { all } = req.query;

    if (all === 'true') {
      const authCheck = await requireRole(req, 'admin');
      if (authCheck.error) return res.status(authCheck.status).json({ error: authCheck.error });
    }

    let query = supabase
      .from('promotions')
      .select('*')
      .order('starts_at', { ascending: false });

    if (all !== 'true') {
      query = query
        .eq('is_active', true)
        .lte('starts_at', new Date().toISOString())
        .gte('ends_at', new Date().toISOString());
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST — créer une promotion (admin)
  if (req.method === 'POST') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { name, type, value, target_type, target_id, starts_at, ends_at } = req.body;
    if (!name || !type || !value || !starts_at || !ends_at) {
      return res.status(400).json({ error: 'name, type, value, starts_at, ends_at requis' });
    }

    const { data, error } = await supabase
      .from('promotions')
      .insert({ name, type, value, target_type: target_type || 'all', target_id, starts_at, ends_at })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  // PUT /api/promotions?id=xxx — modifier
  if (req.method === 'PUT') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id requis' });
    const { name, type, value, target_type, target_id, starts_at, ends_at, is_active } = req.body;
    const { data, error } = await supabase
      .from('promotions')
      .update({ name, type, value, target_type, target_id, starts_at, ends_at, is_active })
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // DELETE /api/promotions?id=xxx — désactiver
  if (req.method === 'DELETE') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id requis' });
    const { error } = await supabase
      .from('promotions')
      .update({ is_active: false })
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
