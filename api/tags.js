// api/tags.js
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — liste publique
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('tags')
      .select('id, name, slug')
      .order('name');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST — créer un tag (editor ou admin)
  if (req.method === 'POST') {
    const auth = await requireRole(req, 'admin', 'editor');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name et slug requis' });

    const { data, error } = await supabase
      .from('tags')
      .insert({ name, slug })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
