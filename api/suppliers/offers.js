// api/suppliers/offers.js — CRUD offres fournisseurs (admin uniquement)
const { supabase } = require('../_lib/supabase');
const { requireRole } = require('../_lib/auth');
const { setCors } = require('../_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireRole(req, 'admin', 'editor');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { product_id, offer_id } = req.query;

  // GET — liste des offres pour un produit
  if (req.method === 'GET') {
    if (!product_id) return res.status(400).json({ error: 'product_id requis' });
    const { data, error } = await supabase
      .from('product_supplier_offers')
      .select('*')
      .eq('product_id', product_id)
      .order('score', { ascending: false, nullsFirst: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  // POST — créer une offre
  if (req.method === 'POST') {
    const { data, error } = await supabase
      .from('product_supplier_offers')
      .insert({ ...req.body, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  // PUT — modifier une offre
  if (req.method === 'PUT') {
    if (!offer_id) return res.status(400).json({ error: 'offer_id requis' });
    const { data, error } = await supabase
      .from('product_supplier_offers')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', offer_id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // DELETE — supprimer une offre
  if (req.method === 'DELETE') {
    if (!offer_id) return res.status(400).json({ error: 'offer_id requis' });
    const { error } = await supabase
      .from('product_supplier_offers')
      .delete()
      .eq('id', offer_id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  // PATCH — définir une offre comme principale (copie vers products)
  if (req.method === 'PATCH') {
    if (!offer_id || !product_id) {
      return res.status(400).json({ error: 'offer_id et product_id requis' });
    }

    const { data: offer, error: offerErr } = await supabase
      .from('product_supplier_offers')
      .select('*')
      .eq('id', offer_id)
      .single();
    if (offerErr) return res.status(404).json({ error: 'Offre introuvable' });

    const { error: prodErr } = await supabase
      .from('products')
      .update({
        supplier_url:          offer.supplier_url,
        supplier_name:         offer.supplier_name,
        supplier_price:        offer.price,
        supplier_currency:     offer.currency || 'EUR',
        supplier_shipping:     offer.shipping_price,
        supplier_delivery:     offer.delivery_estimate,
        supplier_availability: offer.availability,
        supplier_last_checked: new Date().toISOString(),
        updated_at:            new Date().toISOString(),
      })
      .eq('id', product_id);
    if (prodErr) return res.status(500).json({ error: prodErr.message });

    // Dé-marque toutes les autres offres comme principales
    await supabase.from('product_supplier_offers')
      .update({ is_primary: false })
      .eq('product_id', product_id);
    await supabase.from('product_supplier_offers')
      .update({ is_primary: true })
      .eq('id', offer_id);

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Méthode non supportée' });
};
