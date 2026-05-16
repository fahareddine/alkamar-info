// api/_lib/cors.js
const ALLOWED_ORIGINS = [
  'https://boutique.info-experts.fr',
  'https://info-experts.fr',
  'https://www.info-experts.fr',
  'https://alkamar-info.vercel.app',
];

function setCors(res, req) {
  const origin = req?.headers?.origin || '';
  const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin);
  const allowed = ALLOWED_ORIGINS.includes(origin) || (process.env.NODE_ENV !== 'production' && isLocalhost);
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

module.exports = { setCors };
