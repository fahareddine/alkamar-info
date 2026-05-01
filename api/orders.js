const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');
// Stripe chargé au top-level pour que Vercel le bundle correctement
let _stripe = null;
function getStripe() {
  if (_stripe) return _stripe;
  const Stripe = require('stripe');
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

// ── Stripe Checkout (action=checkout, public, no auth) ────────────────────────
async function handleStripeCheckout(req, res) {
  const key = process.env.STRIPE_SECRET_KEY;
  console.log('[checkout] key:', key ? key.slice(0,15)+'...' : 'MISSING');
  if (!key) return res.status(500).json({ error: 'STRIPE_SECRET_KEY manquante' });

  const BASE = 'https://alkamar-info.vercel.app';
  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Panier vide' });

  const line_items = items.map(i => ({
    price_data: {
      currency: 'eur',
      product_data: { name: String(i.name || 'Produit').slice(0, 127) },
      unit_amount: Math.round(Math.max(50, Number(i.price_eur) || 50) * 100),
    },
    quantity: Math.max(1, Number(i.qty) || 1),
  }));
  console.log('[checkout] line_items:', line_items.length, 'total:', line_items.reduce((s,l)=>s+l.price_data.unit_amount*l.quantity,0));

  try {
    const stripe = getStripe();
    console.log('[checkout] Stripe OK, appel API...');
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      locale: 'fr',
      success_url: `${BASE}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE}/cancel.html`,
    });
    console.log('[checkout] Session OK:', session.id);
    return res.status(200).json({ url: session.url });
  } catch(err) {
    console.error('[checkout] ERR type:', err.constructor?.name, '| msg:', err.message?.slice(0,200));
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
