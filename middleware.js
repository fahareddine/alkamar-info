export const config = { matcher: ['/produit.html'] };

const BOT_UA = /facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|applebot|googlebot|bingbot|duckduckbot/i;

export default function middleware(req) {
  const ua = req.headers.get('user-agent') || '';
  if (!BOT_UA.test(ua)) return;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return;

  const dest = new URL(`/og/${encodeURIComponent(id)}`, req.url);
  return Response.redirect(dest.toString(), 302);
}
