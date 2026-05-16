export const config = { matcher: ['/((?!_next|api|favicon).*)'] };

const BOT_UA = /facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|applebot|googlebot|bingbot|duckduckbot/i;
const CANONICAL_HOST = 'boutique.info-experts.fr';
const VERCEL_HOST = 'alkamar-info.vercel.app';

// Pages admin publiques (pas besoin d'auth)
const ADMIN_PUBLIC = ['/admin/', '/admin/login.html', '/admin/js/config.js', '/admin/js/auth.js'];

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
