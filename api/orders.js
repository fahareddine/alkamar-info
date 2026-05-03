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

  // Route client: GET /api/orders?my=1 — commandes de l'utilisateur connecté
  if (req.method === 'GET' && req.query.my === '1') {
    const { createClient: createSB } = require('@supabase/supabase-js');
    const sbAuth = createSB(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
    const token = (req.headers.authorization||'').replace('Bearer ','').trim();
    const { data: userData } = await sbAuth.auth.getUser(token);
    if (!userData?.user) return res.status(401).json({ error: 'Non authentifié' });
    const { data: customer } = await supabase.from('customers').select('id').eq('user_id', userData.user.id).single();
    if (!customer) return res.status(200).json([]);
    const { data, error } = await supabase.from('orders').select('id,created_at,total_eur,total_kmf,status').eq('customer_id', customer.id).order('created_at',{ascending:false}).limit(50);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // Stripe checkout public — pas d'auth requise
  if (req.method === 'POST' && req.query.action === 'checkout') {
    return handleStripeCheckout(req, res);
  }

  // ── Guest checkout — pas d'auth requise ───────────────────────────────────
  if (req.method === 'POST' && req.query.action === 'guest_checkout') {
    const {
      customer_name, customer_email, customer_whatsapp, customer_phone,
      delivery_method = 'pickup', delivery_city, delivery_address, delivery_notes,
      payment_method = 'stripe', cart_items, notes,
    } = req.body || {};

    // Validation
    const errors = [];
    if (!customer_name || String(customer_name).trim().length < 2)
      errors.push('Nom complet obligatoire (minimum 2 caractères).');
    const emailTrimmed = (customer_email || '').trim();
    const emailOk = emailTrimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);
    const waRaw   = (customer_whatsapp || '').replace(/\s+/g, '');
    const waOk    = waRaw && /^\+?\d{7,15}$/.test(waRaw);
    if (!emailOk && !waOk)
      errors.push('Indiquez au moins un email valide ou un numéro WhatsApp valide.');
    if (!['pickup','home_delivery'].includes(delivery_method))
      errors.push('Mode de réception invalide.');
    if (!['stripe','mobile_money','cash_pickup','cash_delivery'].includes(payment_method))
      errors.push('Mode de paiement invalide.');
    if (!Array.isArray(cart_items) || !cart_items.length)
      errors.push('Le panier est vide.');
    if (errors.length) return res.status(400).json({ errors });

    // Recalcul serveur des prix — lookup par id (UUID) OU legacy_id (slug)
    const productIds = cart_items.map(i => i.id).filter(Boolean);
    const uuidRe     = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const uuids      = productIds.filter(id => uuidRe.test(id));
    const legacyIds  = productIds.filter(id => !uuidRe.test(id));

    let allProducts = [];
    if (uuids.length) {
      const { data, error } = await supabase.from('products').select('id, legacy_id, name, price_eur, price_kmf').in('id', uuids).eq('status', 'active');
      if (error) return res.status(500).json({ error: error.message });
      allProducts = allProducts.concat(data || []);
    }
    if (legacyIds.length) {
      const { data, error } = await supabase.from('products').select('id, legacy_id, name, price_eur, price_kmf').in('legacy_id', legacyIds).eq('status', 'active');
      if (error) return res.status(500).json({ error: error.message });
      allProducts = allProducts.concat(data || []);
    }

    const productMap = {};
    allProducts.forEach(p => { productMap[p.id] = p; if (p.legacy_id) productMap[p.legacy_id] = p; });

    let subtotal_eur = 0;
    const validItems = [];
    for (const item of cart_items) {
      const p = productMap[item.id];
      if (!p) return res.status(400).json({ error: `Produit introuvable: ${item.id}` });
      const qty = Math.max(1, parseInt(item.qty) || 1);
      subtotal_eur += p.price_eur * qty;
      validItems.push({ product_id: p.id, product_name: p.name, price_eur: p.price_eur, price_kmf: p.price_kmf, quantity: qty });
    }
    subtotal_eur = parseFloat(subtotal_eur.toFixed(2));
    const delivery_fee = delivery_method === 'home_delivery' ? 5 : 0;
    const total_eur    = parseFloat((subtotal_eur + delivery_fee).toFixed(2));
    const total_kmf    = Math.round(total_eur * 491);

    // Créer ou trouver le customer
    let customer_id = null;
    if (emailOk) {
      const { data: existing } = await supabase.from('customers').select('id')
        .ilike('email', emailTrimmed).limit(1).single();
      if (existing) customer_id = existing.id;
    }
    if (!customer_id) {
      const { data: nc } = await supabase.from('customers').insert({
        name: String(customer_name).trim(),
        email: emailOk ? emailTrimmed : null,
        phone: customer_phone || null,
        whatsapp: waOk ? waRaw : null,
      }).select('id').single();
      if (nc) customer_id = nc.id;
    }

    // Données guest à stocker
    const guestData = {
      name: String(customer_name).trim(),
      email: emailOk ? emailTrimmed : null,
      whatsapp: waOk ? waRaw : null,
      phone: customer_phone || null,
      delivery: delivery_method,
      delivery_fee,
      city: delivery_city || null,
      address: delivery_address || null,
      delivery_notes: delivery_notes || null,
      payment: payment_method,
      guest: true,
    };
    const notesJson = `[GUEST] ${JSON.stringify(guestData)}${notes ? '\n' + notes : ''}`;

    // Tentative 1 : insert avec nouvelles colonnes (migration appliquée)
    let order, orderErr;
    ({ data: order, error: orderErr } = await supabase.from('orders').insert({
      customer_id, total_eur, total_kmf,
      status: 'pending', notes: notesJson,
      customer_name:    String(customer_name).trim(),
      customer_email:   emailOk ? emailTrimmed : null,
      customer_whatsapp: waOk ? waRaw : null,
      customer_phone:   customer_phone || null,
      preferred_contact: emailOk ? 'email' : 'whatsapp',
      delivery_method, delivery_fee,
      delivery_city: delivery_city || null,
      delivery_address: delivery_address || null,
      delivery_notes: delivery_notes || null,
      pickup_location: delivery_method === 'pickup' ? 'Boutique Alkamar Moroni' : null,
      subtotal_eur, payment_method,
      payment_status: payment_method === 'stripe' ? 'unpaid' : 'awaiting_payment',
      guest_checkout: true,
    }).select().single());

    // Tentative 2 : fallback sans nouvelles colonnes (migration pas encore appliquée)
    if (orderErr && (orderErr.message.includes('column') || orderErr.message.includes('schema'))) {
      console.warn('[guest_checkout] Migration non appliquée — fallback colonnes de base:', orderErr.message);
      ({ data: order, error: orderErr } = await supabase.from('orders').insert({
        customer_id, total_eur, total_kmf,
        status: 'pending', notes: notesJson,
      }).select().single());
    }
    if (orderErr) return res.status(500).json({ error: orderErr.message });

    // Créer les order_items
    if (validItems.length) {
      await supabase.from('order_items').insert(
        validItems.map(i => ({ order_id: order.id, product_id: i.product_id, product_name: i.product_name, price_eur: i.price_eur, price_kmf: i.price_kmf, quantity: i.quantity }))
      );
    }

    const orderNum = order.id.split('-')[0].toUpperCase();

    // Stripe
    if (payment_method === 'stripe') {
      const key = (process.env.STRIPE_SECRET_KEY || '').replace(/[\r\n\s]/g, '');
      if (!key) return res.status(500).json({ error: 'STRIPE_SECRET_KEY manquante' });
      const BASE = 'https://alkamar-info.vercel.app';
      const line_items = validItems.map(i => ({
        price_data: { currency: 'eur', product_data: { name: String(i.product_name).slice(0, 127) }, unit_amount: Math.round(i.price_eur * 100) },
        quantity: i.quantity,
      }));
      if (delivery_fee > 0) {
        line_items.push({ price_data: { currency: 'eur', product_data: { name: 'Livraison à domicile' }, unit_amount: 500 }, quantity: 1 });
      }
      const result = await stripeRequest('checkout/sessions', {
        mode: 'payment', line_items, locale: 'fr',
        customer_email: emailOk ? emailTrimmed : undefined,
        success_url: `${BASE}/success.html?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${BASE}/checkout.html`,
        metadata:    { order_id: order.id },
      }, key);
      if (result.status !== 200 || !result.data.url) {
        return res.status(result.status).json({ error: result.data?.error?.message || 'Stripe error' });
      }
      await supabase.from('orders').update({ stripe_session_id: result.data.id }).eq('id', order.id);
      return res.status(200).json({ mode: 'stripe', url: result.data.url, order_id: order.id });
    }

    // Mobile Money / Cash
    return res.status(200).json({
      mode: payment_method,
      order_id: order.id,
      order_number: orderNum,
      total_eur,
      payment_instructions: payment_method === 'mobile_money'
        ? { number: '+269 331 27 22', name: 'Alkamar Info', reference: orderNum }
        : null,
    });
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
