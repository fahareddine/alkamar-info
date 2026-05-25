// scripts/apply-service-images.mjs
// Applique les photos Higgsfield (métisses comoriens musulmans) aux 5 services
// Usage : node scripts/apply-service-images.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync }  from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env   = Object.fromEntries(
  readFileSync(resolve(__dir, '../.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => l.split('=').map(s => s.trim()))
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const BASE = 'https://d8j0ntlcm91z4.cloudfront.net/user_3DMUOJYVD0AUSpzqtmYOyxjZ9KX/';

const UPDATES = [
  {
    slug: 'reparation-pc',
    image: BASE + 'hf_20260525_203805_83e54411-88e0-4635-bab9-13ad33cf9768.png',
  },
  {
    slug: 'maintenance-preventive',
    image: BASE + 'hf_20260525_203806_854238c7-28f4-4ba3-8b8d-7ae808ca9b81.png',
  },
  {
    slug: 'installation-reseau',
    image: BASE + 'hf_20260525_203809_25e14c76-ed16-4d2b-9c85-23fadff96dca.png',
  },
  {
    slug: 'creation-site-web',
    image: BASE + 'hf_20260525_203811_7ee1779e-a47b-4186-a59c-cce2df82df5d.png',
  },
  {
    slug: 'conseil-audit-it',
    image: BASE + 'hf_20260525_203814_4f8c624d-d6cc-489e-8c84-93a4fbd27796.png',
  },
];

async function run() {
  console.log('\n📸  Application photos services (Higgsfield)\n' + '─'.repeat(50));
  let ok = 0, fail = 0;
  for (const { slug, image } of UPDATES) {
    const { data, error } = await sb
      .from('products')
      .update({ image })
      .eq('slug', slug)
      .select('id, name');
    if (error) {
      console.error(`  ✗ ${slug} — ${error.message}`);
      fail++;
    } else if (!data?.length) {
      console.warn(`  ⚠ ${slug} — produit introuvable`);
      fail++;
    } else {
      console.log(`  ✓ ${data[0].name}`);
      ok++;
    }
  }
  console.log(`\n${'─'.repeat(50)}\n  ${ok} OK · ${fail} erreurs\n`);
}

run().catch(console.error);
