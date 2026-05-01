const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

// ── Stripe Checkout (action=checkout, public, no auth) ────────────────────────
async function handleStripeCheckout(req, res) {
  const Stripe = require('stripe');
  // Stripe SDK v22 — sans apiVersion forcée (utilise la version par défaut du SDK)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const BASE = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://alkamar-info.vercel.app';
  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Panier vide' });
  const line_items = items.map(i => ({
    price_data: {
      currency: 'eur',
      product_data: { name: (i.name||'Produit').slice(0,127), description: i.brand||undefined,
        images: i.main_image_url?.startsWith('http') ? [i.main_image_url] : [] },
      unit_amount: Math.round(Math.max(0, i.price_eur||0) * 100),
    },
    quantity: Math.max(1, i.qty||1),
  })).filter(l => l.price_data.unit_amount > 0);
  if (!line_items.length) return res.status(400).json({ error: 'Prix invalide' });
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', line_items, locale: 'fr', payment_method_types: ['card'],
      success_url: `${BASE}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE}/cancel.html`,
      custom_text: { submit: { message: '🔒 TEST Stripe — carte: 4242 4242 4242 4242 · 12/28 · 123' } },
    });
    return res.status(200).json({ url: session.url });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Stripe checkout public — pas d'auth requise
  if (req.method === 'POST' && req.query.action === 'checkout') {
    return handleStripeCheckout(req, res);
  }

  if (req.method === 'GET') {
    const auth = await requireRole(req, 'admin', 'commercial');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { status, limit = '50', offset = '0' } = req.query;
    let query = supabase
      .from('orders')
      .select('*, customers(name, email, phone), order_items(*, products(name, image))')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const auth = await requireRole(req, 'admin', 'commercial');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { customer, items, notes } = req.body;

    let customerId;
    if (customer.id) {
      customerId = customer.id;
    } else {
      const { data: c, error: ce } = await supabase.from('customers').insert(customer).select('id').single();
      if (ce) return res.status(500).json({ error: ce.message });
      customerId = c.id;
    }

    const total_eur = items.reduce((s, i) => s + i.unit_price_eur * i.quantity, 0);
    const total_kmf = items.reduce((s, i) => s + i.unit_price_kmf * i.quantity, 0);

    const { data: order, error: oe } = await supabase
      .from('orders')
      .insert({ customer_id: customerId, total_eur, total_kmf, notes })
      .select('id').single();
    if (oe) return res.status(500).json({ error: oe.message });

    const orderItems = items.map(i => ({ ...i, order_id: order.id }));
    const { error: ie } = await supabase.from('order_items').insert(orderItems);
    if (ie) return res.status(500).json({ error: ie.message });

    return res.status(201).json({ id: order.id });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
