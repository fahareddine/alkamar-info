// Test envoi email via API Resend (https natif) — exécuter : node scripts/test-email.mjs
import { config } from 'dotenv';
import https from 'https';
config({ path: '.env.local' });

const apiKey  = process.env.RESEND_API_KEY || '';
const from    = process.env.EMAIL_FROM || 'Info Experts <noreply@info-experts.fr>';
const to      = process.env.EMAIL_TEST_RECIPIENT || 'defistylez@gmail.com';

console.log('FROM :', from);
console.log('TO   :', to);
console.log('KEY  :', apiKey.slice(0, 10) + '...' + apiKey.slice(-4));

const body = JSON.stringify({
  from, reply_to: 'contact@info-experts.fr', to: [to],
  subject: '[TEST] Email transactionnel — Boutique Info Experts',
  html: `<h1>Test email</h1><p>Système email fonctionne correctement.</p><p>From: ${from}</p>`,
  text: 'Test email OK — Boutique Info Experts',
});

const req = https.request({
  hostname: 'api.resend.com', path: '/emails', method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const data = JSON.parse(d);
    if (res.statusCode >= 400) { console.error('❌ Erreur Resend:', res.statusCode, data); process.exit(1); }
    console.log('✅ Email envoyé ! ID:', data.id);
    console.log('→ Vérifie ta boîte:', to);
  });
});
req.on('error', e => { console.error('❌ Exception:', e.message); process.exit(1); });
req.write(body);
req.end();
