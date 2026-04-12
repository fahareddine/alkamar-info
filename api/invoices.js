// api/invoices.js
const { supabase } = require('./_lib/supabase');
const { requireRole } = require('./_lib/auth');
const { setCors } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireRole(req, 'admin', 'commercial');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { status, customer_id, limit = '50', offset = '0' } = req.query;

  let query = supabase
    .from('invoices')
    .select(`
      id, invoice_number, issued_at, due_at,
      total_eur, total_kmf, discount_eur, tax_rate, status, pdf_url,
      orders(id, status),
      customers(id, name, email, phone)
    `)
    .order('issued_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (status) query = query.eq('status', status);
  if (customer_id) query = query.eq('customer_id', customer_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data);
};
