const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');
const { fetchImages } = require('../_lib/images/fetcher');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireRole(req, 'admin', 'editor');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { productId, slug, mode, payload } = req.body || {};

  if (!productId || !slug) {
    return res.status(400).json({ error: 'productId et slug sont requis' });
  }
  if (!mode || !['urls', 'page'].includes(mode)) {
    return res.status(400).json({ error: 'mode doit être "urls" ou "page"' });
  }
  if (!Array.isArray(payload) || payload.length === 0) {
    return res.status(400).json({ error: 'payload doit être un tableau non vide' });
  }

  try {
    const result = await fetchImages({ productId, slug, mode, payload });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[fetch-images]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
