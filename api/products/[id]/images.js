// api/products/[id]/images.js
// GET public — statut pipeline et URLs des images d'un produit
const { supabase } = require('../../_lib/supabase');
const { setCors } = require('../../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;

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
};
