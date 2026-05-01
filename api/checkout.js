// api/checkout.js — Stripe Checkout Session (mode TEST)
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_BASE_URL || 'https://alkamar-info.vercel.app';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Panier vide' });
  }

  try {
    const line_items = items.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: (item.name || 'Produit').slice(0, 127),
          description: item.brand || undefined,
          images: item.main_image_url
            ? [item.main_image_url.startsWith('http') ? item.main_image_url : undefined].filter(Boolean)
            : [],
        },
        unit_amount: Math.round(Math.max(0, (item.price_eur || 0)) * 100),
      },
      quantity: Math.max(1, item.qty || 1),
    })).filter(li => li.price_data.unit_amount > 0);

    if (!line_items.length) {
      return res.status(400).json({ error: 'Tous les produits ont un prix invalide' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: `${BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${BASE_URL}/cancel.html`,
      locale: 'fr',
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      custom_text: {
        submit: {
          message: '🔒 Mode TEST Stripe — carte test: 4242 4242 4242 4242 · exp 12/28 · CVC 123',
        },
      },
      metadata: {
        source: 'alkamar-info',
        env: 'test',
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[checkout] Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
