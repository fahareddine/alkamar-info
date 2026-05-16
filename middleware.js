export const config = { matcher: ['/((?!_next|favicon).*)'] };

const BOT_UA = /facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|applebot|googlebot|bingbot|duckduckbot/i;
const CANONICAL_HOST = 'boutique.info-experts.fr';
const VERCEL_HOST = 'alkamar-info.vercel.app';

// Pages admin publiques (pas besoin d'auth)
const ADMIN_PUBLIC = ['/admin/', '/admin/login.html', '/admin/js/config.js', '/admin/js/auth.js'];

// ── Rate limiting (in-memory, edge worker scope) ──────────────────────────────
// Note : persist dans l'instance edge courante. Pour une RL multi-nœuds
// robuste, configurer Vercel KV (RATE_LIMIT_KV_URL + RATE_LIMIT_KV_TOKEN).
const _rl = new Map();
const RL_WINDOW = 60_000; // 1 minute

const RL_LIMITS = {
  '/api/orders':    { limit: 20, msg: 'Trop de commandes. Réessayez dans 1 minute.' },
  '/api/customers': { limit: 15, msg: 'Trop de requêtes client. Réessayez dans 1 minute.' },
  '/api/stats':     { limit:  5, msg: 'Trop de requêtes stats. Réessayez dans 1 minute.' },
  '/api/coupons':   { limit: 10, msg: 'Trop de vérifications coupon. Réessayez dans 1 minute.' },
  '/api/invoices':  { limit: 10, msg: 'Trop de requêtes. Réessayez dans 1 minute.' },
  '/api/':          { limit: 80, msg: 'Trop de requêtes API. Réessayez dans 1 minute.' },
};

function getRlConfig(path) {
  for (const [prefix, cfg] of Object.entries(RL_LIMITS)) {
    if (prefix !== '/api/' && path.startsWith(prefix)) return cfg;
  }
  if (path.startsWith('/api/')) return RL_LIMITS['/api/'];
  return null;
}

function checkRateLimit(ip, path) {
  const cfg = getRlConfig(path);
  if (!cfg) return { allowed: true };
  const key = `${ip}:${path.replace(/\/[0-9a-f-]{36}/g, '/:id').split('/').slice(0,4).join('/')}`;
  const now = Date.now();
  const e = _rl.get(key) || { n: 0, t: now };
  if (now - e.t > RL_WINDOW) { e.n = 1; e.t = now; } else { e.n++; }
  _rl.set(key, e);
  // Nettoyage Map tous les 5000 entrées pour éviter fuite mémoire
  if (_rl.size > 5000) { const iter = _rl.keys(); for (let i = 0; i < 1000; i++) _rl.delete(iter.next().value); }
  return { allowed: e.n <= cfg.limit, count: e.n, limit: cfg.limit, msg: cfg.msg };
}

function checkAdminCookie(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)admin_token=([^;]+)/);
  const rawToken = match ? decodeURIComponent(match[1]) : null;
  if (!rawToken) return false;
  try {
    const parts = rawToken.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return false;
    if (payload.role !== 'authenticated') return false;
    return true;
  } catch { return false; }
}

export default function middleware(req) {
  const url = new URL(req.url);
  const path = url.pathname;

  // ── Rate limiting API ───────────────────────────────────────────────────────
  if (path.startsWith('/api/') && req.method !== 'OPTIONS') {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')
            || 'unknown';
    const rl = checkRateLimit(ip, path);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: rl.msg, retry_after: 60 }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': '0',
        },
      });
    }
  }

  // ── Protection admin côté serveur ──────────────────────────────────────────
  if (path.startsWith('/admin/') || path === '/admin') {
    const isPublic = ADMIN_PUBLIC.some(p => path === p || path.startsWith('/admin/css/'));
    if (!isPublic && !checkAdminCookie(req)) {
      return Response.redirect(new URL('/admin/login.html', req.url), 302);
    }
  }

  // ── Redirect alkamar-info.vercel.app → boutique.info-experts.fr ────────────
  if (url.hostname === VERCEL_HOST && !path.startsWith('/admin')) {
    const dest = new URL(req.url);
    dest.hostname = CANONICAL_HOST;
    dest.protocol = 'https:';
    return Response.redirect(dest.toString(), 308);
  }

  // ── Bots sur produit.html → /og/:id (rendu serveur OG) ─────────────────────
  if (path === '/produit.html') {
    const ua = req.headers.get('user-agent') || '';
    if (BOT_UA.test(ua)) {
      const id = url.searchParams.get('id');
      if (id) {
        const dest = new URL(`/og/${encodeURIComponent(id)}`, req.url);
        return Response.redirect(dest.toString(), 302);
      }
    }
  }
}
