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
  '/api/contact':                       { limit:  3, window: 3600_000, msg: 'Trop de messages. Réessayez dans 1 heure.' },
  '/api/orders?action=guest_checkout': { limit:  5, window: 3600_000, msg: 'Trop de commandes. Réessayez dans 1 heure.' },
  '/api/orders?action=checkout':       { limit: 10, window:   60_000, msg: 'Trop de commandes. Réessayez dans 1 minute.' },
  '/api/orders':    { limit: 20, window: RL_WINDOW, msg: 'Trop de commandes. Réessayez dans 1 minute.' },
  '/api/customers': { limit: 15, window: RL_WINDOW, msg: 'Trop de requêtes client. Réessayez dans 1 minute.' },
  '/api/stats':     { limit:  5, window: RL_WINDOW, msg: 'Trop de requêtes stats. Réessayez dans 1 minute.' },
  '/api/coupons':   { limit: 10, window: RL_WINDOW, msg: 'Trop de vérifications coupon. Réessayez dans 1 minute.' },
  '/api/invoices':  { limit: 10, window: RL_WINDOW, msg: 'Trop de requêtes. Réessayez dans 1 minute.' },
  '/api/':          { limit: 80, window: RL_WINDOW, msg: 'Trop de requêtes API. Réessayez dans 1 minute.' },
};

function getRlConfig(path, search) {
  const full = path + (search ? search : '');
  for (const [key, cfg] of Object.entries(RL_LIMITS)) {
    if (key !== '/api/' && (full.startsWith(key) || path.startsWith(key))) return { ...cfg, key };
  }
  if (path.startsWith('/api/')) return { ...RL_LIMITS['/api/'], key: '/api/' };
  return null;
}

function checkRateLimit(ip, path, search) {
  const cfg = getRlConfig(path, search);
  if (!cfg) return { allowed: true };
  const bucketKey = `${ip}:${cfg.key}`;
  const now = Date.now();
  const win = cfg.window || RL_WINDOW;
  const e = _rl.get(bucketKey) || { n: 0, t: now };
  if (now - e.t > win) { e.n = 1; e.t = now; } else { e.n++; }
  _rl.set(bucketKey, e);
  if (_rl.size > 5000) { const iter = _rl.keys(); for (let i = 0; i < 1000; i++) _rl.delete(iter.next().value); }
  const retryAfter = Math.ceil((win - (now - e.t)) / 1000);
  return { allowed: e.n <= cfg.limit, count: e.n, limit: cfg.limit, msg: cfg.msg, retryAfter };
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
    const rl = checkRateLimit(ip, path, url.search);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: rl.msg, retry_after: rl.retryAfter }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rl.retryAfter),
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
