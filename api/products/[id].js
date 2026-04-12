// api/products/[id].js
const { supabase } = require('../_lib/supabase');
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  // GET — lecture publique par UUID ou legacy_id
  if (req.method === 'GET') {
    const isUUID = /^[0-9a-f-]{36}$/.test(id);
    let query;
    if (isUUID) {
      query = supabase.from('products').select('*, categories(id, name, slug, parent_id, icon)').eq('id', id).single();
    } else {
      query = supabase.from('products').select('*, categories(id, name, slug, parent_id, icon)').eq('legacy_id', id).single();
    }
    const { data, error } = await query;
    if (error) return res.status(404).json({ error: 'Produit introuvable' });
    return res.status(200).json(data);
  }

  // PUT — modifier (admin ou editor)
  if (req.method === 'PUT') {
    const auth = await requireRole(req, 'admin', 'editor');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { data, error } = await supabase
      .from('products')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // DELETE — archiver (admin uniquement)
  if (req.method === 'DELETE') {
    const auth = await requireRole(req, 'admin');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { error } = await supabase
      .from('products')
      .update({ status: 'archived' })
      .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ archived: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
