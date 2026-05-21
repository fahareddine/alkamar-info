// scripts/fix-digital-images.mjs — corriger les URLs d'images 404
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

// URLs Wikipedia vérifiées fonctionnelles (autorisées par CSP après fix)
const IMAGES = [
  { slug: 'windows-11-home-licence',                  image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Windows_logo_-_2021.svg/200px-Windows_logo_-_2021.svg.png' },
  { slug: 'windows-11-pro-licence',                   image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Windows_logo_-_2021.svg/200px-Windows_logo_-_2021.svg.png' },
  { slug: 'windows-10-pro-licence',                   image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Windows_logo_-_2021.svg/200px-Windows_logo_-_2021.svg.png' },
  { slug: 'microsoft-365-personnel-1an',              image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Microsoft_Office_logo_%282013%E2%80%932019%29.svg/200px-Microsoft_Office_logo_%282013%E2%80%932019%29.svg.png' },
  { slug: 'microsoft-365-famille-1an',                image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Microsoft_Office_logo_%282013%E2%80%932019%29.svg/200px-Microsoft_Office_logo_%282013%E2%80%932019%29.svg.png' },
  { slug: 'office-2024-famille-etudiant',             image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Microsoft_Office_logo_%282013%E2%80%932019%29.svg/200px-Microsoft_Office_logo_%282013%E2%80%932019%29.svg.png' },
  { slug: 'norton-360-standard-1an',                  image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Norton_logo.svg/200px-Norton_logo.svg.png' },
  { slug: 'kaspersky-standard-3-appareils-1an',       image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Kaspersky_logo_2019.svg/200px-Kaspersky_logo_2019.svg.png' },
  { slug: 'bitdefender-total-security-5-appareils',   image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Bitdefender_logo.svg/200px-Bitdefender_logo.svg.png' },
  { slug: 'eset-nod32-antivirus-1an',                 image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/ESET_logo.svg/200px-ESET_logo.svg.png' },
  { slug: 'canva-pro-mensuel',                        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Canva_icon_2021.svg/200px-Canva_icon_2021.svg.png' },
  { slug: 'canva-pro-annuel',                         image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Canva_icon_2021.svg/200px-Canva_icon_2021.svg.png' },
  { slug: 'nordvpn-standard-1an',                     image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/NordVPN_logo.svg/200px-NordVPN_logo.svg.png' },
  { slug: 'dropbox-plus-2to-1an',                     image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Dropbox_Icon.svg/200px-Dropbox_Icon.svg.png' },
  { slug: 'pack-essentiel-pc',                        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Windows_logo_-_2021.svg/200px-Windows_logo_-_2021.svg.png' },
];

async function run() {
  let ok = 0;
  for (const { slug, image } of IMAGES) {
    const { error } = await sb.from('products').update({ image }).eq('slug', slug);
    if (error) { console.error(`❌ ${slug}: ${error.message}`); }
    else { console.log(`✅ ${slug}`); ok++; }
  }
  console.log(`\n✅ ${ok}/${IMAGES.length} images corrigées`);
}
run().catch(e => { console.error(e.message); process.exit(1); });
