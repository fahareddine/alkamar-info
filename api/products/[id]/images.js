// api/products/[id]/images.js
// GET  — statut pipeline + URLs images
// POST ?action=fetch   — télécharger images sources
// POST ?action=process — traitement IA + upload WebP
const { supabase } = require('../../_lib/supabase');
const { setCors } = require('../../_lib/cors');
const { requireRole } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, action } = req.query;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('products')
      .select('id, image_pipeline_status, main_image_url, gallery_urls, image, gallery')
      .eq('id', id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Produit introuvable' });
    return res.status(200).json({
      pipelineStatus: data.image_pipeline_status || 'idle',
      main:    data.main_image_url || data.image || null,
      gallery: data.gallery_urls?.length ? data.gallery_urls : (data.gallery || []),
    });
  }

  if (req.method === 'POST') {
    const auth = await requireRole(req, 'admin', 'editor');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    if (action === 'fetch') {
      const { fetchImages } = require('../../_lib/images/fetcher');
      const { slug, mode, payload } = req.body || {};
      if (!slug) return res.status(400).json({ error: 'slug requis' });
      if (!mode || !['urls', 'page'].includes(mode))
        return res.status(400).json({ error: 'mode doit être "urls" ou "page"' });
      if (!Array.isArray(payload) || payload.length === 0)
        return res.status(400).json({ error: 'payload doit être un tableau non vide' });
      try {
        const result = await fetchImages({ productId: id, slug, mode, payload });
        return res.status(200).json(result);
      } catch (err) {
        console.error('[images/fetch]', err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    if (action === 'process') {
      const { processImages } = require('../../_lib/images/processor');
      const { slug } = req.body || {};
      if (!slug) return res.status(400).json({ error: 'slug requis' });
      const TIMEOUT_MS = 85000;
      try {
        const result = await Promise.race([
          processImages({ productId: id, slug }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
          ),
        ]);
        return res.status(200).json(result);
      } catch (err) {
        if (err.message === 'TIMEOUT') {
          return res.status(202).json({ status: 'processing', message: 'Traitement en cours, vérifier dans quelques secondes' });
        }
        console.error('[images/process]', err.message);
        await supabase.from('products').update({ image_pipeline_status: 'failed', processing_error: err.message }).eq('id', id);
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(400).json({ error: 'action doit être "fetch" ou "process"' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
