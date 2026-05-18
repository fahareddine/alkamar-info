// Test envoi email Resend — exécuter : node scripts/test-email.mjs
import { config } from 'dotenv';
config({ path: '.env.local' });

const { Resend } = await import('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const from    = process.env.EMAIL_FROM || 'Info Experts <noreply@info-experts.fr>';
const to      = process.env.EMAIL_TEST_RECIPIENT || 'defistylez@gmail.com';
const apiKey  = process.env.RESEND_API_KEY || '';

console.log('FROM :', from);
console.log('TO   :', to);
console.log('KEY  :', apiKey.slice(0, 10) + '...' + apiKey.slice(-4));

try {
  const result = await resend.emails.send({
    from,
    reply_to: 'contact@info-experts.fr',
    to: [to],
    subject: '[TEST] Email transactionnel — Boutique Info Experts',
    html: `<h1>Test email</h1><p>Si tu reçois cet email, le système fonctionne.</p><p>From: ${from}</p><p>Boutique Info Experts — boutique.info-experts.fr</p>`,
    text: 'Test email OK — Boutique Info Experts',
  });

  if (result.error) {
    console.error('❌ Erreur Resend:', result.error.message);
    process.exit(1);
  }
  console.log('✅ Email envoyé ! ID:', result.data?.id);
  console.log('→ Vérifie ta boîte:', to);
} catch (err) {
  console.error('❌ Exception:', err.message);
  process.exit(1);
}
