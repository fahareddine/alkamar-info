const https = require('https');
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');
const { sendOrderConfirmation, sendOrderAdminNotification } = require('./_lib/email');

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

// ── Stock automatique ─────────────────────────────────────────────────────────
// direction -1 : commande passée (décrément) · +1 : commande annulée (restock)
// Met aussi à jour le libellé de stock affiché sur le site.
async function adjustStock(items, direction) {
  const { supabase } = require('./_lib/supabase');
  for (const it of items) {
    if (!it.product_id || !it.quantity) continue;
    const { data: p } = await supabase.from('products')
      .select('stock, stock_label').eq('id', it.product_id).maybeSingle();
    if (!p || typeof p.stock !== 'number') continue;
    const newStock = Math.max(0, p.stock + direction * it.quantity);
    const patch = { stock: newStock };
    if (newStock <= 0) patch.stock_label = 'Rupture de stock';
    else if (newStock <= 2) patch.stock_label = `Plus que ${newStock} en stock`;
    else if (/rupture|plus que/i.test(p.stock_label || '')) patch.stock_label = 'En stock';
    const { error } = await supabase.from('products').update(patch).eq('id', it.product_id);
    if (error) console.error('[stock] ajustement échoué', it.product_id, error.message);
  }
}

// ── Stripe Checkout (action=checkout, public, no auth) ────────────────────────
async function handleStripeCheckout(req, res) {
  const key = (process.env.STRIPE_SECRET_KEY || '').replace(/[\r\n\s]/g, '');
  if (!key) return res.status(500).json({ error: 'STRIPE_SECRET_KEY manquante' });

  const BASE = 'https://boutique.info-experts.fr';
  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Panier vide' });

  // Récupère les vrais prix depuis la base — ignore complètement les prix client
  const uuidRe    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const productIds = items.map(i => i.id).filter(Boolean);
  const uuids      = productIds.filter(id => uuidRe.test(id));
  const slugs      = productIds.filter(id => !uuidRe.test(id));

  let dbProducts = [];
  if (uuids.length) {
    const { data } = await supabase.from('products')
      .select('id, legacy_id, name, price_eur').in('id', uuids).eq('status', 'active');
    dbProducts = dbProducts.concat(data || []);
  }
  if (slugs.length) {
    const { data } = await supabase.from('products')
      .select('id, legacy_id, name, price_eur').in('legacy_id', slugs).eq('status', 'active');
    dbProducts = dbProducts.concat(data || []);
  }
  const productMap = {};
  dbProducts.forEach(p => { productMap[p.id] = p; if (p.legacy_id) productMap[p.legacy_id] = p; });

  const line_items = [];
  for (const i of items) {
    const p = productMap[i.id];
    if (!p) return res.status(400).json({ error: `Produit introuvable: ${i.id}` });
    line_items.push({
      price_data: {
        currency: 'eur',
        product_data: { name: String(p.name || 'Produit').slice(0, 127) },
        unit_amount: Math.round(Math.max(50, Number(p.price_eur)) * 100), // prix DB
      },
      quantity: Math.max(1, Number(i.qty) || 1),
    });
  }

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
  setCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();
  // Délégation stats/logs (limite Vercel Hobby 12 fonctions)
  if (req.query._route === 'stats' || req.query._route === 'logs') {
    return require('./_lib/stats')(req, res);
  }
  // Délégation analytics ventes (dashboard admin)
  if (req.query._route === 'analytics') {
    return require('./_lib/analytics')(req, res);
  }
  // Compteurs badges menu admin
  if (req.query._route === 'counts') {
    return require('./_lib/counts')(req, res);
  }

  // ── Route /api/orders/:id — GET détail + PUT (statut → email client auto) ──
  if (req.query._route === 'order_id') {
    const _id = req.query._id;
    if (!_id) return res.status(400).json({ error: 'id requis' });
    const auth = await requireRole(req, 'admin', 'commercial');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    if (req.method === 'GET') {
      const { data, error } = await supabase.from('orders')
        .select('*, customers(name, email, phone, city), order_items(*, products(name, image))')
        .eq('id', _id).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Commande introuvable' });
      return res.status(200).json(data);
    }

    if (req.method === 'PUT') {
      const ALLOWED = new Set(['status', 'notes', 'payment_status']);
      const patch = {};
      for (const [k, v] of Object.entries(req.body || {})) {
        if (ALLOWED.has(k)) patch[k] = v;
      }
      if (!Object.keys(patch).length) return res.status(400).json({ error: 'Aucun champ modifiable fourni' });
      if (patch.status && !['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(patch.status)) {
        return res.status(400).json({ error: 'status invalide' });
      }

      const { data: before } = await supabase.from('orders')
        .select('status, customer_email, customer_name, total_eur, customers(email, name)')
        .eq('id', _id).maybeSingle();
      if (!before) return res.status(404).json({ error: 'Commande introuvable' });

      patch.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from('orders').update(patch).eq('id', _id).select().single();
      if (error) return res.status(500).json({ error: error.message });

      // Email de suivi automatique au client quand le statut change
      let emailResult = null;
      if (patch.status && patch.status !== before.status) {
        const { sendOrderStatusUpdate } = require('./_lib/email-extra');
        emailResult = await sendOrderStatusUpdate({
          order: {
            ...data,
            customer_email: data.customer_email || before.customers?.email || null,
            customer_name: data.customer_name || before.customers?.name || '',
          },
          newStatus: patch.status,
        }).catch(e => ({ success: false, error: e.message }));

        // Stock : restock si annulation, re-décrément si réactivation d'une commande annulée
        if (patch.status === 'cancelled' || before.status === 'cancelled') {
          const { data: orderItems } = await supabase.from('order_items')
            .select('product_id, quantity').eq('order_id', _id);
          if (orderItems?.length) {
            const dir = patch.status === 'cancelled' ? +1 : -1;
            await adjustStock(orderItems, dir)
              .catch(e => console.error('[stock] ajustement annulation échoué:', e.message));
          }
        }
      }

      return res.status(200).json({ ...data, _email: emailResult });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Relances impayés ──
  // GET ?action=unpaid : commandes Stripe non payées avec email (admin)
  if (req.method === 'GET' && req.query.action === 'unpaid') {
    const auth = await requireRole(req, 'admin', 'commercial');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const { data, error } = await supabase.from('orders')
      .select('id, created_at, customer_name, customer_email, customer_whatsapp, total_eur, payment_status, status, reminder_sent_at')
      .eq('payment_status', 'unpaid').eq('payment_method', 'stripe')
      .neq('status', 'cancelled')
      .not('customer_email', 'is', null)
      .order('created_at', { ascending: false }).limit(100);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // POST ?action=remind : envoie l'email de relance avec un nouveau lien de paiement
  if (req.method === 'POST' && req.query.action === 'remind') {
    const auth = await requireRole(req, 'admin', 'commercial');
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const { order_id } = req.body || {};
    if (!order_id) return res.status(400).json({ error: 'order_id requis' });

    const { data: order } = await supabase.from('orders')
      .select('id, customer_name, customer_email, total_eur, payment_status')
      .eq('id', order_id).maybeSingle();
    if (!order) return res.status(404).json({ error: 'Commande introuvable' });
    if (order.payment_status !== 'unpaid') return res.status(400).json({ error: 'Commande déjà payée' });
    if (!order.customer_email) return res.status(400).json({ error: 'Pas d\'email client sur cette commande' });

    // Nouvelle session Stripe sur le montant total (les anciennes sessions expirent)
    const key = (process.env.STRIPE_SECRET_KEY || '').replace(/[\r\n\s]/g, '');
    if (!key) return res.status(500).json({ error: 'STRIPE_SECRET_KEY manquante' });
    const BASE = 'https://boutique.info-experts.fr';
    const orderNum = order.id.split('-')[0].toUpperCase();
    const session = await stripeRequest('checkout/sessions', {
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: `Commande #${orderNum} — Boutique Info Experts` },
          unit_amount: Math.round(Number(order.total_eur) * 100),
        },
        quantity: 1,
      }],
      locale: 'fr',
      customer_email: order.customer_email,
      success_url: `${BASE}/success.html?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE}/index.html`,
      metadata: { order_id: order.id },
    }, key);
    if (session.status !== 200 || !session.data.url) {
      return res.status(500).json({ error: session.data?.error?.message || 'Erreur Stripe' });
    }

    const { sendPaymentReminder } = require('./_lib/email-extra');
    const result = await sendPaymentReminder({ order, payUrl: session.data.url });
    if (!result.success && !result.skipped) {
      return res.status(500).json({ error: 'Envoi email échoué : ' + (result.error || 'inconnu') });
    }
    await supabase.from('orders').update({
      reminder_sent_at: new Date().toISOString(),
      stripe_session_id: session.data.id,
    }).eq('id', order.id);

    return res.status(200).json({ ok: true, sent_to: order.customer_email, skipped: !!result.skipped });
  }

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
      payment_method = 'stripe', cart_items, notes, coupon_code,
    } = req.body || {};

    // Validation
    const errors = [];

    // Champ honeypot : doit être vide (bots remplissent souvent tous les champs)
    const { website: honeypot } = req.body || {};
    if (honeypot) return res.status(400).json({ errors: ['Requête invalide.'] });

    // Limites de taille des champs (anti-overflow / injection)
    const nameTrimmed = String(customer_name || '').trim().slice(0, 200);
    if (!nameTrimmed || nameTrimmed.length < 2)
      errors.push('Nom complet obligatoire (minimum 2 caractères).');

    const emailTrimmed = (customer_email || '').trim().slice(0, 254);
    const emailOk = emailTrimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);
    const waRaw   = (customer_whatsapp || '').replace(/\s+/g, '').slice(0, 20);
    const waOk    = waRaw && /^\+?\d{7,15}$/.test(waRaw);
    if (!emailOk && !waOk)
      errors.push('Indiquez au moins un email valide ou un numéro WhatsApp valide.');
    if (!['pickup','home_delivery'].includes(delivery_method))
      errors.push('Mode de réception invalide.');
    if (!['stripe','mobile_money','cash_pickup','cash_delivery'].includes(payment_method))
      errors.push('Mode de paiement invalide.');
    if (!Array.isArray(cart_items) || !cart_items.length)
      errors.push('Le panier est vide.');
    if (Array.isArray(cart_items) && cart_items.length > 50)
      errors.push('Panier trop grand (maximum 50 articles).');
    if (delivery_address && String(delivery_address).length > 500)
      errors.push('Adresse trop longue.');
    if (notes && String(notes).length > 1000)
      errors.push('Notes trop longues (maximum 1000 caractères).');
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

    // Code promo — revalidé côté serveur (jamais de confiance au montant client)
    let appliedCoupon = null;
    let discount_eur  = 0;
    let discount_kmf  = 0;
    if (coupon_code) {
      const { validateCoupon } = require('./_lib/coupon-validate');
      const cv = await validateCoupon(coupon_code, subtotal_eur);
      if (cv.error) return res.status(cv.status).json({ error: cv.error });
      appliedCoupon = cv.coupon;
      discount_eur  = Math.min(cv.discount_eur, subtotal_eur);
      discount_kmf  = cv.discount_kmf;
    }

    const total_eur    = parseFloat((subtotal_eur + delivery_fee - discount_eur).toFixed(2));
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
      pickup_location: delivery_method === 'pickup' ? 'Boutique Info Experts — Moroni' : null,
      subtotal_eur, payment_method,
      payment_status: payment_method === 'stripe' ? 'unpaid' : 'awaiting_payment',
      guest_checkout: true,
      coupon_code: appliedCoupon ? appliedCoupon.code : null,
      discount_eur, discount_kmf,
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
      // Colonnes réelles : unit_price_eur / unit_price_kmf / product_snapshot (NOT NULL).
      // L'ancien insert (price_eur/product_name) échouait silencieusement → commandes sans détail.
      const { error: itemsErr } = await supabase.from('order_items').insert(
        validItems.map(i => ({
          order_id: order.id,
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price_eur: i.price_eur,
          unit_price_kmf: i.price_kmf || Math.round((i.price_eur || 0) * 491),
          product_snapshot: { name: i.product_name, price_eur: i.price_eur, price_kmf: i.price_kmf },
        }))
      );
      if (itemsErr) console.error('[guest_checkout] order_items insert failed:', itemsErr.message);

      // Décrément automatique du stock (anti-survente) — restocké si annulation
      await adjustStock(validItems.map(i => ({ product_id: i.product_id, quantity: i.quantity })), -1)
        .catch(e => console.error('[stock] décrément échoué:', e.message));
    }

    // Incrémenter l'usage du coupon (best-effort, ne bloque pas la commande)
    if (appliedCoupon) {
      const { error: cErr } = await supabase.from('coupon_codes')
        .update({ uses_count: (appliedCoupon.uses_count || 0) + 1 })
        .eq('id', appliedCoupon.id);
      if (cErr) console.error('[guest_checkout] uses_count update failed:', cErr.message);
    }

    const orderNum = order.id.split('-')[0].toUpperCase();

    // ── Emails — await obligatoire (Vercel coupe la fonction après res.json) ───
    const _emailPayload = { order, items: validItems };
    await Promise.all([
      sendOrderConfirmation(_emailPayload)
        .catch(e => console.error('[orders] confirmation email failed:', e.message)),
      sendOrderAdminNotification(_emailPayload)
        .catch(e => console.error('[orders] admin email failed:', e.message)),
    ]);

    // Stripe
    if (payment_method === 'stripe') {
      const key = (process.env.STRIPE_SECRET_KEY || '').replace(/[\r\n\s]/g, '');
      if (!key) return res.status(500).json({ error: 'STRIPE_SECRET_KEY manquante' });
      const BASE = 'https://boutique.info-experts.fr';
      const line_items = validItems.map(i => ({
        price_data: { currency: 'eur', product_data: { name: String(i.product_name).slice(0, 127) }, unit_amount: Math.round(i.price_eur * 100) },
        quantity: i.quantity,
      }));
      if (delivery_fee > 0) {
        line_items.push({ price_data: { currency: 'eur', product_data: { name: 'Livraison à domicile' }, unit_amount: 500 }, quantity: 1 });
      }

      // Remise : coupon Stripe one-off appliqué à la session
      const sessionParams = {
        mode: 'payment', line_items, locale: 'fr',
        customer_email: emailOk ? emailTrimmed : undefined,
        success_url: `${BASE}/success.html?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${BASE}/checkout.html`,
        metadata:    { order_id: order.id },
      };
      if (discount_eur > 0) {
        const sc = await stripeRequest('coupons', {
          amount_off: Math.round(discount_eur * 100),
          currency: 'eur',
          duration: 'once',
          name: `Code ${appliedCoupon.code}`,
        }, key);
        if (sc.status === 200 && sc.data.id) {
          sessionParams.discounts = [{ coupon: sc.data.id }];
        } else {
          console.error('[guest_checkout] Stripe coupon failed:', JSON.stringify(sc.data).slice(0, 200));
          return res.status(500).json({ error: 'Erreur application du code promo au paiement' });
        }
      }

      const result = await stripeRequest('checkout/sessions', sessionParams, key);
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
        ? { number: '+269 477 78 65', name: 'Info Experts', reference: orderNum }
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
