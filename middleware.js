export const config = { matcher: ['/((?!_next|api|favicon).*)'] };

const BOT_UA = /facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|applebot|googlebot|bingbot|duckduckbot/i;
const CANONICAL_HOST = 'boutique.info-experts.fr';
const VERCEL_HOST = 'alkamar-info.vercel.app';

export default function middleware(req) {
  const url = new URL(req.url);

  // Redirect alkamar-info.vercel.app → boutique.info-experts.fr (except /admin)
  if (url.hostname === VERCEL_HOST && !url.pathname.startsWith('/admin')) {
    const dest = new URL(req.url);
    dest.hostname = CANONICAL_HOST;
    dest.protocol = 'https:';
    return Response.redirect(dest.toString(), 308);
  }

  // Bots sur produit.html → /og/:id (rendu serveur OG)
  if (url.pathname === '/produit.html') {
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
