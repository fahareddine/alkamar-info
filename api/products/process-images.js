// api/products/process-images.js
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');
const { processImages } = require('../_lib/images/processor');
const { supabase } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireRole(req, 'admin', 'editor');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { productId, slug } = req.body || {};

  if (!productId || !slug) {
    return res.status(400).json({ error: 'productId et slug sont requis' });
  }

  const TIMEOUT_MS = 85000;

  try {
    const result = await Promise.race([
      processImages({ productId, slug }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
      ),
    ]);

    return res.status(200).json(result);
  } catch (err) {
    if (err.message === 'TIMEOUT') {
      return res.status(202).json({
        status: 'processing',
        message: 'Traitement en cours, vérifier dans quelques secondes',
      });
    }
    console.error('[process-images]', err.message);
    await supabase.from('products').update({
      image_pipeline_status: 'failed',
      processing_error: err.message,
    }).eq('id', productId);
    return res.status(500).json({ error: err.message });
  }
};
