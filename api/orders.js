const https = require('https');
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

// ── Raw HTTPS call to Stripe API (no SDK dependency) ─────────────────────────
function stripeRequest(path, params, apiKey) {
  // Encode nested objects in Stripe's format: line_items[0][price_data][currency]=eur
  const entries = [];
  function encode(prefix, val) {
    if (Array.isArray(val)) {
      val.forEach((v, i) => encode(`${prefix}[${i}]`, v));
    } else if (val !== null && typeof val === 'object') {
      Object.keys(val).forEach(k => encode(`${prefix}[${k}]`, val[k]));
    } else if (val !== undefined && val !== null) {
      entries.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(val)}`);
    }
  }
  Object.keys(params).forEach(k => encode(k, params[k]));
  const body = entries.join('&');

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.stripe.com',
      path: `/v1/${path}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'Stripe-Version': '2024-06-20',
      },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch(e) { reject(new Error('JSON parse: ' + d.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout connexion Stripe')); });
    req.write(body);
    req.end();
  });
}

// ── Stripe Checkout (action=checkout, public, no auth) ────────────────────────
async function handleStripeCheckout(req, res) {
  // Trim pour éviter espaces/sauts de ligne parasites dans la clé
  const key = (process.env.STRIPE_SECRET_KEY || '').replace(/[\r\n\s]/g, '');
  if (!key) return res.status(500).json({ error: 'STRIPE_SECRET_KEY manquante' });

  const BASE = 'https://alkamar-info.vercel.app';
  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Panier vide' });

  const line_items = items.map((i, idx) => ({
    price_data: {
      currency: 'eur',
      product_data: { name: String(i.name || 'Produit').slice(0, 127) },
      unit_amount: Math.round(Math.max(50, Number(i.price_eur) || 50) * 100),
    },
    quantity: Math.max(1, Number(i.qty) || 1),
  }));

  try {
    const result = await stripeRequest('checkout/sessions', {
      mode: 'payment',
      line_items,
      locale: 'fr',
      success_url: `${BASE}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE}/cancel.html`,
    }, key);

    if (result.status !== 200 || !result.data.url) {
      console.error('[checkout] Stripe error:', JSON.stringify(result.data).slice(0, 300));
      return res.status(result.status).json({ error: result.data?.error?.message || 'Stripe error' });
    }
    console.log('[checkout] Session créée:', result.data.id);
    return res.status(200).json({ url: result.data.url });
  } catch(err) {
    console.error('[checkout] Erreur raw HTTP:', err.message);
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
